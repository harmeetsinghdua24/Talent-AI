"""
Resume file storage, behind one interface with two backends:

  - LocalStorage : writes to STORAGE settings.UPLOAD_DIR on local disk.
                   Default, zero external dependencies, but files are lost
                   on redeploy on most ephemeral-filesystem PaaS hosts.
  - S3Storage    : writes to an S3 (or S3-compatible: Cloudflare R2, MinIO,
                   DigitalOcean Spaces) bucket, which survives redeploys.
                   Select via STORAGE_BACKEND=s3 and the AWS_*/S3_* env vars.

Both backends store and retrieve raw bytes only - text extraction reads
directly from those bytes (see resume_parser.py), so parsing never depends
on a local filesystem path existing, regardless of which backend is active.

Testing note: the S3 backend is exercised in tests/test_storage_service.py
using `moto`, a library that fully simulates the AWS S3 API locally with no
real AWS account or network access required - so the S3 code path itself is
genuinely tested here. What is NOT tested in this build environment is a
live upload against a real AWS account (this sandbox has no network route
to amazonaws.com) - verify that once you have real credentials, e.g. with
the provided `scripts/verify_s3_storage.py` helper.
"""
from abc import ABC, abstractmethod

from app.core.config import get_settings

settings = get_settings()


class StorageError(Exception):
    pass


class StorageBackend(ABC):
    @abstractmethod
    def save(self, key: str, content: bytes) -> str:
        """Persists content, returns a reference string usable by read()."""
        ...

    @abstractmethod
    def read(self, reference: str) -> bytes:
        """Retrieves previously-saved content by its reference."""
        ...

    @abstractmethod
    def delete(self, reference: str) -> None:
        ...


class LocalStorage(StorageBackend):
    def save(self, key: str, content: bytes) -> str:
        import os
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        full_path = os.path.join(settings.UPLOAD_DIR, key)
        with open(full_path, "wb") as f:
            f.write(content)
        return full_path

    def read(self, reference: str) -> bytes:
        with open(reference, "rb") as f:
            return f.read()

    def delete(self, reference: str) -> None:
        import os
        if os.path.exists(reference):
            os.remove(reference)


class S3Storage(StorageBackend):
    def __init__(self):
        if not settings.S3_BUCKET_NAME:
            raise StorageError("STORAGE_BACKEND=s3 requires S3_BUCKET_NAME to be set")
        import boto3
        client_kwargs = {
            "region_name": settings.AWS_REGION,
        }
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        if settings.S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        self._client = boto3.client("s3", **client_kwargs)
        self._bucket = settings.S3_BUCKET_NAME

    def save(self, key: str, content: bytes) -> str:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=content)
        return f"s3://{self._bucket}/{key}"

    def read(self, reference: str) -> bytes:
        key = self._key_from_reference(reference)
        obj = self._client.get_object(Bucket=self._bucket, Key=key)
        return obj["Body"].read()

    def delete(self, reference: str) -> None:
        key = self._key_from_reference(reference)
        self._client.delete_object(Bucket=self._bucket, Key=key)

    def _key_from_reference(self, reference: str) -> str:
        prefix = f"s3://{self._bucket}/"
        if not reference.startswith(prefix):
            raise StorageError(f"Reference {reference!r} does not belong to bucket {self._bucket!r}")
        return reference[len(prefix):]


def get_storage_backend() -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":
        return S3Storage()
    return LocalStorage()
