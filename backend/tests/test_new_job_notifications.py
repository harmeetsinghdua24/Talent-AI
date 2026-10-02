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


def test_strong_fit_candidate_notified_on_new_job(client, recruiter_headers):
    client.post("/api/v1/auth/register", json={
        "email": "strong@test.com", "password": "password123", "full_name": "Strong Fit", "role": "candidate",
    })
    strong_token = client.post("/api/v1/auth/login", json={"email": "strong@test.com", "password": "password123"}).json()["access_token"]
    strong_headers = {"Authorization": f"Bearer {strong_token}"}

    resume_bytes = _make_docx_bytes("Strong Fit\nstrong@test.com\nSkills: Python, FastAPI, SQL\n3 years experience")
    client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=strong_headers,
    )

    client.post(
        "/api/v1/jobs",
        json={"title": "Python Developer", "description": "Required: Python, FastAPI, SQL. 2-4 years experience."},
        headers=recruiter_headers,
    )

    r = client.get("/api/v1/notifications/mine", headers=strong_headers)
    assert r.status_code == 200
    assert r.json()["unread_count"] == 1
    notification = r.json()["notifications"][0]
    assert notification["type"] == "new_job_match"
    assert "Acme Corp" in notification["message"]
    assert "Python Developer" in notification["message"]


def test_weak_fit_candidate_not_notified_on_new_job(client, recruiter_headers):
    client.post("/api/v1/auth/register", json={
        "email": "weak@test.com", "password": "password123", "full_name": "Weak Fit", "role": "candidate",
    })
    weak_token = client.post("/api/v1/auth/login", json={"email": "weak@test.com", "password": "password123"}).json()["access_token"]
    weak_headers = {"Authorization": f"Bearer {weak_token}"}

    resume_bytes = _make_docx_bytes("Weak Fit\nweak@test.com\nSkills: Photoshop, Illustrator\n1 year experience")
    client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=weak_headers,
    )

    client.post(
        "/api/v1/jobs",
        json={"title": "Python Developer", "description": "Required: Python, FastAPI, SQL. 2-4 years experience."},
        headers=recruiter_headers,
    )

    r = client.get("/api/v1/notifications/mine", headers=weak_headers)
    assert r.json()["unread_count"] == 0


def test_candidate_without_resume_not_notified(client, recruiter_headers, candidate_headers):
    client.post(
        "/api/v1/jobs",
        json={"title": "Python Developer", "description": "Required: Python."},
        headers=recruiter_headers,
    )
    r = client.get("/api/v1/notifications/mine", headers=candidate_headers)
    assert r.json()["unread_count"] == 0
