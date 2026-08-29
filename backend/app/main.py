"""FastAPI application entrypoint."""

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Side-effect import: registers every model's table on Base.metadata.
from app import models  # noqa: F401
from app.api.auth import router as auth_router
from app.api.categories import router as categories_router
from app.api.health import router as health_router
from app.api.products import router as products_router
from app.api.public_catalog import router as public_catalog_router
from app.api.shop_settings import router as shop_settings_router
from app.api.super_admin import router as super_admin_router
from app.api.webhooks import router as webhooks_router
from app.utils.config import get_settings
from app.utils.rate_limit import limiter

logger = logging.getLogger("app")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API for the Digital Catalog SaaS pilot.",
    # Disable auto-generated docs in production.
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(super_admin_router)
app.include_router(shop_settings_router)
app.include_router(categories_router)
app.include_router(products_router)
app.include_router(public_catalog_router)
app.include_router(webhooks_router)

# Serves images saved by LocalImageStorage (app/services/storage.py). Only
# meaningful when IMAGE_STORAGE_PROVIDER=local, but mounting it unconditionally
# is harmless -- it's just an empty directory under Cloudinary/Supabase.
_upload_dir = Path(settings.upload_dir)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": f"{settings.app_name} is running. See /docs for API documentation."}


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all: never leak tracebacks or SQL errors to the client.

    In development the full traceback still goes to the console via
    uvicorn's logging; in production only the log gets the detail.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )
