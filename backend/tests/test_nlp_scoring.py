from app.nlp.text_processing import extract_skills, extract_email, extract_years_of_experience, clean_text, extract_name
from app.services.jd_intelligence import analyze_job_description
from app.services.scoring import compute_match_score
from app.nlp.semantic_matcher import TfidfSemanticMatcher


def test_extract_skills_normalizes_aliases():
    text = "Experience with Django REST Framework, k8s, and Postgres."
    skills = {s["skill"] for s in extract_skills(text)}
    assert "django" in skills
    assert "kubernetes" in skills
    assert "postgresql" in skills


def test_extract_email():
    assert extract_email("Contact me at jane.doe@example.com please") == "jane.doe@example.com"


def test_extract_years_of_experience_variants():
    assert extract_years_of_experience("3+ years of experience with Python") == 3.0
    assert extract_years_of_experience("Software Engineer (2.5 years)") == 2.5
    assert extract_years_of_experience("No experience mentioned here") == 0.0


def test_jd_intelligence_classifies_must_vs_good_to_have():
    jd = "Required: Python, SQL. Good to have: Docker, AWS. 1-3 years experience."
    result = analyze_job_description(jd)
    assert "python" in result["must_have_skills"]
    assert "docker" in result["good_to_have_skills"]
    assert result["experience_min_years"] == 1.0
    assert result["experience_max_years"] == 3.0


def test_semantic_matcher_scores_related_text_higher_than_unrelated():
    matcher = TfidfSemanticMatcher()
    jd = "Backend developer with REST API and database experience"
    related = "Built REST APIs and worked extensively with databases"
    unrelated = "Watercolor painting and landscape photography portfolio"
    assert matcher.similarity(jd, related) > matcher.similarity(jd, unrelated)


def test_semantic_matcher_handles_empty_text():
    matcher = TfidfSemanticMatcher()
    assert matcher.similarity("", "something") == 0.0
    assert matcher.similarity("something", "") == 0.0


def test_compute_match_score_perfect_match_scores_high():
    breakdown = compute_match_score(
        job_description="Python developer with SQL and REST API experience",
        job_must_have_skills=["python", "sql"],
        job_good_to_have_skills=["docker"],
        required_experience_min=1,
        required_experience_max=3,
        required_education=None,
        required_certifications=None,
        candidate_resume_text="Python developer with SQL and REST API experience",
        candidate_skills=["python", "sql", "docker"],
        candidate_experience_years=2,
        candidate_education_lines=[],
        candidate_projects=["Built REST APIs with Python and SQL"],
        candidate_certifications=[],
    )
    assert breakdown.overall > 0.7
    assert breakdown.missing_critical == []


def test_compute_match_score_missing_all_skills_scores_low():
    breakdown = compute_match_score(
        job_description="Python developer with SQL experience",
        job_must_have_skills=["python", "sql"],
        job_good_to_have_skills=[],
        required_experience_min=1,
        required_experience_max=3,
        required_education=None,
        required_certifications=None,
        candidate_resume_text="Graphic designer with Photoshop and Illustrator skills",
        candidate_skills=["photoshop", "illustrator"],
        candidate_experience_years=0,
        candidate_education_lines=[],
        candidate_projects=[],
        candidate_certifications=[],
    )
    assert breakdown.overall < 0.3
    assert set(breakdown.missing_critical) == {"python", "sql"}


def test_extract_name_prefers_header_line_over_misleading_ner():
    text = "Live Candidate\nlive.candidate@email.com\nBuilt REST APIs using Python, FastAPI, PostgreSQL."
    assert extract_name(text) == "Live Candidate"


def test_clean_text_collapses_whitespace():
    assert clean_text("Hello   world\n\n\n\nfoo") == "Hello world\n\nfoo"
