"""Integration tests for the public, unauthenticated customer catalog
(Phase 5): shop-by-slug lookup, product listing/search/filter/sort,
product detail, shop isolation, inactive-shop behavior, and anonymous
customer_events creation.

None of these requests carry an Authorization header -- that's the point:
a customer never logs in. Products are created directly against
`db_session` (not through the shop-owner API) so tests can control
`status`/`created_at`/price precisely for filter/sort assertions.
"""

from datetime import datetime, timedelta

from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType, ProductStatus
from app.models.product import Product

BASE_TIME = datetime(2026, 1, 1, 12, 0, 0)


def _make_product(db_session, shop, category, *, offset_minutes=0, **overrides):
    defaults = dict(
        shop_id=shop.id,
        category_id=category.id,
        name="Banarasi Silk Saree",
        product_code=None,
        price=8500.00,
        description="Handwoven silk saree.",
        status=ProductStatus.AVAILABLE,
        created_at=BASE_TIME + timedelta(minutes=offset_minutes),
    )
    defaults.update(overrides)
    product = Product(**defaults)
    db_session.add(product)
    db_session.flush()
    return product


# --- Shop lookup ------------------------------------------------------------


def test_get_shop_catalog_by_slug(client, shop_a, category_a):
    resp = client.get(f"/api/public/shops/{shop_a.slug}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["shop"]["slug"] == shop_a.slug
    assert body["shop"]["name"] == shop_a.name
    assert body["categories"] == [{"id": category_a.id, "name": category_a.name}]


def test_get_shop_catalog_does_not_expose_admin_fields(client, shop_a):
    resp = client.get(f"/api/public/shops/{shop_a.slug}")
    shop_json = resp.json()["shop"]
    assert set(shop_json.keys()) == {
        "id",
        "name",
        "slug",
        "logo_url",
        "description",
        "phone",
        "address",
        "city",
        "website",
    }
    # No trial, subscription, or is_active leakage of any kind.
    for forbidden in ("subscription_status", "trial_end_date", "trial_days_remaining", "is_active", "created_at"):
        assert forbidden not in shop_json


def test_get_shop_catalog_unknown_slug_returns_404(client):
    resp = client.get("/api/public/shops/no-such-shop")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "We couldn't find this catalog."


def test_get_shop_catalog_inactive_shop_returns_403_generic_message(client, shop_a, db_session):
    shop_a.is_active = False
    db_session.flush()

    resp = client.get(f"/api/public/shops/{shop_a.slug}")
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail == "This catalog is currently unavailable."
    # Never leak *why* -- no mention of suspension/trial/subscription internals.
    assert "trial" not in detail.lower()
    assert "subscription" not in detail.lower()
    assert "suspend" not in detail.lower()


def test_get_shop_catalog_inactive_shop_hides_its_products_endpoint_too(client, shop_a, db_session):
    shop_a.is_active = False
    db_session.flush()
    resp = client.get(f"/api/public/shops/{shop_a.slug}/products")
    assert resp.status_code == 403


# --- Product listing: shop isolation ----------------------------------------


def test_list_products_only_returns_this_shops_products(client, shop_a, shop_b, category_a, category_b, db_session):
    _make_product(db_session, shop_a, category_a, name="Shop A Saree")
    _make_product(db_session, shop_b, category_b, name="Shop B Saree")

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products")
    assert resp.status_code == 200
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Shop A Saree"]


def test_list_products_does_not_expose_admin_fields(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a)
    resp = client.get(f"/api/public/shops/{shop_a.slug}/products")
    item = resp.json()["items"][0]
    assert set(item.keys()) == {
        "id",
        "name",
        "product_code",
        "category",
        "price",
        "status",
        "primary_image_url",
        "quantity_available",
        "discount_percent",
        "color",
        "brand",
    }
    for forbidden in ("created_by", "shop_id", "description", "images"):
        assert forbidden not in item


# --- Search ------------------------------------------------------------------


def test_list_products_search_by_name(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Kanjivaram Silk Saree", product_code="KJ1")
    _make_product(db_session, shop_a, category_a, name="Cotton Kurti", product_code="CK1")

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"search": "kanjivaram"})
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Kanjivaram Silk Saree"]


def test_list_products_search_by_product_code(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Banarasi Silk Saree", product_code="BS1001")
    _make_product(db_session, shop_a, category_a, name="Cotton Kurti", product_code="CK1")

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"search": "bs1001"})
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Banarasi Silk Saree"]


# --- Category filter -----------------------------------------------------


def test_list_products_category_filter(client, shop_a, category_a, db_session):
    from app.models.category import Category

    other_category = Category(shop_id=shop_a.id, name="Lehengas", display_order=1, is_active=True)
    db_session.add(other_category)
    db_session.flush()

    _make_product(db_session, shop_a, category_a, name="In Category A")
    _make_product(db_session, shop_a, other_category, name="In Lehengas")

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"category_id": category_a.id})
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["In Category A"]


# --- Availability filter ------------------------------------------------


def test_list_products_availability_available_only(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Available One", status=ProductStatus.AVAILABLE)
    _make_product(db_session, shop_a, category_a, name="Sold One", status=ProductStatus.SOLD)
    _make_product(db_session, shop_a, category_a, name="OOS One", status=ProductStatus.OUT_OF_STOCK)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"availability": "available"})
    names = {item["name"] for item in resp.json()["items"]}
    assert names == {"Available One"}


def test_list_products_availability_unavailable_groups_sold_and_out_of_stock(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Available One", status=ProductStatus.AVAILABLE)
    _make_product(db_session, shop_a, category_a, name="Sold One", status=ProductStatus.SOLD)
    _make_product(db_session, shop_a, category_a, name="OOS One", status=ProductStatus.OUT_OF_STOCK)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"availability": "unavailable"})
    names = {item["name"] for item in resp.json()["items"]}
    assert names == {"Sold One", "OOS One"}


# --- Sorting ---------------------------------------------------------------


def test_list_products_sort_newest_first_by_default(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Oldest", offset_minutes=0)
    _make_product(db_session, shop_a, category_a, name="Newest", offset_minutes=10)
    _make_product(db_session, shop_a, category_a, name="Middle", offset_minutes=5)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products")
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Newest", "Middle", "Oldest"]


def test_list_products_sort_price_ascending(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Mid", price=5000)
    _make_product(db_session, shop_a, category_a, name="Cheap", price=1000)
    _make_product(db_session, shop_a, category_a, name="Expensive", price=9000)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"sort": "price_asc"})
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Cheap", "Mid", "Expensive"]


def test_list_products_sort_price_descending(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Mid", price=5000)
    _make_product(db_session, shop_a, category_a, name="Cheap", price=1000)
    _make_product(db_session, shop_a, category_a, name="Expensive", price=9000)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"sort": "price_desc"})
    names = [item["name"] for item in resp.json()["items"]]
    assert names == ["Expensive", "Mid", "Cheap"]


# --- Pagination --------------------------------------------------------


def test_list_products_pagination(client, shop_a, category_a, db_session):
    for i in range(5):
        _make_product(db_session, shop_a, category_a, name=f"Product {i}", offset_minutes=i)

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"page": 1, "page_size": 2})
    body = resp.json()
    assert len(body["items"]) == 2
    assert body["total"] == 5
    assert body["has_more"] is True

    resp2 = client.get(f"/api/public/shops/{shop_a.slug}/products", params={"page": 3, "page_size": 2})
    body2 = resp2.json()
    assert len(body2["items"]) == 1
    assert body2["has_more"] is False


# --- Product detail ------------------------------------------------------


def test_get_product_detail(client, shop_a, category_a, db_session):
    product = _make_product(
        db_session, shop_a, category_a, name="Banarasi Silk Saree", product_code="BS1001", price=8500
    )
    resp = client.get(f"/api/public/shops/{shop_a.slug}/products/{product.id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Banarasi Silk Saree"
    assert body["product_code"] == "BS1001"
    assert body["price"] == 8500.0
    assert body["category"] == {"id": category_a.id, "name": category_a.name}
    assert body["images"] == []
    assert set(body.keys()) == {
        "id",
        "name",
        "product_code",
        "category",
        "price",
        "status",
        "primary_image_url",
        "quantity_available",
        "discount_percent",
        "color",
        "brand",
        "description",
        "images",
    }


def test_get_product_detail_wrong_shop_slug_returns_404(client, shop_a, shop_b, category_b, db_session):
    product = _make_product(db_session, shop_b, category_b, name="Shop B Product")

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products/{product.id}")
    assert resp.status_code == 404


def test_get_product_detail_missing_product_returns_404(client, shop_a):
    resp = client.get(f"/api/public/shops/{shop_a.slug}/products/999999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Product not found."


def test_get_product_detail_inactive_shop_returns_403(client, shop_a, category_a, db_session):
    product = _make_product(db_session, shop_a, category_a)
    shop_a.is_active = False
    db_session.flush()

    resp = client.get(f"/api/public/shops/{shop_a.slug}/products/{product.id}")
    assert resp.status_code == 403


# --- Customer events (anonymous analytics) --------------------------------


def test_shop_view_records_customer_event(client, shop_a, db_session):
    client.get(f"/api/public/shops/{shop_a.slug}")
    events = db_session.query(CustomerEvent).filter(CustomerEvent.shop_id == shop_a.id).all()
    assert len(events) == 1
    assert events[0].event_type == CustomerEventType.SHOP_VIEW
    assert events[0].product_id is None


def test_product_view_records_customer_event(client, shop_a, category_a, db_session):
    product = _make_product(db_session, shop_a, category_a)
    client.get(f"/api/public/shops/{shop_a.slug}/products/{product.id}")

    events = (
        db_session.query(CustomerEvent)
        .filter(CustomerEvent.shop_id == shop_a.id, CustomerEvent.event_type == CustomerEventType.PRODUCT_VIEW)
        .all()
    )
    assert len(events) == 1
    assert events[0].product_id == product.id


def test_search_records_customer_event(client, shop_a, category_a, db_session):
    _make_product(db_session, shop_a, category_a, name="Banarasi Silk Saree")
    client.get(f"/api/public/shops/{shop_a.slug}/products", params={"search": "banarasi"})

    events = (
        db_session.query(CustomerEvent)
        .filter(CustomerEvent.shop_id == shop_a.id, CustomerEvent.event_type == CustomerEventType.SEARCH)
        .all()
    )
    assert len(events) == 1


def test_category_view_records_customer_event(client, shop_a, category_a, db_session):
    client.get(f"/api/public/shops/{shop_a.slug}/products", params={"category_id": category_a.id})

    events = (
        db_session.query(CustomerEvent)
        .filter(CustomerEvent.shop_id == shop_a.id, CustomerEvent.event_type == CustomerEventType.CATEGORY_VIEW)
        .all()
    )
    assert len(events) == 1


def test_customer_event_captures_anonymous_session_id_header(client, shop_a, db_session):
    client.get(f"/api/public/shops/{shop_a.slug}", headers={"X-Anon-Session-Id": "test-session-123"})
    event = db_session.query(CustomerEvent).filter(CustomerEvent.shop_id == shop_a.id).first()
    assert event.anonymous_session_id == "test-session-123"


def test_customer_event_without_session_header_is_still_recorded(client, shop_a, db_session):
    client.get(f"/api/public/shops/{shop_a.slug}")
    event = db_session.query(CustomerEvent).filter(CustomerEvent.shop_id == shop_a.id).first()
    assert event is not None
    assert event.anonymous_session_id is None


# --- No authentication required ---------------------------------------


def test_public_endpoints_require_no_authentication(client, shop_a, category_a, db_session):
    product = _make_product(db_session, shop_a, category_a)
    # None of these requests carry an Authorization header.
    assert client.get(f"/api/public/shops/{shop_a.slug}").status_code == 200
    assert client.get(f"/api/public/shops/{shop_a.slug}/products").status_code == 200
    assert client.get(f"/api/public/shops/{shop_a.slug}/products/{product.id}").status_code == 200
