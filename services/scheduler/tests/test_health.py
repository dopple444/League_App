from fastapi.testclient import TestClient

from league_scheduler.main import app


def test_health_is_private_service_metadata() -> None:
    with TestClient(app) as client:
        response = client.get("/healthz", headers={"x-request-id": "synthetic-request"})

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "scheduler",
        "version": "0.1.0",
    }
    assert response.headers["x-request-id"] == "synthetic-request"


def test_readiness_does_not_expose_environment() -> None:
    with TestClient(app) as client:
        response = client.get("/readyz")

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ready"
    assert "environment" not in body
    assert "database" not in body
