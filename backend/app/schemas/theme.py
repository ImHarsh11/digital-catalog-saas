"""Theme schemas (redesign Phase 2).

``ThemeConfig`` is the *input* form — the small semantic config stored on
``shops.theme`` and accepted by the admin PATCH endpoint. It is strict:
unknown keys are rejected, colours must be hex, the preset must exist.

``ResolvedTheme`` is the *output* form — flat concrete values returned by
the public catalog API and applied by the frontend as CSS variables.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.theme import HEX_RE, PRESETS


class ThemePalette(BaseModel):
    model_config = ConfigDict(extra="forbid")
    primary: str | None = Field(default=None, pattern=HEX_RE)
    accent: str | None = Field(default=None, pattern=HEX_RE)


class ThemeHero(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_url: str | None = Field(default=None, max_length=1024)
    tagline: str | None = Field(default=None, max_length=80)


class ThemeSplash(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None


class ThemeConfig(BaseModel):
    """What a shop's `theme` column stores. Every field optional; an empty
    object means "the default preset, no overrides"."""

    model_config = ConfigDict(extra="forbid")

    version: int = 1
    preset: str = "royal-maroon"
    palette: ThemePalette = Field(default_factory=ThemePalette)
    hero: ThemeHero = Field(default_factory=ThemeHero)
    splash: ThemeSplash = Field(default_factory=ThemeSplash)

    @field_validator("preset")
    @classmethod
    def _known_preset(cls, v: str) -> str:
        if v not in PRESETS:
            raise ValueError(
                f"Unknown theme preset '{v}'. Choose one of: {', '.join(sorted(PRESETS))}."
            )
        return v


class ResolvedTheme(BaseModel):
    preset: str
    brand: dict[str, str]
    accent: str
    accent_contrast: str
    surface_bg: str
    surface_card: str
    ink: str
    ink_muted: str
    splash_enabled: bool
    splash_style: str
    hero_style: str
    hero_image_url: str | None
    hero_tagline: str
    heading_font: str
    body_font: str
    card_radius: str


class ThemePresetInfo(BaseModel):
    key: str
    label: str
    description: str
    primary: str
    accent: str
    surface_bg: str
    heading_font: str
