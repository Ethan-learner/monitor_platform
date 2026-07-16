import secrets

import httpx
from fastapi import APIRouter, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response

from app.auth.jwt import create_token, verify_token
from app.auth.oidc import oidc
from app.auth.roles import map_role
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookie(resp: Response, username: str, role: str, name: str) -> None:
    token = create_token({"sub": username, "role": role, "name": name})
    resp.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_ttl_seconds,
        path="/",
    )


@router.post("/login")
async def login_with_eip(body: dict, request: Request) -> Response:
    """登录：域控 EIP → 手动账号(password_hash) → dev_mock 兜底"""
    import hashlib, json as json_mod
    username = body.get("username", "")
    password = body.get("password", "")
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")[:500]
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")

    full_name = username
    person_code = ""
    department = ""
    role = "ops"
    login_ok = False

    # 1. 尝试域控 EIP API
    eip_user = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            eip_resp = await client.post(
                settings.eip_url,
                json={"username": username, "password": password},
            )
            eip_data = eip_resp.json() if eip_resp.text else {}
            if eip_resp.status_code == 200 and eip_data.get("data") and eip_data["data"].get("userinfo"):
                ui = eip_data["data"]["userinfo"]
                eip_user = {"name": ui.get("personName", username), "code": ui.get("personCode", ""), "dept": ui.get("deptName", "")}
    except Exception:
        pass

    if eip_user:
        full_name = eip_user["name"]
        person_code = eip_user["code"]
        department = eip_user["dept"]
        login_ok = True
    else:
        # 2. 尝试手动账号（users 表 password_hash）
        try:
            from app.db import get_db
            with get_db(readonly=True) as conn:
                cur = conn.cursor()
                cur.execute("SELECT id, display_name, person_code, department, role, password_hash FROM users WHERE username=%s AND status=1", (username,))
                row = cur.fetchone()
                cur.close()
                if row and row[5]:
                    pw_hash = hashlib.sha256(password.encode()).hexdigest()
                    if pw_hash == row[5]:
                        full_name = row[1] or username
                        person_code = row[2] or ""
                        department = row[3] or ""
                        role = row[4]
                        login_ok = True
        except Exception:
            pass

    # 3. dev_mock 兜底（域控不可达时走 DB 手动账号）
    if not login_ok and settings.dev_mock:
        try:
            from app.db import get_db
            with get_db(readonly=True) as conn:
                cur = conn.cursor()
                cur.execute("SELECT display_name, person_code, department, role, password_hash FROM users WHERE username=%s AND status=1", (username,))
                row = cur.fetchone()
                cur.close()
                if row and row[4]:
                    pw_hash = hashlib.sha256(password.encode()).hexdigest()
                    if pw_hash == row[4]:
                        full_name = row[0] or username
                        person_code = row[1] or ""
                        department = row[2] or ""
                        role = row[3]
                        login_ok = True
        except Exception:
            pass

    if not login_ok:
        _log_login(None, username, full_name, person_code, department, ip, ua, "failed", "验证失败")
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 同步用户信息到 users 表，角色从 DB 读取（EIP 不返回角色）
    from app.db import get_db
    from datetime import datetime
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, role FROM users WHERE username=%s", (username,))
            existing = cur.fetchone()
            now = datetime.now()
            if existing:
                uid = existing[0]
                role = existing[1]  # 保留 DB 中已分配的角色
                cur.execute("UPDATE users SET display_name=%s, person_code=%s, department=%s, last_login=%s, updated_at=%s WHERE id=%s",
                            (full_name, person_code, department, now, now, uid))
            else:
                cur.execute("INSERT INTO users (username, person_code, display_name, department, role, status, last_login) VALUES (%s,%s,%s,%s,%s,1,%s)",
                            (username, person_code, full_name, department, role, now))
                uid = cur.lastrowid
            _log_login(uid, username, full_name, person_code, department, ip, ua, "success", None)
            cur.close()
    except Exception:
        pass

    # 签发 JWT
    resp_data = {"username": username, "role": role, "displayName": full_name}
    resp = Response(content=json_mod.dumps(resp_data), media_type="application/json")
    _set_auth_cookie(resp, username, role, full_name)
    return resp


def _log_login(user_id, username, name, person_code, department, ip, ua, result, reason):
    try:
        from app.db import get_db
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO login_logs (user_id, username, display_name, person_code, department, login_time, ip_address, user_agent, result, failed_reason) VALUES (%s,%s,%s,%s,%s,NOW(),%s,%s,%s,%s)",
                (user_id, username, name, person_code, department, ip, ua, result, reason))
            cur.close()
    except Exception:
        pass


@router.get("/dev-login")
async def dev_login_get(username: str = "admin", password: str = "") -> RedirectResponse:
    """开发模式：重定向到前端登录页"""
    return RedirectResponse("/login")


@router.post("/dev-login")
async def dev_login(username: str = Form("admin"), password: str = Form("")) -> RedirectResponse:
    return RedirectResponse("/login")


@router.post("/register")
async def register_user(body: dict) -> dict:
    """管理员手动创建用户，随机生成密码"""
    import secrets, hashlib
    username = body.get("username", "")
    if not username:
        raise HTTPException(status_code=400, detail="username required")
    rand_pw = secrets.token_urlsafe(8)
    pw_hash = hashlib.sha256(rand_pw.encode()).hexdigest()
    try:
        from app.db import get_db
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="用户名已存在")
            cur.execute("INSERT INTO users (username, password_hash, display_name, department) VALUES (%s,%s,%s,%s)",
                        (username, pw_hash, body.get("displayName", ""), body.get("department", "")))
            cur.close()
            return {"username": username, "password": rand_pw, "status": "created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/login")
async def login(request: Request) -> RedirectResponse:
    state = secrets.token_urlsafe(16)
    redirect_uri = f"{settings.public_base_url}{settings.oidc_redirect_path}"
    url = oidc.authorize_url(state=state, redirect_uri=redirect_uri)
    return RedirectResponse(url)


@router.get("/callback")
async def callback(request: Request) -> RedirectResponse:
    code = request.query_params.get("code")
    if not code:
        return RedirectResponse("/login?error=no_code")
    redirect_uri = f"{settings.public_base_url}{settings.oidc_redirect_path}"
    tokens = oidc.exchange_code(code=code, redirect_uri=redirect_uri)
    claims = oidc.fetch_userinfo(access_token=tokens["access_token"])
    username = claims.get("preferred_username") or claims.get("sub") or "unknown"
    role = map_role(claims.get("groups") or [])
    name = claims.get("name") or username
    token = create_token({"sub": username, "role": role, "name": name})
    resp = RedirectResponse("/dashboard")
    resp.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_ttl_seconds,
        path="/",
    )
    return resp


@router.post("/logout")
async def logout() -> Response:
    resp = Response(status_code=204)
    resp.delete_cookie(key=settings.cookie_name, path="/")
    return resp


@router.get("/me")
async def me(request: Request) -> dict:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    payload = verify_token(token)
    return {"username": payload["sub"], "role": payload["role"], "displayName": payload["name"]}


@router.get("/verify")
async def verify(request: Request) -> Response:
    """供 Nginx auth_request 子请求调用。校验 cookie JWT,回 X-Auth-User 头。"""
    token = request.cookies.get(settings.cookie_name)
    if not token:
        return Response(status_code=401)
    try:
        payload = verify_token(token)
    except Exception:
        return Response(status_code=401)
    resp = Response(status_code=200)
    resp.headers["X-Auth-User"] = payload["sub"]
    return resp
