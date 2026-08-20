"""URL-safe slug generation, used for shop URLs (`/shop/:slug`)."""

import re

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Lowercase, hyphen-separated slug. Falls back to "shop" if empty."""
    value = _NON_ALNUM.sub("-", value.strip().lower()).strip("-")
    return value or "shop"
