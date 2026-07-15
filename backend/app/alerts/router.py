import httpx
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.audit import log_audit
from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api", tags=["alerts"])

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
            am_data = resp.json()
        # 合并 DB 状态
        db_status = {}
        try:
            with get_db(readonly=True) as conn:
                cur = conn.cursor()
                cur.execute("SELECT silence_id, status FROM silence_records WHERE status != -1")
                for row in cur.fetchall():
                    db_status[row[0]] = row[1]
                cur.close()
        except Exception:
            pass
        for item in am_data:
            sid = item.get("id", "")
            item["db_status"] = db_status.get(sid, 1)
        return am_data
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
                # 修复日期格式：去掉毫秒
                clean_body = dict(body)
                for f in ['startsAt', 'endsAt']:
                    if f in clean_body and clean_body[f]:
                        clean_body[f] = clean_body[f].replace("T", " ").replace("Z", "")[:19].replace(" ", "T") + "Z"
                resp = await client.post(f"{settings.alertmanager_url}/api/v2/silences", json=clean_body)
                if resp.status_code >= 300:
                    detail = resp.text
                    if resp.status_code == 400:
                        raise HTTPException(status_code=400, detail=detail)
                    raise HTTPException(status_code=502, detail=f"alertmanager_error: {resp.status_code} {detail}")
                result = resp.json()
            # 写入 audit_log
            log_audit(body.get("createdBy", "unknown"), "silences", "create",
                       f"matcher={body.get('matchers',[{}])[0].get('name')}={body.get('matchers',[{}])[0].get('value')}",
                       f"startsAt={body.get('startsAt')} endsAt={body.get('endsAt')}")
            # 写入 silence_records (upsert)
            try:
                m = body.get("matchers", [{}])[0]
                starts = body.get("startsAt", "").replace("T", " ").replace("Z", "")[:19]
                ends = body.get("endsAt", "").replace("T", " ").replace("Z", "")[:19]
                with get_db(readonly=False) as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "INSERT INTO silence_records (silence_id, operator, matcher_name, matcher_value, starts_at, ends_at, comment, status) VALUES (%s,%s,%s,%s,%s,%s,%s,1) ON DUPLICATE KEY UPDATE status=1, starts_at=VALUES(starts_at), ends_at=VALUES(ends_at)",
                        (result.get("silenceID", ""), body.get("createdBy", "unknown"),
                         m.get("name", ""), m.get("value", ""), starts, ends, body.get("comment", "")))
            except Exception: pass
            return result
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.delete("/alerts/silences/{sid}")
async def expire_silence(sid: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.delete(f"{settings.alertmanager_url}/api/v2/silence/{sid}")
            if resp.status_code < 300:
                log_audit("system", "silences", "expire", f"sid={sid}")
                try:
                    with get_db(readonly=False) as conn:
                        cur = conn.cursor()
                        cur.execute("UPDATE silence_records SET status=0 WHERE silence_id=%s", (sid,))
                except Exception: pass
                return {"status": "expired"}
            raise HTTPException(status_code=502, detail="expire_failed")
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.post("/alerts/silences/{sid}/delete")
async def delete_silence(sid: str) -> dict:
    """平台删除：Alertmanager 过期 + DB status=-1"""
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            await client.delete(f"{settings.alertmanager_url}/api/v2/silence/{sid}")
        log_audit("system", "silences", "delete", f"sid={sid}")
        try:
            with get_db(readonly=False) as conn:
                cur = conn.cursor()
                cur.execute("UPDATE silence_records SET status=-1 WHERE silence_id=%s", (sid,))
        except Exception: pass
        return {"status": "deleted"}
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="alertmanager_unreachable")


@router.put("/alerts/silences/{sid}")
async def update_silence(sid: str, body: dict) -> dict:
    """编辑静默：过期旧 → 创建新，更新 DB"""
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            # 1. 过期旧静默
            await client.delete(f"{settings.alertmanager_url}/api/v2/silence/{sid}")
            # 2. 创建新静默
            clean_body = dict(body)
            for f in ['startsAt', 'endsAt']:
                if f in clean_body and clean_body[f]:
                    clean_body[f] = clean_body[f].replace("T", " ").replace("Z", "")[:19].replace(" ", "T") + "Z"
            resp = await client.post(f"{settings.alertmanager_url}/api/v2/silences", json=clean_body)
            if resp.status_code >= 300:
                raise HTTPException(status_code=502, detail=f"create_failed: {resp.text}")
            result = resp.json()
            new_sid = result.get("silenceID", "")
        # 3. 更新 DB：旧记录置负数，新记录写入
        try:
            m = body.get("matchers", [{}])[0]
            starts = body.get("startsAt", "").replace("T", " ").replace("Z", "")[:19]
            ends = body.get("endsAt", "").replace("T", " ").replace("Z", "")[:19]
            with get_db(readonly=False) as conn:
                cur = conn.cursor()
                cur.execute("UPDATE silence_records SET status=-1 WHERE silence_id=%s", (sid,))
                cur.execute(
                    "INSERT INTO silence_records (silence_id, operator, matcher_name, matcher_value, starts_at, ends_at, comment, status) VALUES (%s,%s,%s,%s,%s,%s,%s,1)",
                    (new_sid, body.get("createdBy", "unknown"), m.get("name", ""), m.get("value", ""), starts, ends, body.get("comment", "")))
        except Exception: pass
        log_audit(body.get("createdBy", "unknown"), "silences", "update", f"old={sid} new={new_sid}")
        return {"status": "updated", "old_sid": sid, "new_sid": new_sid}
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


@router.get("/alerts/records")
async def list_alert_records(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    alertname: str = Query(""),
    instance: str = Query(""),
    status: str = Query(""),
    severity: str = Query(""),
) -> dict:
    """从 MySQL alert_records 表读取告警记录"""
    where = "WHERE 1=1"
    params = []
    if alertname:
        where += " AND alert_name LIKE %s"
        params.append(f"%{alertname}%")
    if instance:
        where += " AND instance LIKE %s"
        params.append(f"%{instance}%")
    if status:
        where += " AND status = %s"
        params.append(status)
    if severity:
        where += " AND severity = %s"
        params.append(severity)

    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT COUNT(*) FROM alert_records {where}", params)
            total = cur.fetchone()[0]
            cur.execute(f"SELECT id, alert_name, instance, severity, status, department, project, env, service, job, criticality, owner, resource_category, resource_type, region, summary, starts_at, ends_at FROM alert_records {where} ORDER BY starts_at DESC, status DESC LIMIT %s OFFSET %s", params + [limit, offset])
            rows = cur.fetchall()
            cur.close()
            return {
                "total": total,
                "data": [
                    {"id": r[0], "alertName": r[1], "instance": r[2], "severity": r[3], "status": r[4],
                     "department": r[5], "project": r[6], "env": r[7], "service": r[8],
                     "job": r[9] or "", "criticality": r[10] or "", "owner": r[11] or "",
                     "resourceCategory": r[12] or "", "resourceType": r[13] or "", "region": r[14] or "",
                     "summary": r[15] or "",
                     "startsAt": str(r[16]) if r[16] else "", "endsAt": str(r[17]) if r[17] else ""}
                    for r in rows
                ],
            }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


# ========== 接收人配置 CRUD ==========

@router.get("/alerts/recipients")
async def list_recipients() -> list:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, rule_name, severity, channel, recipients, enabled FROM alert_recipients ORDER BY id")
            rows = cur.fetchall()
            cur.close()
            return [
                {"id": r[0], "ruleName": r[1] or "", "severity": r[2] or "", "channel": r[3], "recipients": r[4], "enabled": r[5]}
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.post("/alerts/recipients")
async def create_recipient(body: dict) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO alert_recipients (rule_name, severity, channel, recipients) VALUES (%s,%s,%s,%s)",
                (body.get("ruleName", "default"), body.get("severity", ""), body["channel"], str(body["recipients"]).replace("'", '"')),
            )
            rid = cur.lastrowid
            cur.close()
            return {"id": rid, "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/alerts/recipients/{rid}")
async def update_recipient(rid: int, body: dict) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE alert_recipients SET rule_name=%s, severity=%s, channel=%s, recipients=%s, enabled=%s WHERE id=%s",
                (body.get("ruleName", "default"), body.get("severity", ""), body["channel"], str(body["recipients"]).replace("'", '"'), body.get("enabled", 1), rid),
            )
            cur.close()
            return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/alerts/recipients/{rid}")
async def delete_recipient(rid: int) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE alert_recipients SET enabled=0 WHERE id=%s", (rid,))
            cur.close()
            return {"status": "disabled"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== 通知策略 CRUD ==========

@router.get("/alerts/strategies")
async def list_strategies() -> list:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, name, label, description, config, enabled, created_at FROM alert_strategies ORDER BY id")
            rows = cur.fetchall()
            cur.close()
            return [{"id": r[0], "name": r[1], "label": r[2], "description": r[3],
                     "config": json.loads(r[4]) if isinstance(r[4], str) else (r[4] or {}),
                     "enabled": r[5], "created_at": str(r[6]) if r[6] else ""} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.post("/alerts/strategies")
async def create_strategy(body: dict) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            gen_name = "strat_" + uuid.uuid4().hex[:8]
            cur.execute("SELECT id, name FROM alert_strategies WHERE label=%s AND enabled != -1", (body.get("label", ""),))
            existing = cur.fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="显示名已存在")
            cur.execute("INSERT INTO alert_strategies (name, label, description, config) VALUES (%s,%s,%s,%s)",
                        (gen_name, body.get("label", ""), body.get("description", ""), json.dumps(body["config"])))
            new_id = cur.lastrowid
            # 查找同名已删策略，将其关联规则重新链接到新策略并恢复启用
            cur.execute("SELECT id FROM alert_strategies WHERE label=%s AND enabled=-1 AND id != %s", (body.get("label", ""), new_id))
            old_ids = [r[0] for r in cur.fetchall()]
            relinked = 0
            new_cfg = body.get("config", {})
            sev_levels = ["critical", "warning", "info"]
            new_sev = "warning"
            for lv in sev_levels:
                if new_cfg.get(lv) and len(new_cfg[lv]) > 0:
                    new_sev = lv
                    break
            for oid in old_ids:
                cur.execute("UPDATE alert_rules SET strategy_id=%s, status=1, severity=%s WHERE strategy_id=%s AND status=0",
                            (new_id, new_sev, oid))
                relinked += cur.rowcount
            return {"id": new_id, "status": "created", "name": gen_name, "relinked": relinked, "synced_severity": new_sev}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/alerts/strategies/{sid}")
async def update_strategy(sid: int, body: dict) -> dict:
    try:
        cfg = body.get("config", {})
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE alert_strategies SET label=%s, description=%s, config=%s, enabled=%s WHERE id=%s",
                        (body.get("label", ""), body.get("description", ""), json.dumps(cfg), body.get("enabled", 1), sid))
            # 同步更新关联规则的级别
            sev_levels = ["critical", "warning", "info"]
            new_sev = "warning"
            for lv in sev_levels:
                if cfg.get(lv) and len(cfg[lv]) > 0:
                    new_sev = lv
                    break
            cur.execute("UPDATE alert_rules SET severity=%s WHERE strategy_id=%s AND status != -1", (new_sev, sid))
            cur.close()
            return {"status": "updated", "synced_severity": new_sev}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/alerts/strategies/{sid}")
async def disable_strategy(sid: int) -> dict:
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        # 禁用关联规则
        cur.execute("UPDATE alert_rules SET status=0 WHERE strategy_id=%s AND status=1", (sid,))
        cur.execute("UPDATE alert_strategies SET enabled=-1 WHERE id=%s", (sid,))
        cur.close()
        return {"status": "deleted"}


@router.get("/alerts/strategies/{sid}")
async def get_strategy(sid: int):
    """获取单个策略（用于检查存在性）"""
    with get_db(readonly=True) as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name, label, enabled FROM alert_strategies WHERE id=%s AND enabled != -1", (sid,))
        row = cur.fetchone()
        cur.close()
        if not row:
            raise HTTPException(status_code=404, detail="strategy_not_found")
        return {"id": row[0], "name": row[1], "label": row[2], "enabled": row[3]}


@router.get("/alerts/strategies/{sid}/refs")
async def strategy_refs(sid: int) -> dict:
    """返回引用了该策略的规则数量"""
    with get_db(readonly=True) as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM alert_rules WHERE strategy_id=%s", (sid,))
        count = cur.fetchone()[0]
        cur.close()
        return {"count": count, "sid": sid}


@router.put("/alerts/strategies/{sid}/disable")
async def toggle_strategy(sid: int, body: dict) -> dict:
    """禁用/启用策略: enabled=0 禁用, enabled=1 启用"""
    enabled = body.get("enabled", 0)
    with get_db(readonly=False) as conn:
        cur = conn.cursor()
        cur.execute("UPDATE alert_strategies SET enabled=%s WHERE id=%s", (enabled, sid))
        cur.close()
        return {"status": "toggled", "enabled": enabled}
