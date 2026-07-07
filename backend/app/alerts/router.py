import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
async def list_alerts(active: bool = Query(default=True)) -> list:
    params = {"active": "true" if active else "false"}
    try:
        resp = await httpx.AsyncClient(timeout=5.0).aget(
            f"{settings.alertmanager_url}/api/v2/alerts",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="alertmanager_unreachable")
