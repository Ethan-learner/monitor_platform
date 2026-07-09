import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
async def list_alerts(active: bool = Query(default=True)) -> list:
    params = {"active": "true" if active else "false"}
    try:
        async with httpx.AsyncClient(timeout=5.0).aget(
            f"{settings.alertmanager_url}/api/v2/alerts",
            params=params,
        ) as resp:
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="alertmanager_unreachable")


@router.get("/alerts/silences")
async def list_silences() -> list:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.alertmanager_url}/api/v2/silences")
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.get("/alerts/silences/{sid}")
async def get_silence(sid: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.alertmanager_url}/api/v2/silence/{sid}")
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.post("/alerts/silences")
async def create_silence(body: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.post(f"{settings.alertmanager_url}/api/v2/silences", json=body)
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.delete("/alerts/silences/{sid}")
async def expire_silence(sid: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.delete(f"{settings.alertmanager_url}/api/v2/silence/{sid}")
            if resp.status_code < 300:
                return {"status": "expired"}
            raise HTTPException(status_code=502, detail="expire_failed")
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")
