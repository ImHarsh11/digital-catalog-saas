"""Integration tests for shop-scoped product CRUD and status changes (Phase 4).

Covers: creation (validation, category-must-belong-to-shop, unique product
code per shop), listing/filtering, updates, status transitions and their
catalog_activity actions, deletion, shop isolation, Super Admin access, and
created_by tracking (shop owner vs. catalog team).
"""

from app.models import CatalogActivity, Product
from tests.conftest import auth_headers


def _owner_a_headers(client, owner_a):
    return auth_headers(client, owner_a.email, "OwnerA123!")


def _owner_b_headers(client, owner_b):
    return auth_headers(client, owner_b.email, "OwnerB123!")


def _admin_headers(client, super_admin):
    return auth_headers(client, super_admin.email, "Admin123!")


def _product_payload(category_id, **overrides):
    payload = {
        "name": "Banarasi Silk Saree",
        "product_code": "BS1001",
        "category_id": category_id,
        "price": 8500.00,
        "description": "Handwoven silk saree.",
    }
    payload.update(overrides)
    return payload


# --- Authorization / shop isolation ---------------------------------------


def test_products_list_requires_authentication(client, shop_a):
    resp = client.get(f"/api/shops/{shop_a.id}/products")
    assert resp.status_code == 401


def test_shop_owner_cannot_list_another_shops_products(client, shop_b, owner_a):
    resp = client.get(f"/api/shops/{shop_b.id}/products", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404


def test_shop_owner_cannot_create_product_for_another_shop(client, shop_b, category_b, owner_a):
    resp = client.post(
        f"/api/shops/{shop_b.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 404


def test_shop_owner_cannot_read_another_shops_product(client, shop_b, category_b, owner_b, owner_a):
    create = client.post(
        f"/api/shops/{shop_b.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_b_headers(client, owner_b),
    )
    product_id = create.json()["id"]

    resp = client.get(f"/api/shops/{shop_b.id}/products/{product_id}", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404


def test_shop_owner_cannot_update_another_shops_product(client, shop_b, category_b, owner_b, owner_a):
    create = client.post(
        f"/api/shops/{shop_b.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_b_headers(client, owner_b),
    )
    product_id = create.json()["id"]

    resp = client.put(
        f"/api/shops/{shop_b.id}/products/{product_id}",
        json={"name": "Hacked name"},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 404


def test_shop_owner_cannot_delete_another_shops_product(client, shop_b, category_b, owner_b, owner_a):
    create = client.post(
        f"/api/shops/{shop_b.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_b_headers(client, owner_b),
    )
    product_id = create.json()["id"]

    resp = client.delete(
        f"/api/shops/{shop_b.id}/products/{product_id}", headers=_owner_a_headers(client, owner_a)
    )
    assert resp.status_code == 404


def test_super_admin_can_manage_any_shops_products(client, shop_a, category_a, super_admin):
    headers = _admin_headers(client, super_admin)
    create = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    )
    assert create.status_code == 201, create.text
    product_id = create.json()["id"]
    assert create.json()["created_by"]["role"] == "SUPER_ADMIN"

    resp = client.get(f"/api/shops/{shop_a.id}/products/{product_id}", headers=headers)
    assert resp.status_code == 200


# --- Creation / validation ---------------------------------------------


def test_create_product_success(client, db_session, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Banarasi Silk Saree"
    assert body["product_code"] == "BS1001"
    assert body["price"] == 8500.00
    assert body["status"] == "AVAILABLE"
    assert body["category"]["id"] == category_a.id
    assert body["created_by"]["id"] == owner_a.id
    assert body["created_by"]["role"] == "SHOP_OWNER"
    assert body["images"] == []
    assert body["primary_image_url"] is None

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_CREATED")
        .all()
    )
    assert len(activity) == 1
    assert activity[0].user_id == owner_a.id


def test_create_product_without_code_allowed(client, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, product_code=None),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["product_code"] is None


def test_create_product_duplicate_code_conflicts(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers)
    resp = client.post(f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers)
    assert resp.status_code == 409


def test_same_product_code_allowed_across_different_shops(
    client, shop_a, shop_b, category_a, category_b, owner_a, owner_b
):
    resp_a = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id),
        headers=_owner_a_headers(client, owner_a),
    )
    resp_b = client.post(
        f"/api/shops/{shop_b.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_b_headers(client, owner_b),
    )
    assert resp_a.status_code == 201
    assert resp_b.status_code == 201


def test_create_product_category_from_another_shop_rejected(client, shop_a, category_b, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_b.id),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


def test_create_product_blank_name_rejected(client, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, name=""),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


def test_create_product_zero_price_rejected(client, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, price=0),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


def test_create_product_negative_price_rejected(client, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, price=-5),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


def test_create_product_excessive_price_rejected(client, shop_a, category_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, price=50_000_000),
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


def test_create_product_missing_category_rejected(client, shop_a, owner_a):
    resp = client.post(
        f"/api/shops/{shop_a.id}/products",
        json={"name": "Saree", "price": 100},
        headers=_owner_a_headers(client, owner_a),
    )
    assert resp.status_code == 422


# --- Listing / filtering -------------------------------------------------


def test_list_and_filter_products(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, name="Banarasi Silk Saree", product_code="BS1"),
        headers=headers,
    )
    sold = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, name="Kanjivaram Silk Saree", product_code="BS2"),
        headers=headers,
    ).json()
    client.patch(
        f"/api/shops/{shop_a.id}/products/{sold['id']}/status", json={"status": "SOLD"}, headers=headers
    )

    resp_all = client.get(f"/api/shops/{shop_a.id}/products", headers=headers)
    assert resp_all.status_code == 200
    assert len(resp_all.json()) == 2

    resp_status = client.get(f"/api/shops/{shop_a.id}/products?status=SOLD", headers=headers)
    assert len(resp_status.json()) == 1
    assert resp_status.json()[0]["name"] == "Kanjivaram Silk Saree"

    resp_search = client.get(f"/api/shops/{shop_a.id}/products?search=Kanjivaram", headers=headers)
    assert len(resp_search.json()) == 1

    resp_code_search = client.get(f"/api/shops/{shop_a.id}/products?search=BS1", headers=headers)
    assert len(resp_code_search.json()) == 1
    assert resp_code_search.json()[0]["product_code"] == "BS1"

    resp_category = client.get(
        f"/api/shops/{shop_a.id}/products?category_id={category_a.id}", headers=headers
    )
    assert len(resp_category.json()) == 2


def test_list_products_empty_state(client, shop_a, owner_a):
    resp = client.get(f"/api/shops/{shop_a.id}/products", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 200
    assert resp.json() == []


# --- Update ----------------------------------------------------------------


def test_update_product_success(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()

    resp = client.put(
        f"/api/shops/{shop_a.id}/products/{created['id']}",
        json={"price": 9200.00, "description": "Updated description"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["price"] == 9200.00
    assert body["description"] == "Updated description"
    assert body["name"] == created["name"]  # untouched

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_UPDATED")
        .all()
    )
    assert len(activity) == 1


def test_update_product_code_conflict(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, product_code="CODE1"),
        headers=headers,
    )
    second = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, product_code="CODE2"),
        headers=headers,
    ).json()

    resp = client.put(
        f"/api/shops/{shop_a.id}/products/{second['id']}",
        json={"product_code": "CODE1"},
        headers=headers,
    )
    assert resp.status_code == 409


def test_update_product_can_keep_its_own_code(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products",
        json=_product_payload(category_a.id, product_code="CODE1"),
        headers=headers,
    ).json()

    resp = client.put(
        f"/api/shops/{shop_a.id}/products/{created['id']}",
        json={"product_code": "CODE1", "price": 1234},
        headers=headers,
    )
    assert resp.status_code == 200


def test_update_product_category_must_belong_to_shop(client, shop_a, category_a, category_b, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()

    resp = client.put(
        f"/api/shops/{shop_a.id}/products/{created['id']}",
        json={"category_id": category_b.id},
        headers=headers,
    )
    assert resp.status_code == 422


# --- Status changes ---------------------------------------------------------


def test_mark_product_sold(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()

    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{created['id']}/status",
        json={"status": "SOLD"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "SOLD"

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_MARKED_SOLD")
        .all()
    )
    assert len(activity) == 1


def test_mark_product_out_of_stock_then_available(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()

    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{created['id']}/status",
        json={"status": "OUT_OF_STOCK"},
        headers=headers,
    )
    assert resp.json()["status"] == "OUT_OF_STOCK"

    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{created['id']}/status",
        json={"status": "AVAILABLE"},
        headers=headers,
    )
    assert resp.json()["status"] == "AVAILABLE"

    actions = {
        a.action
        for a in db_session.query(CatalogActivity).filter(CatalogActivity.shop_id == shop_a.id).all()
    }
    assert "PRODUCT_MARKED_OUT_OF_STOCK" in actions
    assert "PRODUCT_MARKED_AVAILABLE" in actions


def test_setting_same_status_does_not_duplicate_activity(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()
    # Product is already AVAILABLE by default -- setting it again should be a no-op.
    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{created['id']}/status",
        json={"status": "AVAILABLE"},
        headers=headers,
    )
    assert resp.status_code == 200

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_MARKED_AVAILABLE")
        .all()
    )
    assert len(activity) == 0


# --- Delete ------------------------------------------------------------------


def test_delete_product_success(client, db_session, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    created = client.post(
        f"/api/shops/{shop_a.id}/products", json=_product_payload(category_a.id), headers=headers
    ).json()

    resp = client.delete(f"/api/shops/{shop_a.id}/products/{created['id']}", headers=headers)
    assert resp.status_code == 204
    assert db_session.query(Product).filter(Product.id == created["id"]).first() is None

    activity = (
        db_session.query(CatalogActivity)
        .filter(CatalogActivity.shop_id == shop_a.id, CatalogActivity.action == "PRODUCT_DELETED")
        .all()
    )
    assert len(activity) == 1
    assert activity[0].product_id is None  # FK ON DELETE SET NULL
    assert activity[0].activity_metadata["product_name"] == created["name"]


def test_delete_nonexistent_product_404(client, shop_a, owner_a):
    resp = client.delete(f"/api/shops/{shop_a.id}/products/999999", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404
