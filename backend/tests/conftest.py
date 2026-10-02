import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mktemp(suffix='.db')}"
# The test suite fires far more requests per minute than any real single
# client would (many tests x many calls each, all from the TestClient's one
# IP) - without this override, the in-memory rate limiter starts returning
# 429s partway through a full test run, which looks like a random failure
# but is actually the rate limiter doing exactly what it's supposed to.
os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"

from app.main import app  # noqa: E402
from app.core.database import Base, engine  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_database():
    """
    Ensures true per-test isolation. Without this, all tests share the same
    underlying SQLite file (created once at module import above), so data
    from one test (e.g. a job/application created via the shared
    recruiter_headers/candidate_headers fixtures) silently leaks into the
    next test and can make count-based assertions ("total_applicants == 1")
    fail depending on test execution order - this was caught precisely
    that way when new tests were added later.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def recruiter_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "recruiter@test.com", "password": "password123",
        "full_name": "Test Recruiter", "role": "recruiter", "company_name": "Acme Corp",
    })
    token = client.post("/api/v1/auth/login", json={
        "email": "recruiter@test.com", "password": "password123",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def candidate_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "candidate@test.com", "password": "password123",
        "full_name": "Test Candidate", "role": "candidate",
    })
    token = client.post("/api/v1/auth/login", json={
        "email": "candidate@test.com", "password": "password123",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
