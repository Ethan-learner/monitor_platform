import time
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


@router.get("/health")
async def health() -> dict:
    """检查 webhook 服务存活"""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.webhook_url}/health")
            latency = int((time.monotonic() - start) * 1000)
            return {
                "status": "up" if r.status_code < 500 else "down",
                "latencyMs": latency,
                "code": r.status_code,
            }
    except Exception:
        return {"status": "down", "latencyMs": None, "code": None}


@router.get("/status")
async def status() -> dict:
    """从 webhook 服务获取 /health 存活状态"""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            r = await client.get(f"{settings.webhook_url}/health")
            latency = int((time.monotonic() - start) * 1000)
            if r.status_code < 500:
                return {"latencyMs": latency, **r.json()}
            raise HTTPException(status_code=502, detail="webhook_unreachable")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"webhook_error: {e}")


class TestAlert(BaseModel):
    receiver: str = "email"
    summary: str = "[测试] 平台手动测试告警"
    severity: str = "warning"


@router.post("/test")
async def test_alert(body: TestAlert) -> dict:
    """向 webhook 发送测试告警"""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(f"{settings.webhook_url}/test", json=body.dict())
            latency = int((time.monotonic() - start) * 1000)
            if r.status_code < 400:
                return {"status": "sent", "latencyMs": latency, "data": r.json()}
            raise HTTPException(status_code=502, detail="webhook_rejected")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"webhook_error: {e}")


class ResendAlert(BaseModel):
    fingerprint: str
    receiver: str = "all"


@router.post("/resend")
async def resend_alert(body: ResendAlert) -> dict:
    """重发指定告警"""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(f"{settings.webhook_url}/resend", json=body.dict())
            latency = int((time.monotonic() - start) * 1000)
            if r.status_code < 400:
                return {"status": "resent", "latencyMs": latency, "data": r.json()}
            raise HTTPException(status_code=502, detail="resend_failed")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"webhook_error: {e}")
