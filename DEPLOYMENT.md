# Deployment Guide

This covers going from "runs on my laptop" to "real users can use it".

Read the **Production readiness checklist** at the bottom before you point
real users at it — a few defaults that are convenient for local development
are actively wrong for production, and they're called out explicitly.

---

## 1. What you need

> **About Netlify:** Netlify is built for static sites. This project has two
> deployable pieces — a Next.js frontend *and* a Python FastAPI backend
> (plus PostgreSQL). Netlify can host the frontend with the Next.js runtime
> plugin, but it **cannot run the FastAPI backend at all**, so you'd still
> need a second host for that. Unless you specifically need Netlify, the
> simplest path is **Vercel for the frontend + Render (or Railway) for the
> backend and database** — that's what the config files in this repo
> (`frontend/vercel.json`, `render.yaml`) are set up for.

| Thing | Why | Free options |
|---|---|---|
| PostgreSQL database | All app data | Render, Supabase, Neon, Railway |
| Backend host | Runs FastAPI | Render, Railway, Fly.io |
| Frontend host | Runs Next.js | Vercel (easiest), Netlify (needs the Next.js plugin) |
| S3-compatible storage | Resume files that survive redeploys | Cloudflare R2 (generous free tier), AWS S3, Backblaze B2 |
| SMTP provider | Real emails to candidates | Gmail (App Password), SendGrid, Mailgun, Resend |

---

## 2. Backend deployment

### 2a. Set environment variables

Copy every variable from `backend/.env.example` into your host's
environment-variables settings, with real values. The ones that **must**
change from their defaults for production:

```env
DATABASE_URL=postgresql://...        # your hosted Postgres connection string
SECRET_KEY=<a long random string>    # python -c "import secrets; print(secrets.token_urlsafe(48))"
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com

STORAGE_BACKEND=s3                   # NOT local - see the checklist below
S3_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
# S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com   # only for R2/MinIO/Spaces

EMAIL_BACKEND=smtp                   # NOT console - see the checklist below
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=<Gmail App Password>
SMTP_FROM_EMAIL=you@gmail.com
```

### 2b. Verify storage and email BEFORE launching

Two helper scripts exist precisely because these are the two things that
fail silently in production:

```bash
cd backend
python ../scripts/verify_s3_storage.py                  # uploads, reads, deletes a test object
python ../scripts/verify_smtp_email.py you@youremail.com # sends one real test email
```

Both print a clear SUCCESS/FAIL with likely causes. Don't skip these.

### 2c. Start command

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

(Most hosts inject `$PORT`. On Railway/Render this goes in the "Start
Command" field.)

Database tables are created automatically on first startup — no migration
step needed for this prototype.

---

## 3. Frontend deployment

### Option A — Vercel (recommended for Next.js)

1. Point Vercel at the `frontend/` directory (set it as the Root Directory).
2. Set one environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api/v1
   ```
3. Deploy. `frontend/vercel.json` is already included.

### Option B — Netlify

Netlify needs its Next.js runtime plugin to serve a Next.js app (static
export won't work here — the app uses client-side routing and dynamic
routes). In Netlify's site settings:

- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/.next`
- Install the official **Next.js Runtime** plugin from Netlify's plugin
  directory.
- Environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api/v1`

Remember: this only hosts the frontend. The FastAPI backend still needs a
separate host (Render/Railway/Fly).

### After the frontend is live

Go back to the backend and make sure `CORS_ORIGINS` and `FRONTEND_URL` use
that exact frontend URL (including `https://`, no trailing slash). If they
don't match, the browser will block every API call and the app will look
broken with no obvious error.

---

## 4. Production readiness checklist

### Handled — works out of the box
- [x] Passwords hashed with bcrypt, never stored in plaintext
- [x] JWT auth with role-based access control (recruiter vs candidate)
- [x] Uploaded files renamed to random UUIDs (no path traversal)
- [x] File type and size validation on upload
- [x] Per-IP rate limiting
- [x] Password reset flow (email link, single-use, 30-min expiry, no
      account-enumeration leak)
- [x] Resume storage that survives redeploys — **once you set
      `STORAGE_BACKEND=s3`**
- [x] Real email delivery — **once you set `EMAIL_BACKEND=smtp`**

### You must do these
- [ ] Set `STORAGE_BACKEND=s3`. With the `local` default on an ephemeral
      PaaS filesystem, **every uploaded resume is permanently deleted on
      each redeploy**.
- [ ] Set `EMAIL_BACKEND=smtp`. With the `console` default, candidates
      receive **no emails at all** (in-app notifications still work).
- [ ] Set a real `SECRET_KEY`. The placeholder in `.env.example` is public.
- [ ] Set `CORS_ORIGINS` to your real frontend domain, not `localhost`.
- [ ] Run both verify scripts above.

### Known gaps — decide whether they matter for your launch
- **No email verification at signup.** Anyone can register with any email
  address without proving they own it. For a controlled pilot this is
  usually fine; for an open public launch, add verification first.
- **Rate limiting is in-memory and per-process.** With more than one
  worker/instance, each has its own counter. Move to Redis-backed limiting
  if you scale horizontally.
- **Job-match notifications are computed synchronously.** Posting a job
  scores every candidate's resume before returning, so with thousands of
  candidates the request gets slow. Move to a background queue
  (Celery/RQ/Arq) at that scale.
- **No admin interface.** Managing/removing users or content requires
  direct database access.
- **ML model trained on synthetic data.** See the README's Dataset section
  — the matching logic is real, but the learned classifier hasn't been
  validated against real hiring outcomes.

---

## 5. What was and wasn't verified during development

Being explicit, because "it's tested" can mean different things:

- **Fully tested here, end to end:** auth, password reset, job posting,
  resume parsing, matching/scoring, ranking, bulk screening, exports,
  interviews, offer letters, notifications, duplicate detection, company
  name propagation — 71 automated tests, plus live runs against a real
  PostgreSQL instance.
- **Code tested against a simulated S3 API** (`moto`, which implements the
  real S3 protocol locally): the S3 storage backend. What this does *not*
  prove is that *your* bucket/credentials/IAM policy are right — that's
  what `scripts/verify_s3_storage.py` is for.
- **Not tested against a live server:** real SMTP sending. The code follows
  the standard `smtplib` + STARTTLS pattern, but the development
  environment had no network route to any mail server. Run
  `scripts/verify_smtp_email.py` once against your provider.
