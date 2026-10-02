"""
Resume file parsing: converts uploaded PDF/DOCX bytes into raw text, then
runs the NLP pipeline to produce a structured candidate profile.

Text extraction works directly from in-memory bytes (via BytesIO) rather
than requiring a filesystem path, so parsing is completely independent of
which storage backend (local disk or S3) persists the original file - see
app/services/storage_service.py.
"""
import io
import uuid
from pathlib import Path

import pdfplumber
import docx

from app.core.config import get_settings
from app.nlp.text_processing import (
    clean_text, extract_email, extract_phone, extract_name, extract_skills,
    extract_years_of_experience, extract_education_lines, detect_sections,
)

settings = get_settings()


class UnsupportedFileType(Exception):
    pass


def safe_filename(original_filename: str) -> str:
    """Prevent path traversal; generate a random, safe stored filename."""
    ext = Path(original_filename or "").suffix.lower()
    if ext not in settings.ALLOWED_RESUME_EXTENSIONS:
        raise UnsupportedFileType(f"Unsupported file type: {ext or 'unknown'}")
    return f"{uuid.uuid4().hex}{ext}"


def extract_text_from_pdf_bytes(content: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    return "\n".join(text_parts)


def extract_text_from_docx_bytes(content: bytes) -> str:
    document = docx.Document(io.BytesIO(content))
    return "\n".join(p.text for p in document.paragraphs)


def extract_raw_text(content: bytes, filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext == ".pdf":
        raw = extract_text_from_pdf_bytes(content)
    elif ext == ".docx":
        raw = extract_text_from_docx_bytes(content)
    else:
        raise UnsupportedFileType(f"Unsupported file type: {ext or 'unknown'}")
    return clean_text(raw)


def parse_resume_to_profile(raw_text: str) -> dict:
    """Run the NLP pipeline over resume text to produce a structured profile."""
    sections = detect_sections(raw_text)
    skills = extract_skills(raw_text)
    projects_text = sections.get("projects", "")
    certifications_text = sections.get("certifications", "")

    return {
        "name": extract_name(raw_text),
        "email": extract_email(raw_text),
        "phone": extract_phone(raw_text),
        "education": extract_education_lines(sections.get("education", raw_text)),
        "experience": {
            "years": extract_years_of_experience(raw_text),
            "raw_section": sections.get("experience", sections.get("work experience", "")),
        },
        "projects": [p.strip("-• ").strip() for p in projects_text.split("\n") if p.strip()][:15],
        "certifications": [c.strip("-• ").strip() for c in certifications_text.split("\n") if c.strip()][:10],
        "skills": skills,
        "total_experience_years": extract_years_of_experience(raw_text),
    }


def validate_upload_size(content: bytes) -> None:
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(f"File exceeds max size of {settings.MAX_UPLOAD_SIZE_MB}MB")
