"""
Email notifications for shortlist/reject decisions and interview scheduling.

Two backends behind one interface:
  - "console" (default): logs the email instead of sending it. Zero
    configuration, works everywhere, and is genuinely useful for local
    dev/demo - you can see exactly what would be sent without needing real
    SMTP credentials or network access to an SMTP server.
  - "smtp": sends a real email via smtplib using the SMTP_* settings in
    .env (Gmail, SendGrid, Mailgun, etc. all work over standard SMTP).

Switch via EMAIL_BACKEND=smtp once you have real credentials - see
.env.example for the exact fields required. This module was NOT tested
against a live SMTP server in the environment this project was built in
(that sandbox has no network route to any SMTP host), so the "console"
path is what's actually been exercised; the "smtp" path follows the
standard smtplib/starttls pattern and should work as-is, but test it
against your real provider before relying on it for something important.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger("talent_ai.email")
settings = get_settings()


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Returns True if the email was sent/logged successfully."""
    if not to_email:
        logger.warning("send_email called with no recipient - skipping (subject=%r)", subject)
        return False

    if settings.EMAIL_BACKEND == "smtp":
        return _send_via_smtp(to_email, subject, body)

    # console backend - default, always available
    logger.info(
        "\n--- EMAIL (console backend, not actually sent) ---\nTo: %s\nSubject: %s\n\n%s\n--- END EMAIL ---",
        to_email, subject, body,
    )
    return True


def _send_via_smtp(to_email: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.error("EMAIL_BACKEND=smtp but SMTP_HOST/SMTP_USER not configured - email not sent")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


# --- Templated notifications used across the app ---

def send_shortlist_email(candidate_email: str, candidate_name: str | None, job_title: str, company_name: str | None = None) -> bool:
    name = candidate_name or "there"
    company_suffix = f" at {company_name}" if company_name else ""
    subject = f"You've been shortlisted for {job_title}{company_suffix}"
    body = (
        f"Hi {name},\n\n"
        f"Good news - you've been shortlisted for the {job_title} role{company_suffix}.\n"
        f"The hiring team will be in touch about next steps shortly.\n\n"
        f"Best,\n{company_name or 'Talentum'} Hiring Team"
    )
    return send_email(candidate_email, subject, body)


def send_rejection_email(candidate_email: str, candidate_name: str | None, job_title: str, company_name: str | None = None) -> bool:
    name = candidate_name or "there"
    company_suffix = f" at {company_name}" if company_name else ""
    subject = f"Update on your application for {job_title}{company_suffix}"
    body = (
        f"Hi {name},\n\n"
        f"Thank you for applying for the {job_title} role{company_suffix}. After reviewing your application, "
        f"we've decided to move forward with other candidates at this time.\n\n"
        f"We appreciate your interest and encourage you to apply for future roles that match your skills.\n\n"
        f"Best,\n{company_name or 'Talentum'} Hiring Team"
    )
    return send_email(candidate_email, subject, body)


def send_password_reset_email(user_email: str, user_name: str | None, reset_link: str, expire_minutes: int) -> bool:
    name = user_name or "there"
    subject = "Reset your Talentum password"
    body = (
        f"Hi {name},\n\n"
        f"We received a request to reset your Talentum password. Click the link below to choose a new one "
        f"(this link expires in {expire_minutes} minutes):\n\n"
        f"{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email - your password will not be changed.\n\n"
        f"Best,\nTalentum"
    )
    return send_email(user_email, subject, body)


def send_interview_scheduled_email(
    candidate_email: str, candidate_name: str | None, job_title: str,
    scheduled_at_str: str, mode: str, location_or_link: str | None,
    company_name: str | None = None,
) -> bool:
    name = candidate_name or "there"
    company_suffix = f" at {company_name}" if company_name else ""
    subject = f"Interview scheduled for {job_title}{company_suffix}"
    location_line = f"\nLocation/Link: {location_or_link}" if location_or_link else ""
    body = (
        f"Hi {name},\n\n"
        f"Your interview for the {job_title} role{company_suffix} has been scheduled.\n\n"
        f"When: {scheduled_at_str}\n"
        f"Mode: {mode}{location_line}\n\n"
        f"Please reach out if you have any scheduling conflicts.\n\n"
        f"Best,\n{company_name or 'Talentum'} Hiring Team"
    )
    return send_email(candidate_email, subject, body)
