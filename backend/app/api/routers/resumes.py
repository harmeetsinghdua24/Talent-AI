import hashlib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import (
    Resume, ExtractedProfile, Candidate, User, CandidateSkill, Skill,
    Application, Job, MatchScore, SkillGap, JobSkill, SkillPriority,
)
from app.api.deps import get_current_user, require_candidate
from app.services.resume_parser import (
    extract_raw_text, parse_resume_to_profile, safe_filename, validate_upload_size, UnsupportedFileType,
)
from app.services.storage_service import get_storage_backend, StorageError
from app.services.scoring import compute_match_score
from app.ml.inference import predict_shortlist_probability
from app.services.notification_service import create_notification
from app.models.models import NotificationType

router = APIRouter(tags=["resumes"])
settings = get_settings()


def _get_or_create_skill(db: Session, name: str) -> Skill:
    skill = db.query(Skill).filter(Skill.normalized_name == name).first()
    if not skill:
        skill = Skill(name=name, normalized_name=name)
        db.add(skill)
        db.flush()
    return skill


def _compute_content_hash(raw_text: str) -> str:
    """
    Normalizes whitespace/case before hashing so trivial formatting
    differences (extra blank lines, re-saving the same resume from a
    different app) don't defeat duplicate detection, while still catching
    genuinely identical resume content submitted under different candidate
    accounts.
    """
    normalized = " ".join(raw_text.lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@router.get("/resumes/mine")
def list_my_resumes(db: Session = Depends(get_db), user: User = Depends(require_candidate)):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        return []
    resumes = db.query(Resume).filter(Resume.candidate_id == candidate.id).order_by(Resume.uploaded_at.desc()).all()
    return [{"resume_id": r.id, "filename": r.filename, "uploaded_at": r.uploaded_at.isoformat()} for r in resumes]


@router.post("/resumes/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_candidate),
):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        raise HTTPException(status_code=400, detail="Candidate profile not found")

    content = await file.read()
    try:
        validate_upload_size(content)
        stored_name = safe_filename(file.filename)
        # Text is extracted directly from the in-memory bytes, so parsing
        # never depends on the storage backend or a local filesystem path.
        raw_text = extract_raw_text(content, file.filename)
        reference = get_storage_backend().save(stored_name, content)
    except UnsupportedFileType as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Could not store resume file: {e}")

    resume = Resume(
        candidate_id=candidate.id, filename=file.filename, stored_path=reference,
        raw_text=raw_text, content_hash=_compute_content_hash(raw_text),
    )
    db.add(resume)
    db.flush()

    # Duplicate-resume detection: same exact resume content already submitted
    # under a different candidate account is a signal worth surfacing to
    # recruiters (could be one person applying multiple times, or two people
    # submitting an identical/templated resume).
    duplicate_of = (
        db.query(Resume)
        .join(Candidate, Candidate.id == Resume.candidate_id)
        .filter(Resume.content_hash == resume.content_hash, Resume.candidate_id != candidate.id)
        .first()
    )
    duplicate_info = None
    if duplicate_of:
        other_user = duplicate_of.candidate.user if duplicate_of.candidate else None
        duplicate_info = {
            "is_duplicate": True,
            "matches_candidate_name": other_user.full_name if other_user else None,
            "matches_candidate_email": other_user.email if other_user else None,
        }
    else:
        duplicate_info = {"is_duplicate": False}

    profile = parse_resume_to_profile(raw_text)
    extracted = ExtractedProfile(
        resume_id=resume.id,
        name=profile["name"],
        email=profile["email"],
        phone=profile["phone"],
        education=profile["education"],
        experience=profile["experience"],
        projects=profile["projects"],
        certifications=profile["certifications"],
        skills=profile["skills"],
        total_experience_years=profile["total_experience_years"],
    )
    db.add(extracted)

    # Sync candidate_skills + candidate profile summary fields
    db.query(CandidateSkill).filter(CandidateSkill.candidate_id == candidate.id).delete()
    for s in profile["skills"]:
        skill = _get_or_create_skill(db, s["skill"])
        db.add(CandidateSkill(candidate_id=candidate.id, skill_id=skill.id, proficiency=1.0))
    candidate.total_experience_years = profile["total_experience_years"]

    db.commit()
    db.refresh(resume)

    return {
        "resume_id": resume.id,
        "filename": resume.filename,
        "extracted_profile": profile,
        "status": "processed",
        "duplicate_check": duplicate_info,
    }


@router.post("/applications/apply/{job_id}")
def apply_to_job(job_id: int, resume_id: int, db: Session = Depends(get_db), user: User = Depends(require_candidate)):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.candidate_id == candidate.id).first()
    if not job or not resume:
        raise HTTPException(status_code=404, detail="Job or resume not found")

    existing = db.query(Application).filter(Application.job_id == job_id, Application.candidate_id == candidate.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    application = Application(job_id=job_id, candidate_id=candidate.id, resume_id=resume.id)
    db.add(application)
    db.flush()

    _score_application(db, application, job, resume)

    recruiter_user = job.recruiter.user if job.recruiter else None
    if recruiter_user:
        create_notification(
            db, recruiter_user.id, NotificationType.NEW_APPLICATION,
            f"{user.full_name or 'A candidate'} applied for {job.title}",
            link=f"/recruiter/jobs/{job.id}/candidates/{application.id}",
        )

    db.commit()
    db.refresh(application)
    return {"application_id": application.id, "status": application.status.value}


@router.get("/applications/mine")
def list_my_applications(db: Session = Depends(get_db), user: User = Depends(require_candidate)):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        return []
    apps = (
        db.query(Application, MatchScore, Job)
        .join(MatchScore, MatchScore.application_id == Application.id, isouter=True)
        .join(Job, Job.id == Application.job_id)
        .filter(Application.candidate_id == candidate.id)
        .order_by(Application.applied_at.desc())
        .all()
    )
    return [
        {
            "application_id": a.id,
            "job_id": j.id,
            "job_title": j.title,
            "company_name": j.company_name,
            "status": a.status.value,
            "match_score": round(m.overall_score * 100, 1) if m else None,
            "applied_at": a.applied_at.isoformat(),
        }
        for a, m, j in apps
    ]


def _score_application(db: Session, application: Application, job: Job, resume: Resume):
    """Shared scoring logic used both on apply and on recruiter re-scoring."""
    extracted = resume.extracted_profile
    if not extracted:
        return

    job_skills = db.query(JobSkill).filter(JobSkill.job_id == job.id).all()
    must_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.MUST_HAVE]
    good_to_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.GOOD_TO_HAVE]
    candidate_skills = [s["skill"] for s in (extracted.skills or [])]

    breakdown = compute_match_score(
        job_description=job.description,
        job_must_have_skills=must_have,
        job_good_to_have_skills=good_to_have,
        required_experience_min=job.experience_min,
        required_experience_max=job.experience_max,
        required_education=job.education,
        required_certifications=job.certifications,
        candidate_resume_text=resume.raw_text or "",
        candidate_skills=candidate_skills,
        candidate_experience_years=extracted.total_experience_years or 0.0,
        candidate_education_lines=extracted.education or [],
        candidate_projects=extracted.projects or [],
        candidate_certifications=extracted.certifications or [],
    )

    ml_proba = predict_shortlist_probability(
        breakdown,
        num_matched_skills=len(breakdown.matched_skills),
        num_missing_critical=len(breakdown.missing_critical),
        candidate_experience_years=extracted.total_experience_years or 0.0,
    )

    match_score = MatchScore(
        application_id=application.id,
        overall_score=breakdown.overall,
        skill_match_score=breakdown.skill_match,
        semantic_score=breakdown.semantic_match,
        experience_score=breakdown.experience,
        project_score=breakdown.projects,
        education_score=breakdown.education,
        certification_score=breakdown.certifications,
        ml_shortlist_probability=ml_proba,
        explanation={"model_score_breakdown": breakdown.as_dict(), "llm_explanation": None},
    )
    db.add(match_score)

    skill_gap = SkillGap(
        application_id=application.id,
        matched_skills=breakdown.matched_skills,
        missing_critical=breakdown.missing_critical,
        missing_secondary=breakdown.missing_secondary,
    )
    db.add(skill_gap)
