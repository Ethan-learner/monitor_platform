from typing import Optional, Callable

from fastapi import Depends, HTTPException, Request, status

from app.auth.jwt import verify_token
from app.config import settings
from app.db import get_db


def _token_from_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(settings.cookie_name)


async def current_user(request: Request) -> dict:
    token = _token_from_cookie(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return verify_token(token)


def require_perm(key: str) -> Callable:
    """FastAPI 依赖：校验用户是否有某项操作权限。ops 角色直接放行。"""

    async def checker(request: Request) -> True:
        token = _token_from_cookie(request)
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
        payload = verify_token(token)
        username = payload["sub"]
        if payload.get("role") == "ops":
            return True
        try:
            with get_db(readonly=True) as conn:
                cur = conn.cursor()
                # 用户直接权限
                cur.execute(
                    "SELECT 1 FROM system_user_perms WHERE user_id=(SELECT id FROM users WHERE username=%s) AND permission_key=%s AND granted=1",
                    (username, key))
                if cur.fetchone():
                    return True
                # 角色权限
                cur.execute(
                    "SELECT 1 FROM system_role_perms srp JOIN system_user_roles sur ON sur.role_id=srp.role_id JOIN users u ON u.id=sur.user_id WHERE u.username=%s AND srp.permission_key=%s",
                    (username, key))
                if cur.fetchone():
                    return True
                cur.close()
        except Exception:
            return True  # DB down 不拦截
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"permission denied: {key}")

    return checker
