import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, ForeignKey, DateTime,
    Enum, Table, JSON
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"
    ADMIN = "admin"


class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    UNDER_REVIEW = "under_review"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    HIRED = "hired"


class SkillPriority(str, enum.Enum):
    MUST_HAVE = "must_have"
    GOOD_TO_HAVE = "good_to_have"
    OPTIONAL = "optional"


# Association table: job <-> skill (with priority)
class JobSkill(Base):
    __tablename__ = "job_skills"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    priority = Column(Enum(SkillPriority), default=SkillPriority.MUST_HAVE)

    job = relationship("Job", back_populates="job_skills")
    skill = relationship("Skill")


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    proficiency = Column(Float, default=1.0)  # 0-1 confidence/strength from extraction

    candidate = relationship("Candidate", back_populates="candidate_skills")
    skill = relationship("Skill")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter_profile = relationship("Recruiter", back_populates="user", uselist=False)
    candidate_profile = relationship("Candidate", back_populates="user", uselist=False)

    @property
    def company_name(self) -> str | None:
        return self.recruiter_profile.company_name if self.recruiter_profile else None


class PasswordResetToken(Base):
    """Short-lived, single-use token for the forgot-password flow."""
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Recruiter(Base):
    __tablename__ = "recruiters"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    company_name = Column(String, nullable=True)
    designation = Column(String, nullable=True)

    user = relationship("User", back_populates="recruiter_profile")
    jobs = relationship("Job", back_populates="recruiter")


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    headline = Column(String, nullable=True)
    total_experience_years = Column(Float, default=0.0)
    education_level = Column(String, nullable=True)

    user = relationship("User", back_populates="candidate_profile")
    resumes = relationship("Resume", back_populates="candidate")
    candidate_skills = relationship("CandidateSkill", back_populates="candidate")
    applications = relationship("Application", back_populates="candidate")


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True, nullable=False)
    normalized_name = Column(String, index=True, nullable=False)  # lowercased/canonical form
    category = Column(String, nullable=True)  # e.g. "backend", "ml", "cloud"


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    recruiter_id = Column(Integer, ForeignKey("recruiters.id"), nullable=False)
    title = Column(String, nullable=False)
    department = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    experience_min = Column(Float, default=0.0)
    experience_max = Column(Float, default=0.0)
    education = Column(String, nullable=True)
    certifications = Column(String, nullable=True)
    location = Column(String, nullable=True)
    employment_type = Column(String, nullable=True)
    status = Column(String, default="open")  # open / closed / draft
    ai_extracted = Column(JSON, nullable=True)  # cached JD-intelligence output
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter = relationship("Recruiter", back_populates="jobs")
    job_skills = relationship("JobSkill", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")

    @property
    def company_name(self) -> str | None:
        """Convenience accessor so JobOut can expose the posting recruiter's
        company name without every router needing to join/reach through
        job.recruiter.company_name manually."""
        return self.recruiter.company_name if self.recruiter else None


class NotificationType(str, enum.Enum):
    NEW_APPLICATION = "new_application"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    OFFER_GENERATED = "offer_generated"
    NEW_JOB_MATCH = "new_job_match"


class Notification(Base):
    """In-app notification, distinct from (and sent alongside) the email
    notifications - so a user sees an update immediately in the bell icon
    even if they don't check their inbox."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True)
    content_hash = Column(String, nullable=True, index=True)  # for duplicate-resume detection
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="resumes")
    extracted_profile = relationship("ExtractedProfile", back_populates="resume", uselist=False)


class ExtractedProfile(Base):
    """Structured data extracted from a resume by the NLP pipeline."""
    __tablename__ = "extracted_profiles"
    id = Column(Integer, primary_key=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), unique=True)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    education = Column(JSON, nullable=True)
    experience = Column(JSON, nullable=True)
    projects = Column(JSON, nullable=True)
    certifications = Column(JSON, nullable=True)
    skills = Column(JSON, nullable=True)
    total_experience_years = Column(Float, default=0.0)

    resume = relationship("Resume", back_populates="extracted_profile")


class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.APPLIED)
    applied_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    candidate = relationship("Candidate", back_populates="applications")
    match_score = relationship("MatchScore", back_populates="application", uselist=False, cascade="all, delete-orphan")
    skill_gap = relationship("SkillGap", back_populates="application", uselist=False, cascade="all, delete-orphan")


class MatchScore(Base):
    __tablename__ = "match_scores"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True)
    overall_score = Column(Float, nullable=False)
    skill_match_score = Column(Float, default=0.0)
    semantic_score = Column(Float, default=0.0)
    experience_score = Column(Float, default=0.0)
    project_score = Column(Float, default=0.0)
    education_score = Column(Float, default=0.0)
    certification_score = Column(Float, default=0.0)
    ml_shortlist_probability = Column(Float, nullable=True)  # from ML classifier
    explanation = Column(JSON, nullable=True)  # feature contributions + LLM explanation (clearly separated)
    computed_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="match_score")


class SkillGap(Base):
    __tablename__ = "skill_gaps"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True)
    matched_skills = Column(JSON, nullable=True)
    missing_critical = Column(JSON, nullable=True)
    missing_secondary = Column(JSON, nullable=True)

    application = relationship("Application", back_populates="skill_gap")


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    score = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InterviewMode(str, enum.Enum):
    ONLINE = "online"
    IN_PERSON = "in_person"
    PHONE = "phone"


class Shortlist(Base):
    __tablename__ = "shortlists"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    shortlisted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Interview(Base):
    """A scheduled interview for a specific job application."""
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    scheduled_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)
    mode = Column(Enum(InterviewMode), default=InterviewMode.ONLINE)
    location_or_link = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", backref="interviews")


class ScreeningSession(Base):
    """
    A saved Bulk Resume Screening run: the pasted job requirement plus every
    scanned resume's result, so a recruiter can revisit past screenings
    instead of losing the ranked list once they navigate away.
    """
    __tablename__ = "screening_sessions"
    id = Column(Integer, primary_key=True)
    recruiter_id = Column(Integer, ForeignKey("recruiters.id"), nullable=False)
    job_description = Column(Text, nullable=False)
    title = Column(String, nullable=True)  # optional short label, e.g. "Python Developer - Sept batch"
    resume_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("ScreeningResult", back_populates="session", cascade="all, delete-orphan")


class ScreeningResult(Base):
    __tablename__ = "screening_results"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("screening_sessions.id"), nullable=False)
    filename = Column(String, nullable=False)
    candidate_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    experience_years = Column(Float, default=0.0)
    match_score = Column(Float, nullable=False)
    ml_shortlist_probability = Column(Float, nullable=True)
    matched_skills = Column(JSON, nullable=True)
    missing_critical = Column(JSON, nullable=True)
    missing_secondary = Column(JSON, nullable=True)

    session = relationship("ScreeningSession", back_populates="results")
