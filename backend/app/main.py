from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.alerts.router import router as alerts_router
from app.overview.router import router as overview_router
from app.prometheus.router import router as prometheus_router
from app.rules.router import router as rules_router
from app.webhook.router import router as webhook_router

app = FastAPI(title="统一监控门户后端", version="0.1.0")
app.include_router(auth_router)
app.include_router(alerts_router)
app.include_router(overview_router)
app.include_router(prometheus_router)
app.include_router(rules_router)
app.include_router(webhook_router)


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
