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


RESUME_TEXT = """Jane Doe
jane.doe@example.com | +1-555-0100

Education
Bachelor of Technology in Computer Science, State University

Experience
Backend Engineer at TechCorp (3 years)
Built REST API services using Python, FastAPI and PostgreSQL.

Projects
Developed an internal analytics tool using Python and SQL.

Skills
Python, SQL, FastAPI, Git, Docker
"""

JOB_JD = """Looking for a Python Developer, 1-3 years experience.
Required: Python, SQL, FastAPI.
Good to have: Docker, AWS.
Bachelor's degree required."""


def test_full_workflow_apply_and_rank(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "Python Developer", "description": JOB_JD}, headers=recruiter_headers).json()

    resume_bytes = _make_docx_bytes(RESUME_TEXT)
    r = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("jane_resume.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )
    assert r.status_code == 200
    resume_id = r.json()["resume_id"]
    assert r.json()["extracted_profile"]["email"] == "jane.doe@example.com"
    assert "python" in {s["skill"] for s in r.json()["extracted_profile"]["skills"]}

    r = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume_id}", headers=candidate_headers)
    assert r.status_code == 200
    application_id = r.json()["application_id"]

    # Duplicate application should be rejected
    r_dup = client.post(f"/api/v1/applications/apply/{job['id']}?resume_id={resume_id}", headers=candidate_headers)
    assert r_dup.status_code == 400

    r = client.get(f"/api/v1/jobs/{job['id']}/candidates", headers=recruiter_headers)
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 1
    assert results[0]["match_score"] > 50  # strong match given aligned skills

    r = client.post(f"/api/v1/jobs/{job['id']}/candidates/{application_id}/shortlist", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "shortlisted"

    r = client.get("/api/v1/analytics/recruiter-dashboard", headers=recruiter_headers)
    assert r.status_code == 200
    assert r.json()["shortlisted"] == 1
    assert r.json()["total_applicants"] == 1

    r = client.get(f"/api/v1/jobs/{job['id']}/candidates/{application_id}/detail", headers=recruiter_headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["candidate"]["name"] == "Test Candidate"
    assert detail["score_breakdown"]["overall"] > 0
    assert "python" in detail["skill_gap"]["matched"]


def test_unsupported_file_type_rejected(client, candidate_headers):
    r = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("resume.txt", b"plain text resume", "text/plain")},
        headers=candidate_headers,
    )
    assert r.status_code == 400


def test_candidate_cannot_shortlist(client, recruiter_headers, candidate_headers):
    job = client.post("/api/v1/jobs", json={"title": "X", "description": "Python"}, headers=recruiter_headers).json()
    r = client.post(f"/api/v1/jobs/{job['id']}/candidates/1/shortlist", headers=candidate_headers)
    assert r.status_code == 403


def test_recommendations_rank_relevant_job_higher(client, recruiter_headers, candidate_headers):
    client.post("/api/v1/jobs", json={"title": "Python Dev", "description": "Required: Python, SQL, FastAPI. 1-3 years."}, headers=recruiter_headers)
    client.post("/api/v1/jobs", json={"title": "Graphic Designer", "description": "Required: Photoshop, Illustrator."}, headers=recruiter_headers)

    resume_bytes = _make_docx_bytes("Test Candidate\ntest@x.com\nSkills: Python, SQL, FastAPI\n2 years experience")
    client.post(
        "/api/v1/resumes/upload",
        files={"file": ("r.docx", resume_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )

    r = client.get("/api/v1/recommendations/jobs-for-me", headers=candidate_headers)
    assert r.status_code == 200
    results = r.json()["results"]
    by_title = {row["job_title"]: row["match_score"] for row in results}
    assert by_title["Python Dev"] > by_title["Graphic Designer"]
