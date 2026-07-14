import asyncio
import time
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


def _node_list():
    return [u.strip() for u in settings.webhook_nodes.split(",") if u.strip()]


async def _probe_node(url: str) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as c:
            r = await c.get(f"{url}/health")
            data = r.json() if r.status_code < 500 else {}
            return {
                "url": url,
                "up": r.status_code < 500,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "redis_ok": data.get("redis_ok", False),
                "kafka_ok": data.get("kafka_ok", False),
                "mail_ok": data.get("mail_ok", False),
                "lark_ok": data.get("lark_ok", False),
                "vm_ok": data.get("vm_ok", False),
                "stats": data.get("stats", {}),
                "timestamp": data.get("timestamp", ""),
            }
    except Exception:
        return {"url": url, "up": False, "latency_ms": None}


@router.get("/health")
async def health() -> dict:
    start = time.monotonic()
    nodes = _node_list()
    tasks = [_probe_node(u) for u in nodes]
    results = await asyncio.gather(*tasks)
    any_up = any(r["up"] for r in results)
    return {
        "status": "up" if any_up else "down",
        "latency_ms": int((time.monotonic() - start) * 1000),
        "nodes": results,
    }


@router.get("/status")
async def status() -> dict:
    results = await asyncio.gather(*[_probe_node(u) for u in _node_list()])
    # Return the first healthy node's full data, plus all nodes
    primary = next((r for r in results if r["up"]), results[0] if results else {})
    return {**primary, "nodes": results}


class TestAlert(BaseModel):
    receiver: str = "email"
    summary: str = "[测试] 平台手动测试告警"
    severity: str = "warning"


@router.post("/test")
async def test_alert(body: TestAlert) -> dict:
    for url in _node_list():
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as c:
                r = await c.post(f"{url}/test", json=body.dict())
                if r.status_code < 400:
                    return {"status": "sent", "node": url}
        except Exception:
            continue
    raise HTTPException(status_code=502, detail="all webhook nodes unreachable")


class ResendAlert(BaseModel):
    fingerprint: str
    receiver: str = "all"


@router.post("/resend")
async def resend_alert(body: ResendAlert) -> dict:
    for url in _node_list():
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as c:
                r = await c.post(f"{url}/resend", json=body.dict())
                if r.status_code < 400:
                    return {"status": "resent", "node": url}
        except Exception:
            continue
    raise HTTPException(status_code=502, detail="all webhook nodes unreachable")


@router.get("/push-log")
async def list_push_log(limit: int = Query(20, ge=1, le=100)) -> list:
    """读取最近 N 条 Webhook 推送记录"""
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT alert_name, instance, channel, status, summary, alert_reason, recipient, created_at FROM webhook_push_log ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
            cur.close()
            return [
                {"alertName": r[0], "instance": r[1], "channel": r[2], "status": r[3], "summary": r[4], "alertReason": r[5] or r[4], "recipient": r[6], "createdAt": str(r[7])}
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")
