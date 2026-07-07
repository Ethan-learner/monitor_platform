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
