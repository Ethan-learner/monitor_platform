from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.jwt import verify_token
from app.config import settings


def _token_from_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(settings.cookie_name)


async def current_user(request: Request) -> dict:
    token = _token_from_cookie(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return verify_token(token)
