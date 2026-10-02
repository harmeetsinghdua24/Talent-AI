# app/ranking

The candidate ranking, comparison, and shortlist/reject HTTP endpoints
currently live in `app/api/routers/ranking.py` (they need FastAPI's router
machinery and DB session dependency directly). This package is reserved for
extracting the underlying ranking/sorting logic into pure, independently
testable functions as the ranking rules grow more complex (e.g. multi-field
weighted sort, pagination strategies) — following the same
service/router separation already used for scoring
(`app/services/scoring.py` vs `app/api/routers/resumes.py`).
