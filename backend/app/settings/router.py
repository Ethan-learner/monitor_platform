from fastapi import APIRouter, HTTPException, Query
from app.db import get_db
from app.deps import current_user
from fastapi import Depends

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)) -> dict:
    """当前用户档案 + 最近10条登录记录"""
    username = user["sub"]
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, username, person_code, display_name, email, department, role, status, last_login, created_at FROM users WHERE username=%s", (username,))
            row = cur.fetchone()
            if not row:
                return {"username": username, "displayName": user.get("name", username), "role": user.get("role", "dev"), "loginLogs": []}
            profile = {"id": row[0], "username": row[1], "personCode": row[2] or "", "displayName": row[3] or "", "email": row[4] or "", "department": row[5] or "", "role": row[6], "status": row[7], "lastLogin": str(row[8]) if row[8] else "", "createdAt": str(row[9]) if row[9] else ""}
            cur.execute("SELECT login_time, ip_address, user_agent, result, failed_reason FROM login_logs WHERE username=%s ORDER BY login_time DESC LIMIT 10", (username,))
            logs = [{"loginTime": str(r[0]) if r[0] else "", "ip": r[1] or "", "userAgent": r[2] or "", "result": r[3] or "", "failedReason": r[4] or ""} for r in cur.fetchall()]
            profile["loginLogs"] = logs
            cur.close()
            return profile
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.get("/users")
async def list_users(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), search: str = Query("")) -> dict:
    """用户列表"""
    where = "WHERE 1=1"
    params = []
    if search:
        where += " AND (username LIKE %s OR display_name LIKE %s OR person_code LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT COUNT(*) FROM users {where}", params)
            total = cur.fetchone()[0]
            cur.execute(f"SELECT id, username, person_code, display_name, email, department, role, status, last_login, created_at FROM users {where} ORDER BY id LIMIT %s OFFSET %s", params + [limit, offset])
            rows = cur.fetchall()
            cur.close()
            return {"total": total, "data": [{"id": r[0], "username": r[1], "personCode": r[2] or "", "displayName": r[3] or "", "email": r[4] or "", "department": r[5] or "", "role": r[6], "status": r[7], "lastLogin": str(r[8]) if r[8] else "", "createdAt": str(r[9]) if r[9] else ""} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.put("/users/{uid}/role")
async def update_user_role(uid: int, body: dict) -> dict:
    """修改用户角色"""
    role = body.get("role", "dev")
    if role not in ("ops", "dev", "mgmt"):
        raise HTTPException(status_code=400, detail="invalid role")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE users SET role=%s WHERE id=%s", (role, uid))
            cur.close()
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{uid}/status")
async def update_user_status(uid: int, body: dict) -> dict:
    """启用/禁用用户"""
    status_val = body.get("status", 1)
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE users SET status=%s WHERE id=%s", (status_val, uid))
            cur.close()
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/login-logs")
async def list_login_logs(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), username: str = Query(""), result: str = Query("")) -> dict:
    """登录日志列表"""
    where = "WHERE 1=1"
    params = []
    if username:
        where += " AND username LIKE %s"
        params.append(f"%{username}%")
    if result:
        where += " AND result=%s"
        params.append(result)
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT COUNT(*) FROM login_logs {where}", params)
            total = cur.fetchone()[0]
            cur.execute(f"SELECT id, username, display_name, person_code, department, login_time, ip_address, user_agent, result, failed_reason FROM login_logs {where} ORDER BY login_time DESC LIMIT %s OFFSET %s", params + [limit, offset])
            rows = cur.fetchall()
            cur.close()
            return {"total": total, "data": [{"id": r[0], "username": r[1] or "", "displayName": r[2] or "", "personCode": r[3] or "", "department": r[4] or "", "loginTime": str(r[5]) if r[5] else "", "ip": r[6] or "", "userAgent": r[7] or "", "result": r[8] or "", "failedReason": r[9] or ""} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")
