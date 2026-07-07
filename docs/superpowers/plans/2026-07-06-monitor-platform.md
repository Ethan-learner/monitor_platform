# 统一监控门户 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `frontend/`(React+Vite+AntD iframe 聚合门户)基础上,新增 `backend/`(FastAPI)做 OIDC 认证与告警/总览聚合,统一 Nginx 同域反代各监控组件,实现"统一登录 + 分类菜单 + iframe 嵌入 Grafana/PMM/Glowroot + 原生告警列表 + 原生总览首页"。

**Architecture:** 三层结构 —— 门户 Nginx(同域反代,消除 iframe 跨域,给 Grafana 注入 X-Auth-User)→ 门户前端(React SPA,iframe 容器为主 + 两个原生页)→ 门户后端(FastAPI,OIDC 认证 / Alertmanager 代理 / 组件健康聚合)。既有监控组件(Prometheus/VM/Grafana/PMM/Glowroot/Loki/Alertmanager)不动,只被反代。

**Tech Stack:**
- 前端:React 19 + Vite 8 + TypeScript 6 + Ant Design 6 + react-router 7 + zustand 5 + Vitest 3 + @testing-library/react + axios
- 后端:Python 3.11+ / FastAPI / uvicorn / httpx / PyJWT / itsdangerous / python-multipart / pytest + pytest-asyncio + respx
- 部署:systemd + Nginx,Python venv

**Reference spec:** `docs/superpowers/specs/2026-07-06-monitor-platform-design.md`

---

## File Structure

### 新增文件

**后端(`backend/`):**
- `backend/requirements.txt` — Python 依赖
- `backend/app/__init__.py`
- `backend/app/main.py` — FastAPI 入口,挂载路由,全局异常处理
- `backend/app/config.py` — Settings(pydantic-settings,组件地址/OIDC/JWT 密钥)
- `backend/app/deps.py` — 依赖注入:当前用户、JWT 校验
- `backend/app/auth/__init__.py`
- `backend/app/auth/router.py` — `/api/auth/*` 路由(login/callback/logout/me/verify)
- `backend/app/auth/oidc.py` — OIDC 适配层(可插拔,默认标准 OIDC)
- `backend/app/auth/roles.py` — IdP group → ops/dev/mgmt 映射
- `backend/app/alerts/__init__.py`
- `backend/app/alerts/router.py` — `/api/alerts` 透传 Alertmanager
- `backend/app/alerts/schemas.py` — 告警响应模型
- `backend/app/overview/__init__.py`
- `backend/app/overview/router.py` — `/api/overview/health` + `/alerts-summary`
- `backend/app/overview/components.py` — 组件地址清单与探活逻辑
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — pytest fixtures
- `backend/tests/test_auth.py` — 认证接口测试
- `backend/tests/test_alerts.py` — 告警接口测试
- `backend/tests/test_overview.py` — 总览接口测试
- `backend/tests/test_oidc.py` — OIDC 适配层测试
- `backend/README.md` — 后端说明
- `backend/.gitignore` — `__pycache__/`,`.venv/`,`*.pyc`

**前端(`frontend/`):**
- `frontend/src/lib/api.ts` — axios 实例,401 拦截跳登录
- `frontend/src/lib/auth.ts` — 认证 API 封装(login/callback/me/logout)
- `frontend/src/lib/alerts.ts` — 告警 API 封装
- `frontend/src/lib/overview.ts` — 总览 API 封装
- `frontend/src/pages/Overview.tsx` — 总览首页(原生)
- `frontend/src/pages/Alerts.tsx` — 告警列表(原生)
- `frontend/src/components/OverviewHealth.tsx` — 组件健康卡片
- `frontend/src/components/AlertList.tsx` — 告警列表组件
- `frontend/src/test/setup.ts` — Vitest setup
- `frontend/src/test/utils.tsx` — renderWithRouter helper
- `frontend/src/test/AlertList.test.tsx`
- `frontend/src/test/Overview.test.tsx`
- `frontend/src/test/Dashboard.test.tsx`
- `frontend/vitest.config.ts`

**部署(`deploy/`):**
- `deploy/portal-backend.service` — FastAPI systemd unit
- `deploy/nginx-portal.conf` — 门户 Nginx server 块(整合版)

### 修改文件

- `frontend/package.json` — 加 vitest、@testing-library/react、@testing-library/jest-dom、jsdom、axios
- `frontend/vite.config.ts` — dev 代理改为同域反代路径(`/grafana` `/pmm` `/glowroot` `/prometheus` `/loki` `/vmselect` `/api`),移除旧 `/api/proxy/*` 与 `/v1` `/graph`
- `frontend/src/config/menus.ts` — url 改为同域反代路径;加"总览首页""告警中心"两个原生页菜单项;按监控类型重组分类
- `frontend/src/App.tsx` — 加 Overview/Alerts 路由;Login 改为跳 OIDC
- `frontend/src/pages/Login.tsx` — mock 登录改为跳 `/api/auth/login`
- `frontend/src/pages/Dashboard.tsx` — 保留 iframe 容器逻辑(微调:总览/告警不在其内)
- `frontend/src/store/authStore.ts` — user 改为从 `/api/auth/me` 获取,移除默认 mock 用户,加 init() 拉取
- `frontend/src/components/ProtectedRoute.tsx` — 改为校验真实认证状态(调 me/init)
- `frontend/src/components/Layout/MainLayout.tsx` — 菜单加总览/告警入口;登出调后端
- `nginx/nginx.conf` — 整合为统一入口(参考 deploy/nginx-portal.conf,或直接替换)
- `DEPLOY.md` — 更新部署说明(后端 systemd、venv、新 Nginx)

---

## Task 0: 工作分支

**Files:** —

- [ ] **Step 1: 创建并切换到 feature 分支**

```bash
git checkout -b feat/monitor-portal
```

Expected: `Switched to a new branch 'feat/monitor-portal'`

- [ ] **Step 2: 确认分支**

```bash
git branch --show-current
```

Expected: `feat/monitor-portal`

---

## Task 1: 后端项目骨架与依赖

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.gitignore`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/README.md`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: 写 `backend/requirements.txt`**

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
pydantic-settings==2.7.1
PyJWT==2.10.1
itsdangerous==2.2.0
python-multipart==0.0.20
pytest==8.3.4
pytest-asyncio==0.25.0
respx==0.22.0
```

- [ ] **Step 2: 写 `backend/.gitignore`**

```text
__pycache__/
*.pyc
.venv/
.pytest_cache/
*.egg-info/
```

- [ ] **Step 3: 写 `backend/app/__init__.py`(空文件)**

```text
```

- [ ] **Step 4: 写 `backend/app/config.py`**

```python
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
```

- [ ] **Step 5: 写 `backend/app/main.py`(最小可用,后续 Task 往里挂路由)**

```python
from fastapi import FastAPI

app = FastAPI(title="统一监控门户后端", version="0.1.0")


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 6: 写 `backend/tests/__init__.py`(空文件)**

```text
```

- [ ] **Step 7: 写 `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
```

- [ ] **Step 8: 写 `backend/README.md`**

```markdown
# Portal Backend

FastAPI backend for the unified monitoring portal.

## Develop

```bash
cd backend
python -m venv .venv
. .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Test

```bash
pytest -v
```

## Config

All settings via `PORTAL_` env vars (see `app/config.py`). Copy `.env.example` to `.env` for local dev.
```

- [ ] **Step 9: 建虚拟环境并安装依赖**

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Expected: 安装成功,无报错。

- [ ] **Step 10: 写 `backend/tests/test_health.py` 验证骨架**

```python
from fastapi.testclient import TestClient


def test_healthz(client: TestClient):
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 11: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest -v && cd ..
```

Expected: `1 passed`

- [ ] **Step 12: 提交**

```bash
git add backend/
git commit -m "feat(backend): scaffold FastAPI project with config and healthz"
```

---

## Task 2: JWT 工具与依赖注入

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/jwt.py`
- Create: `backend/app/deps.py`
- Create: `backend/tests/test_jwt.py`

- [ ] **Step 1: 写 `backend/app/auth/__init__.py`(空文件)**

```text
```

- [ ] **Step 2: 写失败测试 `backend/tests/test_jwt.py`**

```python
import pytest

from app.auth.jwt import create_token, verify_token


def test_create_and_verify_roundtrip():
    token = create_token({"sub": "alice", "role": "ops", "name": "Alice"})
    payload = verify_token(token)
    assert payload["sub"] == "alice"
    assert payload["role"] == "ops"
    assert payload["name"] == "Alice"


def test_verify_invalid_token_raises():
    with pytest.raises(Exception):
        verify_token("not.a.valid.token")
```

- [ ] **Step 3: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_jwt.py -v && cd ..
```

Expected: FAIL — `ModuleNotFoundError: app.auth.jwt`

- [ ] **Step 4: 写 `backend/app/auth/jwt.py`**

```python
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, status

from app.config import settings


def create_token(claims: dict[str, Any]) -> str:
    payload = {
        **claims,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_ttl_seconds),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
```

- [ ] **Step 5: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_jwt.py -v && cd ..
```

Expected: `2 passed`

- [ ] **Step 6: 写 `backend/app/deps.py`**

```python
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.jwt import verify_token
from app.config import settings


def _token_from_cookie(request: Request) -> str | None:
    return request.cookies.get(settings.cookie_name)


async def current_user(request: Request) -> dict:
    token = _token_from_cookie(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return verify_token(token)
```

- [ ] **Step 7: 提交**

```bash
git add backend/app/auth/__init__.py backend/app/auth/jwt.py backend/app/deps.py backend/tests/test_jwt.py
git commit -m "feat(backend): add JWT utilities and auth dependency"
```

---

## Task 3: 角色映射

**Files:**
- Create: `backend/app/auth/roles.py`
- Create: `backend/tests/test_roles.py`

- [ ] **Step 1: 写失败测试 `backend/tests/test_roles.py`**

```python
from app.auth.roles import map_role


def test_ops_group_maps_to_ops():
    assert map_role(["monitoring-ops", "everyone"]) == "ops"


def test_dev_group_maps_to_dev():
    assert map_role(["monitoring-dev"]) == "dev"


def test_mgmt_group_maps_to_mgmt():
    assert map_role(["monitoring-mgmt"]) == "mgmt"


def test_no_known_group_defaults_to_dev():
    assert map_role(["everyone", "some-other"]) == "dev"


def test_ops_takes_precedence_over_dev():
    assert map_role(["monitoring-dev", "monitoring-ops"]) == "ops"
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_roles.py -v && cd ..
```

Expected: FAIL — `ModuleNotFoundError: app.auth.roles`

- [ ] **Step 3: 写 `backend/app/auth/roles.py`**

```python
from app.config import settings

_PRECEDENCE = ("ops", "dev", "mgmt")


def map_role(groups: list[str]) -> str:
    group_set = set(groups or [])
    group_to_role = {
        settings.role_group_ops: "ops",
        settings.role_group_dev: "dev",
        settings.role_group_mgmt: "mgmt",
    }
    for role in _PRECEDENCE:
        if group_to_role[role] and any(g == group_to_role[role] for g in group_set):
            return role
    return "dev"
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_roles.py -v && cd ..
```

Expected: `5 passed`

- [ ] **Step 5: 提交**

```bash
git add backend/app/auth/roles.py backend/tests/test_roles.py
git commit -m "feat(backend): add IdP group to portal role mapping"
```

---

## Task 4: OIDC 适配层(可插拔)

**Files:**
- Create: `backend/app/auth/oidc.py`
- Create: `backend/tests/test_oidc.py`

- [ ] **Step 1: 写失败测试 `backend/tests/test_oidc.py`**

```python
import httpx
import pytest
import respx

from app.auth.oidc import OIDCProvider


@pytest.fixture
def provider():
    return OIDCProvider()


def test_authorize_url_builds_redirect(provider):
    url = provider.authorize_url(state="abc123", redirect_uri="http://localhost/api/auth/callback")
    assert "response_type=code" in url
    assert "client_id=portal" in url
    assert "state=abc123" in url
    assert "redirect_uri=" in url
    assert "scope=openid" in url


@respx.mock
def test_exchange_code_returns_tokens(provider):
    respx.post("https://idp.example.com/token").mock(
        return_value=httpx.Response(200, json={"access_token": "AT", "id_token": "IT", "token_type": "Bearer"})
    )
    tokens = provider.exchange_code(code="xyz", redirect_uri="http://localhost/api/auth/callback")
    assert tokens["access_token"] == "AT"


@respx.mock
def test_fetch_userinfo_returns_claims(provider):
    respx.get("https://idp.example.com/userinfo").mock(
        return_value=httpx.Response(200, json={"sub": "u1", "preferred_username": "alice", "groups": ["monitoring-ops"]})
    )
    claims = provider.fetch_userinfo(access_token="AT")
    assert claims["sub"] == "u1"
    assert claims["preferred_username"] == "alice"
    assert "monitoring-ops" in claims["groups"]
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_oidc.py -v && cd ..
```

Expected: FAIL — `ModuleNotFoundError: app.auth.oidc`

- [ ] **Step 3: 写 `backend/app/auth/oidc.py`**

```python
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
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_oidc.py -v && cd ..
```

Expected: `3 passed`

- [ ] **Step 5: 提交**

```bash
git add backend/app/auth/oidc.py backend/tests/test_oidc.py
git commit -m "feat(backend): add pluggable OIDC adapter (default standard OIDC)"
```

---

## Task 5: 认证路由(login / callback / logout / me / verify)

**Files:**
- Create: `backend/app/auth/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: 写失败测试 `backend/tests/test_auth.py`**

```python
import httpx
import respx
from fastapi.testclient import TestClient


def test_me_unauthenticated_returns_401(client: TestClient):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_login_redirects_to_idp(client: TestClient):
    resp = client.get("/api/auth/login", follow_redirects=False)
    assert resp.status_code == 302
    assert "idp.example.com/authorize" in resp.headers["location"]
    assert "response_type=code" in resp.headers["location"]


@respx.mock
def test_callback_exchanges_code_sets_cookie_and_redirects(client: TestClient, monkeypatch):
    monkeypatch.setattr("app.auth.oidc.OIDCProvider.exchange_code", lambda self, code, redirect_uri: {"access_token": "AT"})
    monkeypatch.setattr(
        "app.auth.oidc.OIDCProvider.fetch_userinfo",
        lambda self, access_token: {"sub": "u1", "preferred_username": "alice", "groups": ["monitoring-ops"]},
    )
    resp = client.get("/api/auth/callback?code=xyz&state=abc", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "/dashboard"
    set_cookie = resp.headers.get("set-cookie", "")
    assert "portal_session=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_me_with_session_returns_user(client: TestClient):
    from app.auth.jwt import create_token
    token = create_token({"sub": "alice", "role": "ops", "name": "Alice"})
    resp = client.get("/api/auth/me", cookies={"portal_session": token})
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "alice"
    assert body["role"] == "ops"
    assert body["displayName"] == "Alice"


def test_verify_endpoint_sets_x_auth_user_header(client: TestClient):
    from app.auth.jwt import create_token
    token = create_token({"sub": "alice", "role": "ops", "name": "Alice"})
    resp = client.get("/api/auth/verify", cookies={"portal_session": token})
    assert resp.status_code == 200
    assert resp.headers["x-auth-user"] == "alice"


def test_verify_without_session_returns_401(client: TestClient):
    resp = client.get("/api/auth/verify")
    assert resp.status_code == 401
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_auth.py -v && cd ..
```

Expected: FAIL — 路由不存在(404)。

- [ ] **Step 3: 写 `backend/app/auth/router.py`**

```python
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, Response

from app.auth.jwt import create_token, verify_token
from app.auth.oidc import oidc
from app.auth.roles import map_role
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
```

- [ ] **Step 4: 修改 `backend/app/main.py` 挂载路由**

```python
from fastapi import FastAPI

from app.auth.router import router as auth_router

app = FastAPI(title="统一监控门户后端", version="0.1.0")
app.include_router(auth_router)


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 5: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_auth.py -v && cd ..
```

Expected: `6 passed`

- [ ] **Step 6: 运行全部测试确认无回归**

```bash
cd backend && . .venv/bin/activate && pytest -v && cd ..
```

Expected: 全部 passed(test_jwt + test_roles + test_oidc + test_auth + test_health)

- [ ] **Step 7: 提交**

```bash
git add backend/app/auth/router.py backend/app/main.py backend/tests/test_auth.py
git commit -m "feat(backend): add auth routes (login/callback/logout/me/verify)"
```

---

## Task 6: 告警接口(透传 Alertmanager)

**Files:**
- Create: `backend/app/alerts/__init__.py`
- Create: `backend/app/alerts/schemas.py`
- Create: `backend/app/alerts/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_alerts.py`

- [ ] **Step 1: 写 `backend/app/alerts/__init__.py`(空文件)**

```text
```

- [ ] **Step 2: 写失败测试 `backend/tests/test_alerts.py`**

```python
import httpx
import respx
from fastapi.testclient import TestClient


@respx.mock
def test_alerts_proxies_alertmanager_active(client: TestClient):
    route = respx.get("http://172.16.10.27:9093/api/v2/alerts").mock(
        return_value=httpx.Response(200, json=[{"labels": {"alertname": "InstanceDown", "severity": "critical"}}])
    )
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    assert resp.json() == [{"labels": {"alertname": "InstanceDown", "severity": "critical"}}]
    assert "active=true" in route.calls.last.request.url


@respx.mock
def test_alerts_includes_inactive_when_param_set(client: TestClient):
    route = respx.get("http://172.16.10.27:9093/api/v2/alerts").mock(
        return_value=httpx.Response(200, json=[])
    )
    resp = client.get("/api/alerts?active=false")
    assert resp.status_code == 200
    assert "active=false" in route.calls.last.request.url


@respx.mock
def test_alerts_alertmanager_unreachable_returns_502(client: TestClient):
    respx.get("http://172.16.10.27:9093/api/v2/alerts").mock(side_effect=httpx.ConnectError("boom"))
    resp = client.get("/api/alerts")
    assert resp.status_code == 502
    assert resp.json()["detail"] == "alertmanager_unreachable"
```

- [ ] **Step 3: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_alerts.py -v && cd ..
```

Expected: FAIL — 路由不存在(404)。

- [ ] **Step 4: 写 `backend/app/alerts/schemas.py`**

```python
from typing import Any

from pydantic import BaseModel


class AlertError(BaseModel):
    detail: str
```

- [ ] **Step 5: 写 `backend/app/alerts/router.py`**

```python
import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
async def list_alerts(active: bool = Query(default=True)) -> list:
    params = {"active": "true" if active else "false"}
    try:
        resp = await httpx.AsyncClient(timeout=5.0).aget(
            f"{settings.alertmanager_url}/api/v2/alerts",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, httpx.ConnectError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="alertmanager_unreachable")
```

- [ ] **Step 6: 修改 `backend/app/main.py` 挂载告警路由**

```python
from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.alerts.router import router as alerts_router

app = FastAPI(title="统一监控门户后端", version="0.1.0")
app.include_router(auth_router)
app.include_router(alerts_router)


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 7: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_alerts.py -v && cd ..
```

Expected: `3 passed`

- [ ] **Step 8: 提交**

```bash
git add backend/app/alerts/ backend/app/main.py backend/tests/test_alerts.py
git commit -m "feat(backend): add alerts proxy to Alertmanager /api/v2/alerts"
```

---

## Task 7: 总览接口(组件健康 + 告警摘要)

**Files:**
- Create: `backend/app/overview/__init__.py`
- Create: `backend/app/overview/components.py`
- Create: `backend/app/overview/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_overview.py`

- [ ] **Step 1: 写 `backend/app/overview/__init__.py`(空文件)**

```text
```

- [ ] **Step 2: 写失败测试 `backend/tests/test_overview.py`**

```python
import httpx
import respx
from fastapi.testclient import TestClient


@respx.mock
def test_health_probes_all_components(client: TestClient):
    respx.get("http://172.16.10.99:3001/api/health").mock(return_value=httpx.Response(200, json={"database": "ok"}))
    respx.get("http://172.16.10.99:30080/-/healthy").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:4000").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:9090/-/healthy").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:3100/ready").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:8481/health").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:9093/-/healthy").mock(return_value=httpx.Response(200, text="ok"))

    resp = client.get("/api/overview/health")
    assert resp.status_code == 200
    results = {r["name"]: r for r in resp.json()}
    assert results["grafana"]["status"] == "up"
    assert results["pmm"]["status"] == "up"
    assert results["glowroot"]["status"] == "up"
    assert results["prometheus"]["status"] == "up"
    assert results["loki"]["status"] == "up"
    assert results["vmselect"]["status"] == "up"
    assert results["alertmanager"]["status"] == "up"


@respx.mock
def test_health_marks_down_component_on_timeout(client: TestClient):
    respx.get("http://172.16.10.99:3001/api/health").mock(return_value=httpx.Response(200, json={}))
    respx.get("http://172.16.10.99:30080/-/healthy").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:4000").mock(side_effect=httpx.ConnectTimeout("slow"))
    respx.get("http://172.16.10.27:9090/-/healthy").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:3100/ready").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:8481/health").mock(return_value=httpx.Response(200, text="ok"))
    respx.get("http://172.16.10.27:9093/-/healthy").mock(return_value=httpx.Response(200, text="ok"))

    resp = client.get("/api/overview/health")
    results = {r["name"]: r for r in resp.json()}
    assert results["glowroot"]["status"] == "down"
    assert results["grafana"]["status"] == "up"


@respx.mock
def test_alerts_summary_counts_by_severity(client: TestClient):
    respx.get("http://172.16.10.27:9093/api/v2/alerts").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"labels": {"severity": "critical"}},
                {"labels": {"severity": "critical"}},
                {"labels": {"severity": "warning"}},
                {"labels": {"severity": "info"}},
                {"labels": {"severity": "unknown"}},
            ],
        )
    )
    resp = client.get("/api/overview/alerts-summary")
    assert resp.status_code == 200
    assert resp.json() == {"critical": 2, "warning": 1, "info": 1, "other": 1, "total": 5}
```

- [ ] **Step 3: 运行测试验证失败**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_overview.py -v && cd ..
```

Expected: FAIL — 路由不存在(404)。

- [ ] **Step 4: 写 `backend/app/overview/components.py`**

```python
from app.config import settings

# (name, health_path) — health_path 为各组件健康检查/探活端点
COMPONENTS: list[tuple[str, str]] = [
    ("grafana", f"{settings.grafana_url}/api/health"),
    ("pmm", f"{settings.pmm_url}/-/healthy"),
    ("glowroot", settings.glowroot_url),
    ("prometheus", f"{settings.prometheus_url}/-/healthy"),
    ("loki", f"{settings.loki_url}/ready"),
    ("vmselect", f"{settings.vmselect_url}/health"),
    ("alertmanager", f"{settings.alertmanager_url}/-/healthy"),
]
```

- [ ] **Step 5: 写 `backend/app/overview/router.py`**

```python
import asyncio
import time
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.overview.components import COMPONENTS

router = APIRouter(prefix="/api/overview", tags=["overview"])

_HEALTH_TIMEOUT = 2.0


async def _probe(name: str, url: str) -> dict:
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=_HEALTH_TIMEOUT) as client:
            resp = await client.get(url)
            ok = resp.status_code < 500
        latency_ms = int((time.monotonic() - start) * 1000)
        return {"name": name, "status": "up" if ok else "down", "latencyMs": latency_ms}
    except (httpx.HTTPError, OSError):
        return {"name": name, "status": "down", "latencyMs": None}


@router.get("/health")
async def health() -> list:
    tasks = [_probe(name, url) for name, url in COMPONENTS]
    return await asyncio.gather(*tasks)


@router.get("/alerts-summary")
async def alerts_summary() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.alertmanager_url}/api/v2/alerts", params={"active": "true"}
            )
            resp.raise_for_status()
            alerts = resp.json()
    except (httpx.HTTPError, OSError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="alertmanager_unreachable")

    counts = {"critical": 0, "warning": 0, "info": 0, "other": 0, "total": len(alerts)}
    for a in alerts:
        sev = (a.get("labels") or {}).get("severity", "other")
        if sev in counts:
            counts[sev] += 1
        else:
            counts["other"] += 1
    return counts
```

- [ ] **Step 6: 修改 `backend/app/main.py` 挂载总览路由**

```python
from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.alerts.router import router as alerts_router
from app.overview.router import router as overview_router

app = FastAPI(title="统一监控门户后端", version="0.1.0")
app.include_router(auth_router)
app.include_router(alerts_router)
app.include_router(overview_router)


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 7: 运行测试验证通过**

```bash
cd backend && . .venv/bin/activate && pytest tests/test_overview.py -v && cd ..
```

Expected: `3 passed`

- [ ] **Step 8: 运行全部后端测试**

```bash
cd backend && . .venv/bin/activate && pytest -v && cd ..
```

Expected: 全部 passed(test_health + test_jwt + test_roles + test_oidc + test_auth + test_alerts + test_overview)

- [ ] **Step 9: 提交**

```bash
git add backend/app/overview/ backend/app/main.py backend/tests/test_overview.py
git commit -m "feat(backend): add overview (component health + alerts summary)"
```

---

## Task 8: 前端测试基础设施

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/utils.tsx`
- Modify: `frontend/tsconfig.app.json`(若需要加 test 类型)

- [ ] **Step 1: 安装测试依赖**

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
cd ..
```

Expected: package.json devDependencies 增加 vitest 等。

- [ ] **Step 2: 写 `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 3: 写 `frontend/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 4: 写 `frontend/src/test/utils.tsx`**

```typescript
import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

export function renderWithRouter(ui: ReactElement, options?: RenderOptions) {
  return render(
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter>{ui}</BrowserRouter>
    </ConfigProvider>,
    options,
  )
}
```

- [ ] **Step 5: 在 `frontend/package.json` scripts 加 test**

修改 `scripts` 字段为:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: 写一个 smoke 测试验证设施可用 `frontend/src/test/smoke.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderWithRouter } from './utils'

describe('smoke', () => {
  it('renders test environment', () => {
    renderWithRouter(<div>hello portal</div>)
    expect(screen.getByText('hello portal')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: 运行测试验证通过**

```bash
cd frontend && npm test && cd ..
```

Expected: `1 passed`

- [ ] **Step 8: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/
git commit -m "test(frontend): add Vitest + testing-library setup"
```

---

## Task 9: 前端 API 层(axios + 封装)

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/lib/alerts.ts`
- Create: `frontend/src/lib/overview.ts`

- [ ] **Step 1: 写 `frontend/src/lib/api.ts`**

```typescript
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
```

- [ ] **Step 2: 写 `frontend/src/lib/auth.ts`**

```typescript
import { api } from './api'

export interface PortalUser {
  username: string
  role: 'ops' | 'dev' | 'mgmt'
  displayName: string
}

export async function login() {
  window.location.href = '/api/auth/login'
}

export async function fetchMe(): Promise<PortalUser> {
  const { data } = await api.get<PortalUser>('/auth/me')
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}
```

- [ ] **Step 3: 写 `frontend/src/lib/alerts.ts`**

```typescript
import { api } from './api'

export interface AlertItem {
  labels: Record<string, string>
  annotations?: Record<string, string>
  startsAt?: string
  endsAt?: string
  status?: { state: string }
}

export async function fetchAlerts(active = true): Promise<AlertItem[]> {
  const { data } = await api.get<AlertItem[]>('/alerts', { params: { active } })
  return data
}
```

- [ ] **Step 4: 写 `frontend/src/lib/overview.ts`**

```typescript
import { api } from './api'

export interface ComponentHealth {
  name: string
  status: 'up' | 'down'
  latencyMs: number | null
}

export interface AlertsSummary {
  critical: number
  warning: number
  info: number
  other: number
  total: number
}

export async function fetchHealth(): Promise<ComponentHealth[]> {
  const { data } = await api.get<ComponentHealth[]>('/overview/health')
  return data
}

export async function fetchAlertsSummary(): Promise<AlertsSummary> {
  const { data } = await api.get<AlertsSummary>('/overview/alerts-summary')
  return data
}
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/lib/
git commit -m "feat(frontend): add API layer (axios + auth/alerts/overview)"
```

---

## Task 10: 改造 authStore 与 ProtectedRoute(对接真实后端)

**Files:**
- Modify: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: 写失败测试 `frontend/src/test/authStore.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { useAuthStore } from '../store/authStore'
import { fetchMe } from '../lib/auth'

vi.mock('../lib/auth', () => ({
  login: vi.fn(),
  fetchMe: vi.fn(),
  logout: vi.fn(),
}))

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
    vi.clearAllMocks()
  })

  it('init() loads user from /auth/me', async () => {
    ;(fetchMe as any).mockResolvedValue({ username: 'alice', role: 'ops', displayName: 'Alice' })
    const { init } = useAuthStore.getState()
    await init()
    await waitFor(() => {
      expect(useAuthStore.getState().user?.username).toBe('alice')
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })

  it('init() marks unauthenticated when fetchMe throws 401', async () => {
    ;(fetchMe as any).mockRejectedValue({ response: { status: 401 } })
    const { init } = useAuthStore.getState()
    await init()
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().user).toBeNull()
    })
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd frontend && npm test -- authStore && cd ..
```

Expected: FAIL — `useAuthStore.getState().reset is not a function`(旧 store 没有 reset/init)。

- [ ] **Step 3: 重写 `frontend/src/store/authStore.ts`**

```typescript
import { create } from 'zustand'
import { fetchMe, type PortalUser, login as apiLogin, logout as apiLogout } from '../lib/auth'

interface AuthState {
  user: PortalUser | null
  isAuthenticated: boolean
  loading: boolean
  init: () => Promise<void>
  login: () => void
  logout: () => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => apiLogin(),
  logout: async () => {
    try {
      await apiLogout()
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },
  init: async () => {
    set({ loading: true })
    try {
      const user = await fetchMe()
      set({ user, isAuthenticated: true, loading: false })
    } catch {
      set({ user: null, isAuthenticated: false, loading: false })
    }
  },
  reset: () => set({ user: null, isAuthenticated: false, loading: false }),
}))
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd frontend && npm test -- authStore && cd ..
```

Expected: `2 passed`

- [ ] **Step 5: 重写 `frontend/src/components/ProtectedRoute.tsx`(加 loading 态 + init)**

```tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Spin } from 'antd'
import { useAuthStore } from '../store/authStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, init } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (loading && !isAuthenticated) init()
  }, [loading, isAuthenticated, init])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 6: 重写 `frontend/src/pages/Login.tsx`(跳 OIDC,移除 mock)**

```tsx
import { Card, Typography, Button } from 'antd'
import { LoginOutlined } from '@ant-design/icons'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

export default function Login() {
  const { isAuthenticated, login } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <Card style={{ width: 400, borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>统一监控门户</Title>
          <Text type="secondary">Unified Monitoring Portal</Text>
        </div>
        <Button type="primary" icon={<LoginOutlined />} size="large" block onClick={login}>
          使用公司统一身份登录
        </Button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            通过公司统一身份平台(OIDC)单点登录
          </Text>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: 运行全部前端测试**

```bash
cd frontend && npm test && cd ..
```

Expected: 全部 passed(smoke + authStore)

- [ ] **Step 8: 提交**

```bash
git add frontend/src/store/authStore.ts frontend/src/components/ProtectedRoute.tsx frontend/src/pages/Login.tsx frontend/src/test/authStore.test.tsx
git commit -m "feat(frontend): wire authStore to backend /auth/me and OIDC login"
```

---

## Task 11: 菜单重组(按监控类型 + 总览/告警入口,同域反代路径)

**Files:**
- Modify: `frontend/src/config/menus.ts`

- [ ] **Step 1: 重写 `frontend/src/config/menus.ts`**

```typescript
export interface MenuItem {
  key: string
  label: string
  icon?: string
  url?: string
  native?: boolean
  children?: MenuItem[]
}

export interface RoleConfig {
  name: string
  menus: MenuItem[]
}

export const nativeMenuKeys = {
  overview: 'overview',
  alerts: 'alerts',
} as const

export const roleMenus: Record<string, RoleConfig> = {
  ops: {
    name: '运维人员',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', native: true },
      {
        key: 'system', label: '系统监控', icon: 'DashboardOutlined', children: [
          { key: 'prometheus', label: 'Prometheus', url: '/prometheus/' },
          { key: 'vmselect', label: 'VictoriaMetrics', url: '/vmselect/select/0/prometheus/graph' },
        ],
      },
      {
        key: 'host', label: '主机监控', icon: 'DesktopOutlined', children: [
          { key: 'linux-server', label: '服务器 Linux', url: '/grafana/d/Bkl9bBYik/linux?orgId=1&kiosk=tv' },
        ],
      },
      {
        key: 'db', label: '数据库监控', icon: 'DatabaseOutlined', children: [
          { key: 'pmm', label: 'PMM', url: '/pmm/' },
        ],
      },
      {
        key: 'apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot', label: 'Glowroot APM', url: '/glowroot/' },
        ],
      },
      {
        key: 'logs', label: '日志监控', icon: 'FileTextOutlined', children: [
          { key: 'loki', label: 'Loki', url: '/loki/' },
        ],
      },
      {
        key: 'boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana', label: 'Grafana 首页', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
  dev: {
    name: '开发人员',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', native: true },
      {
        key: 'dev-apm', label: '应用性能', icon: 'ApiOutlined', children: [
          { key: 'glowroot', label: 'Glowroot APM', url: '/glowroot/' },
        ],
      },
      {
        key: 'dev-boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana-dev', label: 'Grafana 开发看板', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
  mgmt: {
    name: '管理层',
    menus: [
      { key: 'overview', label: '总览首页', icon: 'DashboardOutlined', native: true },
      {
        key: 'mgmt-boards', label: '看板总览', icon: 'BarChartOutlined', children: [
          { key: 'grafana-mgmt', label: 'Grafana 概览', url: '/grafana/?kiosk=tv' },
        ],
      },
    ],
  },
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/config/menus.ts
git commit -m "feat(frontend): regroup menu by monitor type, add overview/alerts, switch to same-domain paths"
```

---

## Task 12: 告警列表组件与页面(原生)

**Files:**
- Create: `frontend/src/components/AlertList.tsx`
- Create: `frontend/src/pages/Alerts.tsx`
- Create: `frontend/src/test/AlertList.test.tsx`

- [ ] **Step 1: 写失败测试 `frontend/src/test/AlertList.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from './utils'
import AlertList from '../components/AlertList'

const alerts = [
  { labels: { alertname: 'InstanceDown', severity: 'critical', instance: 'node1' }, annotations: { summary: 'node1 down' }, status: { state: 'firing' } },
  { labels: { alertname: 'DiskFull', severity: 'warning', instance: 'node2' }, annotations: { summary: 'disk 90%' }, status: { state: 'firing' } },
]

describe('AlertList', () => {
  it('renders alerts grouped and colored by severity', () => {
    renderWithRouter(<AlertList alerts={alerts} />)
    expect(screen.getByText('InstanceDown')).toBeInTheDocument()
    expect(screen.getByText('DiskFull')).toBeInTheDocument()
    expect(screen.getByText(/node1/)).toBeInTheDocument()
  })

  it('shows empty placeholder when no alerts', () => {
    renderWithRouter(<AlertList alerts={[]} />)
    expect(screen.getByText('当前无活跃告警')).toBeInTheDocument()
  })

  it('shows error message when error prop set', () => {
    renderWithRouter(<AlertList alerts={[]} error="alertmanager_unreachable" />)
    expect(screen.getByText(/告警服务暂不可用/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd frontend && npm test -- AlertList && cd ..
```

Expected: FAIL — `Cannot find module '../components/AlertList'`

- [ ] **Step 3: 写 `frontend/src/components/AlertList.tsx`**

```tsx
import { Table, Tag, Typography, Empty, Alert } from 'antd'
import type { AlertItem } from '../lib/alerts'

const { Text } = Typography

const severityColor: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
}

interface AlertListProps {
  alerts: AlertItem[]
  error?: string | null
}

export default function AlertList({ alerts, error }: AlertListProps) {
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="告警服务暂不可用"
        description={error}
        style={{ margin: 24 }}
      />
    )
  }

  if (!alerts.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty description="当前无活跃告警" />
      </div>
    )
  }

  const columns = [
    {
      title: '严重度',
      dataIndex: ['labels', 'severity'],
      width: 100,
      render: (sev: string) => <Tag color={severityColor[sev] || 'default'}>{sev || 'unknown'}</Tag>,
    },
    { title: '告警名', dataIndex: ['labels', 'alertname'], width: 200 },
    { title: '实例', dataIndex: ['labels', 'instance'], width: 180 },
    {
      title: '摘要',
      dataIndex: ['annotations', 'summary'],
      render: (s: string) => <Text type="secondary">{s}</Text>,
    },
    {
      title: '状态',
      dataIndex: ['status', 'state'],
      width: 90,
      render: (st: string) => <Tag color={st === 'firing' ? 'red' : 'green'}>{st || 'firing'}</Tag>,
    },
  ]

  return (
    <Table
      rowKey={(r, i) => `${r.labels.alertname}-${r.labels.instance}-${i}`}
      dataSource={alerts}
      columns={columns}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="middle"
    />
  )
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd frontend && npm test -- AlertList && cd ..
```

Expected: `3 passed`

- [ ] **Step 5: 写 `frontend/src/pages/Alerts.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Typography, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AlertList from '../components/AlertList'
import { fetchAlerts, type AlertItem } from '../lib/alerts'

const { Title } = Typography

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAlerts(true)
      setAlerts(data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'fetch_failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>告警中心</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
      <AlertList alerts={alerts} error={error} />
    </div>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/AlertList.tsx frontend/src/pages/Alerts.tsx frontend/src/test/AlertList.test.tsx
git commit -m "feat(frontend): add alert list component and alerts page"
```

---

## Task 13: 总览首页组件与页面(原生)

**Files:**
- Create: `frontend/src/components/OverviewHealth.tsx`
- Create: `frontend/src/pages/Overview.tsx`
- Create: `frontend/src/test/Overview.test.tsx`

- [ ] **Step 1: 写失败测试 `frontend/src/test/Overview.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from './utils'
import OverviewHealth from '../components/OverviewHealth'

const health = [
  { name: 'grafana', status: 'up', latencyMs: 12 },
  { name: 'pmm', status: 'down', latencyMs: null },
]

describe('OverviewHealth', () => {
  it('renders up components green and down components red', () => {
    renderWithRouter(<OverviewHealth health={health} />)
    expect(screen.getByText('grafana')).toBeInTheDocument()
    expect(screen.getByText('pmm')).toBeInTheDocument()
    expect(screen.getByText('正常')).toBeInTheDocument()
    expect(screen.getByText('异常')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd frontend && npm test -- Overview && cd ..
```

Expected: FAIL — `Cannot find module '../components/OverviewHealth'`

- [ ] **Step 3: 写 `frontend/src/components/OverviewHealth.tsx`**

```tsx
import { Card, Tag, Row, Col, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ComponentHealth } from '../lib/overview'

interface OverviewHealthProps {
  health: ComponentHealth[]
  loading?: boolean
}

export default function OverviewHealth({ health, loading }: OverviewHealthProps) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
  }
  return (
    <Row gutter={[12, 12]}>
      {health.map((c) => (
        <Col key={c.name} xs={12} sm={8} md={6} lg={4}>
          <Card size="small" bodyStyle={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{c.name}</div>
            {c.status === 'up' ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
            )}
            <div style={{ marginTop: 8 }}>
              <Tag color={c.status === 'up' ? 'green' : 'red'}>{c.status === 'up' ? '正常' : '异常'}</Tag>
            </div>
            {c.latencyMs != null && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{c.latencyMs}ms</div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  )
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd frontend && npm test -- Overview && cd ..
```

Expected: `1 passed`

- [ ] **Step 5: 写 `frontend/src/pages/Overview.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Typography, Card, Row, Col, Statistic, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import OverviewHealth from '../components/OverviewHealth'
import { fetchHealth, fetchAlertsSummary, type ComponentHealth, type AlertsSummary } from '../lib/overview'
import { useAuthStore } from '../store/authStore'
import { roleMenus, type MenuItem } from '../config/menus'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

function findLeafUrl(items: MenuItem[]): string | undefined {
  for (const item of items) {
    if (item.url) return item.url
    if (item.children) {
      const found = findLeafUrl(item.children)
      if (found) return found
    }
  }
}

export default function Overview() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [health, setHealth] = useState<ComponentHealth[]>([])
  const [summary, setSummary] = useState<AlertsSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [h, s] = await Promise.all([fetchHealth(), fetchAlertsSummary()])
      setHealth(h)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const menus = roleMenus[user?.role || 'dev']?.menus || []
  const quickBoards = menus.filter((m) => m.children).flatMap((m) => m.children!).filter((c) => c.url).slice(0, 6)

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>总览首页</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card title="告警摘要" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}><Statistic title="Critical" value={summary?.critical ?? '-'} valueStyle={{ color: '#cf1322' }} /></Col>
          <Col span={4}><Statistic title="Warning" value={summary?.warning ?? '-'} valueStyle={{ color: '#d48806' }} /></Col>
          <Col span={4}><Statistic title="Info" value={summary?.info ?? '-'} /></Col>
          <Col span={4}><Statistic title="其他" value={summary?.other ?? '-'} /></Col>
          <Col span={4}><Statistic title="合计" value={summary?.total ?? '-'} /></Col>
        </Row>
      </Card>

      <Card title="组件健康" size="small" style={{ marginBottom: 16 }}>
        <OverviewHealth health={health} loading={loading} />
      </Card>

      <Card title="常用看板" size="small">
        <Space wrap>
          {quickBoards.map((b) => (
            <Button key={b.key} onClick={() => navigate(`/dashboard/${b.key}`)}>{b.label}</Button>
          ))}
        </Space>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/OverviewHealth.tsx frontend/src/pages/Overview.tsx frontend/src/test/Overview.test.tsx
git commit -m "feat(frontend): add overview page (alerts summary + health + quick boards)"
```

---

## Task 14: 路由与 Dashboard 容器整合(原生页 + iframe)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/components/Layout/MainLayout.tsx`
- Create: `frontend/src/test/Dashboard.test.tsx`

- [ ] **Step 1: 写失败测试 `frontend/src/test/Dashboard.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRouter } from './utils'
import Dashboard from '../pages/Dashboard'

describe('Dashboard', () => {
  it('renders iframe with the menu item url', () => {
    renderWithRouter(<Dashboard url="/grafana/d/test?kiosk=tv" title="测试看板" />)
    const frame = document.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame?.getAttribute('src')).toBe('/grafana/d/test?kiosk=tv')
  })

  it('shows placeholder when no url', () => {
    renderWithRouter(<Dashboard url="" title="" />)
    expect(screen.getByText('暂无可用看板')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd frontend && npm test -- Dashboard && cd ..
```

Expected: FAIL — `Dashboard` 不接受 url prop(当前从 route param 取)。

- [ ] **Step 3: 重写 `frontend/src/pages/Dashboard.tsx`(改为接收 url/title 的纯 iframe 容器)**

```tsx
import IframeView from '../components/IframeView'

interface DashboardProps {
  url: string
  title?: string
}

export default function Dashboard({ url, title }: DashboardProps) {
  if (!url) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
        暂无可用看板
      </div>
    )
  }
  return <IframeView url={url} title={title} />
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd frontend && npm test -- Dashboard && cd ..
```

Expected: `2 passed`

- [ ] **Step 5: 重写 `frontend/src/App.tsx`(总览/告警原生路由 + iframe 动态路由)**

```tsx
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './components/Layout/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import Alerts from './pages/Alerts'
import NotFound from './pages/NotFound'
import { useAuthStore } from './store/authStore'
import { roleMenus, type MenuItem, nativeMenuKeys } from './config/menus'

function findItemByKey(items: MenuItem[], key: string): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item
    if (item.children) {
      const found = findItemByKey(item.children, key)
      if (found) return found
    }
  }
}

function DashboardRoute() {
  const { menuKey } = useParams<{ menuKey: string }>()
  const user = useAuthStore((s) => s.user)
  const menus = roleMenus[user?.role || 'dev']?.menus || []
  const item = findItemByKey(menus, menuKey || '')
  if (!item) return <NotFound />
  if (item.native) {
    if (item.key === nativeMenuKeys.overview) return <Overview />
    if (item.key === nativeMenuKeys.alerts) return <Alerts />
  }
  return <Dashboard url={item.url || ''} title={item.label} />
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path=":menuKey" element={<DashboardRoute />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
```

- [ ] **Step 6: 修改 `MainLayout.tsx` 的 `handleMenuClick`,处理 native 项**

把 `handleMenuClick` 改为:

```tsx
const handleMenuClick = ({ key }: { key: string }) => {
  navigate(`/dashboard/${key}`)
}
```

并把 `handleLogout` 改为异步调后端:

```tsx
const handleLogout = async () => {
  await logout()
  navigate('/login')
}
```

并补 `AlertOutlined`、`FileTextOutlined` 到 `iconMap` 与 import:

```tsx
import {
  BarChartOutlined, DashboardOutlined, DatabaseOutlined, DesktopOutlined,
  ApiOutlined, AlertOutlined, FileTextOutlined, LogoutOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'

const iconMap: Record<string, React.ReactNode> = {
  BarChartOutlined: <BarChartOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  DesktopOutlined: <DesktopOutlined />,
  ApiOutlined: <ApiOutlined />,
  AlertOutlined: <AlertOutlined />,
  FileTextOutlined: <FileTextOutlined />,
}
```

- [ ] **Step 7: 运行全部前端测试**

```bash
cd frontend && npm test && cd ..
```

Expected: 全部 passed(smoke + authStore + AlertList + Overview + Dashboard)

- [ ] **Step 8: 运行 lint**

```bash
cd frontend && npm run lint && cd ..
```

Expected: 无错误。

- [ ] **Step 9: 提交**

```bash
git add frontend/src/App.tsx frontend/src/pages/Dashboard.tsx frontend/src/components/Layout/MainLayout.tsx frontend/src/test/Dashboard.test.tsx
git commit -m "feat(frontend): wire routes for overview/alerts/native + iframe container"
```

---

## Task 15: vite dev 代理对齐同域反代路径

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 重写 `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const COMPONENTS = 'https://172.16.10.99'

function hideFrameHeaders(proxyRes: any) {
  delete proxyRes.headers['x-frame-options']
  if (proxyRes.headers['content-security-policy']) {
    proxyRes.headers['content-security-policy'] =
      proxyRes.headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/g, '')
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1009,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/grafana': {
        target: COMPONENTS,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', COMPONENTS)
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/pmm': {
        target: COMPONENTS,
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/pmm/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', COMPONENTS)
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/glowroot': {
        target: 'http://172.16.10.27:4000',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
      '/prometheus': {
        target: 'http://172.16.10.27:9090',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
      '/loki': {
        target: 'http://172.16.10.27:3100',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
      '/vmselect': {
        target: 'http://172.16.10.27:8481',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
    },
  },
})
```

- [ ] **Step 2: 启动 dev server 冒烟(手动,记录结果)**

```bash
cd frontend && npm run dev
```

打开 http://localhost:1009,确认登录页渲染、`/api/auth/login` 能跳到 OIDC(IdP 未配时会跳到 idp.example.com,属预期)。Ctrl+C 停止。

- [ ] **Step 3: 提交**

```bash
git add frontend/vite.config.ts
git commit -m "feat(frontend): align vite dev proxy to same-domain reverse-proxy paths"
```

---

## Task 16: 部署文件(systemd + Nginx)

**Files:**
- Create: `deploy/portal-backend.service`
- Create: `deploy/nginx-portal.conf`
- Modify: `nginx/nginx.conf`(用 deploy/nginx-portal.conf 内容整合或替换)
- Modify: `DEPLOY.md`

- [ ] **Step 1: 写 `deploy/portal-backend.service`**

```ini
[Unit]
Description=Portal Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=portal
Group=portal
WorkingDirectory=/data/software/portal-backend
EnvironmentFile=/data/software/portal-backend/.env
ExecStart=/data/software/portal-backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: 写 `deploy/nginx-portal.conf`**

```nginx
server {
    listen 80;
    server_name 172.16.10.99;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /grafana/ {
        auth_request /_auth;
        proxy_set_header X-Auth-User $upstream_http_x_auth_user;
        proxy_pass http://172.16.10.99:3001/grafana/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
        proxy_redirect /grafana/ /grafana/;
    }

    location /pmm/ {
        proxy_pass http://172.16.10.99:30080/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }

    location /glowroot/ {
        proxy_pass http://172.16.10.27:4000/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }

    location /prometheus/ {
        proxy_pass http://172.16.10.27:9090/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }

    location /loki/ {
        proxy_pass http://172.16.10.27:3100/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }

    location /vmselect/ {
        proxy_pass http://172.16.10.27:8481/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }

    location = /_auth {
        internal;
        proxy_pass http://127.0.0.1:8000/api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
    }
}
```

- [ ] **Step 3: 用 `deploy/nginx-portal.conf` 内容替换 `nginx/nginx.conf`**

(将 `nginx/nginx.conf` 改为与 `deploy/nginx-portal.conf` 一致;旧的 8080 监听和 `/api/proxy/grafana` 配置废弃。)

- [ ] **Step 4: 重写 `DEPLOY.md`**

```markdown
# 部署说明

## 架构概览

监控组件部署在预警服务器 172.16.10.99(VIP),通过门户 Nginx 同域反代统一暴露:
- 门户前端: http://172.16.10.99/
- Grafana: http://172.16.10.99/grafana/
- PMM: http://172.16.10.99/pmm/
- Glowroot: http://172.16.10.99/glowroot/
- Prometheus: http://172.16.10.99/prometheus/
- Loki: http://172.16.10.99/loki/
- VictoriaMetrics: http://172.16.10.99/vmselect/

## 后端部署(systemd)

1. 复制 `backend/` 到 `/data/software/portal-backend/`
2. 创建 venv:`python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`
3. 创建 `.env`,设置 `PORTAL_*` 环境变量(见 `backend/app/config.py`),重点:`PORTAL_JWT_SECRET`、`PORTAL_OIDC_*`、`PORTAL_PUBLIC_BASE_URL`
4. 安装 systemd unit:`sudo cp deploy/portal-backend.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now portal-backend`
5. 验证:`curl http://127.0.0.1:8000/api/healthz` 返回 `{"status":"ok"}`

## 前端构建部署

```bash
cd frontend
npm install
npm run build          # 产出到 frontend/dist/
```

将 `dist/` 内容复制到 Nginx HTML 目录(`/usr/share/nginx/html`)。

## Nginx 配置

将 `deploy/nginx-portal.conf` 内容合并到 Nginx 配置(接管 80 作为统一入口,或调整 listen 端口避免与既有 Nginx 冲突)。重载:`sudo nginx -t && sudo systemctl reload nginx`。

## Grafana Auth Proxy 集成

1. 合并 `grafana/grafana-auth-proxy.ini` 到 `/etc/grafana/grafana.ini`
2. 设置 `server.root_url = http://172.16.10.99/grafana/`
3. 重启 `systemctl restart grafana-server`
4. 门户 Nginx 经 `auth_request /_auth` 注入 `X-Auth-User` 头,实现免密登录

## iframe 跨域

所有组件反代已 `proxy_hide_header X-Frame-Options / Content-Security-Policy`,iframe 同域嵌入无需额外 CORS 配置。

## 本地开发

```bash
cd frontend && npm install && npm run dev   # http://localhost:1009
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload  # http://localhost:8000
```

vite dev proxy 已对齐同域反代路径,本地开发即可联调。
```

- [ ] **Step 5: 提交**

```bash
git add deploy/ nginx/nginx.conf DEPLOY.md
git commit -m "feat: add deployment files (systemd + nginx portal config) and update DEPLOY.md"
```

---

## Task 17: 端到端联调验证(手动清单)

**Files:** —

- [ ] **Step 1: 后端单测全绿**

```bash
cd backend && . .venv/bin/activate && pytest -v && cd ..
```

Expected: 全部 passed。

- [ ] **Step 2: 前端单测全绿**

```bash
cd frontend && npm test && cd ..
```

Expected: 全部 passed。

- [ ] **Step 3: 前端构建通过**

```bash
cd frontend && npm run build && cd ..
```

Expected: `dist/` 产出,无 TypeScript 错误。

- [ ] **Step 4: 本地联调(配通 OIDC 或临时 mock)**

启动后端与前端 dev server,用浏览器走一遍:
- 登录 → 跳 OIDC(若 IdP 未就绪,临时在 `oidc.py` 注入一个 mock userinfo 走通流程,验证后回退)
- 登录后 → 总览首页加载(告警摘要 + 组件健康 + 快捷入口)
- 点告警中心 → 告警列表(Alertmanager 有告警时显示,无时显示空占位)
- 点 Grafana 菜单 → iframe 加载看板(注意 IdP/Grafana auth proxy 在本地需配)
- 切换 ops/dev/mgmt 角色 → 菜单不同

- [ ] **Step 5: 记录联调结果**

在 PR 描述里记录第 4 步每项的观察(通过/异常)。

- [ ] **Step 6: 最终提交(如有联调修复)**

```bash
git add -A
git commit -m "fix: end-to-end integration adjustments"
```

---

## Task 18: 合并到 main

**Files:** —

- [ ] **Step 1: 确认所有测试通过**

```bash
cd backend && . .venv/bin/activate && pytest -v && cd ..
cd frontend && npm test && npm run build && cd ..
```

Expected: 全绿。

- [ ] **Step 2: 推送 feature 分支**

```bash
git push -u origin feat/monitor-portal
```

- [ ] **Step 3: 创建 PR**

```bash
gh pr create --title "feat: 统一监控门户(iframe 聚合 + 原生告警与总览 + OIDC)" --body "$(cat <<'EOF'
## Summary
- 新增 FastAPI 后端(OIDC 认证 / Alertmanager 代理 / 组件健康聚合)
- 前端菜单按监控类型重组,iframe 嵌入改为同域反代路径
- 新增原生总览首页与告警中心
- 部署文件(systemd + Nginx 同域反代)

## Test plan
- [x] 后端 pytest 全绿
- [x] 前端 vitest 全绿
- [x] 前端构建通过
- [ ] 端到端联调(待 IdP 配置后补)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: 返回 PR URL。

---

## Self-Review Notes

**Spec coverage:**
- 第 1 节背景/目标 → Task 0/1/16(架构落地)
- 第 2 节设计选择 → 各 Task 对应实现(iframe 聚合 Task 11/14、告警 Task 6/12、OIDC Task 4/5/10、角色 Task 3/11、FastAPI Task 1-7、systemd+Nginx Task 16、同域反代 Task 15/16)
- 第 3 节三层架构 → Task 1/14/16
- 第 4 节前端结构与菜单 → Task 11/14/15
- 第 5 节后端接口 → Task 2-7(8 个接口全覆盖:login/callback/logout/me/verify/alerts/overview.health/overview.alerts-summary)
- 第 6 节 Nginx 反代 → Task 16
- 第 7 节数据流与错误处理 → Task 5/6/7(401 拦截 Task 9、alertmanager_unreachable Task 6/7、组件超时 Task 7)
- 第 8 节部署概要 → Task 16/17

**Placeholder scan:** 无 TBD/TODO;每个 step 含实际代码或确切命令。

**Type consistency:** `PortalUser`/`AlertItem`/`ComponentHealth`/`AlertsSummary` 在 lib 与页面间一致;后端 `map_role`/`create_token`/`verify_token`/`oidc.exchange_code`/`oidc.fetch_userinfo` 在 tests 与 router 间一致;`nativeMenuKeys` 在 menus.ts 与 App.tsx 一致。
