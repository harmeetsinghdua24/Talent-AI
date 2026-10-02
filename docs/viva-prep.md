# Final-Year Viva Preparation — Talentum

20 questions an examiner is likely to ask, with grounded answers.

**1. What problem does your project solve?**
Manual resume screening is slow and inconsistent, and keyword-based ATS
tools miss candidates who describe the same skill differently. Talentum
automates extraction and scoring while keeping every score explainable.

**2. What is the scope of your project — what does it NOT do?**
It does not make hiring decisions autonomously (explicitly disclaimed as
decision-support), does not verify candidate-claimed information, and its
skill taxonomy is scoped to software/data/ML roles rather than all
industries.

**3. What makes your project different from existing ATS software?**
Semantic (embedding-based) matching instead of exact keyword search, and a
fully decomposed, auditable match score instead of a single opaque number.

**4. Why did you choose FastAPI and Next.js specifically?**
FastAPI: async support, automatic request/response validation via
Pydantic, and auto-generated OpenAPI docs — useful given the number of
typed endpoints. Next.js: file-system routing suited the recruiter/candidate
role split, and it's the current standard for production React apps.

**5. Explain your database schema.**
Users optionally have a recruiter or candidate profile; recruiters post
jobs, jobs have classified skills (via a `job_skills` join table with a
priority field); candidates upload resumes, which produce one extracted
profile each; applications link a candidate, job, and resume, and carry at
most one match score and one skill-gap record.

**6. What machine learning algorithm did you use, and why that one?**
I trained and compared three: Logistic Regression, Random Forest, and
XGBoost, then selected Random Forest because it had the highest F1
(0.9098) on a held-out test split — an evidence-based choice rather than
picking the most complex model by default.

**7. What is your model's accuracy / how did you evaluate it?**
Evaluated on precision, recall, F1, and ROC-AUC using an 80/20 stratified
train/test split. Random Forest: precision 0.9015, recall 0.9182, F1
0.9098, ROC-AUC 0.987 — all numbers from an actual run, saved in
`ml/evaluation/metrics.json`.

**8. Where did your training data come from?**
A documented, seeded synthetic generator (`ml/data/generate_synthetic_dataset.py`),
because the environment this was built in has no network access to
Kaggle/Hugging Face Datasets. This is disclosed explicitly in the README
rather than presented as real-world validated data — a design decision I
can defend: reporting real metrics on honest synthetic data is more
defensible than implying real-world validation that didn't happen.

**9. What is explainable AI, and how did you implement it here?**
Explainable AI means a model's output can be traced back to specific,
understandable reasons rather than treated as a black box. Here, every
match score is a weighted sum of six named, visible features
(skill/semantic/experience/project/education/certification match), and the
separate ML probability is always labeled and shown alongside — never
merged into — that transparent breakdown.

**10. What is semantic search / semantic similarity?**
Comparing meaning rather than exact wording, typically by mapping text into
a vector space (via TF-IDF+LSA or neural embeddings) and measuring cosine
similarity, so that texts using different words for the same concept still
score as similar.

**11. What NLP techniques did you use for resume parsing?**
Text cleaning and section-detection heuristics, spaCy NER for names/
organizations, and alias-based skill normalization matched longest-alias-
first against a curated taxonomy.

**12. How is user authentication handled and secured?**
JWT tokens (HS256) issued on login; passwords hashed with bcrypt (never
stored in plaintext); role-based route guards separate recruiter and
candidate functionality server-side, not just hidden in the UI.

**13. How did you ensure your file upload feature is secure?**
Uploaded files are renamed to a randomly generated UUID before being
written to disk (the original filename is never trusted for the storage
path), extensions are validated against an allow-list, and file size is
capped — preventing path traversal and unrestricted uploads.

**14. What testing did you do?**
23 automated pytest tests: auth flows and role enforcement, job CRUD and
AI-driven JD classification, NLP/scoring unit tests, and a full end-to-end
workflow test (upload resume → apply → rank → shortlist → dashboard
reflects it). The frontend passes a full TypeScript build check and lints
clean with ESLint.

**15. What are the limitations of your system?**
Synthetic training data (not real hiring outcomes); default semantic
backend is TF-IDF rather than transformer embeddings (a documented,
swappable tradeoff); hand-curated skill taxonomy scoped to tech roles;
in-memory (not distributed) rate limiting; no email verification yet.

**16. How would you extend this project in the future?**
Wire a real LLM call for natural-language score explanations (kept
structurally separate from the numeric score); add SHAP-based feature
attribution to the classifier; integrate a real public resume dataset;
add Alembic migrations and a background task queue for bulk processing at
scale.

**17. How does your system avoid unfair bias?**
It never uses religion, caste, race, ethnicity, political affiliation, or
health information as ranking inputs, and avoids unnecessary use of gender,
photographs, or addresses. A visible disclaimer states that AI output is
decision support, not a sole basis for hiring decisions.

**18. What was the most challenging part of this project?**
Keeping the ML model's prediction and the rule-based transparent score
cleanly separated throughout the codebase and API — it would have been
easier (and worse practice) to just blend them into one number.

**19. How does your recommendation engine work in both directions?**
Both the "best candidates for this job" (recruiter ranking view) and "best
jobs for this candidate" (candidate recommendations view) call the exact
same `compute_match_score()` function, just iterating the other axis — so
there's one real matching engine, not two that could disagree.

**20. Why is your frontend light-themed / what design decisions did you
make there?**
The brief required a premium, light-only SaaS aesthetic. I built a
deliberate design-token system (a single "signal indigo" brand accent,
distinct neutral palette, self-hosted Manrope/Inter fonts) rather than
using Tailwind or shadcn defaults, so the product reads as an intentional
design rather than a templated scaffold.
