"""Integration tests for the shop-owner dashboard + profile settings
endpoints (Phase 4) -- /api/shops/{shop_id}/dashboard and /profile --
plus the Phase 6 pilot analytics endpoint, /api/shops/{shop_id}/analytics.
"""

from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType
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


# --- Analytics (Phase 6) -------------------------------------------------


def _record_event(db_session, shop, event_type, *, product=None, category=None, search_query=None, days_ago=0):
    from datetime import datetime, timedelta

    event = CustomerEvent(
        shop_id=shop.id,
        product_id=product.id if product else None,
        category_id=category.id if category else None,
        event_type=event_type,
        search_query=search_query,
        created_at=datetime.utcnow() - timedelta(days=days_ago),
    )
    db_session.add(event)
    db_session.flush()
    return event


def _make_product(db_session, shop, category, **overrides):
    from app.models.product import Product

    defaults = dict(shop_id=shop.id, category_id=category.id, name="Banarasi Silk Saree", price=8500.00)
    defaults.update(overrides)
    product = Product(**defaults)
    db_session.add(product)
    db_session.flush()
    return product


def test_analytics_requires_authentication(client, shop_a):
    resp = client.get(f"/api/shops/{shop_a.id}/analytics")
    assert resp.status_code == 401


def test_shop_owner_cannot_view_another_shops_analytics(client, shop_b, owner_a):
    resp = client.get(f"/api/shops/{shop_b.id}/analytics", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 404


def test_analytics_counts_and_top_lists(client, shop_a, category_a, owner_a, db_session):
    product = _make_product(db_session, shop_a, category_a, name="Kanjivaram Silk Saree")

    _record_event(db_session, shop_a, CustomerEventType.SHOP_VIEW)
    _record_event(db_session, shop_a, CustomerEventType.SHOP_VIEW)
    _record_event(db_session, shop_a, CustomerEventType.PRODUCT_VIEW, product=product)
    _record_event(db_session, shop_a, CustomerEventType.PRODUCT_VIEW, product=product)
    _record_event(db_session, shop_a, CustomerEventType.CATEGORY_VIEW, category=category_a)
    _record_event(db_session, shop_a, CustomerEventType.SEARCH, search_query="Saree")
    _record_event(db_session, shop_a, CustomerEventType.SEARCH, search_query="saree")
    _record_event(db_session, shop_a, CustomerEventType.SEARCH, search_query="lehenga")

    resp = client.get(f"/api/shops/{shop_a.id}/analytics", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["shop_views_total"] == 2
    assert body["product_views_total"] == 2
    assert body["searches_total"] == 3

    assert body["top_products"] == [
        {
            "product_id": product.id,
            "name": product.name,
            "primary_image_url": None,
            "view_count": 2,
        }
    ]
    assert body["top_categories"] == [
        {"category_id": category_a.id, "name": category_a.name, "view_count": 1}
    ]
    # "Saree" and "saree" are the same search, grouped case-insensitively.
    top_searches = {row["term"]: row["count"] for row in body["top_searches"]}
    assert top_searches == {"saree": 2, "lehenga": 1}


def test_analytics_last_7_days_excludes_older_events(client, shop_a, owner_a, db_session):
    _record_event(db_session, shop_a, CustomerEventType.SHOP_VIEW, days_ago=0)
    _record_event(db_session, shop_a, CustomerEventType.SHOP_VIEW, days_ago=10)

    resp = client.get(f"/api/shops/{shop_a.id}/analytics", headers=_owner_a_headers(client, owner_a))
    body = resp.json()
    assert body["shop_views_total"] == 2
    assert body["shop_views_last_7_days"] == 1


def test_analytics_ignores_other_shops_events(client, shop_a, shop_b, owner_a, db_session):
    _record_event(db_session, shop_a, CustomerEventType.SHOP_VIEW)
    _record_event(db_session, shop_b, CustomerEventType.SHOP_VIEW)
    _record_event(db_session, shop_b, CustomerEventType.SHOP_VIEW)

    resp = client.get(f"/api/shops/{shop_a.id}/analytics", headers=_owner_a_headers(client, owner_a))
    assert resp.json()["shop_views_total"] == 1


def test_analytics_with_no_events_returns_zeroes_and_empty_lists(client, shop_a, owner_a):
    resp = client.get(f"/api/shops/{shop_a.id}/analytics", headers=_owner_a_headers(client, owner_a))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["shop_views_total"] == 0
    assert body["top_products"] == []
    assert body["top_searches"] == []
    assert body["top_categories"] == []
