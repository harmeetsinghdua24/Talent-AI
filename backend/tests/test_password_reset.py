from app.core.database import SessionLocal
from app.models.models import PasswordResetToken


def _get_latest_token(email: str) -> str:
    db = SessionLocal()
    try:
        row = (
            db.query(PasswordResetToken)
            .join(PasswordResetToken.user)
            .filter_by(email=email)
            .order_by(PasswordResetToken.id.desc())
            .first()
        )
        return row.token
    finally:
        db.close()


def test_forgot_password_existing_and_nonexistent_email_look_identical(client):
    client.post("/api/v1/auth/register", json={
        "email": "reset1@test.com", "password": "oldpassword123", "full_name": "Reset User", "role": "candidate",
    })
    r1 = client.post("/api/v1/auth/forgot-password", json={"email": "reset1@test.com"})
    r2 = client.post("/api/v1/auth/forgot-password", json={"email": "does-not-exist@test.com"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()


def test_reset_password_full_flow(client):
    client.post("/api/v1/auth/register", json={
        "email": "reset2@test.com", "password": "oldpassword123", "full_name": "Reset Two", "role": "candidate",
    })
    client.post("/api/v1/auth/forgot-password", json={"email": "reset2@test.com"})
    token = _get_latest_token("reset2@test.com")

    reset = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "newpassword456"})
    assert reset.status_code == 200

    old_login = client.post("/api/v1/auth/login", json={"email": "reset2@test.com", "password": "oldpassword123"})
    assert old_login.status_code == 401

    new_login = client.post("/api/v1/auth/login", json={"email": "reset2@test.com", "password": "newpassword456"})
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_reset_token_is_single_use(client):
    client.post("/api/v1/auth/register", json={
        "email": "reset3@test.com", "password": "oldpassword123", "full_name": "Reset Three", "role": "candidate",
    })
    client.post("/api/v1/auth/forgot-password", json={"email": "reset3@test.com"})
    token = _get_latest_token("reset3@test.com")

    first = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "firstnewpass1"})
    assert first.status_code == 200

    second = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "secondnewpass2"})
    assert second.status_code == 400


def test_reset_password_rejects_invalid_token(client):
    r = client.post("/api/v1/auth/reset-password", json={"token": "not-a-real-token", "new_password": "whatever123"})
    assert r.status_code == 400


def test_reset_password_rejects_short_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "reset4@test.com", "password": "oldpassword123", "full_name": "Reset Four", "role": "candidate",
    })
    client.post("/api/v1/auth/forgot-password", json={"email": "reset4@test.com"})
    token = _get_latest_token("reset4@test.com")

    r = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "short"})
    assert r.status_code == 422
