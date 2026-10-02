"""
Bulk Resume Screening - a recruiter tool distinct from the job-marketplace
flow (post job -> candidates apply). Here the recruiter pastes a job
requirement directly and drops resume files straight in; each resume is
parsed and scored against that requirement immediately, with no candidate
account or Application record involved. This is what "screen 20 resumes
against this JD right now" looks like as a real feature, backed by the same
NLP extraction + explainable scoring + trained ML model as the rest of the
platform - not a single opaque LLM call.

The frontend calls /scan-one once per uploaded file (with limited
concurrency) so it can show real per-file progress ("Scanning 7/20") and
degrade gracefully if one file fails to parse without losing the rest.
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_recruiter
from app.core.config import get_settings
from app.core.database import get_db
from app.ml.inference import predict_shortlist_probability
from app.models.models import Recruiter, ScreeningResult, ScreeningSession, User
from app.services.export_service import build_excel_report, build_pdf_report
from app.services.jd_intelligence import analyze_job_description
from app.services.resume_parser import extract_raw_text, parse_resume_to_profile, UnsupportedFileType
from app.services.scoring import compute_match_score

router = APIRouter(prefix="/screening", tags=["screening"])
settings = get_settings()


@router.post("/scan-one")
async def scan_one_resume(
    job_description: str = Form(..., min_length=10),
    file: UploadFile = File(...),
    user=Depends(require_recruiter),
):
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"{file.filename} exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Screening never persists the file anywhere (no candidate record, no
    # storage backend involved) - text is extracted directly from the
    # in-memory bytes and then discarded.
    try:
        raw_text = extract_raw_text(content, file.filename)
    except UnsupportedFileType as e:
        raise HTTPException(status_code=400, detail=f"{e} ({file.filename})")

    profile = parse_resume_to_profile(raw_text)
    analysis = analyze_job_description(job_description)

    breakdown = compute_match_score(
        job_description=job_description,
        job_must_have_skills=analysis["must_have_skills"],
        job_good_to_have_skills=analysis["good_to_have_skills"],
        required_experience_min=analysis["experience_min_years"],
        required_experience_max=analysis["experience_max_years"],
        required_education=analysis["education_requirement"],
        required_certifications=None,
        candidate_resume_text=raw_text,
        candidate_skills=[s["skill"] for s in profile["skills"]],
        candidate_experience_years=profile["total_experience_years"],
        candidate_education_lines=profile["education"],
        candidate_projects=profile["projects"],
        candidate_certifications=profile["certifications"],
    )
    ml_proba = predict_shortlist_probability(
        breakdown,
        num_matched_skills=len(breakdown.matched_skills),
        num_missing_critical=len(breakdown.missing_critical),
        candidate_experience_years=profile["total_experience_years"],
    )

    return {
        "filename": file.filename,
        "candidate_name": profile["name"],
        "email": profile["email"],
        "experience_years": profile["total_experience_years"],
        "match_score": round(breakdown.overall * 100, 1),
        "ml_shortlist_probability": round(ml_proba * 100, 1) if ml_proba is not None else None,
        "matched_skills": breakdown.matched_skills,
        "missing_critical": breakdown.missing_critical,
        "missing_secondary": breakdown.missing_secondary,
    }


@router.get("/must-have-preview")
def preview_requirements(job_description: str, user: User = Depends(require_recruiter)):
    """Lets the frontend show 'here's what we detected' before scanning any resumes."""
    if len(job_description.strip()) < 10:
        return {"must_have_skills": [], "good_to_have_skills": [], "experience_min_years": 0, "experience_max_years": 0}
    return analyze_job_description(job_description)


# --- Screening history: save/list/view past bulk-screening runs ---

class ScreeningResultIn(BaseModel):
    filename: str
    candidate_name: str | None = None
    email: str | None = None
    experience_years: float = 0.0
    match_score: float
    ml_shortlist_probability: float | None = None
    matched_skills: list[str] = []
    missing_critical: list[str] = []
    missing_secondary: list[str] = []


class SaveSessionRequest(BaseModel):
    job_description: str
    title: str | None = None
    results: list[ScreeningResultIn]


def _serialize_result(r: ScreeningResult) -> dict:
    return {
        "filename": r.filename,
        "candidate_name": r.candidate_name,
        "email": r.email,
        "experience_years": r.experience_years,
        "match_score": r.match_score,
        "ml_shortlist_probability": r.ml_shortlist_probability,
        "matched_skills": r.matched_skills or [],
        "missing_critical": r.missing_critical or [],
        "missing_secondary": r.missing_secondary or [],
    }


@router.post("/sessions")
def save_session(payload: SaveSessionRequest, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    if not recruiter:
        raise HTTPException(status_code=400, detail="Recruiter profile not found")

    title = payload.title or (payload.job_description.strip().split("\n")[0][:80] or "Untitled screening")
    session = ScreeningSession(
        recruiter_id=recruiter.id,
        job_description=payload.job_description,
        title=title,
        resume_count=len(payload.results),
    )
    db.add(session)
    db.flush()

    # Persist already-sorted (by match_score desc) so history detail loads fast with no re-sort needed
    sorted_results = sorted(payload.results, key=lambda r: r.match_score, reverse=True)
    for r in sorted_results:
        db.add(ScreeningResult(
            session_id=session.id,
            filename=r.filename,
            candidate_name=r.candidate_name,
            email=r.email,
            experience_years=r.experience_years,
            match_score=r.match_score,
            ml_shortlist_probability=r.ml_shortlist_probability,
            matched_skills=r.matched_skills,
            missing_critical=r.missing_critical,
            missing_secondary=r.missing_secondary,
        ))
    db.commit()
    return {"session_id": session.id}


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    if not recruiter:
        return []
    sessions = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.recruiter_id == recruiter.id)
        .order_by(ScreeningSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "job_description_preview": s.job_description[:160],
            "resume_count": s.resume_count,
            "created_at": s.created_at.isoformat(),
            "top_score": max((r.match_score for r in s.results), default=0),
        }
        for s in sessions
    ]


def _get_owned_session(db: Session, session_id: int, user: User) -> ScreeningSession:
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    session = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.id == session_id, ScreeningSession.recruiter_id == (recruiter.id if recruiter else -1))
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Screening session not found")
    return session


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    session = _get_owned_session(db, session_id, user)
    return {
        "id": session.id,
        "title": session.title,
        "job_description": session.job_description,
        "resume_count": session.resume_count,
        "created_at": session.created_at.isoformat(),
        "results": [_serialize_result(r) for r in sorted(session.results, key=lambda r: r.match_score, reverse=True)],
    }


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    session = _get_owned_session(db, session_id, user)
    db.delete(session)
    db.commit()
    return None


@router.get("/sessions/{session_id}/export/excel")
def export_session_excel(session_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    session = _get_owned_session(db, session_id, user)
    results = [_serialize_result(r) for r in sorted(session.results, key=lambda r: r.match_score, reverse=True)]
    content = build_excel_report(session.title or "Screening Results", session.job_description, results)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="screening-{session_id}.xlsx"'},
    )


@router.get("/sessions/{session_id}/export/pdf")
def export_session_pdf(session_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    session = _get_owned_session(db, session_id, user)
    results = [_serialize_result(r) for r in sorted(session.results, key=lambda r: r.match_score, reverse=True)]
    content = build_pdf_report(session.title or "Screening Results", session.job_description, results)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="screening-{session_id}.pdf"'},
    )
