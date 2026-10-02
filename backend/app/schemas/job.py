from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobCreate(BaseModel):
    title: str
    department: Optional[str] = None
    description: str
    experience_min: float = 0
    experience_max: float = 0
    education: Optional[str] = None
    certifications: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    education: Optional[str] = None
    certifications: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    status: Optional[str] = None


class JobOut(BaseModel):
    id: int
    title: str
    department: Optional[str]
    description: str
    experience_min: float
    experience_max: float
    education: Optional[str]
    location: Optional[str]
    employment_type: Optional[str]
    status: str
    company_name: Optional[str] = None
    ai_extracted: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)
