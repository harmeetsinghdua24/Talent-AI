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


# --- Notifications ---

def test_recruiter_notified_on_new_application(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python required."}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers)

    r = client.get("/api/v1/notifications/mine", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["unread_count"] == 1
    assert r.json()["notifications"][0]["type"] == "new_application"


def test_candidate_notified_on_shortlist_and_mark_read(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python required."}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/shortlist", headers=recruiter_headers)

    r = client.get("/api/v1/notifications/mine", headers=candidate_headers)
    assert r.json()["unread_count"] == 1
    notification_id = r.json()["notifications"][0]["id"]

    mark = client.post(f"/api/v1/notifications/{notification_id}/read", headers=candidate_headers)
    assert mark.status_code == 200
    assert mark.json()["is_read"] is True

    after = client.get("/api/v1/notifications/mine", headers=candidate_headers)
    assert after.json()["unread_count"] == 0


def test_mark_all_read(client, recruiter_headers, candidate_headers):
    job1 = client.post("/api/v1/jobs", json={"title": "Dev1", "description": "Python"}, headers=recruiter_headers).json()
    job2 = client.post("/api/v1/jobs", json={"title": "Dev2", "description": "Python"}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    app1 = client.post(f"/api/v1/applications/apply/{job1['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/applications/apply/{job2['id']}?resume_id={resume['resume_id']}", headers=candidate_headers)
    client.post(f"/api/v1/jobs/{job1['id']}/candidates/{app1['application_id']}/shortlist", headers=recruiter_headers)

    client.post("/api/v1/notifications/read-all", headers=recruiter_headers)
    r = client.get("/api/v1/notifications/mine", headers=recruiter_headers)
    assert r.json()["unread_count"] == 0


# --- Duplicate resume detection ---

def test_duplicate_resume_detected_across_candidates(client):
    client.post("/api/v1/auth/register", json={"email": "d1@test.com", "password": "password123", "full_name": "Candidate One", "role": "candidate"})
    token1 = client.post("/api/v1/auth/login", json={"email": "d1@test.com", "password": "password123"}).json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    client.post("/api/v1/auth/register", json={"email": "d2@test.com", "password": "password123", "full_name": "Candidate Two", "role": "candidate"})
    token2 = client.post("/api/v1/auth/login", json={"email": "d2@test.com", "password": "password123"}).json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    same_text = "John Smith\njohn@x.com\nSkills: Python, SQL\n3 years experience"
    r1 = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r1.docx", _make_docx_bytes(same_text), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers1,
    )
    assert r1.json()["duplicate_check"]["is_duplicate"] is False

    r2 = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r2.docx", _make_docx_bytes(same_text), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers2,
    )
    assert r2.json()["duplicate_check"]["is_duplicate"] is True
    assert r2.json()["duplicate_check"]["matches_candidate_name"] == "Candidate One"


def test_different_resumes_not_flagged_as_duplicate(client, candidate_headers):
    r = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", _make_docx_bytes("Unique Person\nunique@x.com\nSkills: Rust\n1 year experience"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )
    assert r.json()["duplicate_check"]["is_duplicate"] is False


# --- Hiring funnel ---

def test_hiring_funnel_reflects_pipeline(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/shortlist", headers=recruiter_headers)

    r = client.get("/api/v1/analytics/hiring-funnel", headers=recruiter_headers)
    assert r.status_code == 200
    data = r.json()
    stages = {s["label"]: s["count"] for s in data["stages"]}
    assert stages["Applied"] == 1
    assert stages["Shortlisted"] == 1
    assert stages["Hired"] == 0
    assert data["conversion_rates"]["applied_to_shortlisted"] == 100.0


def test_hiring_funnel_empty_state(client, recruiter_headers):
    r = client.get("/api/v1/analytics/hiring-funnel", headers=recruiter_headers)
    assert r.status_code == 200
    stages = {s["label"]: s["count"] for s in r.json()["stages"]}
    assert stages["Applied"] == 0


# --- Offer letter ---

def test_generate_offer_letter_marks_hired_and_returns_pdf(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Python Developer", "description": "Python required."}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()

    offer = client.post(
        f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/offer-letter",
        json={"salary": "12 LPA", "joining_date": "2026-11-01", "additional_terms": "3 month probation."},
        headers=recruiter_headers,
    )
    assert offer.status_code == 200
    assert offer.headers["content-type"] == "application/pdf"
    assert offer.content[:4] == b"%PDF"

    detail = client.get(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/detail", headers=recruiter_headers)
    assert detail.json()["status"] == "hired"

    notif = client.get("/api/v1/notifications/mine", headers=candidate_headers)
    assert any(n["type"] == "offer_generated" for n in notif.json()["notifications"])


def test_offer_letter_can_skip_marking_hired(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()

    client.post(
        f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/offer-letter",
        json={"salary": "10 LPA", "joining_date": "2026-11-01", "mark_as_hired": False},
        headers=recruiter_headers,
    )
    detail = client.get(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/detail", headers=recruiter_headers)
    assert detail.json()["status"] == "applied"


def test_candidate_cannot_generate_offer_letter(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python"}, headers=recruiter_headers).json()
    r = client.post(
        f"/api/v1/jobs/{job['id']}/candidates/1/offer-letter",
        json={"salary": "10 LPA", "joining_date": "2026-11-01"},
        headers=candidate_headers,
    )
    assert r.status_code == 403
