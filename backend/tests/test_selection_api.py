"""Guest selection list + consent popup + owner Leads (Phase 4a).

All customer-side requests carry no auth, keyed by an X-Device-Id header.
"""

from app.models.enums import CustomerEventType, ProductStatus
from app.models.product import Product
from tests.conftest import auth_headers

DEV = {"X-Device-Id": "device-abc-123"}
DEV2 = {"X-Device-Id": "device-xyz-999"}


def _product(db_session, shop, category, name="Kanjivaram Silk Saree", **kw):
    p = Product(
        shop_id=shop.id,
        category_id=category.id,
        name=name,
        price=kw.pop("price", 9000),
        status=kw.pop("status", ProductStatus.AVAILABLE),
        **kw,
    )
    db_session.add(p)
    db_session.flush()
    return p


# ── selection basics ───────────────────────────────────────────────────────


def test_empty_selection_for_new_device(client, shop_a, category_a):
    resp = client.get(f"/api/public/shops/{shop_a.slug}/selection", headers=DEV)
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "count": 0, "contact_captured": False}


def test_add_and_list_items(client, shop_a, category_a, db_session):
    p1 = _product(db_session, shop_a, category_a, name="Red Saree")
    p2 = _product(db_session, shop_a, category_a, name="Blue Saree")

    r1 = client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items",
        json={"product_id": p1.id, "note": "wants in green"},
        headers=DEV,
    )
    assert r1.status_code == 200
    assert r1.json()["count"] == 1

    r2 = client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items",
        json={"product_id": p2.id},
        headers=DEV,
    )
    body = r2.json()
    assert body["count"] == 2
    names = {i["product"]["name"] for i in body["items"]}
    assert names == {"Red Saree", "Blue Saree"}
    noted = next(i for i in body["items"] if i["product"]["name"] == "Red Saree")
    assert noted["note"] == "wants in green"


def test_add_is_idempotent_on_repeat(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a)
    for _ in range(3):
        resp = client.post(
            f"/api/public/shops/{shop_a.slug}/selection/items",
            json={"product_id": p.id},
            headers=DEV,
        )
    assert resp.json()["count"] == 1
    # only one ADD_TO_SELECTION event was logged
    from app.models.customer_event import CustomerEvent

    n = (
        db_session.query(CustomerEvent)
        .filter(
            CustomerEvent.shop_id == shop_a.id,
            CustomerEvent.event_type == CustomerEventType.ADD_TO_SELECTION,
        )
        .count()
    )
    assert n == 1


def test_remove_item(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a)
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    resp = client.delete(
        f"/api/public/shops/{shop_a.slug}/selection/items/{p.id}", headers=DEV
    )
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


def test_update_note(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a)
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    resp = client.patch(
        f"/api/public/shops/{shop_a.slug}/selection/items/{p.id}",
        json={"note": "size L please"},
        headers=DEV,
    )
    assert resp.json()["items"][0]["note"] == "size L please"


def test_selections_are_isolated_by_device(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a)
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    other = client.get(f"/api/public/shops/{shop_a.slug}/selection", headers=DEV2)
    assert other.json()["count"] == 0


def test_add_requires_device_id(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a)
    resp = client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}
    )
    assert resp.status_code == 400


def test_cannot_add_another_shops_product(client, shop_a, shop_b, category_b, db_session):
    p = _product(db_session, shop_b, category_b)
    resp = client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    assert resp.status_code == 404


# ── consent popup ──────────────────────────────────────────────────────────


def test_contact_requires_processing_consent(client, shop_a):
    resp = client.post(
        f"/api/public/shops/{shop_a.slug}/contacts",
        json={"name": "Priya", "whatsapp": "9000000000", "consent_processing": False},
        headers=DEV,
    )
    assert resp.status_code == 422


def test_contact_requires_at_least_one_field(client, shop_a):
    resp = client.post(
        f"/api/public/shops/{shop_a.slug}/contacts",
        json={"consent_processing": True},
        headers=DEV,
    )
    assert resp.status_code == 422


def test_contact_submitted_and_linked_to_selection(client, shop_a, category_a, db_session):
    p = _product(db_session, shop_a, category_a, name="Wanted Saree")
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    resp = client.post(
        f"/api/public/shops/{shop_a.slug}/contacts",
        json={
            "name": "Priya",
            "whatsapp": "9000000000",
            "consent_processing": True,
            "consent_marketing": True,
        },
        headers=DEV,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["consent_marketing"] is True

    # the device's selection now reports contact_captured
    sel = client.get(f"/api/public/shops/{shop_a.slug}/selection", headers=DEV).json()
    assert sel["contact_captured"] is True


# ── owner Leads ────────────────────────────────────────────────────────────


def test_leads_shows_captured_contacts_with_their_picks(
    client, shop_a, category_a, owner_a, db_session
):
    p = _product(db_session, shop_a, category_a, name="Picked Saree")
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items",
        json={"product_id": p.id, "note": "gift wrap"},
        headers=DEV,
    )
    client.post(
        f"/api/public/shops/{shop_a.slug}/contacts",
        json={"name": "Anita", "email": "a@x.com", "consent_processing": True, "consent_marketing": False},
        headers=DEV,
    )

    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    resp = client.get(f"/api/shops/{shop_a.id}/leads", headers=headers)
    assert resp.status_code == 200, resp.text
    leads = resp.json()
    assert len(leads) == 1
    lead = leads[0]
    assert lead["name"] == "Anita"
    assert lead["consent_marketing"] is False
    assert lead["selected_items"][0]["name"] == "Picked Saree"
    assert lead["selected_items"][0]["note"] == "gift wrap"


def test_leads_is_owner_only(client, shop_a, super_admin, owner_b):
    admin_h = auth_headers(client, "admin@test.com", "Admin123!")
    assert client.get(f"/api/shops/{shop_a.id}/leads", headers=admin_h).status_code == 404
    other_h = auth_headers(client, owner_b.email, "OwnerB123!")
    assert client.get(f"/api/shops/{shop_a.id}/leads", headers=other_h).status_code == 404


# ── analytics ──────────────────────────────────────────────────────────────


def test_selection_adds_appear_in_rich_analytics(client, shop_a, category_a, owner_a, db_session):
    p = _product(db_session, shop_a, category_a, name="Trendy Saree")
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV
    )
    client.post(
        f"/api/public/shops/{shop_a.slug}/selection/items", json={"product_id": p.id}, headers=DEV2
    )

    headers = auth_headers(client, owner_a.email, "OwnerA123!")
    data = client.get(f"/api/shops/{shop_a.id}/analytics/rich?period=7d", headers=headers).json()
    assert data["selection_adds"]["current"] == 2
    assert data["top_selected_products"][0]["name"] == "Trendy Saree"
    assert data["top_selected_products"][0]["add_count"] == 2
