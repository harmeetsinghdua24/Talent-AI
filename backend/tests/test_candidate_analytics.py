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


def test_candidate_dashboard_empty_state(client, candidate_headers):
    r = client.get("/api/v1/analytics/candidate-dashboard", headers=candidate_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_applications"] == 0
    assert data["shortlisted"] == 0


def test_candidate_dashboard_reflects_applications_and_shortlist(client, recruiter_headers, candidate_headers):
    job1 = client.post("/api/v1/jobs", json={"title": "Python Dev", "description": "Required: Python, SQL."}, headers=recruiter_headers).json()
    job2 = client.post("/api/v1/jobs", json={"title": "Data Analyst", "description": "Required: SQL, Excel."}, headers=recruiter_headers).json()

    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python, SQL\n2 years experience")
    resume = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    ).json()

    app1 = client.post(f"/api/v1/applications/apply/{job1['id']}?resume_id={resume['resume_id']}", headers=candidate_headers).json()
    client.post(f"/api/v1/applications/apply/{job2['id']}?resume_id={resume['resume_id']}", headers=candidate_headers)

    client.post(f"/api/v1/jobs/{job1['id']}/candidates/{app1['application_id']}/shortlist", headers=recruiter_headers)

    r = client.get("/api/v1/analytics/candidate-dashboard", headers=candidate_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_applications"] == 2
    assert data["shortlisted"] == 1
    assert data["under_review"] == 1
    assert data["opportunities_count"] == 2
    assert data["average_match_score"] > 0
    assert len(data["applications_timeline"]) == 2
    breakdown = {b["status"]: b["count"] for b in data["status_breakdown"]}
    assert breakdown["Shortlisted"] == 1


def test_recruiter_cannot_access_candidate_dashboard(client, recruiter_headers):
    r = client.get("/api/v1/analytics/candidate-dashboard", headers=recruiter_headers)
    assert r.status_code == 403
