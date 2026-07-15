import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import httpx
import paramiko
import yaml
from fastapi import APIRouter, HTTPException, Query, status

from app.audit import log_audit
from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/rules", tags=["rules"])

CATEGORY_PREFIX: Dict[str, str] = {
    "app_": "应用告警",
    "db_": "数据库告警",
    "host_": "服务器告警",
    "component_": "平台组件告警",
    "perf_": "性能告警",
}


def _categorize(filename: str) -> str:
    for prefix, cat in CATEGORY_PREFIX.items():
        if filename.startswith(prefix):
            return cat
    return "其他"


def _list_files_ssh() -> List[dict]:
    """通过 SSH 读取远程告警规则文件"""
    files = []
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(settings.ssh_host, port=settings.ssh_port,
                    username=settings.ssh_user, password=settings.ssh_password, timeout=10)
        sftp = ssh.open_sftp()
        for entry in sorted(sftp.listdir_attr(settings.alerts_dir), key=lambda x: x.filename):
            if entry.filename.endswith(".yml"):
                fpath = f"{settings.alerts_dir}/{entry.filename}"
                with sftp.open(fpath, "r") as f:
                    content = f.read().decode("utf-8")
                rules = _parse_yaml(content, entry.filename)
                files.append({
                    "filename": entry.filename,
                    "category": _categorize(entry.filename),
                    "size": entry.st_size,
                    "mtime": entry.st_mtime,
                    "content": content,
                    "rules": rules,
                })
        sftp.close()
        ssh.close()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ssh_read_failed: {e}")
    return files


def _parse_yaml(content: str, filename: str) -> List[dict]:
    try:
        data = yaml.safe_load(content)
    except Exception:
        return []
    if not data or "groups" not in data:
        return []
    category = _categorize(filename)
    results = []
    for group in data["groups"]:
        for rule in group.get("rules", []):
            results.append({
                "name": rule.get("alert", rule.get("record", "")),
                "expr": rule.get("expr", ""),
                "for": rule.get("for", ""),
                "severity": (rule.get("labels") or {}).get("severity", ""),
                "summary": (rule.get("annotations") or {}).get("summary", ""),
                "group": group.get("name", ""),
                "file": filename,
                "category": category,
            })
    return results


@router.get("/parsed")
async def list_parsed_rules() -> List[dict]:
    """读取 MySQL alert_rules 表"""
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, rule_name, category, expr, severity, duration, summary, file_name, operator, strategy_id, custom_notify, created_at, status FROM alert_rules WHERE status != -1 ORDER BY id")
            rows = cur.fetchall()
            cur.close()
            return [
                {"name": r[1], "expr": r[3], "for": r[5] or "", "severity": r[4] or "", "summary": r[6] or "",
                 "group": r[7] or "", "file": r[7] or "", "category": r[2] or "其他",
                 "strategy_id": r[9], "custom_notify": r[10], "status": r[12]}
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.get("/preview")
async def preview_query(query: str = Query(...)) -> dict:
    """执行 PromQL 查询并返回结果"""
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/query", params={"query": query})
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="prometheus_unreachable")


@router.get("/active")
async def list_active_categorized() -> List[dict]:
    """从 Prometheus API 拉取活跃告警, 按关键词规则分类, 同步写入 alert_records"""
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/alerts")
            resp.raise_for_status()
            alerts = resp.json().get("data", {}).get("alerts", [])
    except Exception:
        return []

    # 同步写入 MySQL（后台任务在无事件循环环境下不稳定）
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            for a in alerts:
                labels = a.get("labels") or {}
                annots = a.get("annotations") or {}
                fingerprint = str(labels.get("alertname","")) + "|" + str(labels.get("instance","")) + "|" + str(labels.get("severity",""))
                cur.execute(
                    "SELECT id FROM alert_records WHERE fingerprint=%s", (fingerprint,))
                existing = cur.fetchone()
                if existing:
                    if state == "resolved":
                        cur.execute("UPDATE alert_records SET status='resolved', ends_at=%s WHERE id=%s",
                                    (datetime.now(), existing[0]))
                else:
                    if state == "firing":
                        at = a.get("activeAt", "")
                        if '.' in str(at):
                            at = str(at)[:26]  # strip nanoseconds to 6 digits
                        cur.execute(
                            "INSERT INTO alert_records (alert_name, instance, severity, status, department, project, env, service, summary, labels, starts_at, fingerprint, source) "
                            "VALUES (%s,%s,%s,'firing',%s,%s,%s,%s,%s,%s,%s,%s,'prometheus')",
                            (alert_name, instance, severity,
                             labels.get("department", ""), labels.get("project", ""), labels.get("env", ""),
                             labels.get("service", ""), annots.get("summary", ""),
                             json.dumps(labels, ensure_ascii=False),
                             at, fingerprint))
            cur.close()
    except Exception:
        pass

    def assign_category(alert: dict) -> str:
        job = (alert.get("labels") or {}).get("job", "")
        name = (alert.get("labels") or {}).get("alertname", "")
        kw = (job + " " + name).lower()
        if any(w in kw for w in ["mysql", "db_", "database", "pmm"]):
            return "数据库告警"
        if any(w in kw for w in ["node", "host_", "disk", "cpu", "mem", "load", "server"]):
            return "服务器告警"
        if any(w in kw for w in ["prometheus", "kafka", "webhook", "component", "debezium", "alertmanager"]):
            return "平台组件告警"
        if any(w in kw for w in ["perf", "latency", "slow", "high_", "duration"]):
            return "性能告警"
        return "应用告警"

    results = []
    for a in alerts:
        labels = a.get("labels") or {}
        annots = a.get("annotations") or {}
        results.append({
            "name": labels.get("alertname", ""),
            "severity": labels.get("severity", ""),
            "instance": labels.get("instance", ""),
            "job": labels.get("job", ""),
            "service": labels.get("service", ""),
            "region": labels.get("region", ""),
            "department": labels.get("department", ""),
            "project": labels.get("project", ""),
            "env": labels.get("env", ""),
            "summary": annots.get("summary", ""),
            "state": a.get("state", ""),
            "activeAt": a.get("activeAt", ""),
            "category": assign_category(a),
        })
    return results


@router.get("/files")
async def list_rule_files() -> List[dict]:
    local_dir = Path(settings.alerts_dir)
    if local_dir.is_dir():
        files = []
        for f in sorted(local_dir.glob("*.yml")):
            files.append({
                "filename": f.name,
                "category": _categorize(f.name),
                "size": f.stat().st_size,
                "mtime": os.path.getmtime(f),
                "content": f.read_text(encoding="utf-8"),
            })
        return files
    if settings.ssh_host:
        return _list_files_ssh()
    raise HTTPException(status_code=404, detail="alerts dir not found and no ssh configured")


@router.get("/files/{filename}")
async def get_rule_file(filename: str) -> dict:
    local = Path(settings.alerts_dir) / filename
    if local.is_file():
        return {"filename": filename, "category": _categorize(filename), "content": local.read_text(encoding="utf-8")}
    if settings.ssh_host:
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            fpath = f"{settings.alerts_dir}/{filename}"
            with sftp.open(fpath, "r") as f:
                content = f.read().decode("utf-8")
            sftp.close(); ssh.close()
            return {"filename": filename, "category": _categorize(filename), "content": content}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"ssh_failed: {e}")
    raise HTTPException(status_code=404, detail="file not found")


@router.post("/files/{filename}")
async def save_rule_file(filename: str, body: dict) -> dict:
    """MySQL 保存告警规则"""
    content = body.get("content", "")
    category = body.get("category", "其他")
    operator = body.get("operator", "admin")
    strategy_id = body.get("strategy_id")
    custom_notify = body.get("custom_notify", "")
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")
    try:
        data = yaml.safe_load(content)
        if not data or "groups" not in data:
            raise HTTPException(status_code=400, detail="invalid yaml")
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            for group in data["groups"]:
                for rule in group.get("rules", []):
                    alert_name = rule.get("alert", "")
                    # 仅检查未删除的同名规则
                    cur.execute("SELECT id FROM alert_rules WHERE rule_name=%s AND status != -1", (alert_name,))
                    if cur.fetchone():
                        raise HTTPException(status_code=409, detail=f"规则名 {alert_name} 已存在")
                    cur.execute(
                        "INSERT INTO alert_rules (rule_name, category, expr, duration, severity, summary, file_name, operator, strategy_id, custom_notify) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (rule.get("alert", ""), category,
                         rule.get("expr", ""), rule.get("for", ""),
                         (rule.get("labels") or {}).get("severity", "warning"),
                         (rule.get("annotations") or {}).get("summary", ""),
                         filename, operator, strategy_id or None, custom_notify or None),
                    )
            cur.close()
        # 同步写入服务器 YAML 文件
        _write_file(filename, content)
        log_audit(operator, "rules", "create", f"file={filename}")
        return {"status": "saved", "filename": filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reload")
async def reload_prometheus() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.post(f"{settings.prometheus_url}/-/reload")
            if resp.status_code < 300:
                return {"status": "ok"}
            return {"status": "warning", "detail": resp.text[:200]}
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="prometheus_unreachable")


@router.post("/update")
async def update_rule(body: dict) -> dict:
    """MySQL 更新告警规则 + 同步服务器 YAML"""
    old_name = body.get("oldRuleName", "")
    new_name = body.get("newName", "")
    expr = body.get("expr", "")
    duration = body.get("for", "")
    severity = body.get("severity", "warning")
    summary = body.get("summary", "")
    strategy_id = body.get("strategy_id")
    custom_notify = body.get("custom_notify", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            # 获取当前文件名
            cur.execute("SELECT file_name FROM alert_rules WHERE rule_name=%s", (old_name,))
            row = cur.fetchone()
            old_file = row[0] if row else ""
            # 生成新文件名
            if old_file:
                parts = old_file.split("_", 1)
                prefix = parts[0] + "_" if len(parts) > 1 else ""
                new_file = prefix + new_name.lower().replace(" ", "_") + ".yml" if " " not in new_name else prefix + new_name.lower().replace(" ", "_").replace("__", "_") + ".yml"
                # 清理非ASCII
                new_file = "".join(c for c in new_file if c.isalnum() or c in "._-")
            else:
                new_file = new_name.lower().replace(" ", "_") + ".yml"
            cur.execute("UPDATE alert_rules SET rule_name=%s, expr=%s, duration=%s, severity=%s, summary=%s, strategy_id=%s, custom_notify=%s WHERE rule_name=%s",
                        (new_name, expr, duration, severity, summary, strategy_id or None, custom_notify or None, old_name))
            cur.close()
        # 同步服务器 YAML
        new_yaml = f"groups:\n  - name: {new_file.replace('.yml', '')}\n    rules:\n      - alert: {new_name}\n        expr: {expr}\n        for: {duration}\n        labels:\n          severity: {severity}\n        annotations:\n          summary: \"{summary}\"\n"
        if old_file and old_file != new_file:
            _move_to_disabled(old_file)
        _write_file(new_file, new_yaml)
        if old_file and old_file != new_file:
            log_audit(body.get("operator", "system"), "rules", "update", f"old={old_name} file={old_file}->{new_file}")
        return {"status": "updated", "filename": new_file}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _write_file(filename: str, content: str) -> None:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")
    local = Path(settings.alerts_dir) / filename
    if local.parent.is_dir():
        local.write_text(content, encoding="utf-8")
        return
    if settings.ssh_host:
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            with sftp.open(f"{settings.alerts_dir}/{filename}", "w") as f:
                f.write(content.encode("utf-8"))
            sftp.close(); ssh.close()
            return
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"ssh_write_failed: {e}")
    raise HTTPException(status_code=404, detail="cannot write: no target")


def _move_to_disabled(filename: str) -> str:
    """将规则文件移至 alerts_disabled 目录（加时间戳后缀避免覆盖），返回新文件名"""
    if ".." in filename or "/" in filename:
        return filename
    try:
        if settings.ssh_host:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            try:
                sftp.mkdir(f"{settings.alerts_dir}_disabled")
            except Exception:
                pass
            ts = datetime.now().strftime("%Y%m%d%H%M%S")
            name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
            dst_name = f"{name}_{ts}.{ext}" if ext else f"{name}_{ts}"
            src = f"{settings.alerts_dir}/{filename}"
            dst = f"{settings.alerts_dir}_disabled/{dst_name}"
            try:
                sftp.rename(src, dst)
            except IOError:
                pass
            sftp.close(); ssh.close()
            return dst_name
    except Exception:
        pass
    return filename


def _move_to_active(filename: str) -> None:
    """将规则文件从 alerts_disabled 移回 alerts 目录"""
    if ".." in filename or "/" in filename:
        return
    try:
        if settings.ssh_host:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            src = f"{settings.alerts_dir}_disabled/{filename}"
            dst = f"{settings.alerts_dir}/{filename}"
            try:
                sftp.rename(src, dst)
            except IOError:
                pass
            sftp.close(); ssh.close()
    except Exception:
        pass


@router.post("/delete")
async def delete_rule(body: dict) -> dict:
    rule_name = body.get("ruleName", "")
    try:
        # 获取文件名用于移动
        file_name = ""
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT file_name FROM alert_rules WHERE rule_name=%s", (rule_name,))
            row = cur.fetchone()
            if row: file_name = row[0]
            cur.close()
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE alert_rules SET status=-1 WHERE rule_name=%s", (rule_name,))
            cur.close()
        # 移动文件到 disabled 目录，同步更新文件名
        if file_name:
            dst = _move_to_disabled(file_name)
            with get_db(readonly=False) as conn:
                cur = conn.cursor()
                cur.execute("UPDATE alert_rules SET file_name=%s WHERE rule_name=%s AND status=-1", (dst, rule_name))
                cur.close()
        log_audit("system", "rules", "delete", f"rule={rule_name} file={file_name}")
        return {"status": "deleted", "rule": rule_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disable")
async def disable_rule(body: dict) -> dict:
    rule_name = body.get("ruleName", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT status, file_name, id FROM alert_rules WHERE rule_name=%s AND status != -1", (rule_name,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="rule_not_found")
            cur_status, file_name, rid = row
            new_status = 0 if cur_status == 1 else 1
            new_file = file_name
            # 禁用：移动文件到 disabled 目录
            if new_status == 0 and file_name:
                new_file = _move_to_disabled(file_name)
            # 启用：移回文件（从时间戳文件名恢复）
            if new_status == 1 and file_name:
                _move_to_active(file_name)
                # 恢复原始文件名
                new_file = file_name.rsplit("_", 1)[0] + ".yml" if "_" in file_name else file_name
            cur.execute("UPDATE alert_rules SET status=%s, file_name=%s WHERE id=%s", (new_status, new_file, rid))
            cur.close()
        return {"status": "disabled" if new_status == 0 else "enabled", "rule": rule_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _read_file(filename: str) -> str:
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")
    local = Path(settings.alerts_dir) / filename
    if local.is_file():
        return local.read_text(encoding="utf-8")
    if settings.ssh_host:
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            with sftp.open(f"{settings.alerts_dir}/{filename}", "r") as f:
                content = f.read().decode("utf-8")
            sftp.close(); ssh.close()
            return content
        except Exception:
            raise HTTPException(status_code=404, detail="file not found via ssh")
    raise HTTPException(status_code=404, detail="file not found")
