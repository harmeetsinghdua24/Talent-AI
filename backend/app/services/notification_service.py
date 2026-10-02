from sqlalchemy.orm import Session

from app.models.models import Notification, NotificationType, Candidate, Resume, Job, JobSkill, SkillPriority
from app.services.scoring import compute_match_score
from app.services.email_service import send_email
from app.core.config import get_settings

settings = get_settings()


def create_notification(db: Session, user_id: int, type_: NotificationType, message: str, link: str | None = None) -> Notification:
    notification = Notification(user_id=user_id, type=type_, message=message, link=link)
    db.add(notification)
    return notification


def notify_matching_candidates_of_new_job(db: Session, job: Job) -> int:
    """
    Runs when a job is posted: scores every candidate's most recent resume
    against the new job (the same transparent scoring engine used
    everywhere else in the app, just run proactively instead of waiting for
    the candidate to apply) and notifies only those above
    NEW_JOB_MATCH_THRESHOLD - both in-app and by email - so candidates learn
    about a strong-fit opening without the recruiter broadcasting to every
    candidate regardless of relevance.

    Returns the number of candidates notified (useful for tests/logging).
    """
    job_skills = db.query(JobSkill).filter(JobSkill.job_id == job.id).all()
    must_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.MUST_HAVE]
    good_to_have = [js.skill.normalized_name for js in job_skills if js.priority == SkillPriority.GOOD_TO_HAVE]

    company_name = job.company_name
    job_label = f"{job.title} at {company_name}" if company_name else job.title

    notified_count = 0
    candidates = db.query(Candidate).all()
    for candidate in candidates:
        latest_resume = (
            db.query(Resume)
            .filter(Resume.candidate_id == candidate.id)
            .order_by(Resume.uploaded_at.desc())
            .first()
        )
        if not latest_resume or not latest_resume.extracted_profile:
            continue

        extracted = latest_resume.extracted_profile
        breakdown = compute_match_score(
            job_description=job.description,
            job_must_have_skills=must_have,
            job_good_to_have_skills=good_to_have,
            required_experience_min=job.experience_min,
            required_experience_max=job.experience_max,
            required_education=job.education,
            required_certifications=job.certifications,
            candidate_resume_text=latest_resume.raw_text or "",
            candidate_skills=[s["skill"] for s in (extracted.skills or [])],
            candidate_experience_years=extracted.total_experience_years or 0.0,
            candidate_education_lines=extracted.education or [],
            candidate_projects=extracted.projects or [],
            candidate_certifications=extracted.certifications or [],
        )

        if breakdown.overall < settings.NEW_JOB_MATCH_THRESHOLD:
            continue

        match_pct = round(breakdown.overall * 100, 1)
        create_notification(
            db, candidate.user_id, NotificationType.NEW_JOB_MATCH,
            f"New job matching your profile: {job_label} ({match_pct}% match)",
            link="/candidate/jobs",
        )
        if candidate.user:
            send_email(
                candidate.user.email,
                f"New job matching your profile: {job.title}",
                f"Hi {candidate.user.full_name or 'there'},\n\n"
                f"A new role was just posted that matches your profile well: {job_label} "
                f"({match_pct}% match based on your latest resume).\n\n"
                f"Log in to Talentum to view the full listing and apply.\n\n"
                f"Best,\nTalentum",
            )
        notified_count += 1

    return notified_count
