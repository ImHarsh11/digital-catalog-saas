"""Storefront theming (redesign Phase 2).

A shop's ``theme`` column holds a small, validated semantic config -- which
preset, plus a handful of allowed overrides. It never holds raw CSS.

``resolve_theme`` turns ``{preset + overrides}`` into a flat ``ResolvedTheme``
of concrete values (colour ramp, fonts, layout flags) that the public API
returns and the catalog frontend applies as CSS custom properties. One
dynamic ``/shop/:slug`` route renders every tenant from this -- there is no
per-shop page or bundle.
"""

from __future__ import annotations

HEX_RE = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"

# Fonts a preset (or the resolver) may name. Anything outside this list is
# rejected -- the catalog frontend only loads faces from here.
ALLOWED_FONTS = {
    "Inter",
    "Playfair Display",
    "Fraunces",
    "Poppins",
    "Cormorant Garamond",
    "Nunito Sans",
    "DM Serif Display",
}

HERO_STYLES = {"ornate", "minimal", "photo"}
SPLASH_STYLES = {"ornate", "minimal", "none"}
CARD_SHAPES = {"rounded", "sharp"}

# Curated heading + body font pairings. A shop can override the preset's own
# fonts by naming one of these keys in `theme.font_pair`. Every face here
# must also be in ALLOWED_FONTS (the catalog frontend only loads those).
FONT_PAIRS: dict[str, dict] = {
    "classic-serif": {
        "label": "Classic Serif",
        "heading_font": "Playfair Display",
        "body_font": "Inter",
    },
    "modern-sans": {
        "label": "Modern Sans",
        "heading_font": "Poppins",
        "body_font": "Poppins",
    },
    "editorial": {
        "label": "Editorial",
        "heading_font": "Fraunces",
        "body_font": "Nunito Sans",
    },
    "elegant": {
        "label": "Elegant",
        "heading_font": "Cormorant Garamond",
        "body_font": "Inter",
    },
    "bold-display": {
        "label": "Bold Display",
        "heading_font": "DM Serif Display",
        "body_font": "Nunito Sans",
    },
    "clean-minimal": {
        "label": "Clean & Minimal",
        "heading_font": "Inter",
        "body_font": "Inter",
    },
}


def font_pair_choices() -> list[dict]:
    return [
        {"key": k, "label": v["label"], "heading_font": v["heading_font"], "body_font": v["body_font"]}
        for k, v in FONT_PAIRS.items()
    ]


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def _rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c))):02x}" for c in rgb)


def _mix(a: str, b: str, t: float) -> str:
    """Blend hex a -> hex b by t in [0, 1]."""
    ar, ag, ab = _hex_to_rgb(a)
    br, bg, bb = _hex_to_rgb(b)
    return _rgb_to_hex((ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t))


# Ramp anchors: 600 is the chosen primary, everything else is a blend toward
# white (lighter steps) or near-black (darker steps).
_RAMP_STOPS: dict[str, tuple[str, float]] = {
    "50": ("#ffffff", 0.94),
    "100": ("#ffffff", 0.85),
    "200": ("#ffffff", 0.68),
    "300": ("#ffffff", 0.48),
    "400": ("#ffffff", 0.24),
    "500": ("#ffffff", 0.10),
    "600": ("", 0.0),  # the primary itself
    "700": ("#1a1012", 0.18),
    "800": ("#1a1012", 0.32),
    "900": ("#1a1012", 0.46),
}


def _ramp(primary: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for step, (toward, t) in _RAMP_STOPS.items():
        out[step] = primary if not toward else _mix(primary, toward, t)
    return out


def _readable_on(bg: str) -> str:
    """Black or white text, whichever contrasts better with ``bg``."""
    r, g, b = _hex_to_rgb(bg)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#1a1a1a" if luminance > 0.6 else "#ffffff"


# ─── Presets ────────────────────────────────────────────────────────────────
# Each preset is a full set of concrete values. Overrides patch primary /
# accent / hero / splash on top. `royal-maroon` matches the pre-Phase-2 look
# so existing shops don't change appearance until a preset is chosen.

PRESETS: dict[str, dict] = {
    "royal-maroon": {
        "label": "Royal Maroon",
        "description": "Deep maroon and gold. Traditional, festive, the original look.",
        "primary": "#b12f42",
        "accent": "#c9a84c",
        "surface_bg": "#fbf6f4",
        "surface_card": "#ffffff",
        "ink": "#2a1a1d",
        "ink_muted": "#8a7377",
        "splash_style": "ornate",
        "hero_style": "ornate",
        "hero_tagline": "Crafted with elegance",
        "heading_font": "Playfair Display",
        "body_font": "Inter",
        "card_shape": "rounded",
    },
    "emerald-heritage": {
        "label": "Emerald Heritage",
        "description": "Emerald green with gold. Rich and classic.",
        "primary": "#1f6f54",
        "accent": "#c9a84c",
        "surface_bg": "#f4f8f5",
        "surface_card": "#ffffff",
        "ink": "#182a24",
        "ink_muted": "#6c8079",
        "splash_style": "ornate",
        "hero_style": "ornate",
        "hero_tagline": "A heritage of fine weaves",
        "heading_font": "Playfair Display",
        "body_font": "Inter",
        "card_shape": "rounded",
    },
    "rose-blush": {
        "label": "Rose Blush",
        "description": "Soft rose pastel. Light, modern, feminine.",
        "primary": "#d1667f",
        "accent": "#e7a6b7",
        "surface_bg": "#fdf5f6",
        "surface_card": "#ffffff",
        "ink": "#3a2b30",
        "ink_muted": "#9a8288",
        "splash_style": "minimal",
        "hero_style": "minimal",
        "hero_tagline": "New season, new favourites",
        "heading_font": "Fraunces",
        "body_font": "Nunito Sans",
        "card_shape": "rounded",
    },
    "lavender-luxe": {
        "label": "Lavender Luxe",
        "description": "Muted lavender. Calm, contemporary, boutique.",
        "primary": "#7c6bb0",
        "accent": "#b6a6e0",
        "surface_bg": "#f8f6fc",
        "surface_card": "#ffffff",
        "ink": "#2b2740",
        "ink_muted": "#847e9c",
        "splash_style": "minimal",
        "hero_style": "minimal",
        "hero_tagline": "Discover our collection",
        "heading_font": "Poppins",
        "body_font": "Poppins",
        "card_shape": "rounded",
    },
    "midnight-indigo": {
        "label": "Midnight Indigo",
        "description": "Deep indigo and silver. Sharp and premium.",
        "primary": "#37477e",
        "accent": "#9aa7d0",
        "surface_bg": "#f5f6fa",
        "surface_card": "#ffffff",
        "ink": "#1e2233",
        "ink_muted": "#767c93",
        "splash_style": "minimal",
        "hero_style": "minimal",
        "hero_tagline": "Timeless pieces, thoughtfully chosen",
        "heading_font": "Cormorant Garamond",
        "body_font": "Inter",
        "card_shape": "sharp",
    },
    "peach-cream": {
        "label": "Peach Cream",
        "description": "Warm peach and cream. Friendly and inviting.",
        "primary": "#d5824f",
        "accent": "#e8c39c",
        "surface_bg": "#fdf8f2",
        "surface_card": "#ffffff",
        "ink": "#3a2c22",
        "ink_muted": "#93806f",
        "splash_style": "none",
        "hero_style": "minimal",
        "hero_tagline": "Handpicked, just for you",
        "heading_font": "Fraunces",
        "body_font": "Nunito Sans",
        "card_shape": "rounded",
    },
}

DEFAULT_PRESET = "royal-maroon"
_CARD_RADIUS = {"rounded": "1rem", "sharp": "0.25rem"}


def preset_choices() -> list[dict]:
    """Gallery data for the admin Theme tab -- each preset resolved so the
    frontend can render a real swatch without duplicating the palette."""
    out = []
    for key, p in PRESETS.items():
        out.append(
            {
                "key": key,
                "label": p["label"],
                "description": p["description"],
                "primary": p["primary"],
                "accent": p["accent"],
                "surface_bg": p["surface_bg"],
                "heading_font": p["heading_font"],
            }
        )
    return out


def resolve_theme(theme: dict | None) -> dict:
    """``{preset, palette:{primary,accent}, hero:{image_url,tagline},
    splash:{enabled}}`` (any part optional) -> flat concrete values.

    Assumes ``theme`` has already passed ``ThemeConfig`` validation (or is
    None). Unknown preset falls back to the default rather than raising, so
    a stale value can never take a catalog offline.
    """
    theme = theme or {}
    preset_key = theme.get("preset") or DEFAULT_PRESET
    if preset_key not in PRESETS:
        preset_key = DEFAULT_PRESET
    preset = PRESETS[preset_key]

    palette = theme.get("palette") or {}
    hero = theme.get("hero") or {}
    splash = theme.get("splash") or {}

    primary = palette.get("primary") or preset["primary"]
    accent = palette.get("accent") or preset["accent"]

    # Font pairing override (falls back to the preset's own fonts).
    pair = FONT_PAIRS.get(theme.get("font_pair") or "")
    heading_font = pair["heading_font"] if pair else preset["heading_font"]
    body_font = pair["body_font"] if pair else preset["body_font"]

    splash_style = preset["splash_style"]
    splash_enabled = splash.get("enabled")
    if splash_enabled is None:
        splash_enabled = splash_style != "none"
    elif splash_enabled is False:
        splash_style = "none"
    elif splash_style == "none":
        # owner turned it back on but preset has no ornate variant -> minimal
        splash_style = "minimal"

    return {
        "preset": preset_key,
        "brand": _ramp(primary),
        "accent": accent,
        "accent_contrast": _readable_on(accent),
        "surface_bg": preset["surface_bg"],
        "surface_card": preset["surface_card"],
        "ink": preset["ink"],
        "ink_muted": preset["ink_muted"],
        "splash_enabled": bool(splash_enabled),
        "splash_style": splash_style,
        "hero_style": preset["hero_style"],
        "hero_image_url": hero.get("image_url"),
        "hero_tagline": hero.get("tagline") or preset["hero_tagline"],
        "heading_font": heading_font,
        "body_font": body_font,
        "card_radius": _CARD_RADIUS[preset["card_shape"]],
    }
