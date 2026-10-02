import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import Base, engine
from app.api.routers import auth, jobs, resumes, ranking, analytics, recommendations, screening, interviews, notifications, offers
from app.models import models  # noqa: F401 - ensures models are registered on Base

settings = get_settings()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("talent_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")
    yield


app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Minimal in-memory rate limiting (per-process; use Redis in production) ---
_request_log: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60
    _request_log[client_ip] = [t for t in _request_log[client_ip] if now - t < window]
    if len(_request_log[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    _request_log[client_ip].append(now)
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok", "project": settings.PROJECT_NAME}


app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(jobs.router, prefix=settings.API_V1_PREFIX)
app.include_router(resumes.router, prefix=settings.API_V1_PREFIX)
app.include_router(ranking.router, prefix=settings.API_V1_PREFIX)
app.include_router(ranking.compare_router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(recommendations.router, prefix=settings.API_V1_PREFIX)
app.include_router(screening.router, prefix=settings.API_V1_PREFIX)
app.include_router(interviews.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(offers.router, prefix=settings.API_V1_PREFIX)
