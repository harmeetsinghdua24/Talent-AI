"""
Synthetic job-candidate dataset generator.

WHY SYNTHETIC DATA (documented honestly, see README -> Dataset & Limitations):
This build environment has no network access to Kaggle/Hugging Face Datasets,
where a real public resume-job matching dataset (e.g. Kaggle's "Resume
Dataset", or the ESCO occupations/skills dataset) would normally be pulled
from. Rather than fabricate "real" evaluation numbers against data that was
never actually used, this script generates a synthetic but structurally
realistic dataset with a documented, reproducible generation process, and
all evaluation metrics reported elsewhere are computed genuinely against a
held-out split of THIS data.

For a real deployment: swap this module for a loader that pulls the actual
Kaggle Resume Dataset (via `kaggle datasets download -d snehaanbhawal/resume-dataset`)
or O*NET/ESCO skills-occupations data, keeping the same downstream schema
(job_features, candidate_features, label) so the training script does not
need to change.

Generation logic:
  - A fixed pool of canonical skills (from app.nlp.skill_taxonomy) is split
    into loose "skill families" (backend, ml, frontend, cloud, data).
  - Each synthetic job samples 3-6 must-have skills and 0-3 good-to-have
    skills from one or two related families, plus an experience requirement.
  - Each synthetic candidate samples a skill set with a controllable overlap
    with a "target" job family, simulating varying fit quality, plus
    experience/education/project-relevance noise.
  - Ground-truth label (shortlisted: 0/1) is generated from a hand-specified
    rule (skill overlap ratio + experience fit + random noise) - this is the
    "oracle" the ML model is trained to approximate from the observable
    feature columns, which mirrors how labeled historical hiring decisions
    would be used in production.
"""
import random
import csv
import os

random.seed(42)

SKILL_FAMILIES = {
    "backend": ["python", "java", "sql", "fastapi", "django", "flask", "rest api", "postgresql", "mysql"],
    "frontend": ["javascript", "typescript", "react", "next.js", "html", "css"],
    "ml": ["machine learning", "deep learning", "nlp", "scikit-learn", "tensorflow", "pytorch", "pandas", "numpy", "xgboost"],
    "cloud_devops": ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "linux"],
    "data": ["sql", "data analysis", "power bi", "tableau", "pandas", "numpy"],
}

ALL_SKILLS = sorted({s for fam in SKILL_FAMILIES.values() for s in fam})


def sample_job(family: str) -> dict:
    pool = SKILL_FAMILIES[family]
    k_must = random.randint(3, min(6, len(pool)))
    must_have = random.sample(pool, k_must)
    remaining = [s for s in ALL_SKILLS if s not in must_have]
    good_to_have = random.sample(remaining, random.randint(0, 3))
    exp_min = random.choice([0, 1, 2, 3, 5])
    exp_max = exp_min + random.choice([2, 3, 5])
    return {
        "family": family,
        "must_have": must_have,
        "good_to_have": good_to_have,
        "exp_min": exp_min,
        "exp_max": exp_max,
    }


def sample_candidate(job: dict, fit_quality: float) -> dict:
    """fit_quality in [0,1] controls how well the candidate matches the job family."""
    job_skills = set(job["must_have"]) | set(job["good_to_have"])
    n_from_job = max(0, round(len(job_skills) * fit_quality))
    from_job = random.sample(sorted(job_skills), min(n_from_job, len(job_skills)))
    n_noise = random.randint(0, 4)
    noise_pool = [s for s in ALL_SKILLS if s not in job_skills]
    from_noise = random.sample(noise_pool, min(n_noise, len(noise_pool)))
    candidate_skills = list(set(from_job + from_noise))

    exp_center = (job["exp_min"] + job["exp_max"]) / 2
    experience = max(0.0, round(random.gauss(exp_center * fit_quality + 0.3, 1.2), 1))
    project_relevance = min(1.0, max(0.0, random.gauss(fit_quality, 0.2)))
    semantic_sim = min(1.0, max(0.0, random.gauss(fit_quality * 0.7, 0.15)))
    has_required_education = random.random() < (0.5 + 0.4 * fit_quality)

    return {
        "skills": candidate_skills,
        "experience_years": experience,
        "project_relevance": project_relevance,
        "semantic_similarity": semantic_sim,
        "has_required_education": has_required_education,
    }


def compute_features(job: dict, candidate: dict) -> dict:
    must = set(job["must_have"])
    good = set(job["good_to_have"])
    cskills = set(candidate["skills"])

    must_ratio = len(must & cskills) / len(must) if must else 1.0
    good_ratio = len(good & cskills) / len(good) if good else 1.0
    skill_match = 0.8 * must_ratio + 0.2 * good_ratio

    exp_min = job["exp_min"]
    if exp_min <= 0:
        exp_score = 1.0
    else:
        exp_score = min(1.0, candidate["experience_years"] / exp_min)

    return {
        "skill_match": round(skill_match, 4),
        "semantic_match": round(candidate["semantic_similarity"], 4),
        "experience_score": round(exp_score, 4),
        "project_score": round(candidate["project_relevance"], 4),
        "education_score": 1.0 if candidate["has_required_education"] else 0.4,
        "num_matched_skills": len(must & cskills) + len(good & cskills),
        "num_missing_critical": len(must - cskills),
        "candidate_experience_years": candidate["experience_years"],
    }


def ground_truth_label(features: dict) -> int:
    """
    Oracle rule simulating a historical hiring decision, with noise -
    this is what the ML model learns to approximate from observable features.
    """
    score = (
        0.45 * features["skill_match"]
        + 0.25 * features["semantic_match"]
        + 0.20 * features["experience_score"]
        + 0.10 * features["project_score"]
    )
    score -= 0.08 * features["num_missing_critical"]
    score += random.gauss(0, 0.08)  # label noise, simulating inconsistent human decisions
    return int(score > 0.55)


def generate_dataset(n_samples: int = 4000, out_path: str = "ml/data/training_data.csv"):
    rows = []
    families = list(SKILL_FAMILIES.keys())
    for _ in range(n_samples):
        family = random.choice(families)
        job = sample_job(family)
        fit_quality = random.random()
        candidate = sample_candidate(job, fit_quality)
        features = compute_features(job, candidate)
        label = ground_truth_label(features)
        row = {**features, "label": label}
        rows.append(row)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out_path}")
    return out_path


if __name__ == "__main__":
    generate_dataset()
