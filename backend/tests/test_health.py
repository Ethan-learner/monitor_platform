from fastapi.testclient import TestClient


def test_healthz(client: TestClient):
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
