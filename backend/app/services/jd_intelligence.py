"""
Job Description Intelligence: parses a free-text JD into structured,
classified requirements (must-have / good-to-have / optional skills,
experience range, education, responsibilities).

Skill priority classification is rule-based and transparent:
  - Skills mentioned near "required", "must have", "must-have", "mandatory"
    -> MUST_HAVE
  - Skills mentioned near "good to have", "nice to have", "preferred", "bonus"
    -> GOOD_TO_HAVE
  - All other detected skills default to MUST_HAVE if in the first 60% of the
    JD (core requirements section), else GOOD_TO_HAVE.
This keeps the classification auditable, as opposed to an opaque LLM call
making a silent decision - a natural-language summary can be layered on top
via app.ai.generative for presentation, but the classification itself is
rule-based and testable.
"""
import re

from app.nlp.text_processing import extract_skills, extract_years_of_experience, clean_text
from app.nlp.skill_taxonomy import normalize_skill

GOOD_TO_HAVE_MARKERS = re.compile(
    r"(good to have|nice to have|preferred|bonus|plus|desirable)", re.IGNORECASE
)
MUST_HAVE_MARKERS = re.compile(
    r"(required|must have|must-have|mandatory|essential)", re.IGNORECASE
)


def _skill_context_window(text: str, alias: str, window: int = 80) -> str:
    idx = text.lower().find(alias.lower())
    if idx == -1:
        return ""
    start = max(0, idx - window)
    end = min(len(text), idx + len(alias) + window)
    return text[start:end]


def extract_experience_range(text: str) -> tuple[float, float]:
    # Look for patterns like "1-3 years", "1 to 3 years", "3+ years"
    range_match = re.search(r"(\d+)\s*(?:-|to)\s*(\d+)\s*\+?\s*years?", text, re.IGNORECASE)
    if range_match:
        return float(range_match.group(1)), float(range_match.group(2))
    plus_match = re.search(r"(\d+)\s*\+\s*years?", text, re.IGNORECASE)
    if plus_match:
        val = float(plus_match.group(1))
        return val, val + 3  # open-ended, assume a soft ceiling for display purposes
    single = extract_years_of_experience(text)
    if single:
        return single, single
    return 0.0, 0.0


def extract_education_requirement(text: str) -> str | None:
    patterns = [
        r"(bachelor'?s?\s*(?:degree)?[^.\n]*)",
        r"(master'?s?\s*(?:degree)?[^.\n]*)",
        r"(b\.?tech[^.\n]*)",
        r"(m\.?tech[^.\n]*)",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:120]
    return None


def classify_skills(jd_text: str) -> dict:
    """
    Classify each detected skill mention by the nearest preceding priority
    marker within its sentence/line segment, rather than a fixed character
    window (which can otherwise span two adjacent requirement lists and
    misclassify skills, e.g. "Required: Python. Good to have: Docker.").
    """
    text = clean_text(jd_text)
    # Split into segments on sentence/line boundaries so each segment's
    # marker applies only to the skills mentioned within it.
    segments = re.split(r"(?<=[.\n])", text)

    must_have, good_to_have = [], []
    seen_good_to_have: set[str] = set()
    cursor = 0
    for segment in segments:
        seg_start = cursor
        cursor += len(segment)
        detected = extract_skills(segment)
        if not detected:
            continue

        if GOOD_TO_HAVE_MARKERS.search(segment):
            for item in detected:
                good_to_have.append(item["skill"])
                seen_good_to_have.add(item["skill"])
        elif MUST_HAVE_MARKERS.search(segment):
            for item in detected:
                must_have.append(item["skill"])
        else:
            # Default heuristic: first 60% of doc = core requirements
            position_ratio = seg_start / max(1, len(text))
            target = must_have if position_ratio < 0.6 else good_to_have
            for item in detected:
                target.append(item["skill"])

    must_have_set = set(must_have) - seen_good_to_have
    return {
        "must_have": sorted(must_have_set),
        "good_to_have": sorted(set(good_to_have) - must_have_set),
    }


def analyze_job_description(jd_text: str) -> dict:
    text = clean_text(jd_text)
    skills = classify_skills(text)
    exp_min, exp_max = extract_experience_range(text)
    education = extract_education_requirement(text)

    return {
        "must_have_skills": skills["must_have"],
        "good_to_have_skills": skills["good_to_have"],
        "experience_min_years": exp_min,
        "experience_max_years": exp_max,
        "education_requirement": education,
    }
