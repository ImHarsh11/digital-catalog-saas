"""Integration tests for the Super Admin API (Phase 3).

Covers: role enforcement on every route, shop creation (auto trial +
owner account), listing, detail (+ recent activity), profile update,
activate/deactivate, dashboard stats, and (Phase 6) shop QR-code
generation.
"""

from datetime import date, timedelta

from app.models import Product, ProductStatus, Shop, SubscriptionStatus
from tests.conftest import auth_headers

# --- Authorization -------------------------------------------------------


def test_shops_list_requires_authentication(client):
    resp = client.get("/api/super-admin/shops")
    assert resp.status_code == 401


def test_shops_list_rejects_shop_owner(client, owner_a):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.get("/api/super-admin/shops", headers=headers)
    assert resp.status_code == 403


def test_dashboard_rejects_shop_owner(client, owner_a):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.get("/api/super-admin/dashboard", headers=headers)
    assert resp.status_code == 403


def test_create_shop_rejects_shop_owner(client, owner_a):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "New Shop",
            "owner_name": "New Owner",
            "owner_email": "new-owner@test.com",
            "owner_password": "Password123!",
        },
        headers=headers,
    )
    assert resp.status_code == 403


# --- Shop creation ---------------------------------------------------------


def test_create_shop_success(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Rina Fashions",
            "description": "Silk sarees and lehengas.",
            "city": "Pune",
            "owner_name": "Rina Shah",
            "owner_email": "rina@test.com",
            "owner_password": "RinaPass123!",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    shop = body["shop"]
    assert shop["name"] == "Rina Fashions"
    assert shop["slug"] == "rina-fashions"
    assert shop["is_active"] is True
    assert shop["subscription_status"] == "TRIAL"
    assert shop["product_count"] == 0
    assert shop["owner"]["email"] == "rina@test.com"

    # 14-day trial started automatically.
    expected_end = (date.today() + timedelta(days=14)).isoformat()
    assert shop["trial_end_date"] == expected_end
    assert shop["trial_days_remaining"] == 14

    owner = body["owner"]
    assert owner["email"] == "rina@test.com"
    assert owner["role"] == "SHOP_OWNER"
    assert owner["shop_id"] == shop["id"]
    assert owner["is_active"] is True
    # Password must never be echoed back.
    assert "password" not in owner
    assert "password_hash" not in owner


def test_create_shop_owner_can_immediately_log_in(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    create_resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Lakshmi Textiles",
            "owner_name": "Lakshmi Rao",
            "owner_email": "lakshmi@test.com",
            "owner_password": "LakshmiPass1!",
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    shop_id = create_resp.json()["shop"]["id"]

    login_resp = client.post(
        "/api/auth/login", json={"email": "lakshmi@test.com", "password": "LakshmiPass1!"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_body = me_resp.json()
    assert me_body["user"]["role"] == "SHOP_OWNER"
    assert me_body["shop"]["id"] == shop_id
    assert me_body["shop"]["trial_status_label"] == "14 days remaining"


def test_create_shop_with_explicit_slug(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Anything",
            "slug": "custom-url",
            "owner_name": "Owner",
            "owner_email": "custom@test.com",
            "owner_password": "CustomPass1!",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["shop"]["slug"] == "custom-url"


def test_create_shop_duplicate_slug_is_rejected(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Different Name",
            "slug": shop_a.slug,
            "owner_name": "Owner",
            "owner_email": "another@test.com",
            "owner_password": "AnotherPass1!",
        },
        headers=headers,
    )
    assert resp.status_code == 409


def test_create_shop_auto_generated_slug_dedupes_on_collision(client, super_admin, shop_a):
    # shop_a fixture has name "Shop A" -> slug "shop-a" already taken.
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Shop A",
            "owner_name": "Second Owner",
            "owner_email": "second-shop-a@test.com",
            "owner_password": "SecondPass1!",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["shop"]["slug"] == "shop-a-2"


def test_create_shop_duplicate_owner_email_is_rejected(client, super_admin, owner_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Some Shop",
            "owner_name": "Owner",
            "owner_email": "ownera@test.com",  # already owner_a's email
            "owner_password": "SomePass123!",
        },
        headers=headers,
    )
    assert resp.status_code == 409


def test_create_shop_rejects_invalid_email(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Some Shop",
            "owner_name": "Owner",
            "owner_email": "not-an-email",
            "owner_password": "SomePass123!",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_create_shop_rejects_short_password(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        "/api/super-admin/shops",
        json={
            "name": "Some Shop",
            "owner_name": "Owner",
            "owner_email": "shortpw@test.com",
            "owner_password": "short",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_create_shop_rejects_missing_required_fields(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post("/api/super-admin/shops", json={"name": "No Owner Info"}, headers=headers)
    assert resp.status_code == 422


# --- List shops --------------------------------------------------------


def test_list_shops_empty_state(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/shops", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_shops_includes_owner_and_product_count(
    client, db_session, super_admin, shop_a, owner_a
):
    category_id = _make_category(db_session, shop_a.id, "Sarees")
    _make_product(db_session, shop_a.id, category_id, "P1")
    _make_product(db_session, shop_a.id, category_id, "P2")
    db_session.flush()

    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/shops", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["slug"] == "shop-a"
    assert items[0]["owner"]["email"] == "ownera@test.com"
    assert items[0]["product_count"] == 2


# --- Shop detail --------------------------------------------------------


def test_get_shop_detail_not_found(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/shops/999999", headers=headers)
    assert resp.status_code == 404


def test_get_shop_detail_stats_and_empty_activity(
    client, db_session, super_admin, shop_a, owner_a
):
    category_id = _make_category(db_session, shop_a.id, "Sarees")
    _make_product(db_session, shop_a.id, category_id, "AVAIL", status=ProductStatus.AVAILABLE)
    _make_product(db_session, shop_a.id, category_id, "SOLD1", status=ProductStatus.SOLD)
    _make_product(
        db_session, shop_a.id, category_id, "OOS1", status=ProductStatus.OUT_OF_STOCK
    )
    db_session.flush()

    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get(f"/api/super-admin/shops/{shop_a.id}", headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    shop = body["shop"]
    assert shop["product_count"] == 3
    assert shop["products_available"] == 1
    assert shop["products_sold"] == 1
    assert shop["products_out_of_stock"] == 1
    assert shop["products_added_this_week"] == 3
    assert body["recent_activity"] == []


def test_shop_update_appears_in_recent_activity(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    put_resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}", json={"city": "Chennai"}, headers=headers
    )
    assert put_resp.status_code == 200

    detail_resp = client.get(f"/api/super-admin/shops/{shop_a.id}", headers=headers)
    activity = detail_resp.json()["recent_activity"]
    assert len(activity) == 1
    assert activity[0]["action"] == "SHOP_UPDATED"


# --- Update shop ---------------------------------------------------------


def test_update_shop_success(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}",
        json={"name": "Shop A Renamed", "phone": "+91 90000 00000"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Shop A Renamed"
    assert body["phone"] == "+91 90000 00000"
    assert body["slug"] == "shop-a"  # unchanged


def test_update_shop_ignores_slug_field(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        f"/api/super-admin/shops/{shop_a.id}",
        json={"name": "New Name", "slug": "attempted-new-slug"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["slug"] == "shop-a"


def test_update_shop_not_found(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.put(
        "/api/super-admin/shops/999999", json={"name": "Nope"}, headers=headers
    )
    assert resp.status_code == 404


# --- Activate / deactivate ------------------------------------------------


def test_deactivate_and_reactivate_shop(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")

    deactivate_resp = client.patch(
        f"/api/super-admin/shops/{shop_a.id}/status", json={"is_active": False}, headers=headers
    )
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["is_active"] is False

    reactivate_resp = client.patch(
        f"/api/super-admin/shops/{shop_a.id}/status", json={"is_active": True}, headers=headers
    )
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["is_active"] is True


def test_status_update_not_found(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.patch(
        "/api/super-admin/shops/999999/status", json={"is_active": False}, headers=headers
    )
    assert resp.status_code == 404


# --- Dashboard stats -------------------------------------------------------


def test_dashboard_counts(client, db_session, super_admin, shop_a, shop_b):
    # shop_a and shop_b are both active, live 14-day trials (from fixtures).
    expired_shop = Shop(
        name="Expired Trial Shop",
        slug="expired-trial-shop",
        is_active=True,
        trial_start_date=date.today() - timedelta(days=30),
        trial_end_date=date.today() - timedelta(days=16),
        subscription_status=SubscriptionStatus.TRIAL,
    )
    inactive_shop = Shop(
        name="Deactivated Shop",
        slug="deactivated-shop",
        is_active=False,
        trial_start_date=date.today(),
        trial_end_date=date.today() + timedelta(days=14),
        subscription_status=SubscriptionStatus.TRIAL,
    )
    db_session.add_all([expired_shop, inactive_shop])
    db_session.flush()

    category_id = _make_category(db_session, shop_a.id, "Sarees")
    _make_product(db_session, shop_a.id, category_id, "P1")
    _make_product(db_session, shop_a.id, category_id, "P2")
    db_session.flush()

    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/dashboard", headers=headers)
    assert resp.status_code == 200
    stats = resp.json()

    assert stats["total_shops"] == 4  # shop_a, shop_b, expired_shop, inactive_shop
    assert stats["active_shops"] == 3  # all but inactive_shop
    assert stats["trial_shops"] == 3  # shop_a, shop_b, inactive_shop (still within 14 days)
    assert stats["expired_trials"] == 1  # expired_shop
    assert stats["total_products"] == 2
    assert stats["products_added_this_week"] == 2


# --- QR code (Phase 6) ------------------------------------------------------


def test_qr_code_requires_authentication(client, shop_a):
    resp = client.get(f"/api/super-admin/shops/{shop_a.id}/qr-code")
    assert resp.status_code == 401


def test_qr_code_rejects_shop_owner(client, owner_a, shop_a):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.get(f"/api/super-admin/shops/{shop_a.id}/qr-code", headers=headers)
    assert resp.status_code == 403


def test_qr_code_returns_png_image(client, super_admin, shop_a):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get(f"/api/super-admin/shops/{shop_a.id}/qr-code", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/png"
    # A real PNG, not an empty/placeholder response.
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(resp.content) > 100


def test_qr_code_unknown_shop_returns_404(client, super_admin):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/shops/999999/qr-code", headers=headers)
    assert resp.status_code == 404


def test_qr_code_uses_the_shops_current_slug(client, super_admin, shop_a):
    """The URL a QR code encodes isn't asserted by decoding the image (no
    scanning library dependency needed) -- instead `build_shop_catalog_url`
    is checked directly, and this confirms the endpoint 200s per-shop."""
    from app.services.qr import build_shop_catalog_url

    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get(f"/api/super-admin/shops/{shop_a.id}/qr-code", headers=headers)
    assert resp.status_code == 200
    assert build_shop_catalog_url(shop_a.slug) == f"http://localhost:5173/shop/{shop_a.slug}"


# --- helpers ---------------------------------------------------------------


def _make_category(db_session, shop_id: int, name: str) -> int:
    from app.models import Category

    category = Category(shop_id=shop_id, name=name, display_order=0, is_active=True)
    db_session.add(category)
    db_session.flush()
    return category.id


def _make_product(
    db_session,
    shop_id: int,
    category_id: int,
    code: str,
    status: ProductStatus = ProductStatus.AVAILABLE,
) -> Product:
    product = Product(
        shop_id=shop_id,
        category_id=category_id,
        product_code=code,
        name=f"Product {code}",
        price="1000.00",
        status=status,
    )
    db_session.add(product)
    db_session.flush()
    return product
