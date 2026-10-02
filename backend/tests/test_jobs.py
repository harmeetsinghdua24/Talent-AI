JD = """We need a Machine Learning Engineer with 2-4 years of experience.
Required: Python, Machine Learning, Scikit-learn, SQL.
Good to have: TensorFlow, Docker, AWS.
Master's degree preferred."""


def test_create_job_extracts_skills(client, recruiter_headers):
    r = client.post("/api/v1/jobs", json={"title": "ML Engineer", "description": JD}, headers=recruiter_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "ML Engineer"
    assert "python" in body["ai_extracted"]["must_have_skills"]
    assert "machine learning" in body["ai_extracted"]["must_have_skills"]
    assert body["experience_min"] == 2.0
    assert body["experience_max"] == 4.0


def test_candidate_cannot_create_job(client, candidate_headers):
    r = client.post("/api/v1/jobs", json={"title": "X", "description": "Python required."}, headers=candidate_headers)
    assert r.status_code == 403


def test_candidate_only_sees_open_jobs(client, recruiter_headers, candidate_headers):
    client.post("/api/v1/jobs", json={"title": "Open Job", "description": "Python"}, headers=recruiter_headers)
    r = client.get("/api/v1/jobs", headers=candidate_headers)
    assert r.status_code == 200
    assert all(j["status"] == "open" for j in r.json())


def test_update_and_delete_job(client, recruiter_headers):
    job = client.post("/api/v1/jobs", json={"title": "Temp", "description": "SQL"}, headers=recruiter_headers).json()
    r = client.patch(f"/api/v1/jobs/{job['id']}", json={"status": "closed"}, headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    r = client.delete(f"/api/v1/jobs/{job['id']}", headers=recruiter_headers)
    assert r.status_code == 204
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=recruiter_headers).status_code == 404


def test_duplicate_job(client, recruiter_headers):
    job = client.post("/api/v1/jobs", json={"title": "Original", "description": "Python"}, headers=recruiter_headers).json()
    r = client.post(f"/api/v1/jobs/{job['id']}/duplicate", headers=recruiter_headers)
    assert r.status_code == 201
    assert r.json()["title"] == "Original (Copy)"
    assert r.json()["status"] == "draft"
