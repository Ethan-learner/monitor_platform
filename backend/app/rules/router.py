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
                fingerprint = a.get("fingerprint", "")
                state = a.get("state", "firing")
                alert_name = labels.get("alertname", "")
                instance = labels.get("instance", "")
                severity = labels.get("severity", "")
                if not alert_name:
                    continue
                cur.execute(
                    "SELECT id FROM alert_records WHERE fingerprint=%s AND alert_name=%s AND instance=%s AND severity=%s",
                    (fingerprint, alert_name, instance, severity))
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
                    cur.execute(
                        "INSERT INTO alert_rules (rule_name, category, expr, duration, severity, summary, file_name, operator, strategy_id, custom_notify) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (rule.get("alert", ""), category,
                         rule.get("expr", ""), rule.get("for", ""),
                         (rule.get("labels") or {}).get("severity", "warning"),
                         (rule.get("annotations") or {}).get("summary", ""),
                         filename, operator, strategy_id or None, custom_notify or None),
                    )
            cur.close()
            return {"status": "saved", "filename": filename}
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
    """MySQL 更新告警规则"""
    old_name = body.get("oldRuleName", "")
    new_name = body.get("newName", "")
    expr = body.get("expr", "")
    duration = body.get("for", "")
    severity = body.get("severity", "warning")
    summary = body.get("summary", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE alert_rules SET rule_name=%s, expr=%s, duration=%s, severity=%s, summary=%s WHERE rule_name=%s",
                        (new_name, expr, duration, severity, summary, old_name))
            cur.close()
            return {"status": "updated"}
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


@router.post("/delete")
async def delete_rule(body: dict) -> dict:
    rule_name = body.get("ruleName", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE alert_rules SET status=-1 WHERE rule_name=%s", (rule_name,))
            cur.close()
            return {"status": "deleted", "rule": rule_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disable")
async def disable_rule(body: dict) -> dict:
    rule_name = body.get("ruleName", "")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT status FROM alert_rules WHERE rule_name=%s", (rule_name,))
            row = cur.fetchone()
            new_status = 0 if (row and row[0] == 1) else 1
            cur.execute("UPDATE alert_rules SET status=%s WHERE rule_name=%s", (new_status, rule_name))
            cur.close()
            return {"status": "disabled" if new_status == 0 else "enabled", "rule": rule_name}
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
