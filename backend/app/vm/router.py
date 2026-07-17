from fastapi import APIRouter, HTTPException, Query, Request
import httpx
from datetime import datetime

router = APIRouter(prefix="/api/vm", tags=["vm"])

VM_URL = "http://172.16.10.27:8481/select/0/prometheus"


def save_history(request: Request, promql: str, mode: str):
    try:
        token = request.cookies.get("portal_session", "")
        from app.auth.jwt import verify_token
        payload = verify_token(token)
        username = payload["sub"]
        from app.db import get_db
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT display_name, person_code, department FROM users WHERE username=%s", (username,))
            row = cur.fetchone()
            cur.execute("INSERT INTO query_history (username, display_name, person_code, department, promql, mode) VALUES (%s,%s,%s,%s,%s,%s)",
                        (username, row[0] if row else "", row[1] if row else "", row[2] if row else "", promql, mode))
            cur.close()
    except Exception:
        pass


@router.get("/query")
async def vm_query(query: str = Query(...), time: str = Query(""), request: Request = None):
    try:
        save_history(request, query, "instant")
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {"query": query}
            if time:
                params["time"] = time
            resp = await client.get(f"{VM_URL}/api/v1/query", params=params)
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="VM query timeout")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"VM query failed: {str(e)[:100]}")


@router.get("/query_range")
async def vm_query_range(query: str = Query(...), start: str = Query(...), end: str = Query(...), step: str = Query("15s"), request: Request = None):
    try:
        save_history(request, query, "range")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{VM_URL}/api/v1/query_range", params={"query": query, "start": start, "end": end, "step": step})
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="VM query timeout")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"VM query_range failed: {str(e)[:100]}")


@router.get("/history")
async def get_history(request: Request, keyword: str = Query(""), limit: int = Query(50)):
    try:
        token = request.cookies.get("portal_session", "")
        from app.auth.jwt import verify_token
        payload = verify_token(token)
        username = payload["sub"]
        from app.db import get_db
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            if keyword:
                cur.execute("SELECT id, promql, mode, created_at FROM query_history WHERE username=%s AND promql LIKE %s ORDER BY created_at DESC LIMIT %s",
                            (username, f"%{keyword}%", limit))
            else:
                cur.execute("SELECT id, promql, mode, created_at FROM query_history WHERE username=%s ORDER BY created_at DESC LIMIT %s", (username, limit))
            rows = cur.fetchall()
            cur.close()
            return [{"id": r[0], "promql": r[1], "mode": r[2], "createdAt": str(r[3]) if r[3] else ""} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:100])
