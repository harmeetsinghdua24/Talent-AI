"""
Storage backend tests.

The S3 backend is tested against `moto`, which implements the real S3 API
locally (same boto3 client code path, same request/response shapes) with no
AWS account or network access needed. This genuinely exercises the S3 code
in app/services/storage_service.py - what it does NOT prove is that a real
AWS account/bucket/IAM policy is configured correctly, which has to be
verified once against real credentials (see scripts/verify_s3_storage.py).
"""
import importlib

import boto3
import pytest
from moto import mock_aws

from app.services import storage_service


def test_local_storage_save_read_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(storage_service.settings, "UPLOAD_DIR", str(tmp_path))
    backend = storage_service.LocalStorage()

    reference = backend.save("test-file.docx", b"hello world")
    assert backend.read(reference) == b"hello world"

    backend.delete(reference)
    with pytest.raises(FileNotFoundError):
        backend.read(reference)


@mock_aws
def test_s3_storage_save_read_delete(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "S3_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(storage_service.settings, "AWS_REGION", "us-east-1")
    monkeypatch.setattr(storage_service.settings, "AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setattr(storage_service.settings, "AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setattr(storage_service.settings, "S3_ENDPOINT_URL", "")

    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="test-bucket")

    backend = storage_service.S3Storage()
    reference = backend.save("resumes/abc123.pdf", b"PDF-CONTENT-BYTES")
    assert reference == "s3://test-bucket/resumes/abc123.pdf"

    assert backend.read(reference) == b"PDF-CONTENT-BYTES"

    backend.delete(reference)
    with pytest.raises(Exception):  # botocore raises NoSuchKey
        backend.read(reference)


@mock_aws
def test_s3_storage_rejects_reference_from_another_bucket(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "S3_BUCKET_NAME", "my-bucket")
    monkeypatch.setattr(storage_service.settings, "AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setattr(storage_service.settings, "AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setattr(storage_service.settings, "S3_ENDPOINT_URL", "")
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="my-bucket")

    backend = storage_service.S3Storage()
    with pytest.raises(storage_service.StorageError):
        backend.read("s3://someone-elses-bucket/secret.pdf")


def test_s3_storage_requires_bucket_name(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "S3_BUCKET_NAME", "")
    with pytest.raises(storage_service.StorageError):
        storage_service.S3Storage()


def test_get_storage_backend_defaults_to_local(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "local")
    assert isinstance(storage_service.get_storage_backend(), storage_service.LocalStorage)


@mock_aws
def test_get_storage_backend_returns_s3_when_configured(monkeypatch):
    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(storage_service.settings, "S3_BUCKET_NAME", "cfg-bucket")
    monkeypatch.setattr(storage_service.settings, "AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setattr(storage_service.settings, "AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setattr(storage_service.settings, "S3_ENDPOINT_URL", "")
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="cfg-bucket")

    assert isinstance(storage_service.get_storage_backend(), storage_service.S3Storage)


@mock_aws
def test_full_resume_upload_works_with_s3_backend(client, candidate_headers, monkeypatch):
    """
    End-to-end: a real resume upload through the API, with STORAGE_BACKEND
    switched to s3. Proves parsing still works (it reads the in-memory bytes,
    not a disk path) and that the stored reference points at S3.
    """
    import io
    import docx

    monkeypatch.setattr(storage_service.settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(storage_service.settings, "S3_BUCKET_NAME", "resume-bucket")
    monkeypatch.setattr(storage_service.settings, "AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setattr(storage_service.settings, "AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setattr(storage_service.settings, "S3_ENDPOINT_URL", "")
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="resume-bucket")

    doc = docx.Document()
    for line in "Priya Sharma\ns3cand@test.com\nSkills: Python, SQL\n3 years experience".split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    r = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("s3resume.docx", buf.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=candidate_headers,
    )
    assert r.status_code == 200
    profile = r.json()["extracted_profile"]
    assert profile["name"] == "Priya Sharma"
    assert "python" in {s["skill"] for s in profile["skills"]}

    # The file really landed in the (simulated) bucket
    objects = boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="resume-bucket")
    assert objects["KeyCount"] == 1
