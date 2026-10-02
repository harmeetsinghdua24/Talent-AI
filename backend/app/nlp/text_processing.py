"""
Core NLP utilities: text cleaning, section detection, skill extraction,
and entity extraction (name/email/phone/education/experience).

Uses spaCy for entity recognition and a regex/alias-based approach for
skill extraction, which is more precise and controllable than pure NER
for a closed-domain skill taxonomy.
"""
import re
from functools import lru_cache

import spacy

from app.nlp.skill_taxonomy import all_aliases_sorted_by_length, normalize_skill

EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,4}\d{3,4}")
YEARS_EXP_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience", re.IGNORECASE
)
# Looser fallback: "(2.5 years)" style parenthetical durations next to a role line,
# used only when the stricter pattern above finds nothing.
YEARS_LOOSE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b", re.IGNORECASE)

SECTION_HEADERS = [
    "experience", "work experience", "education", "projects", "skills",
    "certifications", "internships", "summary", "objective", "achievements",
]


@lru_cache
def get_nlp():
    return spacy.load("en_core_web_sm")


def clean_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def detect_sections(text: str) -> dict[str, str]:
    """Very lightweight section splitter based on header keywords on their own line."""
    lines = text.split("\n")
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in lines:
        stripped = line.strip().lower().strip(":")
        if stripped in SECTION_HEADERS and len(stripped) < 30:
            current = stripped
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items()}


def extract_email(text: str) -> str | None:
    m = EMAIL_RE.search(text)
    return m.group(0) if m else None


def extract_phone(text: str) -> str | None:
    m = PHONE_RE.search(text)
    return m.group(0).strip() if m else None


def extract_years_of_experience(text: str) -> float:
    matches = YEARS_EXP_RE.findall(text)
    if matches:
        return max(float(m) for m in matches)
    # Fallback for resumes that state duration without the word "experience",
    # e.g. "Software Engineer at Acme Corp (2.5 years)". Capped at a sane
    # value to avoid false positives from unrelated numbers.
    loose = [float(m) for m in YEARS_LOOSE_RE.findall(text)]
    loose = [v for v in loose if 0 < v <= 40]
    if loose:
        return max(loose)
    return 0.0


def extract_name(text: str) -> str | None:
    """
    Heuristic: prefer a clean "First Last" style first line (typical resume
    header format); fall back to spaCy's first PERSON entity. The first-line
    check runs first because small NER models occasionally misclassify a
    capitalized tech term (e.g. "Python") as PERSON on short, sparse text,
    while a resume's very first line is reliably the candidate's name in
    the overwhelming majority of real resumes.
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if lines:
        first_line = lines[0]
        words = first_line.split()
        if (
            2 <= len(words) <= 4
            and all(w[0].isupper() for w in words if w[0].isalpha())
            and "@" not in first_line
            and not any(ch.isdigit() for ch in first_line)
            and normalize_skill(first_line) is None
        ):
            return first_line

    header = "\n".join(lines[:5])
    doc = get_nlp()(header)
    for ent in doc.ents:
        if ent.label_ == "PERSON" and normalize_skill(ent.text) is None:
            return ent.text.strip()
    return None


def extract_skills(text: str) -> list[dict]:
    """
    Alias-based skill extraction with normalization.
    Returns a list of {"skill": canonical_name, "matched_text": raw_alias}.
    Longest aliases are matched first to avoid partial overlaps
    (e.g. "django rest framework" before "django").
    """
    lowered = text.lower()
    found: dict[str, str] = {}
    for alias in all_aliases_sorted_by_length():
        pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
        if re.search(pattern, lowered):
            canonical = normalize_skill(alias)
            if canonical and canonical not in found:
                found[canonical] = alias
    return [{"skill": k, "matched_text": v} for k, v in found.items()]


def extract_organizations(text: str) -> list[str]:
    doc = get_nlp()(text[:20000])  # cap for performance
    orgs = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"})
    return orgs[:15]


def extract_education_lines(text: str) -> list[str]:
    keywords = ["bachelor", "b.tech", "btech", "b.e", "master", "m.tech", "mtech",
                "m.e", "phd", "diploma", "university", "college", "institute"]
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    return [ln for ln in lines if any(k in ln.lower() for k in keywords)][:10]
