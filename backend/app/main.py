"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Side-effect import: registers every model's table on Base.metadata.
from app import models  # noqa: F401
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.super_admin import router as super_admin_router
from app.utils.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API for the Digital Catalog SaaS pilot.",
)

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


@app.get("/")
def root() -> dict[str, str]:
    return {"message": f"{settings.app_name} is running. See /docs for API documentation."}
