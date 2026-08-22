"""Integration tests for the shop-owner dashboard + profile settings
endpoints (Phase 4) -- /api/shops/{shop_id}/dashboard and /profile.
"""

from tests.conftest import auth_headers


def _owner_a_headers(client, owner_a):
    return auth_headers(client, owner_a.email, "OwnerA123!")


def _owner_b_headers(client, owner_b):
    return auth_headers(client, owner_b.email, "OwnerB123!")


def test_dashboard_requires_authentication(client, shop_a):
    resp = client.get(f"/api/shops/{shop_a.id}/dashboard")
    assert resp.status_code == 401


def test_dashboard_stats(client, shop_a, category_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    client.post(
        f"/api/shops/{shop_a.id}/products",
        json={"name": "Saree 1", "category_id": category_a.id, "price": 1000},
        headers=headers,
    )
    second = client.post(
        f"/api/shops/{shop_a.id}/products",
        json={"name": "Saree 2", "category_id": category_a.id, "price": 2000},
        headers=headers,
    ).json()
    client.patch(f"/api/shops/{shop_a.id}/products/{second['id']}/status", json={"status": "SOLD"}, headers=headers)

    resp = client.get(f"/api/shops/{shop_a.id}/dashboard", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["product_count"] == 2
    assert body["products_available"] == 1
    assert body["products_sold"] == 1
    assert body["products_out_of_stock"] == 0
    assert body["products_added_this_week"] == 2
    assert body["subscription_status"] == "TRIAL"
    assert "days remaining" in body["trial_status_label"] or body["trial_status_label"] == "Trial expired"


def test_shop_owner_cannot_view_another_shops_dashboard(client, shop_b, owner_a):
    resp = client.get(f"/api/shops/{shop_b.id}/dashboard", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404


def test_get_and_update_profile(client, shop_a, owner_a):
    headers = _owner_a_headers(client, owner_a)
    resp = client.get(f"/api/shops/{shop_a.id}/profile", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == shop_a.name

    update = client.put(
        f"/api/shops/{shop_a.id}/profile",
        json={"phone": "+91 90000 00000", "city": "Jaipur"},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["phone"] == "+91 90000 00000"
    assert update.json()["city"] == "Jaipur"


def test_shop_owner_cannot_update_another_shops_profile(client, shop_b, owner_a):
    resp = client.put(
        f"/api/shops/{shop_b.id}/profile", json={"city": "Hacked"}, headers=_owner_a_headers(client, owner_a)
    )
    assert resp.status_code == 404
