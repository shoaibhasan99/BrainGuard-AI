"""Email routes for sending OTP messages"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["email"])


def _generate_email_html(otp: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">BrainGuard AI</h1>
        <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Medical AI Platform</p>
      </div>
      <div style="padding: 40px 30px; background: #f8f9fa;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Email Verification</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          Thank you for signing up for BrainGuard AI! To complete your registration, please use the following verification code:
        </p>
        <div style="background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
          <p style="color: #333; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Your verification code:</p>
          <div style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            {otp}
          </div>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
        </p>
        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
          <p style="color: #1976d2; font-size: 14px; margin: 0; font-weight: 600;">
            🔒 Security Note: Never share this code with anyone. BrainGuard AI will never ask for your verification code.
          </p>
        </div>
      </div>
      <div style="background: #333; padding: 20px; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">© 2024 BrainGuard AI. All rights reserved.</p>
        <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
    """


class SendOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class SendOTPResponse(BaseModel):
    success: bool
    email_id: Optional[str] = None


@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp_email(payload: SendOTPRequest) -> SendOTPResponse:
    """Send OTP email using Resend API."""
    if not RESEND_API_KEY:
        logger.error("Resend API key is not configured")
        raise HTTPException(status_code=500, detail="Email service not configured. Please set RESEND_API_KEY.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                json={
                    "from": RESEND_FROM_EMAIL,
                    "to": [payload.email],
                    "subject": "BrainGuard AI - Email Verification Code",
                    "html": _generate_email_html(payload.otp),
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                },
            )

        if response.status_code >= 400:
            error_detail = response.json().get("message") if response.content else response.text
            logger.error("Resend API error %s: %s", response.status_code, error_detail)
            raise HTTPException(status_code=502, detail=error_detail or "Failed to send OTP email")

        data = response.json()
        logger.info("OTP email sent successfully to %s", payload.email)
        return SendOTPResponse(success=True, email_id=data.get("id"))

    except httpx.HTTPError as exc:
        logger.exception("HTTP error while sending OTP email: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to reach email service") from exc
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Unexpected error while sending OTP email: %s", exc)
        raise HTTPException(status_code=500, detail="Unexpected error while sending OTP email") from exc

























