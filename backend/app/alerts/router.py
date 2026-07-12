import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

router = APIRouter(prefix="/api", tags=["alerts"])

_BEIJING_TZ = timezone(timedelta(hours=8))


def _promql_escape(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def _format_alert_time(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(_BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")


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


@router.get("/alerts/history")
async def list_alert_history(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    range_hours: int = Query(168, ge=1, le=720),
    status: Optional[str] = Query(None),
    alertname: Optional[str] = Query(None),
    instance: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
) -> dict:
    """从 VictoriaMetrics 查询告警历史（由 webhook 服务写入的 alarm_info 指标）。"""
    if not settings.vmselect_url:
        raise HTTPException(status_code=400, detail="vmselect not configured")

    # 构造 PromQL 标签选择器
    matchers = []
    if status:
        matchers.append(f'status="{_promql_escape(status)}"')
    if alertname:
        matchers.append(f'alertname="{_promql_escape(alertname)}"')
    if instance:
        matchers.append(f'instance="{_promql_escape(instance)}"')
    if severity:
        # webhook 端使用 criticality 标签存储严重级别
        matchers.append(f'criticality="{_promql_escape(severity)}"')

    metric_selector = "alarm_info" + ("{" + ",".join(matchers) + "}" if matchers else "")
    query = f"{metric_selector}[{range_hours}h]"

    url = f"{settings.vmselect_url}/select/0/prometheus/api/v1/query"
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(url, params={"query": query})
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, httpx.ConnectError) as e:
        raise HTTPException(status_code=502, detail=f"vmselect_unreachable: {e}")

    if payload.get("status") != "success":
        raise HTTPException(status_code=502, detail=f"vmselect_query_failed: {payload.get('error')}")

    records = []
    for series in payload.get("data", {}).get("result", []):
        metric = series.get("metric", {})
        for ts_str, value in series.get("values", []):
            ts = float(ts_str)
            records.append({
                "alertName": metric.get("alertname", ""),
                "alertTime": _format_alert_time(ts),
                "instance": metric.get("instance", ""),
                "severity": metric.get("severity") or metric.get("criticality", ""),
                "department": metric.get("department", ""),
                "project": metric.get("project", ""),
                "env": metric.get("env", ""),
                "service": metric.get("service", ""),
                "status": metric.get("status") or ("firing" if value == "1" else "resolved"),
                # VM 只存储了 labels，没有 annotations，所以 summary 无法还原
                "summary": "",
            })

    records.sort(key=lambda x: x["alertTime"], reverse=True)
    total = len(records)
    return {"total": total, "data": records[offset:offset + limit]}


@router.delete("/alerts/history/{alertname}")
async def delete_alert_history(alertname: str) -> dict:
    """从 VictoriaMetrics 删除指定 alertname 的告警历史记录。"""
    if not settings.vmselect_url:
        raise HTTPException(status_code=400, detail="vmselect not configured")

    matcher = f'alarm_info{{alertname="{_promql_escape(alertname)}"}}'
    url = f"{settings.vmselect_url}/delete/0/prometheus/api/v1/admin/tsdb/delete_series"
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.post(url, params={"match[]": matcher})
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"vmselect_delete_failed: {resp.status_code} {resp.text}"
                )
    except (httpx.HTTPError, httpx.ConnectError) as e:
        raise HTTPException(status_code=502, detail=f"vmselect_unreachable: {e}")

    return {"status": "deleted", "alertname": alertname}
