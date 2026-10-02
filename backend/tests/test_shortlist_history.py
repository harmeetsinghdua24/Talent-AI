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


def _apply_and_shortlist(client, recruiter_headers, candidate_headers, job_title="Dev"):
    job = client.post("/api/v1/jobs", json={"title": job_title, "description": "Python required."}, headers=recruiter_headers).json()
    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()
    application = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/shortlist", headers=recruiter_headers)
    return job, application


def test_shortlisted_candidate_remains_after_being_hired(client, recruiter_headers, candidate_headers):
    """
    Regression test for a real bug: the shortlisted-candidates list used to
    filter Application.status == SHORTLISTED directly, so a candidate would
    silently disappear from the shortlist the moment they were hired (status
    moves to HIRED). The endpoint now reads from the append-only Shortlist
    audit log instead, so shortlist history is preserved regardless of how
    the application's current status later changes.
    """
    job, application = _apply_and_shortlist(client, recruiter_headers, candidate_headers)

    before = client.get("/api/v1/candidates/shortlisted", headers=recruiter_headers)
    assert before.status_code == 200
    assert len(before.json()["results"]) == 1
    assert before.json()["results"][0]["current_status"] == "shortlisted"

    client.post(
        f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/offer-letter",
        json={"salary": "10 LPA", "joining_date": "2026-12-01"},
        headers=recruiter_headers,
    )

    after = client.get("/api/v1/candidates/shortlisted", headers=recruiter_headers)
    assert after.status_code == 200
    results = after.json()["results"]
    assert len(results) == 1, "candidate should still appear in shortlist history after being hired"
    assert results[0]["current_status"] == "hired"
    assert results[0]["candidate_email"] == "candidate@test.com"


def test_shortlisted_candidate_remains_after_later_rejection(client, recruiter_headers, candidate_headers):
    job, application = _apply_and_shortlist(client, recruiter_headers, candidate_headers)
    client.post(f"/api/v1/jobs/{job['id']}/candidates/{application['application_id']}/reject", headers=recruiter_headers)

    r = client.get("/api/v1/candidates/shortlisted", headers=recruiter_headers)
    results = r.json()["results"]
    assert len(results) == 1
    assert results[0]["current_status"] == "rejected"


def test_shortlisted_list_includes_email_and_job(client, recruiter_headers, candidate_headers):
    _apply_and_shortlist(client, recruiter_headers, candidate_headers, job_title="Backend Engineer")
    r = client.get("/api/v1/candidates/shortlisted", headers=recruiter_headers)
    row = r.json()["results"][0]
    assert row["candidate_email"] == "candidate@test.com"
    assert row["job_title"] == "Backend Engineer"
    assert row["match_score"] is not None


def test_export_shortlisted_pdf(client, recruiter_headers, candidate_headers):
    _apply_and_shortlist(client, recruiter_headers, candidate_headers)
    r = client.get("/api/v1/candidates/shortlisted/export/pdf", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"
    assert len(r.content) > 500


def test_shortlisted_isolated_per_recruiter(client, recruiter_headers, candidate_headers):
    _apply_and_shortlist(client, recruiter_headers, candidate_headers)

    client.post("/api/v1/auth/register", json={
        "email": "other-recruiter2@test.com", "password": "password123",
        "full_name": "Other Two", "role": "recruiter", "company_name": "Other Co",
    })
    other_token = client.post("/api/v1/auth/login", json={
        "email": "other-recruiter2@test.com", "password": "password123",
    }).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    r = client.get("/api/v1/candidates/shortlisted", headers=other_headers)
    assert r.json()["results"] == []
