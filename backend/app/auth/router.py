import secrets

from fastapi import APIRouter, Form, Request
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


@router.post("/dev-login")
async def dev_login(username: str = Form("admin"), password: str = Form("")) -> RedirectResponse:
    """开发模式 mock 登录,跳过 OIDC 流程。账号 admin/admin123 dev/dev123 manager/mgr123"""
    if not settings.dev_mock:
        return RedirectResponse("/login")
    valid = {"admin": "admin123", "dev": "dev123", "manager": "mgr123"}
    if valid.get(username) != password:
        return RedirectResponse("/login?error=invalid")
    user = _MOCK_USERS.get(username, _MOCK_USERS["admin"])
    resp = RedirectResponse("/dashboard")
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
