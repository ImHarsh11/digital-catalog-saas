"""QR code generation for a shop's public catalog URL (Phase 6).

Super Admin only -- used when onboarding a new shop, to print a QR code
that sends customers straight to `{catalog_base_url}/shop/{slug}`. Not
persisted anywhere: generated fresh on every request from the shop's
current slug, so it's always correct even if the slug is later changed.
"""

import io

import qrcode

from app.utils.config import get_settings


def build_shop_catalog_url(slug: str) -> str:
    base = get_settings().catalog_base_url.rstrip("/")
    return f"{base}/shop/{slug}"


def generate_shop_qr_png(slug: str) -> bytes:
    url = build_shop_catalog_url(slug)
    image = qrcode.make(url)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
