"""Theme resolution + validation (app/services/theme.py, app/schemas/theme.py)
and the admin theme endpoints.
"""

import pytest
from pydantic import ValidationError

from app.schemas.theme import ResolvedTheme, ThemeConfig
from app.services.theme import DEFAULT_PRESET, PRESETS, preset_choices, resolve_theme
from tests.conftest import auth_headers


# ─── resolver ───────────────────────────────────────────────────────────────


def test_resolve_none_is_default_preset():
    r = resolve_theme(None)
    assert r["preset"] == DEFAULT_PRESET
    assert r["brand"]["600"] == PRESETS[DEFAULT_PRESET]["primary"]
    assert r["splash_enabled"] is True
    ResolvedTheme(**r)  # shape is valid


def test_resolve_every_preset_produces_a_valid_theme():
    for key in PRESETS:
        r = resolve_theme({"preset": key})
        ResolvedTheme(**r)
        assert set(r["brand"]) == {"50", "100", "200", "300", "400", "500", "600", "700", "800", "900"}


def test_primary_override_regenerates_the_ramp():
    r = resolve_theme({"preset": "rose-blush", "palette": {"primary": "#123456"}})
    assert r["brand"]["600"] == "#123456"
    assert r["brand"]["50"] != "#123456"  # lighter step is blended toward white


def test_splash_disabled_override_wins():
    r = resolve_theme({"preset": "royal-maroon", "splash": {"enabled": False}})
    assert r["splash_enabled"] is False
    assert r["splash_style"] == "none"


def test_tagline_override_and_fallback():
    assert resolve_theme({"preset": "royal-maroon"})["hero_tagline"] == PRESETS["royal-maroon"][
        "hero_tagline"
    ]
    assert resolve_theme({"hero": {"tagline": "My shop"}})["hero_tagline"] == "My shop"


def test_stale_unknown_preset_falls_back_never_raises():
    r = resolve_theme({"preset": "deleted-preset"})
    assert r["preset"] == DEFAULT_PRESET


# ─── validation ─────────────────────────────────────────────────────────────


def test_unknown_preset_is_rejected():
    with pytest.raises(ValidationError):
        ThemeConfig(preset="not-real")


def test_non_hex_colour_is_rejected():
    with pytest.raises(ValidationError):
        ThemeConfig(palette={"primary": "rebeccapurple"})


def test_unknown_keys_are_rejected():
    with pytest.raises(ValidationError):
        ThemeConfig(customCss="body{display:none}")
    with pytest.raises(ValidationError):
        ThemeConfig(palette={"bg": "#ffffff"})


def test_tagline_length_capped():
    with pytest.raises(ValidationError):
        ThemeConfig(hero={"tagline": "x" * 200})


# ─── endpoints ──────────────────────────────────────────────────────────────


def test_theme_presets_endpoint(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/theme-presets", headers=headers)
    assert resp.status_code == 200
    keys = {p["key"] for p in resp.json()}
    assert keys == set(PRESETS)
    assert all(p["primary"].startswith("#") for p in resp.json())


def test_set_and_read_shop_theme(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")

    put = client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme",
        json={"preset": "lavender-luxe", "palette": {"accent": "#abcdef"}, "splash": {"enabled": False}},
        headers=headers,
    )
    assert put.status_code == 200, put.text
    body = put.json()
    assert body["theme_config"]["preset"] == "lavender-luxe"
    assert body["theme_resolved"]["accent"] == "#abcdef"
    assert body["theme_resolved"]["splash_enabled"] is False
    assert body["theme_resolved"]["heading_font"] == "Poppins"

    detail = client.get(f"/api/super-admin/shops/{shop_a.id}", headers=headers).json()
    assert detail["theme_config"]["preset"] == "lavender-luxe"
    assert detail["theme_resolved"]["preset"] == "lavender-luxe"


def test_set_theme_rejects_bad_preset(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme", json={"preset": "nope"}, headers=headers
    )
    assert resp.status_code == 422


def test_set_theme_rejects_shop_owner(client, owner_a, shop_a):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme", json={"preset": "rose-blush"}, headers=headers
    )
    assert resp.status_code == 403


def test_create_shop_with_a_theme_preset(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Peachy Threads",
            "theme_preset": "peach-cream",
            "owner_name": "P T",
            "owner_email": "pt@test.com",
            "owner_password": "PeachPass1!",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    shop_id = resp.json()["shop"]["id"]
    detail = client.get(f"/api/super-admin/shops/{shop_id}", headers=headers).json()
    assert detail["theme_config"]["preset"] == "peach-cream"


def test_create_shop_rejects_bad_theme_preset(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "X",
            "theme_preset": "not-a-preset",
            "owner_name": "X",
            "owner_email": "x-theme@test.com",
            "owner_password": "XxxxPass1!",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_public_shop_response_includes_resolved_theme(client, shop_a, category_a):
    # default (no theme set)
    resp = client.get(f"/api/public/shops/{shop_a.slug}")
    assert resp.status_code == 200
    theme = resp.json()["theme"]
    assert theme["preset"] == DEFAULT_PRESET
    assert "brand" in theme and theme["brand"]["600"].startswith("#")


def test_public_shop_reflects_a_set_theme(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme",
        json={"preset": "midnight-indigo"},
        headers=headers,
    )
    theme = client.get(f"/api/public/shops/{shop_a.slug}").json()["theme"]
    assert theme["preset"] == "midnight-indigo"
    assert theme["card_radius"] == "0.25rem"  # midnight-indigo is "sharp"
