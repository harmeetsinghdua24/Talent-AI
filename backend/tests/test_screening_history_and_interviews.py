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


JD = "Required: Python, SQL. Good to have: Docker."


def _scan(client, headers, name_email_skills):
    content = _make_docx_bytes(name_email_skills)
    r = client.post(
        "/api/v1/screening/scan-one",
        data={"job_description": JD},
        files={"file": ("resume.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=headers,
    )
    assert r.status_code == 200
    return r.json()


def test_save_and_list_screening_session(client, recruiter_headers):
    strong = _scan(client, recruiter_headers, "Amit Verma\namit@x.com\nSkills: Python, SQL, Docker\n2 years experience")
    weak = _scan(client, recruiter_headers, "Sara Khan\nsara@x.com\nSkills: Photoshop\n1 year experience")

    save = client.post("/api/v1/screening/sessions", json={"job_description": JD, "results": [strong, weak]}, headers=recruiter_headers)
    assert save.status_code == 200
    session_id = save.json()["session_id"]

    listing = client.get("/api/v1/screening/sessions", headers=recruiter_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["resume_count"] == 2

    detail = client.get(f"/api/v1/screening/sessions/{session_id}", headers=recruiter_headers)
    assert detail.status_code == 200
    results = detail.json()["results"]
    # Persisted sorted descending by match score
    assert results[0]["match_score"] >= results[1]["match_score"]
    assert results[0]["candidate_name"] == "Amit Verma"


def test_screening_session_isolated_per_recruiter(client, recruiter_headers, db=None):
    save = client.post("/api/v1/screening/sessions", json={"job_description": JD, "results": []}, headers=recruiter_headers)
    session_id = save.json()["session_id"]

    # A second recruiter should not see or access the first recruiter's session
    client.post("/api/v1/auth/register", json={
        "email": "other-recruiter@test.com", "password": "password123", "full_name": "Other", "role": "recruiter", "company_name": "Other Corp",
    })
    other_token = client.post("/api/v1/auth/login", json={
        "email": "other-recruiter@test.com", "password": "password123",
    }).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    r = client.get(f"/api/v1/screening/sessions/{session_id}", headers=other_headers)
    assert r.status_code == 404


def test_export_excel_and_pdf(client, recruiter_headers):
    strong = _scan(client, recruiter_headers, "Amit Verma\namit@x.com\nSkills: Python, SQL, Docker\n2 years experience")
    save = client.post("/api/v1/screening/sessions", json={"job_description": JD, "results": [strong]}, headers=recruiter_headers)
    session_id = save.json()["session_id"]

    excel = client.get(f"/api/v1/screening/sessions/{session_id}/export/excel", headers=recruiter_headers)
    assert excel.status_code == 200
    assert excel.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(excel.content) > 1000

    pdf = client.get(f"/api/v1/screening/sessions/{session_id}/export/pdf", headers=recruiter_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content[:4] == b"%PDF"


def test_delete_session(client, recruiter_headers):
    save = client.post("/api/v1/screening/sessions", json={"job_description": JD, "results": []}, headers=recruiter_headers)
    session_id = save.json()["session_id"]
    assert client.delete(f"/api/v1/screening/sessions/{session_id}", headers=recruiter_headers).status_code == 204
    assert client.get(f"/api/v1/screening/sessions/{session_id}", headers=recruiter_headers).status_code == 404


def test_schedule_reschedule_and_candidate_views_interview(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Dev", "description": "Python required."}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    app_id = application["application_id"]

    sched = client.post(
        f"/api/v1/jobs/{job['id']}/candidates/{app_id}/interview",
        json={
            "scheduled_at": "2026-11-01T10:00:00",
            "duration_minutes": 30,
            "mode": "online",
            "location_or_link": "https://meet.example.com/xyz",
            "notes": "First round",
        },
        headers=recruiter_headers,
    )
    assert sched.status_code == 200
    interview_id = sched.json()["id"]
    assert sched.json()["status"] == "scheduled"

    mine = client.get("/api/v1/interviews/mine", headers=candidate_headers)
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["job_title"] == "Dev"

    reschedule = client.patch(f"/api/v1/interviews/{interview_id}", json={"scheduled_at": "2026-11-02T11:00:00"}, headers=recruiter_headers)
    assert reschedule.status_code == 200
    assert reschedule.json()["scheduled_at"].startswith("2026-11-02")

    cancel = client.patch(f"/api/v1/interviews/{interview_id}", json={"status": "cancelled"}, headers=recruiter_headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    # Cancelled interviews should not show up in the candidate's upcoming list
    mine_after = client.get("/api/v1/interviews/mine", headers=candidate_headers)
    assert len(mine_after.json()) == 0


def test_candidate_cannot_schedule_interview(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "X", "description": "Python"}, headers=recruiter_headers).json()
    r = client.post(
        f"/api/v1/jobs/{job['id']}/candidates/1/interview",
        json={"scheduled_at": "2026-11-01T10:00:00"},
        headers=candidate_headers,
    )
    assert r.status_code == 403
