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
async def login_with_eip(body: dict) -> dict:
    """域控登录：POST {username, password} → 回调公司 EIP 接口验证"""
    username = body.get("username", "")
    password = body.get("password", "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")
    # 调用域控 API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            eip_resp = await client.post(
                settings.eip_url,
                json={"username": username, "password": password},
            )
            if eip_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="用户名或密码错误")
            eip_data = eip_resp.json()
            userinfo = eip_data.get("data", {}).get("userinfo") if eip_data.get("data") else None
            if not userinfo:
                raise HTTPException(status_code=401, detail="域控返回数据异常")
            name = userinfo.get("displayName") or userinfo.get("name") or username
            role = "ops"
    except HTTPException:
        raise
    except Exception:
        # 域控不可达时，dev_mock 兜底
        if settings.dev_mock and username in _MOCK_USERS:
            valid = {"admin": "admin123", "dev": "dev123", "manager": "mgr123"}
            if valid.get(username) != password:
                raise HTTPException(status_code=401, detail="用户名或密码错误")
            user = _MOCK_USERS[username]
            username, role, name = user["sub"], user["role"], user["name"]
        else:
            raise HTTPException(status_code=502, detail="域控服务不可达")
    # 签发 JWT
    import json
    resp = Response(content=json.dumps({"username": username, "role": role, "displayName": name}), media_type="application/json")
    _set_auth_cookie(resp, username, role, name)
    return resp


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
