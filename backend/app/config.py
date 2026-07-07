from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PORTAL_", env_file=".env", extra="ignore")

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_ttl_seconds: int = 86400
    cookie_name: str = "portal_session"

    # OIDC (可插拔适配层默认用这些)
    oidc_issuer: str = "https://idp.example.com"
    oidc_client_id: str = "portal"
    oidc_client_secret: str = "secret"
    oidc_authorize_url: str = "https://idp.example.com/authorize"
    oidc_token_url: str = "https://idp.example.com/token"
    oidc_userinfo_url: str = "https://idp.example.com/userinfo"
    oidc_redirect_path: str = "/api/auth/callback"
    oidc_scope: str = "openid profile groups"

    # 门户外部地址(用于回调 URL)
    public_base_url: str = "http://172.16.10.99"

    # 既有组件地址
    alertmanager_url: str = "http://172.16.10.27:9093"
    grafana_url: str = "http://172.16.10.99:3001"
    pmm_url: str = "http://172.16.10.99:30080"
    glowroot_url: str = "http://172.16.10.27:4000"
    prometheus_url: str = "http://172.16.10.27:9090"
    loki_url: str = "http://172.16.10.27:3100"
    vmselect_url: str = "http://172.16.10.27:8481"

    # 角色映射:IdP group 名 -> 门户角色
    role_group_ops: str = "monitoring-ops"
    role_group_dev: str = "monitoring-dev"
    role_group_mgmt: str = "monitoring-mgmt"


settings = Settings()
