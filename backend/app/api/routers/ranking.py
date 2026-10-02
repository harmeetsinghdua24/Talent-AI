from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Application, Job, User, ApplicationStatus, MatchScore, Candidate, Shortlist
from app.api.deps import require_recruiter
from app.services.email_service import send_shortlist_email, send_rejection_email
from app.services.notification_service import create_notification
from app.models.models import NotificationType

router = APIRouter(prefix="/jobs/{job_id}/candidates", tags=["ranking"])


@router.get("")
def rank_candidates(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_recruiter),
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    status: str | None = None,
    sort_by: str = Query("overall_score", enum=["overall_score", "experience", "applied_at"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    query = (
        db.query(Application, MatchScore, Candidate)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .filter(Application.job_id == job_id)
        .filter(MatchScore.overall_score >= min_score)
    )
    if status:
        query = query.filter(Application.status == status)

    if sort_by == "overall_score":
        query = query.order_by(MatchScore.overall_score.desc())
    elif sort_by == "experience":
        query = query.order_by(Candidate.total_experience_years.desc())
    else:
        query = query.order_by(Application.applied_at.desc())

    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    ranked = []
    for rank, (application, match_score, candidate) in enumerate(results, start=(page - 1) * page_size + 1):
        ranked.append({
            "rank": rank,
            "application_id": application.id,
            "candidate_id": candidate.id,
            "candidate_name": candidate.user.full_name if candidate.user else None,
            "match_score": round(match_score.overall_score * 100, 1),
            "ml_shortlist_probability": (
                round(match_score.ml_shortlist_probability * 100, 1)
                if match_score.ml_shortlist_probability is not None else None
            ),
            "experience_years": candidate.total_experience_years,
            "status": application.status.value,
        })

    return {"total": total, "page": page, "page_size": page_size, "results": ranked}


@router.get("/{application_id}/detail")
def candidate_detail(job_id: int, application_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    from app.models.models import Resume, ExtractedProfile

    row = (
        db.query(Application, MatchScore, Candidate)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .filter(Application.id == application_id, Application.job_id == job_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    application, match_score, candidate = row

    resume = db.query(Resume).filter(Resume.id == application.resume_id).first()
    extracted = resume.extracted_profile if resume else None
    skill_gap = application.skill_gap

    duplicate_check = {"is_duplicate": False}
    if resume and resume.content_hash:
        dup = (
            db.query(Resume)
            .filter(Resume.content_hash == resume.content_hash, Resume.candidate_id != candidate.id)
            .first()
        )
        if dup:
            dup_user = dup.candidate.user if dup.candidate else None
            duplicate_check = {
                "is_duplicate": True,
                "matches_candidate_name": dup_user.full_name if dup_user else None,
                "matches_candidate_email": dup_user.email if dup_user else None,
            }

    return {
        "application_id": application.id,
        "status": application.status.value,
        "applied_at": application.applied_at.isoformat(),
        "candidate": {
            "name": candidate.user.full_name if candidate.user else None,
            "email": candidate.user.email if candidate.user else None,
            "experience_years": candidate.total_experience_years,
            "education": extracted.education if extracted else [],
            "projects": extracted.projects if extracted else [],
            "certifications": extracted.certifications if extracted else [],
        },
        "score_breakdown": {
            "overall": round(match_score.overall_score * 100, 1),
            "skill_match": round(match_score.skill_match_score * 100, 1),
            "semantic_match": round(match_score.semantic_score * 100, 1),
            "experience": round(match_score.experience_score * 100, 1),
            "projects": round(match_score.project_score * 100, 1),
            "education": round(match_score.education_score * 100, 1),
            "certifications": round(match_score.certification_score * 100, 1),
            "ml_shortlist_probability": (
                round(match_score.ml_shortlist_probability * 100, 1)
                if match_score.ml_shortlist_probability is not None else None
            ),
        },
        "skill_gap": {
            "matched": skill_gap.matched_skills if skill_gap else [],
            "missing_critical": skill_gap.missing_critical if skill_gap else [],
            "missing_secondary": skill_gap.missing_secondary if skill_gap else [],
        },
        "duplicate_check": duplicate_check,
    }


@router.post("/{application_id}/shortlist")
def shortlist_candidate(job_id: int, application_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    application = db.query(Application).filter(Application.id == application_id, Application.job_id == job_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    job = db.query(Job).filter(Job.id == job_id).first()
    application.status = ApplicationStatus.SHORTLISTED
    db.add(Shortlist(job_id=job_id, candidate_id=application.candidate_id, shortlisted_by=user.id))
    db.commit()

    candidate_user = application.candidate.user if application.candidate else None
    if candidate_user:
        company_name = job.company_name if job else None
        send_shortlist_email(candidate_user.email, candidate_user.full_name, job.title if job else "the role", company_name)
        job_label = f"{job.title} at {company_name}" if job and company_name else (job.title if job else "a role")
        create_notification(
            db, candidate_user.id, NotificationType.SHORTLISTED,
            f"You've been shortlisted for {job_label}",
            link="/candidate/applications",
        )
        db.commit()

    return {"application_id": application_id, "status": application.status.value}


@router.post("/{application_id}/reject")
def reject_candidate(job_id: int, application_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    application = db.query(Application).filter(Application.id == application_id, Application.job_id == job_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    job = db.query(Job).filter(Job.id == job_id).first()
    application.status = ApplicationStatus.REJECTED
    db.commit()

    candidate_user = application.candidate.user if application.candidate else None
    if candidate_user:
        company_name = job.company_name if job else None
        send_rejection_email(candidate_user.email, candidate_user.full_name, job.title if job else "the role", company_name)
        job_label = f"{job.title} at {company_name}" if job and company_name else (job.title if job else "a role")
        create_notification(
            db, candidate_user.id, NotificationType.REJECTED,
            f"Update on your application for {job_label}",
            link="/candidate/applications",
        )
        db.commit()

    return {"application_id": application_id, "status": application.status.value}


compare_router = APIRouter(prefix="/candidates", tags=["ranking"])


@compare_router.get("/all")
def list_all_candidates(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    from app.models.models import Recruiter
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()] if recruiter else []

    rows = (
        db.query(Application, MatchScore, Candidate, Job)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .join(Job, Job.id == Application.job_id)
        .filter(Application.job_id.in_(job_ids))
        .order_by(MatchScore.overall_score.desc())
        .all()
    ) if job_ids else []

    return {
        "results": [
            {
                "application_id": a.id,
                "candidate_id": c.id,
                "candidate_name": c.user.full_name if c.user else None,
                "job_title": j.title,
                "job_id": j.id,
                "match_score": round(m.overall_score * 100, 1),
                "experience_years": c.total_experience_years,
                "status": a.status.value,
            }
            for a, m, c, j in rows
        ]
    }


@compare_router.get("/shortlisted")
def list_shortlisted(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    """
    Lists every candidate ever shortlisted, using the append-only Shortlist
    audit log rather than filtering Application.status == SHORTLISTED -
    a candidate's status naturally progresses to HIRED (or REJECTED) after
    being shortlisted, and a status-based filter would make them silently
    disappear from this history the moment that happens. The current status
    is still included per-row so the recruiter can see who's still pending,
    who was hired, and who was let go, all in one place.
    """
    from app.models.models import Recruiter, Shortlist

    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()] if recruiter else []

    rows = (
        db.query(Shortlist, Application, MatchScore, Candidate, Job)
        .join(Job, Job.id == Shortlist.job_id)
        .join(Candidate, Candidate.id == Shortlist.candidate_id)
        .join(Application, (Application.job_id == Shortlist.job_id) & (Application.candidate_id == Shortlist.candidate_id))
        .outerjoin(MatchScore, MatchScore.application_id == Application.id)
        .filter(Shortlist.job_id.in_(job_ids))
        .order_by(Shortlist.created_at.desc())
        .all()
    ) if job_ids else []

    return {
        "results": [
            {
                "application_id": a.id,
                "candidate_id": c.id,
                "candidate_name": c.user.full_name if c.user else None,
                "candidate_email": c.user.email if c.user else None,
                "job_title": j.title,
                "job_id": j.id,
                "match_score": round(m.overall_score * 100, 1) if m else None,
                "experience_years": c.total_experience_years,
                "current_status": a.status.value,
                "shortlisted_at": s.created_at.isoformat(),
            }
            for s, a, m, c, j in rows
        ]
    }


@compare_router.get("/shortlisted/export/pdf")
def export_shortlisted_pdf(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    from app.models.models import Recruiter, Shortlist
    from app.services.export_service import build_shortlist_report_pdf
    from fastapi.responses import Response

    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()] if recruiter else []

    rows = (
        db.query(Shortlist, Application, MatchScore, Candidate, Job)
        .join(Job, Job.id == Shortlist.job_id)
        .join(Candidate, Candidate.id == Shortlist.candidate_id)
        .join(Application, (Application.job_id == Shortlist.job_id) & (Application.candidate_id == Shortlist.candidate_id))
        .outerjoin(MatchScore, MatchScore.application_id == Application.id)
        .filter(Shortlist.job_id.in_(job_ids))
        .order_by(Shortlist.created_at.desc())
        .all()
    ) if job_ids else []

    results = [
        {
            "candidate_name": c.user.full_name if c.user else None,
            "candidate_email": c.user.email if c.user else None,
            "job_title": j.title,
            "current_status": a.status.value,
            "match_score": round(m.overall_score * 100, 1) if m else None,
        }
        for s, a, m, c, j in rows
    ]

    pdf_bytes = build_shortlist_report_pdf(user.full_name or "Recruiter", results)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="shortlisted-candidates.pdf"'},
    )


@compare_router.get("/compare")
def compare_candidates(
    application_ids: list[int] = Query(..., min_length=2, max_length=5),
    db: Session = Depends(get_db),
    user: User = Depends(require_recruiter),
):
    rows = (
        db.query(Application, MatchScore, Candidate)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .filter(Application.id.in_(application_ids))
        .all()
    )
    if len(rows) < 2:
        raise HTTPException(status_code=404, detail="At least 2 valid applications required")

    comparison = []
    for application, match_score, candidate in rows:
        skill_gap = application.skill_gap
        comparison.append({
            "application_id": application.id,
            "candidate_name": candidate.user.full_name if candidate.user else None,
            "overall_score": round(match_score.overall_score * 100, 1),
            "skill_match": round(match_score.skill_match_score * 100, 1),
            "semantic_match": round(match_score.semantic_score * 100, 1),
            "experience_years": candidate.total_experience_years,
            "education_score": round(match_score.education_score * 100, 1),
            "matched_skills": skill_gap.matched_skills if skill_gap else [],
            "missing_critical": skill_gap.missing_critical if skill_gap else [],
        })
    return {"comparison": comparison}
