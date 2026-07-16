import secrets

import httpx
from fastapi import APIRouter, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response

from app.auth.jwt import create_token, verify_token
from app.auth.oidc import oidc
from app.auth.roles import map_role
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_MOCK_USERS = {
    "admin": {"sub": "admin", "role": "ops", "name": "运维管理员"},
    "dev": {"sub": "dev", "role": "dev", "name": "开发工程师"},
    "manager": {"sub": "manager", "role": "mgmt", "name": "管理者"},
}


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
    """域控登录：POST {username, password} → 回调公司 EIP 接口验证，同步用户信息"""
    username = body.get("username", "")
    password = body.get("password", "")
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")[:500]
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")

    full_name = username
    person_code = ""
    department = ""
    role = "dev"
    login_ok = False

    # 调用域控 API
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
                eip_user = {
                    "name": ui.get("personName", username),
                    "code": ui.get("personCode", ""),
                    "dept": ui.get("deptName", ""),
                    "role": "ops",
                }
    except Exception:
        pass

    if eip_user:
        full_name = eip_user["name"]
        person_code = eip_user["code"]
        department = eip_user["dept"]
        role = eip_user["role"]
        login_ok = True
    elif settings.dev_mock and username in _MOCK_USERS:
        valid = {"admin": "admin123", "dev": "dev123", "manager": "mgr123"}
        if valid.get(username) != password:
            _log_login(None, username, full_name, person_code, department, ip, ua, "failed", "密码错误")
            raise HTTPException(status_code=401, detail="用户名或密码错误")
        mu = _MOCK_USERS[username]
        full_name = mu["name"]
        role = mu["role"]
        login_ok = True

    if not login_ok:
        _log_login(None, username, full_name, person_code, department, ip, ua, "failed", "域控验证失败")
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 同步用户信息到 users 表
    from app.db import get_db
    from datetime import datetime
    try:
        with get_db(readonly=False) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            existing = cur.fetchone()
            now = datetime.now()
            if existing:
                uid = existing[0]
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
    import json
    resp_data = {"username": username, "role": role, "displayName": full_name}
    resp = Response(content=json.dumps(resp_data), media_type="application/json")
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
    if not settings.dev_mock:
        return RedirectResponse("/login")
    valid = {"admin": "admin123", "dev": "dev123", "manager": "mgr123"}
    if valid.get(username) != password:
        return RedirectResponse("/login?error=invalid")
    user = _MOCK_USERS.get(username, _MOCK_USERS["admin"])
    resp = RedirectResponse("/dashboard", status_code=302)
    _set_auth_cookie(resp, user["sub"], user["role"], user["name"])
    return resp

@router.post("/dev-login")
async def dev_login(username: str = Form("admin"), password: str = Form("")) -> RedirectResponse:
    """开发模式 mock 登录,跳过 OIDC 流程。账号 admin/admin123 dev/dev123 manager/mgr123"""
    if not settings.dev_mock:
        return RedirectResponse("/login")
    valid = {"admin": "admin123", "dev": "dev123", "manager": "mgr123"}
    if valid.get(username) != password:
        return RedirectResponse("/login?error=invalid")
    user = _MOCK_USERS.get(username, _MOCK_USERS["admin"])
    resp = RedirectResponse("/dashboard", status_code=302)
    _set_auth_cookie(resp, user["sub"], user["role"], user["name"])
    return resp


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
