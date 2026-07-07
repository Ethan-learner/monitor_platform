import httpx
from fastapi import APIRouter, HTTPException, status

from app.config import settings

router = APIRouter(prefix="/api/prometheus", tags=["prometheus"])


@router.get("/targets")
async def list_targets(state: str = "active") -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/targets", params={"state": state})
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="prometheus_unreachable")


@router.get("/alerts")
async def list_alerts() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/alerts")
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="prometheus_unreachable")


@router.get("/rules")
async def list_rules() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"{settings.prometheus_url}/api/v1/rules")
            resp.raise_for_status()
            return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="prometheus_unreachable")
