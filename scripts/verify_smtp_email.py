#!/usr/bin/env python3
"""
Verify your real SMTP email configuration before deploying.

With EMAIL_BACKEND=console (the default), emails are only logged, never
sent - which is fine for local dev but means real candidates would never
receive shortlist/interview/offer/password-reset emails in production.

This script switches to the SMTP backend using your .env settings and
sends one real test email, so you can confirm it works before relying on it.

Usage:
    cd backend
    python ../scripts/verify_smtp_email.py you@youremail.com
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ["EMAIL_BACKEND"] = "smtp"

from app.core.config import get_settings  # noqa: E402
from app.services.email_service import send_email  # noqa: E402

settings = get_settings()


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python verify_smtp_email.py <recipient-email>")
        return 1
    recipient = sys.argv[1]

    print("Checking SMTP configuration...")
    print(f"  Host:     {settings.SMTP_HOST or '(not set)'}")
    print(f"  Port:     {settings.SMTP_PORT}")
    print(f"  User:     {settings.SMTP_USER or '(not set)'}")
    print(f"  From:     {settings.SMTP_FROM_EMAIL}")
    print(f"  TLS:      {settings.SMTP_USE_TLS}")
    print(f"  Password: {'set' if settings.SMTP_PASSWORD else '(not set)'}")
    print()

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("FAIL: SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set in backend/.env")
        return 1

    print(f"Sending a test email to {recipient}...")
    ok = send_email(
        recipient,
        "Talentum SMTP test",
        "This is a test email from your Talentum deployment.\n\n"
        "If you're reading this, your SMTP configuration works and real users "
        "will receive shortlist, interview, offer and password-reset emails.",
    )

    if not ok:
        print()
        print("FAIL: the email could not be sent. Check the traceback logged above.")
        print()
        print("Common causes:")
        print("  - Gmail: you must use an App Password, not your normal password")
        print("    (https://myaccount.google.com/apppasswords)")
        print("  - Wrong port: 587 for STARTTLS (SMTP_USE_TLS=true), 465 for SSL")
        print("  - Provider blocks sending from unverified 'From' addresses")
        return 1

    print()
    print(f"SUCCESS - test email sent. Check {recipient} (including spam).")
    print("Set EMAIL_BACKEND=smtp in your deployed environment to enable real emails.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
