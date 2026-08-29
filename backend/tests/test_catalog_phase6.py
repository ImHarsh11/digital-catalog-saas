"""Phase 6 -- auto promo banners, discounted / new-arrival product filters,
font-pair theme override, and shop-logo upload/delete.
"""

from datetime import datetime, timedelta, timezone
from io import BytesIO

from app.models.enums import ProductStatus
from app.models.product import Product

from tests.conftest import auth_headers, tiny_jpeg_bytes


def _product(db_session, shop, category, *, days_old=1, **kw):
    defaults = dict(
        shop_id=shop.id,
        category_id=category.id,
        name="Silk Saree",
        price=5000.00,
        status=ProductStatus.AVAILABLE,
        created_at=datetime.now(timezone.utc) - timedelta(days=days_old),
    )
    defaults.update(kw)
    p = Product(**defaults)
    db_session.add(p)
    db_session.flush()
    return p


# --- promo banners -------------------------------------------------


def test_no_promos_for_empty_catalog(client, shop_a, category_a):
    body = client.get(f"/api/public/shops/{shop_a.slug}").json()
    assert body["promos"] == []


def test_new_arrivals_promo_appears(client, db_session, shop_a, category_a):
    for i in range(3):
        _product(db_session, shop_a, category_a, days_old=2, name=f"Fresh {i}")
    body = client.get(f"/api/public/shops/{shop_a.slug}").json()
    keys = [p["key"] for p in body["promos"]]
    assert "new_arrivals" in keys
    na = next(p for p in body["promos"] if p["key"] == "new_arrivals")
    assert na["subtitle"] == "3 just added"


def test_on_sale_promo_shows_max_discount(client, db_session, shop_a, category_a):
    _product(db_session, shop_a, category_a, discount_percent=15)
    _product(db_session, shop_a, category_a, discount_percent=40, name="Big Deal")
    body = client.get(f"/api/public/shops/{shop_a.slug}").json()
    sale = next(p for p in body["promos"] if p["key"] == "on_sale")
    assert sale["title"] == "Up to 40% Off"
    assert sale["subtitle"] == "2 styles on sale"


def test_new_collection_promo_needs_six_products(client, db_session, shop_a, category_a):
    for i in range(5):
        _product(db_session, shop_a, category_a, days_old=90, name=f"Old {i}")
    body = client.get(f"/api/public/shops/{shop_a.slug}").json()
    assert "new_collection" not in [p["key"] for p in body["promos"]]

    _product(db_session, shop_a, category_a, days_old=90, name="Old 5")
    body = client.get(f"/api/public/shops/{shop_a.slug}").json()
    assert "new_collection" in [p["key"] for p in body["promos"]]


# --- product filters ---------------------------------------------


def test_discounted_filter(client, db_session, shop_a, category_a):
    _product(db_session, shop_a, category_a, name="Plain")
    _product(db_session, shop_a, category_a, name="Discounted", discount_percent=20)
    body = client.get(
        f"/api/public/shops/{shop_a.slug}/products", params={"discounted": "true"}
    ).json()
    assert [i["name"] for i in body["items"]] == ["Discounted"]


def test_new_within_days_filter(client, db_session, shop_a, category_a):
    _product(db_session, shop_a, category_a, name="Recent", days_old=3)
    _product(db_session, shop_a, category_a, name="Ancient", days_old=100)
    body = client.get(
        f"/api/public/shops/{shop_a.slug}/products", params={"new_within_days": 21}
    ).json()
    assert [i["name"] for i in body["items"]] == ["Recent"]


# --- theme: font pairs ------------------------------------------


def test_list_font_pairs(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/font-pairs", headers=headers)
    assert resp.status_code == 200
    keys = [p["key"] for p in resp.json()]
    assert "modern-sans" in keys and "classic-serif" in keys


def test_theme_font_pair_override_flows_to_public(client, db_session, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme",
        json={"preset": "royal-maroon", "font_pair": "modern-sans"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["theme_resolved"]["heading_font"] == "Poppins"

    public = client.get(f"/api/public/shops/{shop_a.slug}").json()
    assert public["theme"]["heading_font"] == "Poppins"
    assert public["theme"]["body_font"] == "Poppins"


def test_theme_rejects_unknown_font_pair(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}/theme",
        json={"preset": "royal-maroon", "font_pair": "comic-sans-forever"},
        headers=headers,
    )
    assert resp.status_code == 422


# --- shop logo upload -----------------------------------------


def test_upload_and_delete_shop_logo(client, db_session, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        f"/api/super-admin/shops/{shop_a.id}/logo",
        headers=headers,
        files={"file": ("logo.jpg", BytesIO(tiny_jpeg_bytes()), "image/jpeg")},
    )
    assert resp.status_code == 200, resp.text
    url = resp.json()["shop"]["logo_url"]
    assert url

    resp = client.delete(f"/api/super-admin/shops/{shop_a.id}/logo", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["shop"]["logo_url"] is None


def test_upload_logo_rejects_non_image(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        f"/api/super-admin/shops/{shop_a.id}/logo",
        headers=headers,
        files={"file": ("evil.txt", BytesIO(b"not an image"), "text/plain")},
    )
    assert resp.status_code == 422
