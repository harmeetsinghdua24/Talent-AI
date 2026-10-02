# Interview Preparation — Talentum

30 technical questions with answers grounded in what this codebase actually
does, organized by topic. Use these to prepare, not to memorize verbatim —
an interviewer will probe follow-ups.

## Python

**1. Why FastAPI over Flask/Django for this project?**
FastAPI gives async support, automatic OpenAPI docs, and Pydantic-based
request/response validation out of the box — useful for a project with many
typed endpoints (jobs, resumes, ranking, analytics) where catching a bad
payload before it hits business logic matters.

**2. How does dependency injection work in FastAPI, and where did you use it?**
`Depends()` resolves a callable at request time and injects its return
value. Used throughout for `get_db` (a fresh SQLAlchemy session per
request), `get_current_user` (decodes the JWT), and `require_recruiter` /
`require_candidate` (role guards that raise 403 before the endpoint body
runs).

**3. What's the difference between `@lru_cache` and a global variable, and
where did you use `lru_cache`?**
`lru_cache` memoizes per argument set and is thread-safer to reason about
than a bare global; used in `get_settings()` (config is expensive to
reconstruct env-var by env-var) and in `get_nlp()` (loading a spaCy model
is slow — cache it once per process).

**4. Why use dataclasses for `ScoreBreakdown` instead of a plain dict?**
Type-checked fields, IDE autocomplete, and an explicit `as_dict()` method
so the internal representation and the API-facing dict shape are separate,
letting the internal computation change without automatically changing the
API contract.

## Machine Learning

**5. Walk through your ML pipeline end to end.**
Synthetic dataset generation (documented, seeded) → feature engineering
(six numeric features per job-candidate pair) → train/test split
(stratified 80/20) → train three models (Logistic Regression, Random
Forest, XGBoost) → evaluate each on the held-out set → select by F1 →
serialize the winner with `joblib` → load it at inference time in the
FastAPI backend.

**6. Why did you compare three different models instead of just picking one?**
To make a defensible, evidence-based choice rather than assuming the
"fanciest" model (XGBoost) is automatically best — in this run, Random
Forest edged out XGBoost on F1 (0.9098 vs 0.8976), which is a reminder that
more complex models don't always win, especially on modest, relatively
clean synthetic data.

**7. What's the difference between your rule-based score and your ML model,
and why have both?**
The rule-based score is a fixed, human-specified weighted sum — fully
auditable, but the weights are chosen by hand. The ML model learns weights
(implicitly, via tree splits) from labeled data — potentially more
accurate, but harder to explain feature-by-feature. Showing both,
separately labeled, lets a recruiter see the transparent reasoning *and*
a data-driven second opinion without conflating the two.

**8. Your training data is synthetic — doesn't that undermine the metrics?**
The metrics are real (they came from an actual train/test split), but they
measure how well the models learned the synthetic labeling rule, not
real-world hiring outcomes. I was explicit about this in the README rather
than implying real-world validation. In a production setting I'd retrain
on real historical hiring decisions, keeping the same feature schema.

**9. Explain precision, recall, F1, and ROC-AUC in this context.**
Precision: of candidates the model says to shortlist, what fraction
actually would be. Recall: of candidates that should be shortlisted, what
fraction the model catches. F1 is their harmonic mean. ROC-AUC measures
ranking quality across all thresholds, not just one cutoff — useful here
since a recruiter might set their own shortlist bar.

**10. Why might precision matter more than recall for this application?**
A false positive costs a recruiter a few minutes reviewing a weak
candidate. A false negative is more costly in theory (missing a good
candidate) but is cushioned here because the transparent score is *always*
shown regardless of the ML prediction — so a borderline candidate isn't
fully hidden even if the classifier scores them low.

**11. How would you detect and mitigate overfitting here?**
Compare train vs. test metrics (not shown to the user, but computable);
use cross-validation instead of a single split for a more robust estimate;
constrain tree depth (already done: `max_depth=4` for XGBoost, `max_depth=6`
for Random Forest) to limit memorization on a modest dataset.

**12. What is XGBoost, briefly?**
A gradient-boosted decision tree ensemble: trees are added sequentially,
each correcting the residual errors of the ensemble so far, regularized to
avoid overfitting.

**13. How is your model served in production (inference path)?**
`joblib.load()` once per process (cached via `@lru_cache`), fed a
`pandas.DataFrame` built from the same six features computed at scoring
time, `predict_proba()` called, and the positive-class probability returned
alongside the transparent score in the API response.

## NLP / Embeddings

**14. What's the difference between TF-IDF and sentence embeddings, and
why does your project support both?**
TF-IDF represents text as sparse term-frequency vectors weighted by inverse
document frequency — good at exact/near-exact term overlap, cheap, and
needs no external model. Sentence embeddings (e.g. Sentence-BERT) map text
into dense vectors trained so that semantically similar sentences are close
even with completely different wording. This project defaults to
TF-IDF+LSA because the development sandbox had no network route to
download embedding model weights; the code is written behind one interface
so swapping in `sentence-transformers` in a real deployment is a one-line
config change.

**15. What is Latent Semantic Analysis (LSA) and why apply it after TF-IDF?**
LSA (via Truncated SVD) reduces the sparse, high-dimensional TF-IDF matrix
into a smaller number of latent "topic" dimensions, so that near-synonymous
terms that never literally co-occur can still end up close in the reduced
space — partially closing the gap with true embeddings while staying fully
local/offline.

**16. How do you extract skills from unstructured resume text?**
An alias-normalization table maps many surface forms ("k8s", "kubernetes")
to one canonical skill, matched longest-alias-first via regex with word
boundaries, so multi-word aliases ("django rest framework") are consumed
before their single-word substrings ("django") could partially match.

**17. Why longest-alias-first matching?**
Without it, "Django REST Framework" could match "django" alone and lose
the more specific signal, or worse, cause double-counting/ordering bugs.
Sorting all aliases by length descending and checking each with a
regex-word-boundary means the most specific alias always wins.

**18. How does your system classify JD skills into must-have vs
good-to-have?**
By splitting the JD into sentence/line segments and checking each segment
for marker phrases ("required", "must have" vs. "good to have",
"preferred"); skills in a segment inherit that segment's marker, or default
to must-have if the segment is in the first 60% of the document (assumed to
be core requirements) and good-to-have otherwise.

**19. What NLP library did you use for entity recognition, and why?**
spaCy's small English pipeline (`en_core_web_sm`) for PERSON and ORG
entities — a good balance of speed and accuracy for structured fields like
candidate name, versus training a custom NER model which would need
labeled resume data.

**20. How do you handle years-of-experience extraction robustly?**
Two regex passes: a strict one requiring the phrase "years of experience"
nearby, and a looser fallback matching bare "N years" (e.g. "(2.5 years)"
next to a job title), capped at a sane range (0–40) to avoid false
positives from unrelated numbers.

## System Design / Architecture

**21. Walk through what happens when a candidate applies to a job.**
See the sequence diagram in `docs/final-year-documentation.md` §13: the API
fetches the job's classified skills and the resume's extracted profile,
calls the scoring service for the six-factor breakdown, calls the ML model
for a shortlist probability, and persists both a `MatchScore` and a
`SkillGap` row tied to the new `Application`.

**22. How did you design the database schema?**
Normalized around the actual entities in the domain: users have exactly one
of a recruiter or candidate profile; skills are a shared lookup table
referenced by both jobs (via `job_skills`, carrying a priority) and
candidates (via `candidate_skills`); every application has at most one
`MatchScore` and one `SkillGap`, enforced with unique foreign keys.

**23. How do you keep the two directions of the recommendation engine
(candidate→jobs, jobs→candidate) consistent?**
Both call the exact same `compute_match_score()` function from
`app/services/scoring.py` — one iterates jobs for a fixed candidate, the
other iterates candidates for a fixed job — so there's a single source of
truth for match logic instead of two independently-maintained scoring
implementations that could drift apart.

**24. How is authentication implemented?**
JWT access tokens (HS256, python-jose) issued on login, carrying the user's
email as `sub` and role as a claim; `get_current_user` decodes and looks up
the user per-request; passwords are bcrypt-hashed via passlib.

**25. How do you prevent path traversal on file upload?**
Uploaded resumes are never stored under their original filename — a fresh
UUID + validated extension is generated server-side
(`safe_filename()`/`save_upload_file()`), so nothing from user input ever
reaches the filesystem path.

**26. How would this scale to 10,000 concurrent resume uploads?**
Move parsing off the request path into a background task queue (Celery/RQ)
so upload returns immediately with a "processing" status; move the
in-memory rate limiter to Redis so it works across multiple worker
processes; consider a managed vector store if switching to embeddings at
scale rather than computing TF-IDF pairwise per request.

## Frontend

**27. Why Next.js App Router over pages router or plain React?**
File-system routing matches the recruiter/candidate route split cleanly,
server components reduce client JS where not needed, and it's the current
recommended Next.js architecture.

**28. How do you handle auth state across the app?**
A React Context (`AuthProvider`) wraps the app, stores the JWT in
`localStorage`, exposes `login`/`register`/`logout`, and a `RequireRole`
wrapper component redirects unauthenticated or wrong-role users before
rendering protected pages.

**29. Why did you self-host font files instead of using `next/font/google`?**
The build sandbox had no network route to Google Fonts, so I fetched the
actual Manrope/Inter variable font files from Google's own open-source
fonts repo on GitHub (a reachable domain) and loaded them via
`next/font/local` — same end result (self-hosted, no runtime request to
Google), verified working with a real production build rather than left
as a TODO.

**30. How is the "explainability" requirement reflected in the frontend?**
The candidate ranking table, candidate detail views, and job creation
preview all show the decomposed score (skill/semantic/experience/etc.) and
the AI-classified must-have vs. good-to-have skill lists directly — never
just a single number with no supporting breakdown.

---

## "Explain this project" — short answers

**In 60 seconds:** "Talentum is a recruitment platform where recruiters
post jobs and candidates upload resumes; an NLP pipeline extracts structured
data from both, and a transparent multi-factor scoring engine — combined
with a separately trained ML classifier — ranks candidates in a way a
recruiter can actually audit, not just trust blindly. It's a full FastAPI +
PostgreSQL + Next.js stack with real auth, a real trained model with
evaluated metrics, and Docker deployment."

**In 2 minutes:** add — the specific problem (keyword ATS misses
semantically-equivalent skills; opaque scores erode recruiter trust); the
two-track scoring design (rule-based transparent score vs. ML probability,
always shown separately); the honest handling of the synthetic-dataset
limitation; and the responsible-AI constraints (no ranking on protected
attributes, visible decision-support disclaimer).

**"Why ML?"** Because a purely rule-based score can't learn interaction
effects between features the way a trained model can, and comparing
against a learned baseline is itself informative — if the rule-based score
and the ML model disagree sharply on a candidate, that's a signal worth a
recruiter's attention.

**"Why NLP?"** Resumes and job descriptions are unstructured text; without
NLP there's no structured data to score at all.

**"Why embeddings / semantic matching?"** To catch skill-equivalent
phrasing that exact keyword matching misses — the single biggest known
failure mode of traditional ATS systems.

**"Why not just use ChatGPT for everything?"** Non-determinism, cost at
scale (one call per resume-job pair), and — most importantly —
auditability: a recruiter can't easily challenge or debug "the LLM said
so," but they can challenge "skill match was 60% because you're missing
Docker and AWS." Generative AI is reserved for narration/summarization
layered on top, not the core decision.

**"How is this different from a traditional ATS?"** Semantic matching
instead of exact keyword search, and a transparent, decomposed score
instead of an opaque pass/fail keyword filter.

**"How is this different from ChatGPT?"** ChatGPT is a general-purpose
conversational model with no persistent structured database, no
deterministic scoring guarantees, and no built-in role-based
recruiter/candidate workflow — this is a purpose-built application with a
real schema, real auth, and a reproducible, evaluated scoring pipeline.

**"Where exactly is AI used?"** JD skill classification, resume entity/skill
extraction (NLP), semantic similarity scoring (embeddings), and the
shortlist-probability classifier (ML) — see root README §6–7 for the exact
line-by-line breakdown.

**"Where exactly is ML used?"** Specifically `app/ml/inference.py` and the
training pipeline in `ml/training/train_shortlist_model.py` — the Random
Forest classifier predicting `ml_shortlist_probability`. Everything else
(the six-factor score) is deliberately rule-based, not ML, and the two are
never confused in the API response.
