"""Health-check endpoint used to verify the API is up and reachable."""

from fastapi import APIRouter

from app.utils.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
    }
