"""
Recommendation engine (Jobs -> Candidate direction).

Reuses the same transparent scoring service used for job applications, but
runs it against every open job for the candidate's most recent resume
without requiring a formal application - this is what "AI-recommended jobs"
means on the candidate dashboard. The Candidate -> Jobs direction (finding
the best-fit candidates for a given job) is already served by
GET /jobs/{job_id}/candidates in ranking.py using the identical scoring
function, so both directions are backed by one real matching engine rather
than two separate implementations.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Candidate, Resume, Job, JobSkill, SkillPriority, User
from app.api.deps import require_candidate
from app.services.scoring import compute_match_score

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/jobs-for-me")
def recommend_jobs_for_candidate(db: Session = Depends(get_db), user: User = Depends(require_candidate), limit: int = 10):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        return {"results": []}

    latest_resume = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate.id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )
    if not latest_resume or not latest_resume.extracted_profile:
        return {"results": [], "reason": "Upload a resume to get job recommendations."}

    extracted = latest_resume.extracted_profile
    candidate_skills = [s["skill"] for s in (extracted.skills or [])]

    open_jobs = db.query(Job).filter(Job.status == "open").all()
    scored = []
    for job in open_jobs:
        job_skills = db.query(JobSkill).filter(JobSkill.job_id == job.id).all()
        must_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.MUST_HAVE]
        good_to_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.GOOD_TO_HAVE]

        breakdown = compute_match_score(
            job_description=job.description,
            job_must_have_skills=must_have,
            job_good_to_have_skills=good_to_have,
            required_experience_min=job.experience_min,
            required_experience_max=job.experience_max,
            required_education=job.education,
            required_certifications=job.certifications,
            candidate_resume_text=latest_resume.raw_text or "",
            candidate_skills=candidate_skills,
            candidate_experience_years=extracted.total_experience_years or 0.0,
            candidate_education_lines=extracted.education or [],
            candidate_projects=extracted.projects or [],
            candidate_certifications=extracted.certifications or [],
        )
        scored.append({
            "job_id": job.id,
            "job_title": job.title,
            "company_name": job.company_name,
            "match_score": round(breakdown.overall * 100, 1),
            "missing_skills": breakdown.missing_critical,
        })

    scored.sort(key=lambda r: r["match_score"], reverse=True)
    return {"results": scored[:limit]}
