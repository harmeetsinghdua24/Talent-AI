from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Job, Recruiter, User, JobSkill, Skill, SkillPriority
from app.schemas.job import JobCreate, JobUpdate, JobOut
from app.api.deps import get_current_user, require_recruiter
from app.services.jd_intelligence import analyze_job_description
from app.services.notification_service import notify_matching_candidates_of_new_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_or_create_skill(db: Session, name: str) -> Skill:
    skill = db.query(Skill).filter(Skill.normalized_name == name).first()
    if not skill:
        skill = Skill(name=name, normalized_name=name)
        db.add(skill)
        db.flush()
    return skill


@router.post("", response_model=JobOut, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
    if not recruiter:
        raise HTTPException(status_code=400, detail="Recruiter profile not found")

    analysis = analyze_job_description(payload.description)

    job = Job(
        recruiter_id=recruiter.id,
        title=payload.title,
        department=payload.department,
        description=payload.description,
        experience_min=payload.experience_min or analysis["experience_min_years"],
        experience_max=payload.experience_max or analysis["experience_max_years"],
        education=payload.education or analysis["education_requirement"],
        certifications=payload.certifications,
        location=payload.location,
        employment_type=payload.employment_type,
        ai_extracted=analysis,
    )
    db.add(job)
    db.flush()

    for skill_name in analysis["must_have_skills"]:
        skill = _get_or_create_skill(db, skill_name)
        db.add(JobSkill(job_id=job.id, skill_id=skill.id, priority=SkillPriority.MUST_HAVE))
    for skill_name in analysis["good_to_have_skills"]:
        skill = _get_or_create_skill(db, skill_name)
        db.add(JobSkill(job_id=job.id, skill_id=skill.id, priority=SkillPriority.GOOD_TO_HAVE))

    db.commit()
    db.refresh(job)

    # Proactively notify candidates whose resume is a strong fit - see
    # notify_matching_candidates_of_new_job for the matching/threshold logic.
    notify_matching_candidates_of_new_job(db, job)
    db.commit()

    return job


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Job)
    if user.role.value == "recruiter":
        recruiter = db.query(Recruiter).filter(Recruiter.user_id == user.id).first()
        if recruiter:
            query = query.filter(Job.recruiter_id == recruiter.id)
    else:
        query = query.filter(Job.status == "open")
    return query.order_by(Job.created_at.desc()).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_recruiter),
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    recruiter = db.query(Recruiter).filter(
        Recruiter.user_id == user.id
    ).first()

    if not recruiter or job.recruiter_id != recruiter.id:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own jobs"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return None


@router.post("/{job_id}/duplicate", response_model=JobOut, status_code=201)
def duplicate_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(require_recruiter)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    new_job = Job(
        recruiter_id=job.recruiter_id,
        title=f"{job.title} (Copy)",
        department=job.department,
        description=job.description,
        experience_min=job.experience_min,
        experience_max=job.experience_max,
        education=job.education,
        certifications=job.certifications,
        location=job.location,
        employment_type=job.employment_type,
        ai_extracted=job.ai_extracted,
        status="draft",
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job
