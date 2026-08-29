"""Phase 7 -- device-keyed unique visitors + SHOP_VIEW dedup, and the
per-piece "record a sale" stock flow.
"""

from datetime import datetime, timedelta, timezone

from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType, ProductStatus
from app.models.product import Product
from app.services import public_catalog as catalog_service

from tests.conftest import auth_headers

SESS = {"X-Anon-Session-Id": "sess-1"}
DEV = {"X-Device-Id": "device-1"}
BOTH = {**SESS, **DEV}


def _product(db_session, shop, category, **kw):
    defaults = dict(
        shop_id=shop.id, category_id=category.id, name="Saree",
        price=5000.00, status=ProductStatus.AVAILABLE, quantity_available=kw.pop("qty", 3),
    )
    defaults.update(kw)
    p = Product(**defaults)
    db_session.add(p)
    db_session.flush()
    return p


# --- visitor analytics ------------------------------------------


def test_shop_view_deduped_within_session(client, db_session, shop_a, category_a):
    for _ in range(4):
        client.get(f"/api/public/shops/{shop_a.slug}", headers=BOTH)
    views = (
        db_session.query(CustomerEvent)
        .filter(CustomerEvent.shop_id == shop_a.id, CustomerEvent.event_type == CustomerEventType.SHOP_VIEW)
        .count()
    )
    assert views == 1


def test_shop_view_records_device_id(client, db_session, shop_a):
    client.get(f"/api/public/shops/{shop_a.slug}", headers=BOTH)
    ev = (
        db_session.query(CustomerEvent)
        .filter(CustomerEvent.event_type == CustomerEventType.SHOP_VIEW)
        .first()
    )
    assert ev.device_id == "device-1"
    assert ev.anonymous_session_id == "sess-1"


def test_unique_visitors_count_by_device_not_session(client, db_session, shop_a, category_a, owner_a):
    # Same device, three different tab-sessions (three fresh QR scans)
    for i in range(3):
        client.get(
            f"/api/public/shops/{shop_a.slug}",
            headers={"X-Anon-Session-Id": f"sess-{i}", "X-Device-Id": "same-phone"},
        )
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    rich = client.get(f"/api/shops/{shop_a.id}/analytics/rich?period=30d", headers=headers).json()
    assert rich["visits"]["current"] == 3          # three genuine sessions
    assert rich["unique_visitors"]["current"] == 1  # one phone


# --- stock: record a sale --------------------------------------


def test_sell_one_decrements_and_stays_available(client, db_session, shop_a, category_a, owner_a):
    p = _product(db_session, shop_a, category_a, qty=3)
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    resp = client.patch(
        f"/api/shops/{shop_a.id}/products/{p.id}/stock", json={"action": "sell"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["quantity_available"] == 2
    assert body["status"] == "AVAILABLE"


def test_selling_last_unit_marks_sold(client, db_session, shop_a, category_a, owner_a):
    p = _product(db_session, shop_a, category_a, qty=1)
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    body = client.patch(
        f"/api/shops/{shop_a.id}/products/{p.id}/stock", json={"action": "sell"}, headers=headers
    ).json()
    assert body["quantity_available"] == 0
    assert body["status"] == "SOLD"

    # still listed publicly, just marked unavailable
    pub = client.get(f"/api/public/shops/{shop_a.slug}/products").json()
    assert pub["total"] == 1
    assert pub["items"][0]["status"] == "SOLD"


def test_restock_a_sold_product_makes_it_live(client, db_session, shop_a, category_a, owner_a):
    p = _product(db_session, shop_a, category_a, qty=1, status=ProductStatus.SOLD)
    p.quantity_available = 0
    db_session.flush()
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    body = client.patch(
        f"/api/shops/{shop_a.id}/products/{p.id}/stock", json={"action": "add", "count": 5}, headers=headers
    ).json()
    assert body["quantity_available"] == 5
    assert body["status"] == "AVAILABLE"


def test_each_unit_sold_is_one_sale_in_analytics(client, db_session, shop_a, category_a, owner_a):
    p = _product(db_session, shop_a, category_a, qty=5)
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    client.patch(
        f"/api/shops/{shop_a.id}/products/{p.id}/stock", json={"action": "sell", "count": 3}, headers=headers
    )
    rich = client.get(f"/api/shops/{shop_a.id}/analytics/rich?period=30d", headers=headers).json()
    assert rich["products_sold"]["current"] == 3


def test_cannot_oversell(client, db_session, shop_a, category_a, owner_a):
    p = _product(db_session, shop_a, category_a, qty=2)
    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    body = client.patch(
        f"/api/shops/{shop_a.id}/products/{p.id}/stock", json={"action": "sell", "count": 10}, headers=headers
    ).json()
    assert body["quantity_available"] == 0
    assert body["status"] == "SOLD"
