"""Integration tests for shop-scoped category CRUD (Phase 4).

Covers: CRUD happy paths, name-uniqueness-per-shop, ON DELETE RESTRICT
surfaced as a friendly 409 (not a raw IntegrityError), shop isolation, and
Super Admin access on behalf of a shop.
"""

from app.models import Category, CatalogActivity
from tests.conftest import auth_headers


def _owner_a_headers(client, owner_a):
    return auth_headers(client, owner_a.email, "OwnerA123!")


def _owner_b_headers(client, owner_b):
    return auth_headers(client, owner_b.email, "OwnerB123!")


def _admin_headers(client, super_admin):
    return auth_headers(client, super_admin.email, "Admin123!")


# --- Authorization -------------------------------------------------------


def test_categories_list_requires_authentication(client, shop_a):
    resp = client.get(f"/api/shops/{shop_a.id}/categories")
    assert resp.status_code == 401


def test_shop_owner_cannot_list_another_shops_categories(client, shop_b, owner_a):
    resp = client.get(f"/api/shops/{shop_b.id}/categories", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404


def test_shop_owner_cannot_create_category_for_another_shop(client, shop_b, owner_a):
    resp = client.post(
        f"/api/shops/{shop_b.id}/categories",
        json={"name": "Intruder Category"},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 404


def test_super_admin_can_manage_any_shops_categories(client, shop_a, super_admin):
    headers = _admin_headers(client, super_admin)
    resp = client.post(
        f"/api/shops/{shop_a.id}/categories", json={"name": "Lehengas"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    category_id = resp.json()["id"]

    resp = client.get(f"/api/shops/{shop_a.id}/categories", headers=headers)
    assert resp.status_code == 200
    assert any(c["id"] == category_id for c in resp.json())


# --- CRUD ------------------------------------------------------------------


def test_list_categories_empty(client, shop_a, owner_a):
    resp = client.get(f"/api/shops/{shop_a.id}/categories", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_category_success(client, db_session, shop_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/categories",
        json={"name": "Silk Sarees", "description": "Premium silk", "display_order": 1},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Silk Sarees"
    assert body["description"] == "Premium silk"
    assert body["display_order"] == 1
    assert body["is_active"] is True
    assert body["product_count"] == 0
    assert body["shop_id"] == shop_a.id

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "CATEGORY_CREATED")
        .all()
    )
    assert len(activity) == 1


def test_create_category_duplicate_name_conflicts(client, shop_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(f"/api/shops/{shop_a.id}/categories", json={"name": "Silk Sarees"}, headers=headers)
    resp = client.post(f"/api/shops/{shop_a.id}/categories", json={"name": "Silk Sarees"}, headers=headers)
    assert resp.status_code == 409


def test_same_category_name_allowed_in_different_shops(client, shop_a, shop_b, owner_a, owner_b):
    resp_a = client.post(
        f"/api/shops/{shop_a.id}/categories", json={"name": "Silk Sarees"}, headers=_owner_a_headers(client, owner_a)
    )
    resp_b = client.post(
        f"/api/shops/{shop_b.id}/categories", json={"name": "Silk Sarees"}, headers=_owner_b_headers(client, owner_b)
    )
    assert resp_a.status_code == 201
    assert resp_b.status_code == 201


def test_create_category_blank_name_rejected(client, shop_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/categories", json={"name": ""}, headers=_owner_a_headers(client, owner_a)
    )
    assert resp.status_code == 422


def test_update_category_success(client, db_session, category_a, owner_a):
    resp = client.put(
        f"/api/shops/{category_a.shop_id}/categories/{category_a.id}",
        json={"description": "Updated description", "is_active": False},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["description"] == "Updated description"
    assert body["is_active"] is False
    assert body["name"] == category_a.name  # untouched

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == category_a.shop_id, CatalogActivity.action == "CATEGORY_UPDATED")
        .all()
    )
    assert len(activity) == 1


def test_update_category_name_conflict(client, db_session, shop_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(f"/api/shops/{shop_a.id}/categories", json={"name": "Silk Sarees"}, headers=headers)
    resp2 = client.post(f"/api/shops/{shop_a.id}/categories", json={"name": "Cotton Sarees"}, headers=headers)
    cotton_id = resp2.json()["id"]

    resp = client.put(
        f"/api/shops/{shop_a.id}/categories/{cotton_id}",
        json={"name": "Silk Sarees"},
        headers=headers,
    )
    assert resp.status_code == 409


def test_update_nonexistent_category_404(client, shop_a, owner_a):
    resp = client.put(
        f"/api/shops/{shop_a.id}/categories/999999",
        json={"name": "New name"},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 404


def test_delete_category_success(client, db_session, category_a, owner_a):
    resp = client.delete(
        f"/api/shops/{category_a.shop_id}/categories/{category_a.id}",
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 204
    assert db_session.query(Category).filter(Category.id == category_a.id).first() is None


def test_delete_category_with_products_returns_409(client, db_session, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    # Created through the API (which commits) rather than flushed directly,
    # so this fixture data survives the db.rollback() the failing DELETE
    # below triggers -- a rollback only undoes writes made since the last
    # commit, and a real "category with products" always got there via
    # separate, already-committed requests.
    create = client.post(
        f"/api/shops/{category_a.shop_id}/products",
        json={"name": "Test Saree", "category_id": category_a.id, "price": 1000},
        headers=headers,
    )
    assert create.status_code == 201, create.text

    resp = client.delete(
        f"/api/shops/{category_a.shop_id}/categories/{category_a.id}",
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 409
    assert "1 product" in resp.json()["detail"]
    # Category must still exist -- RESTRICT semantics preserved.
    assert db_session.query(Category).filter(Category.id == category_a.id).first() is not None


def test_shop_owner_cannot_delete_another_shops_category(client, category_b, owner_a):
    resp = client.delete(
        f"/api/shops/{category_b.shop_id}/categories/{category_b.id}",
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 404
