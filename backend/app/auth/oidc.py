import urllib.parse

import httpx

from app.config import settings


class OIDCProvider:
    """标准 OIDC 适配层。后续接具体 IdP(企业微信/Keycloak/SAML)时,
    实现同接口的另一个类并在 router.py 切换即可,不动门户骨架。"""

    def authorize_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.oidc_client_id,
            "redirect_uri": redirect_uri,
            "scope": settings.oidc_scope,
            "state": state,
        }
        return f"{settings.oidc_authorize_url}?{urllib.parse.urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> dict:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
        }
        resp = httpx.post(settings.oidc_token_url, data=data, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def fetch_userinfo(self, access_token: str) -> dict:
        resp = httpx.get(
            settings.oidc_userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


oidc = OIDCProvider()
