"""
Semantic similarity engine for comparing a Job Description against a Resume.

This goes beyond exact keyword overlap: it embeds both texts into a vector
space and computes cosine similarity, so phrases like "Django REST Framework"
and "REST API backend development" register as related even without a
literal string match.

Two interchangeable backends implement the same interface:

  - TfidfSemanticMatcher   : scikit-learn TF-IDF + SVD (LSA) + cosine similarity.
                             Zero external dependencies at runtime, deterministic,
                             fast. This is the default so the project runs fully
                             offline/air-gapped (e.g. in this dev sandbox).
  - SbertSemanticMatcher   : sentence-transformers bi-encoder embeddings.
                             Higher quality on paraphrase-level semantics, but
                             requires downloading model weights from Hugging Face
                             at first run - use in a deployment environment with
                             that network access (see README -> Deployment).

Select via the SEMANTIC_BACKEND env var ("tfidf" | "sbert").
"""
from abc import ABC, abstractmethod

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import get_settings

settings = get_settings()


class SemanticMatcher(ABC):
    @abstractmethod
    def similarity(self, text_a: str, text_b: str) -> float:
        """Return a similarity score in [0, 1]."""
        ...


class TfidfSemanticMatcher(SemanticMatcher):
    def similarity(self, text_a: str, text_b: str) -> float:
        if not text_a.strip() or not text_b.strip():
            return 0.0
        corpus = [text_a, text_b]
        vectorizer = TfidfVectorizer(stop_words="english", max_features=4096, ngram_range=(1, 2))
        try:
            tfidf = vectorizer.fit_transform(corpus)
        except ValueError:
            return 0.0  # empty vocabulary after stop-word removal
        # Reduce dimensionality (LSA) so near-synonymous n-grams share latent
        # dimensions rather than requiring exact token overlap.
        n_features = tfidf.shape[1]
        n_components = min(100, max(2, n_features - 1))
        if n_features <= 2:
            sim = cosine_similarity(tfidf[0], tfidf[1])[0][0]
        else:
            svd = TruncatedSVD(n_components=n_components, random_state=42)
            reduced = svd.fit_transform(tfidf)
            sim = cosine_similarity([reduced[0]], [reduced[1]])[0][0]
        return float(np.clip(sim, 0.0, 1.0))


class SbertSemanticMatcher(SemanticMatcher):
    _model = None

    def _get_model(self):
        if SbertSemanticMatcher._model is None:
            from sentence_transformers import SentenceTransformer  # lazy import
            SbertSemanticMatcher._model = SentenceTransformer(settings.SBERT_MODEL_NAME)
        return SbertSemanticMatcher._model

    def similarity(self, text_a: str, text_b: str) -> float:
        if not text_a.strip() or not text_b.strip():
            return 0.0
        model = self._get_model()
        emb = model.encode([text_a, text_b], normalize_embeddings=True)
        sim = float(np.dot(emb[0], emb[1]))
        return float(np.clip(sim, 0.0, 1.0))


def get_semantic_matcher() -> SemanticMatcher:
    if settings.SEMANTIC_BACKEND == "sbert":
        try:
            return SbertSemanticMatcher()
        except Exception:
            # Graceful degradation if model weights aren't reachable
            return TfidfSemanticMatcher()
    return TfidfSemanticMatcher()
