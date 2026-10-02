"""
Application configuration.
All values are read from environment variables (see .env.example).
Never hard-code secrets here.
"""
import os
from functools import lru_cache


class Settings:
    PROJECT_NAME: str = "AI-Powered Recruitment & Talent Intelligence Platform"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./talent_ai.db"
    )

    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me-in-.env")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # File uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
    ALLOWED_RESUME_EXTENSIONS: tuple = (".pdf", ".docx")

    # Resume storage backend:
    # "local" (default) - saves to UPLOAD_DIR on disk. Simple, but on most
    #   PaaS hosts (Railway/Render/Heroku free tiers, etc.) local disk is
    #   ephemeral - files disappear on every redeploy/restart. Fine for
    #   local dev, risky for production.
    # "s3" - saves to an AWS S3 (or S3-compatible: Cloudflare R2, MinIO,
    #   DigitalOcean Spaces, etc.) bucket, which survives redeploys.
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "")
    # Only needed for S3-compatible non-AWS providers (R2, MinIO, Spaces).
    # Leave blank to use real AWS S3.
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")

    # Matching engine
    # "tfidf"  -> always-available scikit-learn backend (default; no external calls)
    # "sbert"  -> sentence-transformers backend (requires model access at deploy time)
    SEMANTIC_BACKEND: str = os.getenv("SEMANTIC_BACKEND", "tfidf")
    SBERT_MODEL_NAME: str = os.getenv("SBERT_MODEL_NAME", "all-MiniLM-L6-v2")

    # Match score weights (must sum to 1.0)
    WEIGHT_SKILL_MATCH: float = float(os.getenv("WEIGHT_SKILL_MATCH", "0.35"))
    WEIGHT_SEMANTIC: float = float(os.getenv("WEIGHT_SEMANTIC", "0.25"))
    WEIGHT_EXPERIENCE: float = float(os.getenv("WEIGHT_EXPERIENCE", "0.20"))
    WEIGHT_PROJECTS: float = float(os.getenv("WEIGHT_PROJECTS", "0.10"))
    WEIGHT_EDUCATION: float = float(os.getenv("WEIGHT_EDUCATION", "0.05"))
    WEIGHT_CERTIFICATIONS: float = float(os.getenv("WEIGHT_CERTIFICATIONS", "0.05"))

    # CORS
    CORS_ORIGINS: list = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://talent-ai-eight.vercel.app"
).split(",")

    # Rate limiting (requests per minute per IP) - enforced in middleware
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    # Email notifications
    # "console" (default) logs the email instead of sending it - works with
    # zero configuration, useful for local dev/demo. Switch to "smtp" once
    # you have real SMTP credentials (see .env.example).
    EMAIL_BACKEND: str = os.getenv("EMAIL_BACKEND", "console")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "no-reply@talentum.local")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # When a job is posted, candidates whose latest resume scores at or
    # above this threshold (0-1 scale) against it are proactively notified
    # (in-app + email) rather than having to discover the job themselves.
    NEW_JOB_MATCH_THRESHOLD: float = float(os.getenv("NEW_JOB_MATCH_THRESHOLD", "0.5"))

    # Used to build the password-reset link sent by email
    # (e.g. https://your-frontend.com/reset-password?token=...)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
