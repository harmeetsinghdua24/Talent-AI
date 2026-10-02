from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models.models import UserRole


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: UserRole
    company_name: str | None = None  # required in practice for recruiters, validated below

    @field_validator("company_name")
    @classmethod
    def strip_company_name(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    company_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    company_name: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
