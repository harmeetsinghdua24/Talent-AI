#!/usr/bin/env python3
"""
Verify your real S3 configuration before deploying.

The S3 backend is tested in CI against a simulated S3 API (moto), which
proves the code is correct - but it can't prove YOUR bucket, credentials
and IAM permissions are set up right. Run this once against real AWS (or
Cloudflare R2 / MinIO / DigitalOcean Spaces) to confirm that.

Usage:
    cd backend
    # with your real values in .env, or exported in the shell:
    python ../scripts/verify_s3_storage.py

It uploads a small test object, reads it back, verifies the contents match,
then deletes it - leaving nothing behind.
"""
import os
import sys

# Make `app` importable when run from the repo root or from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ.setdefault("STORAGE_BACKEND", "s3")

from app.core.config import get_settings  # noqa: E402
from app.services.storage_service import S3Storage, StorageError  # noqa: E402

settings = get_settings()


def main() -> int:
    print("Checking S3 configuration...")
    print(f"  Bucket:   {settings.S3_BUCKET_NAME or '(not set)'}")
    print(f"  Region:   {settings.AWS_REGION}")
    print(f"  Endpoint: {settings.S3_ENDPOINT_URL or '(default AWS)'}")
    print(f"  Key ID:   {'set' if settings.AWS_ACCESS_KEY_ID else '(not set)'}")
    print()

    if not settings.S3_BUCKET_NAME:
        print("FAIL: S3_BUCKET_NAME is not set. Add it to backend/.env")
        return 1

    try:
        backend = S3Storage()
    except StorageError as e:
        print(f"FAIL: {e}")
        return 1

    test_key = "talentum-connectivity-check.txt"
    test_body = b"talentum s3 connectivity check"

    try:
        print("1/3 Uploading test object...")
        reference = backend.save(test_key, test_body)
        print(f"    -> {reference}")

        print("2/3 Reading it back...")
        retrieved = backend.read(reference)
        if retrieved != test_body:
            print("FAIL: content read back did not match what was uploaded")
            return 1
        print("    -> contents match")

        print("3/3 Deleting test object...")
        backend.delete(reference)
        print("    -> deleted")
    except Exception as e:
        print()
        print(f"FAIL: {type(e).__name__}: {e}")
        print()
        print("Common causes:")
        print("  - Wrong AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY")
        print("  - Bucket doesn't exist, or is in a different AWS_REGION")
        print("  - IAM user lacks s3:PutObject / s3:GetObject / s3:DeleteObject on this bucket")
        return 1

    print()
    print("SUCCESS - your S3 storage is configured correctly.")
    print("Resumes will persist across redeploys with STORAGE_BACKEND=s3.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
