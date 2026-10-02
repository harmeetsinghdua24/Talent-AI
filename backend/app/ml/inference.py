"""
Loads the trained shortlist-probability classifier (see
ml/training/train_shortlist_model.py for training + evaluation) and exposes
a simple prediction function used by the ranking service.

This is a genuine ML model in the pipeline - it is NOT the same thing as the
transparent rule-based ScoreBreakdown in app.services.scoring. The two are
combined and clearly labeled separately in API responses:
  - `overall_score`               -> transparent weighted-feature score
  - `ml_shortlist_probability`    -> learned classifier's probability estimate
"""
import os
from functools import lru_cache

import joblib
import pandas as pd

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "shortlist_classifier.joblib")
FEATURES_PATH = os.path.join(ARTIFACT_DIR, "feature_columns.joblib")


@lru_cache
def _load_model():
    if not os.path.exists(MODEL_PATH):
        return None, None
    model = joblib.load(MODEL_PATH)
    feature_columns = joblib.load(FEATURES_PATH)
    return model, feature_columns


def predict_shortlist_probability(score_breakdown, num_matched_skills: int, num_missing_critical: int, candidate_experience_years: float) -> float | None:
    """
    score_breakdown: app.services.scoring.ScoreBreakdown instance.
    Returns None if the model artifact isn't available (e.g. before first training run),
    so callers must handle graceful degradation rather than crash.
    """
    model, feature_columns = _load_model()
    if model is None:
        return None

    row = {
        "skill_match": score_breakdown.skill_match,
        "semantic_match": score_breakdown.semantic_match,
        "experience_score": score_breakdown.experience,
        "project_score": score_breakdown.projects,
        "education_score": score_breakdown.education,
        "num_matched_skills": num_matched_skills,
        "num_missing_critical": num_missing_critical,
        "candidate_experience_years": candidate_experience_years,
    }
    ordered_df = pd.DataFrame([[row[col] for col in feature_columns]], columns=feature_columns)
    proba = model.predict_proba(ordered_df)[0][1]
    return float(proba)
