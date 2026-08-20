"""JWT access token creation and verification."""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.utils.config import get_settings

settings = get_settings()


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired, or invalid."""


def create_access_token(
    *, subject: str, role: str, expires_minutes: int | None = None
) -> str:
    """Create a signed JWT for the given user id (`subject`) and role."""
    expire_delta = timedelta(minutes=expires_minutes or settings.jwt_expire_minutes)
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + expire_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT, raising TokenError if it's not valid."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc
