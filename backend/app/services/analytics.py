"""Read-only aggregation backing the shop-owner pilot analytics dashboard
(Phase 6).

Everything here reads `CustomerEvent` rows already written by the public
catalog's `record_event` (Phase 5, extended in Phase 6 with `category_id`
and `search_query`). Nothing here mutates, so unlike the mutating service
modules there's no flush/commit convention to follow.

Top-N lists filter out rows whose `product_id`/`category_id` has since
gone NULL (the product or category was deleted -- `ON DELETE SET NULL`
keeps the historical event but the row obviously can't be resolved to a
name/image anymore).
"""

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType
from app.models.product import Product

TOP_N = 5


def _count(db: Session, shop_id: int, event_type: CustomerEventType, *, since: datetime | None = None) -> int:
    query = db.query(func.count(CustomerEvent.id)).filter(
        CustomerEvent.shop_id == shop_id, CustomerEvent.event_type == event_type
    )
    if since is not None:
        query = query.filter(CustomerEvent.created_at >= since)
    return query.scalar() or 0


def _top_products(db: Session, shop_id: int) -> list[dict]:
    rows = (
        db.query(
            Product.id, Product.name, Product.primary_image_url, func.count(CustomerEvent.id).label("view_count")
        )
        .join(CustomerEvent, CustomerEvent.product_id == Product.id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.PRODUCT_VIEW,
            CustomerEvent.product_id.isnot(None),
        )
        .group_by(Product.id, Product.name, Product.primary_image_url)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [
        {"product_id": row.id, "name": row.name, "primary_image_url": row.primary_image_url, "view_count": row.view_count}
        for row in rows
    ]


def _top_categories(db: Session, shop_id: int) -> list[dict]:
    rows = (
        db.query(Category.id, Category.name, func.count(CustomerEvent.id).label("view_count"))
        .join(CustomerEvent, CustomerEvent.category_id == Category.id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.CATEGORY_VIEW,
            CustomerEvent.category_id.isnot(None),
        )
        .group_by(Category.id, Category.name)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [{"category_id": row.id, "name": row.name, "view_count": row.view_count} for row in rows]


def _top_searches(db: Session, shop_id: int) -> list[dict]:
    term = func.lower(CustomerEvent.search_query).label("term")
    rows = (
        db.query(term, func.count(CustomerEvent.id).label("count"))
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.SEARCH,
            CustomerEvent.search_query.isnot(None),
        )
        .group_by(term)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [{"term": row.term, "count": row.count} for row in rows]


def get_shop_analytics(db: Session, shop_id: int) -> dict:
    week_ago = datetime.utcnow() - timedelta(days=7)
    return {
        "shop_views_total": _count(db, shop_id, CustomerEventType.SHOP_VIEW),
        "shop_views_last_7_days": _count(db, shop_id, CustomerEventType.SHOP_VIEW, since=week_ago),
        "product_views_total": _count(db, shop_id, CustomerEventType.PRODUCT_VIEW),
        "product_views_last_7_days": _count(db, shop_id, CustomerEventType.PRODUCT_VIEW, since=week_ago),
        "searches_total": _count(db, shop_id, CustomerEventType.SEARCH),
        "searches_last_7_days": _count(db, shop_id, CustomerEventType.SEARCH, since=week_ago),
        "top_products": _top_products(db, shop_id),
        "top_searches": _top_searches(db, shop_id),
        "top_categories": _top_categories(db, shop_id),
    }
