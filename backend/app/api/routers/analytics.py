from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Job, Application, MatchScore, Recruiter, User, ApplicationStatus, CandidateSkill, Skill
from app.api.deps import require_recruiter, require_candidate

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/recruiter-dashboard")
def recruiter_dashboard(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()]

    active_jobs = db.query(Job).filter(Job.recruiter_id == recruiter.id, Job.status == "open").count()
    total_applicants = db.query(Application).filter(Application.job_id.in_(job_ids)).count() if job_ids else 0
    shortlisted = db.query(Application).filter(
        Application.job_id.in_(job_ids), Application.status == ApplicationStatus.SHORTLISTED
    ).count() if job_ids else 0

    avg_score_row = (
        db.query(func.avg(MatchScore.overall_score))
        .join(Application, Application.id == MatchScore.application_id)
        .filter(Application.job_id.in_(job_ids))
        .scalar()
    ) if job_ids else None
    avg_match = round((avg_score_row or 0) * 100, 1)

    recent = (
        db.query(Application)
        .filter(Application.job_id.in_(job_ids))
        .order_by(Application.applied_at.desc())
        .limit(5)
        .all()
    ) if job_ids else []

    top_candidates = (
        db.query(Application, MatchScore)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .filter(Application.job_id.in_(job_ids))
        .order_by(MatchScore.overall_score.desc())
        .limit(5)
        .all()
    ) if job_ids else []

    return {
        "active_jobs": active_jobs,
        "total_applicants": total_applicants,
        "shortlisted": shortlisted,
        "average_match_score": avg_match,
        "recent_applications": [
            {"application_id": a.id, "job_id": a.job_id, "status": a.status.value, "applied_at": a.applied_at.isoformat()}
            for a in recent
        ],
        "top_candidates": [
            {"application_id": a.id, "candidate_id": a.candidate_id, "match_score": round(m.overall_score * 100, 1)}
            for a, m in top_candidates
        ],
    }


@router.get("/skill-trends")
def skill_trends(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    rows = db.query(Skill.normalized_name).join(CandidateSkill, CandidateSkill.skill_id == Skill.id).all()
    counts = Counter(r[0] for r in rows)
    top = counts.most_common(10)
    return {"top_candidate_skills": [{"skill": s, "count": c} for s, c in top]}


@router.get("/match-distribution")
def match_distribution(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()]
    scores = (
        db.query(MatchScore.overall_score)
        .join(Application, Application.id == MatchScore.application_id)
        .filter(Application.job_id.in_(job_ids))
        .all()
    ) if job_ids else []

    buckets = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
    for (score,) in scores:
        pct = score * 100
        if pct < 20:
            buckets["0-20"] += 1
        elif pct < 40:
            buckets["20-40"] += 1
        elif pct < 60:
            buckets["40-60"] += 1
        elif pct < 80:
            buckets["60-80"] += 1
        else:
            buckets["80-100"] += 1
    return {"distribution": buckets}


@router.get("/hiring-funnel")
def hiring_funnel(db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    """
    Funnel stages: Applied (all applications ever received) -> Shortlisted
    -> Hired, with Rejected tracked alongside as a drop-off metric rather
    than a funnel stage (an application can be rejected from any point,
    not just at the end). Conversion rates are computed relative to the
    immediately preceding stage.
    """
    from app.models.models import Recruiter, ApplicationStatus

    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == recruiter.id).all()] if recruiter else []

    if not job_ids:
        return {
            "stages": [{"label": "Applied", "count": 0}, {"label": "Shortlisted", "count": 0}, {"label": "Hired", "count": 0}],
            "rejected": 0,
            "conversion_rates": {"applied_to_shortlisted": 0, "shortlisted_to_hired": 0, "applied_to_hired": 0},
        }

    applications = db.query(Application).filter(Application.job_id.in_(job_ids)).all()
    total_applied = len(applications)
    # Shortlisted here counts anyone who reached or passed the shortlist stage (including later hired/rejected-after-shortlist)
    shortlisted = sum(1 for a in applications if a.status in (ApplicationStatus.SHORTLISTED, ApplicationStatus.HIRED))
    hired = sum(1 for a in applications if a.status == ApplicationStatus.HIRED)
    rejected = sum(1 for a in applications if a.status == ApplicationStatus.REJECTED)

    def pct(numerator: int, denominator: int) -> float:
        return round((numerator / denominator) * 100, 1) if denominator else 0.0

    return {
        "stages": [
            {"label": "Applied", "count": total_applied},
            {"label": "Shortlisted", "count": shortlisted},
            {"label": "Hired", "count": hired},
        ],
        "rejected": rejected,
        "conversion_rates": {
            "applied_to_shortlisted": pct(shortlisted, total_applied),
            "shortlisted_to_hired": pct(hired, shortlisted),
            "applied_to_hired": pct(hired, total_applied),
        },
    }


@router.get("/candidate-dashboard")
def candidate_dashboard(db: Session = Depends(get_db), user: User = Depends(require_candidate)):
    from app.models.models import Candidate, ApplicationStatus

    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        return {
            "total_applications": 0, "shortlisted": 0, "rejected": 0,
            "under_review": 0, "hired": 0, "opportunities_count": 0,
            "average_match_score": 0, "status_breakdown": [], "applications_timeline": [],
        }

    applications = db.query(Application).filter(Application.candidate_id == candidate.id).all()
    application_ids = [a.id for a in applications]

    status_counts = {s.value: 0 for s in ApplicationStatus}
    for a in applications:
        status_counts[a.status.value] += 1

    scores = (
        db.query(Application, MatchScore, Job)
        .join(MatchScore, MatchScore.application_id == Application.id)
        .join(Job, Job.id == Application.job_id)
        .filter(Application.candidate_id == candidate.id)
        .order_by(Application.applied_at.asc())
        .all()
    ) if application_ids else []

    avg_score = (
        sum(m.overall_score for _, m, _ in scores) / len(scores) * 100
        if scores else 0
    )

    opportunities_count = db.query(Job).filter(Job.status == "open").count()

    return {
        "total_applications": len(applications),
        "shortlisted": status_counts.get("shortlisted", 0),
        "rejected": status_counts.get("rejected", 0),
        "under_review": status_counts.get("under_review", 0) + status_counts.get("applied", 0),
        "hired": status_counts.get("hired", 0),
        "opportunities_count": opportunities_count,
        "average_match_score": round(avg_score, 1),
        "status_breakdown": [
            {"status": "Shortlisted", "count": status_counts.get("shortlisted", 0)},
            {"status": "Under review", "count": status_counts.get("under_review", 0) + status_counts.get("applied", 0)},
            {"status": "Rejected", "count": status_counts.get("rejected", 0)},
            {"status": "Hired", "count": status_counts.get("hired", 0)},
        ],
        "applications_timeline": [
            {
                "job_title": j.title,
                "match_score": round(m.overall_score * 100, 1),
                "applied_at": a.applied_at.isoformat(),
            }
            for a, m, j in scores
        ],
    }
