import os
from pathlib import Path
from typing import Dict, List

import httpx
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


def _parse_yaml(content: str, filename: str) -> List[dict]:
    """解析 YAML 告警规则文件,返回每条规则的结构化数据"""
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
    """读取全部 YAML 文件, 解析每条告警规则返回"""
    alerts_dir = Path(settings.alerts_dir)
    if not alerts_dir.is_dir():
        return []
    all_rules = []
    for f in sorted(alerts_dir.glob("*.yml")):
        try:
            content = f.read_text(encoding="utf-8")
            rules = _parse_yaml(content, f.name)
            all_rules.extend(rules)
        except Exception:
            continue
    return all_rules


@router.get("/files")
async def list_rule_files() -> List[dict]:
    alerts_dir = Path(settings.alerts_dir)
    if not alerts_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"alerts dir not found: {settings.alerts_dir}")
    files = []
    for f in sorted(alerts_dir.glob("*.yml")):
        filename = f.name
        files.append({
            "filename": filename,
            "category": _categorize(filename),
            "size": f.stat().st_size,
            "mtime": os.path.getmtime(f),
            "content": f.read_text(encoding="utf-8"),
        })
    return files


@router.get("/files/{filename}")
async def get_rule_file(filename: str) -> dict:
    fpath = Path(settings.alerts_dir) / filename
    if not fpath.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    return {
        "filename": filename,
        "category": _categorize(filename),
        "content": fpath.read_text(encoding="utf-8"),
    }


@router.post("/files/{filename}")
async def save_rule_file(filename: str, body: dict) -> dict:
    content = body.get("content", "")
    fpath = Path(settings.alerts_dir) / filename
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="invalid filename")
    fpath.write_text(content, encoding="utf-8")
    return {"status": "saved", "filename": filename}


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
