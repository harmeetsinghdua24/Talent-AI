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


JD = "Required: Python, SQL, FastAPI. Good to have: Docker. 1-3 years experience."


def test_scan_one_strong_match_scores_higher_than_weak_match(client, recruiter_headers):
    strong = _make_docx_bytes("Amit Kumar\namit@x.com\nSkills: Python, SQL, FastAPI, Docker\n2 years experience")
    weak = _make_docx_bytes("Sara Khan\nsara@x.com\nSkills: Photoshop, Illustrator\n1 year experience")

    r1 = client.post(
        "/api/v1/screening/scan-one",
        data={"job_description": JD},
        files={"file": ("amit.docx", strong, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=recruiter_headers,
    )
    r2 = client.post(
        "/api/v1/screening/scan-one",
        data={"job_description": JD},
        files={"file": ("sara.docx", weak, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=recruiter_headers,
    )

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["match_score"] > r2.json()["match_score"]
    assert r1.json()["candidate_name"] == "Amit Kumar"
    assert "python" in r1.json()["matched_skills"]
    assert "python" in r2.json()["missing_critical"]


def test_scan_one_requires_recruiter_role(client, candidate_headers):
    resume = _make_docx_bytes("Test\ntest@x.com\nSkills: Python")
    r = client.post(
        "/api/v1/screening/scan-one",
        data={"job_description": JD},
        files={"file": ("t.docx", resume, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )
    assert r.status_code == 403


def test_scan_one_rejects_unsupported_file_type(client, recruiter_headers):
    r = client.post(
        "/api/v1/screening/scan-one",
        data={"job_description": JD},
        files={"file": ("resume.txt", b"plain text", "text/plain")},
        headers=recruiter_headers,
    )
    assert r.status_code == 400


def test_requirements_preview(client, recruiter_headers):
    r = client.get("/api/v1/screening/must-have-preview", params={"job_description": JD}, headers=recruiter_headers)
    assert r.status_code == 200
    assert "python" in r.json()["must_have_skills"]
    assert "docker" in r.json()["good_to_have_skills"]
