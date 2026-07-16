from fastapi import APIRouter, HTTPException, Query
from app.db import get_db
from app.deps import current_user
from fastapi import Depends

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/permissions")
async def list_permissions() -> list:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT `key`, label, module FROM system_permissions ORDER BY module, id")
            return [{"key": r[0], "label": r[1], "module": r[2]} for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.get("/roles")
async def list_roles() -> list:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, name, label, description, status FROM system_roles ORDER BY id")
            roles = []
            for r in cur.fetchall():
                cur2 = conn.cursor()
                cur2.execute("SELECT permission_key FROM system_role_perms WHERE role_id=%s", (r[0],))
                perms = [x[0] for x in cur2.fetchall()]
                roles.append({"id": r[0], "name": r[1], "label": r[2], "description": r[3] or "", "status": r[4], "permissions": perms})
            return roles
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.post("/roles")
async def create_role(body: dict) -> dict:
    name, label = body.get("name", ""), body.get("label", "")
    if not name or not label:
        raise HTTPException(status_code=400, detail="name and label required")
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO system_roles (name, label, description) VALUES (%s,%s,%s)",
                        (name, label, body.get("description", "")))
            return {"id": cur.lastrowid, "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/roles/{rid}")
async def update_role(rid: int, body: dict) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            if "label" in body:
                cur.execute("UPDATE system_roles SET label=%s, description=%s WHERE id=%s",
                            (body.get("label", ""), body.get("description", ""), rid))
            if "status" in body:
                cur.execute("UPDATE system_roles SET status=%s WHERE id=%s", (body.get("status"), rid))
            cur.close()
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/roles/{rid}")
async def delete_role(rid: int) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM system_role_perms WHERE role_id=%s", (rid,))
            cur.execute("DELETE FROM system_user_roles WHERE role_id=%s", (rid,))
            cur.execute("DELETE FROM system_roles WHERE id=%s", (rid,))
            cur.close()
            return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/roles/{rid}/permissions")
async def update_role_permissions(rid: int, body: dict) -> dict:
    """一次性设置角色全部权限"""
    perms = body.get("permissions", [])
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM system_role_perms WHERE role_id=%s", (rid,))
            for pk in perms:
                cur.execute("INSERT INTO system_role_perms (role_id, permission_key) VALUES (%s,%s)", (rid, pk))
            cur.close()
            return {"status": "ok", "count": len(perms)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{uid}/roles")
async def get_user_roles(uid: int) -> list:
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT sr.id, sr.name, sr.label FROM system_user_roles sur JOIN system_roles sr ON sr.id=sur.role_id WHERE sur.user_id=%s", (uid,))
            return [{"id": r[0], "name": r[1], "label": r[2]} for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"db_error: {e}")


@router.post("/users/{uid}/roles")
async def assign_user_role(uid: int, body: dict) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO system_user_roles (user_id, role_id) VALUES (%s,%s)", (uid, body["role_id"]))
            cur.close()
            return {"status": "assigned"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{uid}/roles/{rid}")
async def remove_user_role(uid: int, rid: int) -> dict:
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM system_user_roles WHERE user_id=%s AND role_id=%s", (uid, rid))
            cur.close()
            return {"status": "removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{uid}/permissions")
async def update_user_permissions(uid: int, body: dict) -> dict:
    """一次性设置用户权限覆盖"""
    perms = body.get("permissions", [])
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM system_user_perms WHERE user_id=%s", (uid,))
            for pk in perms:
                cur.execute("INSERT IGNORE INTO system_user_perms (user_id, permission_key, granted) VALUES (%s,%s,1)", (uid, pk))
            cur.close()
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)) -> dict:
    """当前用户档案 + 最近10条登录记录"""
    username = user["sub"]
    try:
        with get_db(readonly=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, username, person_code, display_name, email, phone, department, role, status, last_login, created_at FROM users WHERE username=%s", (username,))
            row = cur.fetchone()
            if not row:
                return {"username": username, "displayName": user.get("name", username), "role": user.get("role", "dev"), "loginLogs": []}
            profile = {"id": row[0], "username": row[1], "personCode": row[2] or "", "displayName": row[3] or "", "email": row[4] or "", "phone": row[5] or "", "department": row[6] or "", "role": row[7], "status": row[8], "lastLogin": str(row[9]) if row[9] else "", "createdAt": str(row[10]) if row[10] else ""}
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
            cur.execute(f"SELECT id, username, person_code, display_name, email, phone, department, role, status, last_login, created_at FROM users {where} ORDER BY id LIMIT %s OFFSET %s", params + [limit, offset])
            rows = cur.fetchall()
            # 批量获取角色
            user_ids = [r[0] for r in rows]
            roles_map = {}
            if user_ids:
                placeholders = ','.join(['%s'] * len(user_ids))
                cur.execute(f"SELECT user_id, role_id FROM system_user_roles WHERE user_id IN ({placeholders})", user_ids)
                for ur in cur.fetchall():
                    roles_map.setdefault(ur[0], []).append(ur[1])
            cur.close()
            return {"total": total, "data": [{"id": r[0], "username": r[1], "personCode": r[2] or "", "displayName": r[3] or "", "email": r[4] or "", "phone": r[5] or "", "department": r[6] or "", "role": r[7], "roles": roles_map.get(r[0], []), "status": r[8], "lastLogin": str(r[9]) if r[9] else "", "createdAt": str(r[10]) if r[10] else ""} for r in rows]}
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


@router.delete("/users/{uid}")
async def delete_user(uid: int) -> dict:
    """删除用户（软删除 status=-1）"""
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM system_user_roles WHERE user_id=%s", (uid,))
            cur.execute("DELETE FROM system_user_perms WHERE user_id=%s", (uid,))
            cur.execute("DELETE FROM users WHERE id=%s", (uid,))
            cur.close()
            return {"status": "deleted"}
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
