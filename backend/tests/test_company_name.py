import io
import docx


def _make_docx_bytes(text: str) -> bytes:
    doc = docx.Document()
    for line in text.split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


def test_recruiter_registration_requires_company_name(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "nocompany@test.com", "password": "password123",
        "full_name": "No Company", "role": "recruiter",
    })
    assert r.status_code == 422


def test_candidate_registration_does_not_require_company_name(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "cand@test.com", "password": "password123",
        "full_name": "Cand", "role": "candidate",
    })
    assert r.status_code == 201


def test_recruiter_me_includes_company_name(client, recruiter_headers):
    r = client.get("/api/v1/auth/me", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["company_name"] == "Acme Corp"


def test_job_listing_includes_company_name(client, recruiter_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python required."}, headers=recruiter_headers).json()
    assert job["company_name"] == "Acme Corp"


def test_update_profile_sets_company_name(client):
    client.post("/api/v1/auth/register", json={
        "email": "updater@test.com", "password": "password123",
        "full_name": "Updater", "role": "recruiter", "company_name": "Old Name Inc",
    })
    token = client.post("/api/v1/auth/login", json={"email": "updater@test.com", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.patch("/api/v1/auth/me", json={"company_name": "New Name LLC"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["company_name"] == "New Name LLC"

    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=headers).json()
    assert job["company_name"] == "New Name LLC"


def test_candidate_cannot_set_company_name(client, candidate_headers):
    r = client.patch("/api/v1/auth/me", json={"company_name": "Should Fail"}, headers=candidate_headers)
    assert r.status_code == 400


def test_applications_mine_includes_company_name(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers)

    r = client.get("/api/v1/applications/mine", headers=candidate_headers)
    assert r.status_code == 200
    assert r.json()[0]["company_name"] == "Acme Corp"


def test_shortlist_notification_mentions_company_name(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/shortlist", headers=recruiter_headers)

    r = client.get("/api/v1/notifications/mine", headers=candidate_headers)
    message = r.json()["notifications"][0]["message"]
    assert "Acme Corp" in message


def test_recommendations_include_company_name(client, recruiter_headers, candidate_headers):
    client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python required."}, headers=recruiter_headers)
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )
    r = client.get("/api/v1/recommendations/jobs-for-me", headers=candidate_headers)
    assert r.status_code == 200
    assert r.json()["results"][0]["company_name"] == "Acme Corp"
