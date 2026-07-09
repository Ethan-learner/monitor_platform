import asyncio
import time
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.overview.components import COMPONENTS

router = APIRouter(prefix="/api/overview", tags=["overview"])

_HEALTH_TIMEOUT = 2.0


async def _probe(name: str, url: str) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=_HEALTH_TIMEOUT, verify=False) as client:
            resp = await client.get(url)
            ok = resp.status_code < 500
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"name": name, "status": "up" if ok else "down", "latencyMs": latency_ms}
    except (httpx.HTTPError, OSError):
        return {"name": name, "status": "down", "latencyMs": None}


@router.get("/health")
async def health() -> list:
    tasks = [_probe(name, url) for name, url in COMPONENTS]
    return await asyncio.gather(*tasks)


@router.get("/alerts-summary")
async def alerts_summary() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.alertmanager_url}/api/v2/alerts", params={"active": "true"}
            )
            resp.raise_for_status()
            alerts = resp.json()
    except (httpx.HTTPError, OSError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="alertmanager_unreachable")

    counts = {"critical": 0, "warning": 0, "info": 0, "other": 0, "total": len(alerts)}
    seen = set()
    for a in alerts:
        labels = a.get("labels") or {}
        key = f'{labels.get("alertname", "")}|{labels.get("instance", "")}'
        if key in seen:
            continue
        seen.add(key)
        sev = labels.get("severity", "other")
        if sev in counts:
            counts[sev] += 1
        else:
            counts["other"] += 1
    counts["total"] = sum(counts.values()) - counts["total"] + len(seen)
    return counts
