from fastapi import FastAPI

app = FastAPI(title="统一监控门户后端", version="0.1.0")


@app.get("/api/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
