import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import User, UserRole, Recruiter, Candidate, PasswordResetToken
from app.schemas.auth import (
    UserRegister, UserLogin, Token, UserOut, UserProfileUpdate,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.api.deps import get_current_user
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.role == UserRole.RECRUITER and not payload.company_name:
        raise HTTPException(status_code=422, detail="Company name is required for recruiter accounts")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.flush()  # get user.id before creating the role-specific profile

    if payload.role == UserRole.RECRUITER:
        db.add(Recruiter(user_id=user.id, company_name=payload.company_name))
    elif payload.role == UserRole.CANDIDATE:
        db.add(Candidate(user_id=user.id))

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token(subject=user.email, role=user.role.value)
    return Token(access_token=token, role=user.role)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_profile(payload: UserProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.company_name is not None:
        if current_user.role != UserRole.RECRUITER:
            raise HTTPException(status_code=400, detail="Only recruiter accounts have a company name")
        if not current_user.recruiter_profile:
            current_user.recruiter_profile = Recruiter(user_id=current_user.id)
            db.add(current_user.recruiter_profile)
        current_user.recruiter_profile.company_name = payload.company_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Always returns the same generic success message whether or not the
    email exists in the system - this deliberately avoids leaking which
    email addresses are registered (a common account-enumeration flaw).
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
        db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
        db.commit()

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_password_reset_email(user.email, user.full_name, reset_link, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)

    return {"message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    if not reset_token or reset_token.used or reset_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user.hashed_password = hash_password(payload.new_password)
    reset_token.used = True
    db.commit()

    return {"message": "Your password has been reset. You can now log in with your new password."}
