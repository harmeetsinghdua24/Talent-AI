"""
A lightweight, hand-curated skill taxonomy.

In production this would be backed by a larger public taxonomy such as the
ESCO skills dataset or the O*NET Technology Skills list (see README ->
Dataset section for sources). For this project it is intentionally scoped to
software/data-engineering/ML skills relevant to the demo domain, and is easy
to extend by adding entries to SKILL_ALIASES.

Each canonical skill maps to a list of surface forms / aliases that should
all normalize to it. This lets semantic-adjacent phrases like
"Django REST Framework" and "REST API development" be linked via the
semantic matcher even when the exact strings differ.
"""

SKILL_ALIASES: dict[str, list[str]] = {
    "python": ["python", "python3", "python 3"],
    "java": ["java"],
    "javascript": ["javascript", "js", "es6"],
    "typescript": ["typescript", "ts"],
    "sql": ["sql", "structured query language"],
    "postgresql": ["postgresql", "postgres", "psql"],
    "mysql": ["mysql"],
    "mongodb": ["mongodb", "mongo"],
    "fastapi": ["fastapi", "fast api"],
    "django": ["django", "django rest framework", "drf"],
    "flask": ["flask"],
    "rest api": ["rest api", "restful api", "rest apis", "api development", "backend development"],
    "react": ["react", "react.js", "reactjs"],
    "next.js": ["next.js", "nextjs"],
    "node.js": ["node.js", "nodejs", "node"],
    "docker": ["docker", "containerization"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["aws", "amazon web services"],
    "azure": ["azure", "microsoft azure"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "git": ["git", "github", "version control"],
    "machine learning": ["machine learning", "ml"],
    "deep learning": ["deep learning", "dl", "neural networks"],
    "nlp": ["nlp", "natural language processing"],
    "computer vision": ["computer vision", "cv", "opencv"],
    "scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    "tensorflow": ["tensorflow", "tf"],
    "pytorch": ["pytorch", "torch"],
    "pandas": ["pandas"],
    "numpy": ["numpy"],
    "xgboost": ["xgboost", "gradient boosting"],
    "spacy": ["spacy"],
    "sentence transformers": ["sentence transformers", "sbert", "embeddings"],
    "data analysis": ["data analysis", "data analytics"],
    "power bi": ["power bi", "powerbi"],
    "tableau": ["tableau"],
    "linux": ["linux", "unix"],
    "ci/cd": ["ci/cd", "cicd", "continuous integration", "jenkins", "github actions"],
    "microservices": ["microservices", "microservice architecture"],
    "graphql": ["graphql"],
    "html": ["html", "html5"],
    "css": ["css", "css3", "tailwind", "tailwindcss"],
    "system design": ["system design", "distributed systems"],
}

# Reverse lookup: alias -> canonical
_ALIAS_TO_CANONICAL: dict[str, str] = {}
for canonical, aliases in SKILL_ALIASES.items():
    for alias in aliases:
        _ALIAS_TO_CANONICAL[alias.lower()] = canonical


def normalize_skill(raw: str) -> str | None:
    """Return the canonical skill name for a raw string, or None if unknown."""
    key = raw.strip().lower()
    return _ALIAS_TO_CANONICAL.get(key)


def all_aliases_sorted_by_length() -> list[str]:
    """Longest-alias-first, so multi-word aliases match before their substrings."""
    return sorted(_ALIAS_TO_CANONICAL.keys(), key=len, reverse=True)


def canonical_skills() -> list[str]:
    return list(SKILL_ALIASES.keys())
