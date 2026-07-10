import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import httpx
import paramiko
import yaml
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

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
    """读取全部 YAML 告警规则文件，解析每条规则按分类返回"""
    local_dir = Path(settings.alerts_dir)
    if local_dir.is_dir():
        all_rules = []
        for f in sorted(local_dir.glob("*.yml")):
            try:
                all_rules.extend(_parse_yaml(f.read_text(encoding="utf-8"), f.name))
            except Exception:
                continue
        return all_rules
    if settings.ssh_host:
        files = _list_files_ssh()
        all_rules = []
        for f in files:
            all_rules.extend(f.get("rules", []))
        return all_rules
    raise HTTPException(status_code=404, detail="alerts dir not found and no ssh configured")


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
    """从 Prometheus API 拉取活跃告警, 按关键词规则分类"""
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/alerts")
            resp.raise_for_status()
            alerts = resp.json().get("data", {}).get("alerts", [])
    except Exception:
        return []

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
    content = body.get("content", "")
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")
    local = Path(settings.alerts_dir) / filename
    if local.parent.is_dir():
        local.write_text(content, encoding="utf-8")
        return {"status": "saved", "filename": filename}
    if settings.ssh_host:
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(settings.ssh_host, port=settings.ssh_port, username=settings.ssh_user, password=settings.ssh_password, timeout=10)
            sftp = ssh.open_sftp()
            fpath = f"{settings.alerts_dir}/{filename}"
            with sftp.open(fpath, "w") as f:
                f.write(content.encode("utf-8"))
            sftp.close(); ssh.close()
            return {"status": "saved", "filename": filename}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"ssh_save_failed: {e}")
    raise HTTPException(status_code=404, detail="cannot save: no target")


@router.post("/reload")
async def reload_prometheus() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.post(f"{settings.prometheus_url}/-/reload")
            if resp.status_code < 500:
                return {"status": "ok"}
            raise HTTPException(status_code=502, detail="reload failed")
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="prometheus_unreachable")


@router.post("/update")
async def update_rule(body: dict) -> dict:
    """修改一条告警规则的名称/表达式/持续时间/级别/描述"""
    filename = body.get("filename", "")
    group_name = body.get("groupName", "")
    old_name = body.get("oldRuleName", "")
    new_name = body.get("newName", "")
    expr = body.get("expr", "")
    duration = body.get("for", "")
    severity = body.get("severity", "warning")
    summary = body.get("summary", "")

    content = _read_file(filename)
    data = yaml.safe_load(content)
    if not data or "groups" not in data:
        raise HTTPException(status_code=400, detail="invalid rules file")

    found = False
    for group in data["groups"]:
        if group.get("name") != group_name:
            continue
        for rule in group.get("rules", []):
            if rule.get("alert") == old_name:
                rule["alert"] = new_name
                rule["expr"] = expr
                if duration:
                    rule["for"] = duration
                elif "for" in rule:
                    del rule["for"]
                if "labels" not in rule:
                    rule["labels"] = {}
                rule["labels"]["severity"] = severity
                if "annotations" not in rule:
                    rule["annotations"] = {}
                rule["annotations"]["summary"] = summary
                found = True
                break

    if not found:
        raise HTTPException(status_code=404, detail="rule not found")

    _write_file(filename, yaml.dump(data, default_flow_style=False, allow_unicode=True))
    return {"status": "updated"}


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
    """软删除一条告警规则：从原文件移除，追加到 _disabled.yml"""
    filename = body.get("filename", "")
    rule_name = body.get("ruleName", "")
    group_name = body.get("groupName", "")
    reason = body.get("reason", "")
    deleted_by = body.get("deletedBy", "unknown")
    now = datetime.now(timezone.utc).isoformat()

    # 读取原文件
    content = _read_file(filename)
    data = yaml.safe_load(content)
    if not data or "groups" not in data:
        raise HTTPException(status_code=400, detail="invalid rules file")

    removed_rule = None
    new_groups = []
    for group in data["groups"]:
        if group.get("name") == group_name:
            new_rules = [r for r in group.get("rules", []) if r.get("alert") != rule_name]
            if len(new_rules) < len(group["rules"]):
                removed_rule = next(r for r in group["rules"] if r.get("alert") == rule_name)
            if new_rules:
                new_groups.append({**group, "rules": new_rules})
        else:
            new_groups.append(group)

    if not removed_rule:
        raise HTTPException(status_code=404, detail="rule not found")

    # 写回原文件
    data["groups"] = new_groups
    _write_file(filename, yaml.dump(data, default_flow_style=False, allow_unicode=True))

    # 追加到 _disabled.yml
    deleted_entry = {
        "metadata": {"deleted_at": now, "deleted_by": deleted_by, "reason": reason},
        "original_file": filename,
        "original_group": group_name,
        "rule": dict(removed_rule),
    }
    try:
        disabled = yaml.safe_load(_read_file("_disabled.yml")) or {"deleted_rules": []}
    except Exception:
        disabled = {"deleted_rules": []}
    disabled["deleted_rules"].append(deleted_entry)
    _write_file("_disabled.yml", yaml.dump(disabled, default_flow_style=False, allow_unicode=True))

    return {"status": "deleted", "rule": rule_name}


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
