"""
Multi-factor, explainable match scoring between a job and a candidate profile.

Design principle (Explainable AI requirement):
This module computes the MODEL SCORE using transparent, auditable arithmetic
over named features. Nothing here is an LLM call. A separate module
(app.ai.explanations) may later translate this breakdown into natural
language for the recruiter, but that generated text is always stored and
labeled separately from these numeric feature contributions so the two are
never conflated.
"""
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.nlp.semantic_matcher import get_semantic_matcher

settings = get_settings()


@dataclass
class ScoreBreakdown:
    skill_match: float
    semantic_match: float
    experience: float
    projects: float
    education: float
    certifications: float
    overall: float
    matched_skills: list[str] = field(default_factory=list)
    missing_critical: list[str] = field(default_factory=list)
    missing_secondary: list[str] = field(default_factory=list)
    weights: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "skill_match": round(self.skill_match, 4),
            "semantic_match": round(self.semantic_match, 4),
            "experience": round(self.experience, 4),
            "projects": round(self.projects, 4),
            "education": round(self.education, 4),
            "certifications": round(self.certifications, 4),
            "overall": round(self.overall, 4),
            "matched_skills": self.matched_skills,
            "missing_critical": self.missing_critical,
            "missing_secondary": self.missing_secondary,
            "weights": self.weights,
        }


def _skill_score(job_must_have: set[str], job_good_to_have: set[str], candidate_skills: set[str]) -> tuple[float, list, list, list]:
    matched = sorted((job_must_have | job_good_to_have) & candidate_skills)
    missing_critical = sorted(job_must_have - candidate_skills)
    missing_secondary = sorted(job_good_to_have - candidate_skills)

    if not job_must_have and not job_good_to_have:
        return 0.0, matched, missing_critical, missing_secondary

    # Must-have skills weighted higher than good-to-have.
    must_weight, good_weight = 0.8, 0.2
    must_score = (
        len(job_must_have & candidate_skills) / len(job_must_have) if job_must_have else 1.0
    )
    good_score = (
        len(job_good_to_have & candidate_skills) / len(job_good_to_have) if job_good_to_have else 1.0
    )
    score = must_weight * must_score + good_weight * good_score
    return score, matched, missing_critical, missing_secondary


def _experience_score(required_min: float, required_max: float, candidate_years: float) -> float:
    if required_min <= 0 and required_max <= 0:
        return 1.0
    if candidate_years >= required_min:
        if required_max and candidate_years > required_max * 1.5:
            # Significantly overqualified - not necessarily a strong signal, but not penalized here.
            return 1.0
        return 1.0
    if required_min == 0:
        return 1.0
    # Partial credit scaled linearly toward the minimum requirement.
    return max(0.0, candidate_years / required_min)


def _education_score(required_education: str | None, candidate_education_lines: list[str]) -> float:
    if not required_education:
        return 1.0
    req = required_education.lower()
    joined = " ".join(candidate_education_lines).lower()
    return 1.0 if any(token in joined for token in req.split()) else 0.4


def _certification_score(required_certs: str | None, candidate_certs: list[str]) -> float:
    if not required_certs:
        return 1.0
    req_tokens = [c.strip().lower() for c in required_certs.split(",") if c.strip()]
    if not req_tokens:
        return 1.0
    joined = " ".join(candidate_certs).lower()
    hits = sum(1 for t in req_tokens if t in joined)
    return hits / len(req_tokens)


def _project_relevance_score(job_description: str, projects: list[str]) -> float:
    if not projects:
        return 0.0
    matcher = get_semantic_matcher()
    joined_projects = " ".join(projects)
    return matcher.similarity(job_description, joined_projects)


def compute_match_score(
    job_description: str,
    job_must_have_skills: list[str],
    job_good_to_have_skills: list[str],
    required_experience_min: float,
    required_experience_max: float,
    required_education: str | None,
    required_certifications: str | None,
    candidate_resume_text: str,
    candidate_skills: list[str],
    candidate_experience_years: float,
    candidate_education_lines: list[str],
    candidate_projects: list[str],
    candidate_certifications: list[str],
) -> ScoreBreakdown:
    matcher = get_semantic_matcher()

    skill_score, matched, missing_crit, missing_sec = _skill_score(
        set(job_must_have_skills), set(job_good_to_have_skills), set(candidate_skills)
    )
    semantic_score = matcher.similarity(job_description, candidate_resume_text)
    experience_score = _experience_score(required_experience_min, required_experience_max, candidate_experience_years)
    project_score = _project_relevance_score(job_description, candidate_projects)
    education_score = _education_score(required_education, candidate_education_lines)
    certification_score = _certification_score(required_certifications, candidate_certifications)

    weights = {
        "skill_match": settings.WEIGHT_SKILL_MATCH,
        "semantic_match": settings.WEIGHT_SEMANTIC,
        "experience": settings.WEIGHT_EXPERIENCE,
        "projects": settings.WEIGHT_PROJECTS,
        "education": settings.WEIGHT_EDUCATION,
        "certifications": settings.WEIGHT_CERTIFICATIONS,
    }

    overall = (
        weights["skill_match"] * skill_score
        + weights["semantic_match"] * semantic_score
        + weights["experience"] * experience_score
        + weights["projects"] * project_score
        + weights["education"] * education_score
        + weights["certifications"] * certification_score
    )

    return ScoreBreakdown(
        skill_match=skill_score,
        semantic_match=semantic_score,
        experience=experience_score,
        projects=project_score,
        education=education_score,
        certifications=certification_score,
        overall=overall,
        matched_skills=matched,
        missing_critical=missing_crit,
        missing_secondary=missing_sec,
        weights=weights,
    )
