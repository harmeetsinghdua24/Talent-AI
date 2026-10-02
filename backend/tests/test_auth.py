def test_register_and_login(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "new@test.com", "password": "password123",
        "full_name": "New User", "role": "candidate",
    })
    assert r.status_code == 201
    assert r.json()["email"] == "new@test.com"

    r = client.post("/api/v1/auth/login", json={"email": "new@test.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_duplicate_registration_rejected(client):
    payload = {"email": "dup@test.com", "password": "password123", "full_name": "Dup", "role": "candidate"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 400


def test_login_wrong_password_rejected(client):
    client.post("/api/v1/auth/register", json={
        "email": "wrong@test.com", "password": "password123", "full_name": "W", "role": "candidate",
    })
    r = client.post("/api/v1/auth/login", json={"email": "wrong@test.com", "password": "bad-password"})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    r = client.get("/api/v1/jobs")
    assert r.status_code == 401


def test_me_endpoint(client, candidate_headers):
    r = client.get("/api/v1/auth/me", headers=candidate_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "candidate"
