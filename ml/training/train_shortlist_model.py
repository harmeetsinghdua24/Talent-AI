"""
Trains a candidate-shortlisting classifier on the engineered match-score
features and evaluates it with standard classification metrics on a
held-out test split. All numbers printed/saved here come from an actual
run of this script against ml/data/training_data.csv - none are
hand-typed or assumed.

Models compared:
  - Logistic Regression (baseline, fully interpretable coefficients)
  - Random Forest
  - XGBoost (final selected model, typically best F1/ROC-AUC on this data)

Usage:
    python ml/training/train_shortlist_model.py
"""
import json
import os

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report,
)
from xgboost import XGBClassifier

FEATURE_COLUMNS = [
    "skill_match", "semantic_match", "experience_score", "project_score",
    "education_score", "num_matched_skills", "num_missing_critical",
    "candidate_experience_years",
]
LABEL_COLUMN = "label"

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "training_data.csv")
MODEL_OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
METRICS_OUT = os.path.join(os.path.dirname(__file__), "..", "evaluation", "metrics.json")


def evaluate(model, X_test, y_test) -> dict:
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    cm = confusion_matrix(y_test, preds).tolist()
    return {
        "precision": round(precision_score(y_test, preds), 4),
        "recall": round(recall_score(y_test, preds), 4),
        "f1": round(f1_score(y_test, preds), 4),
        "roc_auc": round(roc_auc_score(y_test, probs), 4),
        "confusion_matrix": cm,  # [[TN, FP], [FN, TP]]
    }


def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURE_COLUMNS]
    y = df[LABEL_COLUMN]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    results = {}

    logreg = LogisticRegression(max_iter=1000)
    logreg.fit(X_train, y_train)
    results["logistic_regression"] = evaluate(logreg, X_test, y_test)

    rf = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)
    rf.fit(X_train, y_train)
    results["random_forest"] = evaluate(rf, X_test, y_test)

    xgb = XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.1,
        eval_metric="logloss", random_state=42,
    )
    xgb.fit(X_train, y_train)
    results["xgboost"] = evaluate(xgb, X_test, y_test)

    best_name = max(results, key=lambda k: results[k]["f1"])
    best_model = {"logistic_regression": logreg, "random_forest": rf, "xgboost": xgb}[best_name]

    os.makedirs(MODEL_OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(METRICS_OUT), exist_ok=True)
    joblib.dump(best_model, os.path.join(MODEL_OUT_DIR, "shortlist_classifier.joblib"))
    joblib.dump(FEATURE_COLUMNS, os.path.join(MODEL_OUT_DIR, "feature_columns.joblib"))

    with open(METRICS_OUT, "w") as f:
        json.dump({"results_by_model": results, "selected_model": best_name}, f, indent=2)

    print(json.dumps({"results_by_model": results, "selected_model": best_name}, indent=2))
    print(f"\nSaved best model ({best_name}) to {MODEL_OUT_DIR}/shortlist_classifier.joblib")
    print(f"Saved metrics to {METRICS_OUT}")


if __name__ == "__main__":
    main()
