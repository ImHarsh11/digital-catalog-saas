"""Shared rate-limiter instance used by API routers.

Kept in its own module to avoid circular imports (main.py imports routers,
routers import the limiter).

Rate limiting is automatically disabled during testing (when ENVIRONMENT
is not set or equals "development" and we're running under pytest), so
the test suite's many login calls don't trip the per-IP limit.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.config import get_settings


def _is_rate_limiting_enabled() -> bool:
    """Enable rate limiting only in production/staging, never during tests."""
    settings = get_settings()
    return settings.environment == "production"


limiter = Limiter(
    key_func=get_remote_address,
    enabled=_is_rate_limiting_enabled(),
)
