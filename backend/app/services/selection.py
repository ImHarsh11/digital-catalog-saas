"""Guest selection list + consent-linked leads (redesign Phase 4a).

State lives in ``selections`` / ``selection_items`` (keyed by device_id);
every add also writes an append-only ``ADD_TO_SELECTION`` customer_event
so the owner analytics can count intent over time even after an item is
removed.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.customer_contact import CustomerContact
from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType
from app.models.product import Product
from app.models.selection import Selection, SelectionItem

CONSENT_VERSION = "2026-08-v1"

_ITEM_LOADERS = (
    joinedload(Selection.items).joinedload(SelectionItem.product).joinedload(Product.category),
    joinedload(Selection.items).joinedload(SelectionItem.product).joinedload(Product.images),
    joinedload(Selection.contact),
)


def get_selection(db: Session, shop_id: int, device_id: str) -> Selection | None:
    return (
        db.query(Selection)
        .options(*_ITEM_LOADERS)
        .filter(Selection.shop_id == shop_id, Selection.device_id == device_id[:64])
        .first()
    )


def _get_or_create(db: Session, shop_id: int, device_id: str) -> Selection:
    sel = get_selection(db, shop_id, device_id)
    if sel is None:
        sel = Selection(shop_id=shop_id, device_id=device_id[:64])
        db.add(sel)
        db.flush()
    return sel


def _shop_product(db: Session, shop_id: int, product_id: int) -> Product | None:
    return (
        db.query(Product)
        .filter(Product.id == product_id, Product.shop_id == shop_id)
        .first()
    )


def add_item(
    db: Session, shop_id: int, device_id: str, product_id: int, note: str | None
) -> Selection | None:
    """Add a product to the device's selection. Returns None if the product
    doesn't belong to this shop. Idempotent on the (selection, product) pair;
    a repeat add just updates the note and does not re-log the event."""
    if _shop_product(db, shop_id, product_id) is None:
        return None

    sel = _get_or_create(db, shop_id, device_id)
    existing = next((i for i in sel.items if i.product_id == product_id), None)
    if existing is not None:
        if note is not None:
            existing.note = note[:255]
    else:
        db.add(
            SelectionItem(selection_id=sel.id, product_id=product_id, note=note[:255] if note else None)
        )
        db.add(
            CustomerEvent(
                shop_id=shop_id,
                product_id=product_id,
                event_type=CustomerEventType.ADD_TO_SELECTION,
                anonymous_session_id=device_id[:64],
                device_id=device_id[:64],
            )
        )
    sel.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(sel)
    return sel


def remove_item(db: Session, shop_id: int, device_id: str, product_id: int) -> Selection | None:
    sel = get_selection(db, shop_id, device_id)
    if sel is None:
        return None
    item = next((i for i in sel.items if i.product_id == product_id), None)
    if item is not None:
        db.delete(item)
        sel.updated_at = datetime.now(timezone.utc)
        db.flush()
        db.refresh(sel)
    return sel


def set_note(
    db: Session, shop_id: int, device_id: str, product_id: int, note: str | None
) -> Selection | None:
    sel = get_selection(db, shop_id, device_id)
    if sel is None:
        return None
    item = next((i for i in sel.items if i.product_id == product_id), None)
    if item is not None:
        item.note = note[:255] if note else None
        db.flush()
        db.refresh(sel)
    return sel


def link_contact(db: Session, contact: CustomerContact) -> None:
    """After the consent popup is submitted, attach the new contact to the
    device's selection for this shop (if one exists) so it shows in Leads."""
    if not contact.device_id:
        return
    sel = get_selection(db, contact.shop_id, contact.device_id)
    if sel is not None and sel.customer_contact_id is None:
        sel.customer_contact_id = contact.id
        db.flush()


def list_leads(db: Session, shop_id: int) -> list[dict]:
    """Contacts for this shop, newest first, each with the products they
    selected (if their selection is still linked)."""
    contacts = (
        db.query(CustomerContact)
        .options(
            joinedload(CustomerContact.selection)
            .joinedload(Selection.items)
            .joinedload(SelectionItem.product)
        )
        .filter(CustomerContact.shop_id == shop_id, CustomerContact.withdrawn_at.is_(None))
        .order_by(CustomerContact.created_at.desc())
        .all()
    )
    out: list[dict] = []
    for c in contacts:
        items: list[dict] = []
        if c.selection is not None:
            for it in c.selection.items:
                p = it.product
                items.append(
                    {
                        "product_id": p.id,
                        "name": p.name,
                        "primary_image_url": p.primary_image_url,
                        "price": float(p.price),
                        "discount_percent": (
                            float(p.discount_percent) if p.discount_percent else None
                        ),
                        "note": it.note,
                    }
                )
        out.append(
            {
                "contact_id": c.id,
                "name": c.name,
                "whatsapp": c.whatsapp,
                "email": c.email,
                "consent_marketing": c.consent_marketing,
                "created_at": c.created_at,
                "selected_items": items,
            }
        )
    return out
