from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Application, Interview, InterviewMode, InterviewStatus, Job, User, Candidate
from app.api.deps import require_recruiter, require_candidate, get_current_user
from app.services.email_service import send_interview_scheduled_email
from app.services.notification_service import create_notification
from app.models.models import NotificationType

router = APIRouter(tags=["interviews"])


class InterviewCreate(BaseModel):
    scheduled_at: datetime
    duration_minutes: int = 30
    mode: InterviewMode = InterviewMode.ONLINE
    location_or_link: str | None = None
    notes: str | None = None


class InterviewUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    mode: InterviewMode | None = None
    location_or_link: str | None = None
    notes: str | None = None
    status: InterviewStatus | None = None


def _serialize(interview: Interview) -> dict:
    return {
        "id": interview.id,
        "application_id": interview.application_id,
        "scheduled_at": interview.scheduled_at.isoformat(),
        "duration_minutes": interview.duration_minutes,
        "mode": interview.mode.value,
        "location_or_link": interview.location_or_link,
        "notes": interview.notes,
        "status": interview.status.value,
    }


@router.post("/jobs/{job_id}/candidates/{application_id}/interview")
def schedule_interview(
    job_id: int, application_id: int, payload: InterviewCreate,
    db: Session = Depends(get_db), user: User = Depends(require_recruiter),
):
    application = db.query(Application).filter(Application.id == application_id, Application.job_id == job_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    job = db.query(Job).filter(Job.id == job_id).first()

    interview = Interview(
        application_id=application.id,
        scheduled_by=user.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        mode=payload.mode,
        location_or_link=payload.location_or_link,
        notes=payload.notes,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    candidate_user = application.candidate.user if application.candidate else None
    if candidate_user:
        company_name = job.company_name if job else None
        send_interview_scheduled_email(
            candidate_user.email, candidate_user.full_name, job.title if job else "the role",
            payload.scheduled_at.strftime("%A, %d %B %Y at %I:%M %p"),
            payload.mode.value, payload.location_or_link, company_name,
        )
        job_label = f"{job.title} at {company_name}" if job and company_name else (job.title if job else "a role")
        create_notification(
            db, candidate_user.id, NotificationType.INTERVIEW_SCHEDULED,
            f"Interview scheduled for {job_label} on {payload.scheduled_at.strftime('%d %b %Y')}",
            link="/candidate/applications",
        )
        db.commit()

    return _serialize(interview)


@router.get("/jobs/{job_id}/candidates/{application_id}/interviews")
def list_interviews_for_application(
    job_id: int, application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    application = db.query(Application).filter(Application.id == application_id, Application.job_id == job_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    interviews = db.query(Interview).filter(Interview.application_id == application_id).order_by(Interview.scheduled_at.desc()).all()
    return [_serialize(i) for i in interviews]


@router.patch("/interviews/{interview_id}")
def update_interview(interview_id: int, payload: InterviewUpdate, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interview, field, value)
    db.commit()
    db.refresh(interview)
    return _serialize(interview)


@router.get("/interviews/mine")
def my_upcoming_interviews(db: Session = Depends(get_db), user: User = Depends(require_candidate)):
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        return []
    rows = (
        db.query(Interview, Application, Job)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .filter(Application.candidate_id == candidate.id)
        .filter(Interview.status == InterviewStatus.SCHEDULED)
        .order_by(Interview.scheduled_at.asc())
        .all()
    )
    return [
        {**_serialize(i), "job_title": j.title, "company_name": j.company_name}
        for i, a, j in rows
    ]
