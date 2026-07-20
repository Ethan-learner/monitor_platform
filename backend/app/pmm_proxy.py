"""PMM 代理 - 自动认证后转发请求"""
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response

router = APIRouter(tags=["pmm-proxy"])

PMM_BASE = "https://172.16.10.99"
PMM_USER = "admin"
PMM_PASS = "123456"

_session_cookie = ""
_session_ttl = 0.0


def _ensure_session():
    global _session_cookie, _session_ttl
    import time
    now = time.time()
    if _session_cookie and now - _session_ttl < 1800:
        return _session_cookie
    try:
        with httpx.Client(verify=False, timeout=10) as cli:
            r = cli.post(f"{PMM_BASE}/login", json={"user": PMM_USER, "password": PMM_PASS})
            if r.status_code == 200:
                cookie_header = r.headers.get("set-cookie", "")
                if cookie_header:
                    # 提取 grafana_session cookie
                    for part in cookie_header.split(","):
                        part = part.strip()
                        if part.lower().startswith("grafana_session="):
                            _session_cookie = part.split(";")[0]
                            break
                    _session_ttl = now
                    return _session_cookie
    except Exception:
        pass
    return ""


@router.api_route("/pmm-ui/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def pmm_ui_proxy(request: Request, path: str):
    return await _proxy(request, f"pmm-ui/{path}")


@router.api_route("/graph/{path:path}", methods=["GET", "POST"])
async def pmm_graph_proxy(request: Request, path: str):
    return await _proxy(request, f"graph/{path}")


async def _proxy(request: Request, full_path: str):
    session = _ensure_session()
    if not session:
        raise HTTPException(502, detail="PMM login failed")

    url = f"{PMM_BASE}/{full_path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = {}
    for k, v in request.headers.items():
        kl = k.lower()
        if kl in ("host", "cookie", "transfer-encoding", "content-length"):
            continue
        headers[k] = v
    headers["cookie"] = session
    headers["accept-encoding"] = "identity"

    try:
        async with httpx.AsyncClient(verify=False, timeout=30, follow_redirects=False) as cli:
            body = await request.body() if request.method in ("POST", "PUT", "PATCH") else None
            resp = await cli.request(method=request.method, url=url, headers=headers, content=body)
    except Exception as e:
        raise HTTPException(502, detail=str(e))

    skip_headers = {"transfer-encoding", "content-encoding", "set-cookie"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in skip_headers}
    if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp_headers:
        loc = resp_headers["location"]
        if loc.startswith(PMM_BASE):
            resp_headers["location"] = loc[len(PMM_BASE):]
    resp_headers["x-frame-options"] = "SAMEORIGIN"
    if "content-security-policy" in resp_headers:
        resp_headers["content-security-policy"] = resp_headers["content-security-policy"].replace("frame-ancestors", "")

    return Response(content=resp.content, status_code=resp.status_code, headers=resp_headers)

