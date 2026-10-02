# Talentum — AI-Powered Recruitment & Talent Intelligence Platform

An end-to-end recruitment intelligence product: recruiters post jobs and get
AI-classified requirements, candidates upload resumes and get NLP-extracted
profiles, and every application is scored by a transparent, explainable
multi-factor engine plus a genuinely trained ML classifier — not a black box.

Built as a final-year CS major project / placement portfolio piece.

---

## 1. Project overview

Talentum automates the parts of recruiting that are currently manual and
inconsistent: reading a resume, comparing it against a job description, and
deciding who to interview. It does this with a combination of rule-based NLP,
semantic (embedding-based) similarity, and a supervised ML model trained to
approximate historical shortlisting decisions — while keeping every score
auditable and explainable.

## 2. Problem statement

Manual resume screening is slow, inconsistent between reviewers, and prone to
keyword-matching blind spots (a resume that says "Django REST Framework"
should satisfy a "REST API" requirement, but naive keyword search misses
this). Recruiters need a system that is fast, consistent, and — critically —
**explainable**, so a rejection or shortlist decision can always be traced
back to specific evidence rather than an opaque score.

## 3. Features

- **JD Intelligence**: extracts must-have / good-to-have skills, experience
  range, and education requirements from free-text job descriptions.
- **Resume Intelligence**: parses PDF/DOCX resumes into structured profiles
  (name, contact, education, experience, projects, certifications, skills).
- **Semantic candidate matching**: goes beyond exact keyword overlap using a
  pluggable embedding backend (TF-IDF/LSA by default; sentence-transformers
  optional — see Semantic backend section below).
- **Transparent multi-factor match score**: skill match, semantic similarity,
  experience, project relevance, education, certifications — each visible,
  each weighted, weights configurable via environment variables.
- **ML shortlist classifier**: a separately-trained Random Forest model
  predicts shortlist probability from the same features, reported alongside
  (never instead of) the transparent score.
- **Skill-gap analysis**: matched / missing-critical / missing-secondary
  skills per application.
- **Candidate ranking, comparison, shortlist/reject** workflows for
  recruiters.
- **Candidate analytics dashboard**: total jobs applied to, shortlisted
  count, open opportunities, and average match score, visualized with a
  status-breakdown pie chart and a per-application match-score bar chart —
  backed by the same data every recruiter-side chart uses, not separate
  mock numbers.
- **Password reset**: forgot-password flow with a single-use, 30-minute
  emailed reset link, written so the response is identical whether or not
  the email exists (no account enumeration).
- **Pluggable resume storage**: local disk for development, S3-compatible
  object storage (AWS S3 / Cloudflare R2 / MinIO) for production so
  uploaded resumes survive redeploys on ephemeral-filesystem hosts.
- **Recruiter company profile**: recruiters provide their company name at
  registration (required), editable later from Settings. It's threaded
  through everywhere a candidate sees a job — job listings, applications,
  recommendations, interview details — and through every notification and
  email ("You've been shortlisted for Backend Engineer at Acme Corp"),
  instead of a generic "the role".
- **Proactive new-job notifications**: when a recruiter posts a job,
  candidates whose latest resume scores above a configurable threshold
  against it (`NEW_JOB_MATCH_THRESHOLD`, default 50%) are automatically
  notified — in-app and by email — using the same scoring engine as
  everywhere else, so candidates learn about a strong-fit opening without
  the recruiter broadcasting to everyone regardless of relevance.
- **In-app notifications**: a bell icon (present on every page) shows
  unread updates in real time (polled every 20s) — new applications for
  recruiters, and shortlist/rejection/interview/offer updates for
  candidates — alongside (not instead of) the email notifications.
- **Advanced hiring funnel analytics**: Applied → Shortlisted → Hired,
  visualized with a proportionally-sized funnel and stage-to-stage
  conversion rates, plus a rejected-along-the-way count.
- **Offer letter generation**: generates a formatted PDF offer letter
  (salary, joining date, additional terms) with one click, automatically
  marks the application as hired, and notifies the candidate by email and
  in-app notification.
- **Duplicate resume detection**: every uploaded resume is content-hashed
  (normalized whitespace/case) and checked against all other candidates'
  resumes; if the exact same resume text was already submitted under a
  different account, both the recruiter (with the matching candidate's
  name/email) and the uploading candidate (a privacy-conscious generic
  notice, no other candidate's PII) see a warning.
- **Bulk Resume Screening**: paste any job requirement, drop as many
  resumes as you like (no candidate accounts needed), and get an instantly
  ranked list with real progress tracking — sorted by match score.
- **Screening History**: every past screening run is saved; click one to
  expand a score-sorted dropdown of its results without re-scanning.
- **Excel & PDF export**: download any screening session's ranked results
  as a formatted `.xlsx` or `.pdf` report.
- **Interview scheduling**: schedule, reschedule, and cancel interviews per
  application, visible to both the recruiter and the candidate.
- **Email notifications**: candidates are notified on shortlist, rejection,
  and interview scheduling. Ships with a zero-config "console" backend
  (logs the email instead of sending it) and a real SMTP backend you can
  switch on — see the Email section below.
- **Recommendation engine**: Candidate → Jobs (ranking page) and Jobs →
  Candidate (candidate recommendations page) both run through the *same*
  scoring service, so there is one real matching engine, not two.
- **Analytics dashboards**: match-score distribution, top candidate skills,
  pipeline KPIs.
- **JWT authentication** with recruiter/candidate role separation.
- **Bulk-friendly resume upload** with size/type validation and safe,
  path-traversal-proof file storage.
- **Responsible AI**: no ranking on religion, caste, race, ethnicity,
  political affiliation, or health information; a visible disclaimer that AI
  output is decision support, not a hiring decision.

## 4. Architecture

```
backend/   FastAPI app — auth, jobs, resumes, ranking, analytics, recommendations
  app/
    api/routers/   HTTP endpoints
    core/          config, DB session, security (JWT/bcrypt)
    models/        SQLAlchemy ORM models
    schemas/       Pydantic request/response schemas
    services/      resume parsing, JD intelligence, scoring
    nlp/           text processing, skill taxonomy, semantic matcher
    ml/            trained classifier + inference
  tests/           pytest suite (23 tests, see below)

ml/        Model training pipeline (separate from the runtime backend)
  data/      synthetic dataset generator
  training/  train_shortlist_model.py (Logistic Regression / RF / XGBoost)
  models/    saved artifacts (copied into backend/app/ml/artifacts)
  evaluation/metrics.json  real metrics from the last training run

frontend/  Next.js 16 + Tailwind v4 — light-theme SaaS UI
  src/app/           routed pages (landing, auth, recruiter/*, candidate/*)
  src/components/    shared UI kit (Button, Card, Badge, ScoreRing, Toast, ...)
  src/lib/           typed API client + auth context

docker-compose.yml   Postgres + backend + frontend orchestration
```

**Request flow for an application**: candidate uploads resume → NLP pipeline
extracts a structured profile → candidate applies to a job → the scoring
service compares the job's classified requirements against the candidate's
profile (skill / semantic / experience / project / education / certification)
→ the trained classifier separately estimates shortlist probability →
recruiter sees a ranked, explainable list.

## 5. Tech stack

Python · FastAPI · SQLAlchemy · Alembic-ready · PostgreSQL (SQLite for local
dev) · spaCy · scikit-learn · XGBoost · pandas/numpy · JWT (python-jose) ·
bcrypt · pdfplumber · python-docx · Next.js 16 · React · TypeScript ·
Tailwind CSS v4 · Recharts · Docker.

## 6. ML methodology

Match scoring is deliberately split into two separate, clearly-labeled
components (see `app/services/scoring.py` vs `app/ml/inference.py`):

1. **Transparent rule-based score** — a weighted sum of six named features
   (skill match, semantic similarity, experience fit, project relevance,
   education, certifications). Every number in this breakdown is directly
   auditable arithmetic; nothing here is learned or opaque.
2. **Learned classifier** — a Random Forest (selected over Logistic
   Regression and XGBoost by F1 on held-out data) trained on the same
   feature set to predict `P(shortlisted)`. Reported as
   `ml_shortlist_probability`, always alongside — never in place of — the
   transparent score.

**Why not 100% LLM-based**: an LLM call is non-deterministic, hard to audit,
and expensive to run per-application at scale. The transparent score and the
classifier are both fast, deterministic, and inspectable; generative AI is
reserved for summarization/explanation tasks layered on top (see the NLP &
Generative AI section below), never for the core numeric decision.

### Dataset & limitations (read this before citing the metrics anywhere)

This build environment has no network route to Kaggle or Hugging Face
Datasets, where a real public resume-job dataset would normally come from.
Rather than fabricate results against data that was never used, training
data is generated by `ml/data/generate_synthetic_dataset.py`: a documented,
seeded (seed=42), reproducible generator that samples job/candidate skill
overlap, experience, and project relevance, then labels each pair with a
hand-specified "oracle" rule plus noise (simulating imperfect historical
hiring decisions). **All metrics below come from an actual run of
`ml/training/train_shortlist_model.py` against this synthetic data** — they
are real numbers from a real train/test split, just not from real-world
hiring outcomes.

**For a production deployment**, swap the data loader for the real Kaggle
"Resume Dataset" (`kaggle datasets download -d snehaanbhawal/resume-dataset`)
or O*NET/ESCO skills-occupations data — the downstream schema
(`job_features, candidate_features, label`) is unchanged, so
`train_shortlist_model.py` does not need to change.

### Model evaluation (from `ml/evaluation/metrics.json`, actual run output)

| Model | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|
| Logistic Regression | 0.9101 | 0.9033 | 0.9067 | 0.9886 |
| **Random Forest (selected)** | 0.9015 | 0.9182 | **0.9098** | 0.9870 |
| XGBoost | 0.8993 | 0.8959 | 0.8976 | 0.9840 |

Random Forest was selected automatically by highest F1 on an 80/20
stratified held-out split (800 test rows out of 4,000 total). Confusion
matrix for the selected model: `[[TN=504, FP=27], [FN=22, TP=247]]`. Re-run
`python ml/training/train_shortlist_model.py` to reproduce these numbers
exactly (seeded) or regenerate with different data.

## 7. NLP & Generative AI methodology

- **Text cleaning / section detection**: regex + heuristics
  (`app/nlp/text_processing.py`).
- **Entity extraction**: spaCy `en_core_web_sm` for names/organizations;
  regex for email/phone/years-of-experience.
- **Skill extraction & normalization**: a curated alias taxonomy
  (`app/nlp/skill_taxonomy.py`) maps surface forms ("k8s", "Django REST
  Framework") to canonical skills, matched longest-alias-first to avoid
  partial-substring collisions.
- **Semantic matching**: pluggable backend behind one interface
  (`app/nlp/semantic_matcher.py`) — see below.
- **Generative AI** is scoped intentionally: it is *not* wired into this
  build's numeric scoring path (see the ML methodology section above for
  why). The `explanation.llm_explanation` field on every `MatchScore` is a
  reserved, clearly-separate slot for an LLM-generated natural-language
  gloss of the `model_score_breakdown` — wiring in a real LLM API call to
  populate it (JD summarization, resume summaries, candidate explanations,
  skill-gap narratives) is a natural next step; the schema already keeps it
  structurally distinct from the model score so the two are never conflated
  in the API response.

### Semantic backend

`SEMANTIC_BACKEND=tfidf` (default) uses scikit-learn TF-IDF + Truncated SVD
(LSA) + cosine similarity — zero external calls, fully deterministic, works
offline. This is what ships and is tested in this repo, because the
development sandbox this was built in has no route to Hugging Face.

`SEMANTIC_BACKEND=sbert` switches to `sentence-transformers` embeddings
(`all-MiniLM-L6-v2` by default) for higher-quality paraphrase-level
similarity. To use it in your deployment:
```
pip install sentence-transformers
export SEMANTIC_BACKEND=sbert
```
Both backends implement the same `SemanticMatcher.similarity(a, b) -> float`
interface, so nothing else in the codebase changes.

## 8. Database design

PostgreSQL in production (SQLite auto-selected for local dev if
`DATABASE_URL` is unset). See `backend/app/models/models.py` for the full
SQLAlchemy schema: `users`, `recruiters`, `candidates`, `jobs`, `skills`,
`job_skills`, `candidate_skills`, `resumes`, `extracted_profiles`,
`applications`, `match_scores`, `skill_gaps`, `recommendations`,
`shortlists`. Tables are created automatically on startup
(`Base.metadata.create_all`); for schema evolution beyond this prototype,
add Alembic migrations (Alembic is already a dependency).

## 9. Installation

### Option A — Docker (recommended)
```bash
cp backend/.env.example backend/.env      # edit SECRET_KEY at minimum
cp frontend/.env.example frontend/.env.local
docker compose up --build
```
Backend: http://localhost:8000 · Frontend: http://localhost:3000 · API docs:
http://localhost:8000/docs

> **PostgreSQL verification note**: the full backend — schema creation,
> registration/login, AI job-description extraction, resume upload and NLP
> parsing, applying to a job, transparent + ML scoring, candidate ranking,
> shortlist/reject, the recruiter dashboard, and the candidate-facing
> applications/recommendations endpoints — was exercised end to end over
> real HTTP against a real PostgreSQL 16 database (not SQLite, not
> `TestClient`) during development. The `docker compose` orchestration
> itself (building the containers via Docker specifically) was not run in
> the sandbox this project was built in, since no Docker daemon was
> available there — but the application it packages has been verified
> directly against Postgres, so `docker compose up --build` just needs to
> reproduce that same install inside containers.

### Option B — Manual local setup

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
cp .env.example .env
# Since you already have PostgreSQL running, set DATABASE_URL in .env, e.g.:
#   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>
uvicorn app.main:app --reload
```
On first startup the app creates all tables automatically
(`Base.metadata.create_all`) — no manual migration step needed for this
prototype.

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

**Train the ML model** (already trained and checked in under
`backend/app/ml/artifacts/`; re-run only if you regenerate the dataset or
change features):
```bash
cd ml
python data/generate_synthetic_dataset.py
python training/train_shortlist_model.py
cp models/*.joblib ../backend/app/ml/artifacts/
```

## 10. Environment variables

See `backend/.env.example` and `frontend/.env.example`. Key ones:
`DATABASE_URL`, `SECRET_KEY` (generate with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`),
`SEMANTIC_BACKEND`, `WEIGHT_*` (match-score weights), `CORS_ORIGINS`,
`RATE_LIMIT_PER_MINUTE`, `NEXT_PUBLIC_API_URL`.

## 11. API documentation

Interactive OpenAPI docs are auto-generated by FastAPI at `/docs` (Swagger)
and `/redoc` once the backend is running. Key endpoint groups:

- `POST /api/v1/auth/register` (recruiters must include `company_name`),
  `/login`, `GET /me`, `PATCH /me` (update full name / company name),
  `POST /forgot-password`, `POST /reset-password`
- `POST/GET/PATCH/DELETE /api/v1/jobs`, `POST /jobs/{id}/duplicate`
- `POST /api/v1/resumes/upload`, `GET /resumes/mine`
- `POST /api/v1/applications/apply/{job_id}`, `GET /applications/mine`
- `GET /api/v1/jobs/{job_id}/candidates` (ranking), `GET .../{application_id}/detail`,
  `POST .../shortlist`, `.../reject`, `GET /api/v1/candidates/compare`,
  `/shortlisted`, `/all`
- `GET /api/v1/analytics/recruiter-dashboard`, `/skill-trends`,
  `/match-distribution`, `/candidate-dashboard`, `/hiring-funnel`
- `GET /api/v1/notifications/mine`, `POST /{id}/read`, `POST /read-all`
- `POST /api/v1/jobs/{job_id}/candidates/{application_id}/offer-letter`
- `GET /api/v1/recommendations/jobs-for-me`
- `POST /api/v1/screening/scan-one`, `GET /must-have-preview`,
  `POST/GET/DELETE /sessions`, `GET /sessions/{id}`,
  `GET /sessions/{id}/export/excel`, `/export/pdf`
- `POST /api/v1/jobs/{job_id}/candidates/{application_id}/interview`,
  `GET .../interviews`, `PATCH /interviews/{id}`, `GET /interviews/mine`

## 12a. Email notifications

`EMAIL_BACKEND=console` (default) logs the email content instead of sending
it — zero setup, and what this build was actually tested against (the
sandbox this was built in has no network route to any SMTP host). Switch to
`EMAIL_BACKEND=smtp` and fill in `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` in
`.env` once you have real credentials (Gmail App Password, SendGrid,
Mailgun, etc. all work over standard SMTP). The SMTP code path follows the
standard smtplib/starttls pattern but has not been exercised against a live
mail server here — test it against your provider before relying on it.

## 12. Testing

```bash
cd backend
pytest tests/ -v
```
24 tests covering auth (registration/login/role guards), job CRUD + AI JD
extraction, NLP/scoring unit tests (skill normalization, years-of-experience
parsing, name extraction, JD classification, semantic similarity ordering,
score breakdown correctness on both a strong and a weak match), the full
resume-upload → apply → rank → shortlist → dashboard → candidate-detail
workflow end to end, bulk screening, screening history/export, interview
scheduling, candidate-side dashboard analytics, in-app notifications,
duplicate resume detection, hiring funnel analytics, offer letter
generation, recruiter company-name propagation, and proactive new-job
matching notifications, password reset, and both storage backends
(71 tests total).

The S3 storage backend is tested against `moto`, which implements the real
S3 API locally — so the S3 code path is genuinely exercised without needing
an AWS account. Verifying your own bucket/credentials is a separate step;
see `DEPLOYMENT.md`.

> The automated suite runs against an isolated temporary SQLite database per
> test session (`tests/conftest.py`) for speed and isolation — this is
> intentional and standard practice. Separately, the entire live workflow
> above was also manually verified over real HTTP against a running
> PostgreSQL 16 instance (see the Installation note above) to confirm
> nothing Postgres-specific breaks; that Postgres run is not part of the
> repeatable `pytest` suite itself.

Frontend: `npm run build` runs a full TypeScript check; `npx eslint src`
lints clean.

## 13. Docker setup

See `docker-compose.yml` (Postgres + backend + frontend) and the
per-service `Dockerfile`s. See the caveat under Installation above about
this not having been run inside the build sandbox.

## 14. Security notes

Passwords are bcrypt-hashed; JWTs are HS256-signed with a secret you must
set in `.env`; uploaded files are renamed to random UUIDs before storage
(no path traversal, no trusting user-supplied filenames); file size and
extension are validated; a lightweight in-memory rate limiter is applied
per-IP (swap for Redis-backed limiting in a multi-process deployment); CORS
origins are configurable; no secrets are hard-coded anywhere in the repo.

## 15. Limitations

> **Deploying this?** Read `DEPLOYMENT.md` first. It has a production
> readiness checklist covering the two defaults that silently break in
> production — `STORAGE_BACKEND=local` permanently loses uploaded resumes
> on every redeploy on most PaaS hosts, and `EMAIL_BACKEND=console` means
> real users receive no emails at all — plus verify scripts for both.

- No email verification at signup: anyone can register with any email
  address without proving they own it. Fine for a controlled pilot; add
  verification before an open public launch.
- `requirements.txt` uses minimum-version constraints (e.g. `fastapi>=0.115`)
  rather than exact pins, since exact pins from one development machine can
  fail to resolve on a different Python version (this was hit and fixed
  during development). `passlib`/`bcrypt` remain exactly pinned on purpose —
  see the comment in `requirements.txt` explaining the known incompatibility
  between them at newer bcrypt versions.
- The shipped ML model artifact (`backend/app/ml/artifacts/*.joblib`) was
  pickled with a specific scikit-learn version. If you see an
  `InconsistentVersionWarning` on startup, your installed scikit-learn
  differs from that — harmless for this model type in practice, but to
  clear it, retrain against your installed version:
  `cd ml && python training/train_shortlist_model.py && cp models/*.joblib ../backend/app/ml/artifacts/`.
- Semantic matching defaults to TF-IDF/LSA rather than transformer
  embeddings, for the offline-reproducibility reasons above — swap to
  `sbert` in an environment with Hugging Face access for better quality.
- ML model is trained on synthetic, documented placeholder data, not real
  historical hiring outcomes — see the Dataset section.
- Skill taxonomy is hand-curated and scoped to software/data/ML roles; it
  does not cover arbitrary industries.
- Rate limiting is per-process/in-memory; not suitable for multi-worker
  deployment as-is.
- No email verification or password-reset flow yet.
- The `llm_explanation` field is reserved but not wired to a live LLM call
  in this build.
- Email sending (`EMAIL_BACKEND=smtp`) has not been tested against a real
  SMTP server in this build environment - the console backend is what's
  actually been verified; test the SMTP path against your provider first.
- PDF exports truncate very long job descriptions/skill lists to keep the
  report to a readable single/few pages; use the Excel export for the full,
  untruncated data if needed.
- The in-app notification bell polls every 20 seconds rather than using
  websockets/SSE - fine for a demo/small deployment, but a real-time push
  mechanism would be needed at scale.
- Job-posting notifications score every candidate's resume synchronously
  as part of the create-job request, so posting a job takes slightly
  longer with more candidates in the system. At real scale this should
  move to a background task/queue rather than blocking the response.
- Offer letters are generated as plain PDFs for convenience and are
  explicitly labeled as needing review before being treated as binding -
  they are not a substitute for a reviewed legal document.
- The in-memory rate limiter, tuned for realistic production traffic,
  had to be raised via an env override specifically for the automated test
  suite (which fires far more requests per minute than any real client
  would) - a reminder that test environments sometimes need different
  tuning than production, not a production behavior change.

## 16. Future scope

- Wire a real LLM call into `explanation.llm_explanation` for
  natural-language score narration, JD/resume summarization, and
  career-readiness advice — while keeping it structurally separate from the
  numeric model score, as designed.
- SHAP-based feature attribution for the classifier.
- Real dataset integration (Kaggle/O*NET/ESCO) once network access allows.
- Alembic migrations for schema evolution; Redis-backed rate limiting and
  caching; background task queue (Celery/RQ) for bulk resume processing at
  scale instead of synchronous upload handling.
- Email verification, password reset, SSO.

## 17. Responsible AI

Talentum never ranks candidates using religion, caste, race, ethnicity,
political affiliation, or health information, and avoids unnecessary use of
gender, photographs, or addresses. **AI-generated recommendations are
decision-support outputs and should not be used as the sole basis for
employment decisions.** This disclaimer is shown on the product's landing
page.

## 18. Project structure

See Architecture above for the full tree.

---

For final-year submission materials (abstract, DFD, ER diagram outline,
literature review pointers, etc.) see `docs/final-year-documentation.md`.
For interview and viva preparation, see `docs/interview-prep.md` and
`docs/viva-prep.md`.
