"""Read-only business logic backing the public, unauthenticated customer
catalog (Phase 5).

Every entry point here is scoped by shop slug/id and only ever touches
fields that are safe for an anonymous customer to see. `get_active_shop`
is the single gate every public API route must pass through first:

  - a slug that doesn't match any shop -> `ShopNotFoundError`
  - a slug that matches a shop but the shop is inactive/suspended ->
    `ShopUnavailableError`

Both are handled by the API layer as distinct HTTP responses so the
frontend can show "catalog not found" vs. "catalog unavailable" without
this module (or the API) ever exposing *why* a shop is unavailable
(subscription_status, trial state, etc. never appear in a public response).

`list_products`/`get_product` filter by `shop_id` (not just `slug`) taken
from the already-resolved `Shop` row, so a product belonging to another
shop can never surface under this shop's slug -- the same "trust the
resolved parent, not a caller-supplied id" pattern `require_shop_access`
uses for the shop-owner API.
"""

from dataclasses import dataclass

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.category import Category
from app.models.customer_event import CustomerEvent
from app.models.enums import CustomerEventType, ProductStatus
from app.models.product import Product
from app.models.shop import Shop

DEFAULT_PAGE_SIZE = 24
MAX_PAGE_SIZE = 60


class ShopNotFoundError(Exception):
    def __init__(self, slug: str):
        self.slug = slug
        super().__init__(f"No shop with slug '{slug}'.")


class ShopUnavailableError(Exception):
    """The shop exists but its catalog must not be shown to customers."""

    def __init__(self, slug: str):
        self.slug = slug
        super().__init__(f"Shop '{slug}' is not currently active.")


def get_active_shop(db: Session, slug: str) -> Shop:
    shop = db.query(Shop).filter(Shop.slug == slug).first()
    if shop is None:
        raise ShopNotFoundError(slug)
    if not shop.is_active:
        raise ShopUnavailableError(slug)
    return shop


def list_categories(db: Session, shop_id: int) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.shop_id == shop_id, Category.is_active.is_(True))
        .order_by(Category.display_order, Category.name)
        .all()
    )


@dataclass
class ProductPage:
    items: list[Product]
    total: int


_SORT_COLUMNS = {
    "newest": Product.created_at.desc(),
    "price_asc": Product.price.asc(),
    "price_desc": Product.price.desc(),
}


def list_products(
    db: Session,
    shop_id: int,
    *,
    category_id: int | None = None,
    availability: str | None = None,
    search: str | None = None,
    sort: str = "newest",
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    color: str | None = None,
    brand: str | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
) -> ProductPage:
    """`availability` groups the 3 statuses the way a customer thinks about
    them, not the way the shop-owner dashboard filters them: "available"
    means in-stock right now, "unavailable" covers both SOLD and
    OUT_OF_STOCK (spec explicitly calls out showing these as visually
    distinct rather than hiding them, so both remain filterable together).
    """
    query = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.images))
        .filter(Product.shop_id == shop_id)
    )
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    if availability == "available":
        query = query.filter(Product.status == ProductStatus.AVAILABLE)
    elif availability == "unavailable":
        query = query.filter(Product.status.in_([ProductStatus.SOLD, ProductStatus.OUT_OF_STOCK]))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(pattern),
                Product.product_code.ilike(pattern),
                Product.color.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.description.ilike(pattern),
            )
        )
    if color:
        query = query.filter(Product.color.ilike(f"%{color.strip()}%"))
    if brand:
        query = query.filter(Product.brand.ilike(f"%{brand.strip()}%"))
    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)

    total = query.count()

    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    page = max(1, page)
    order = _SORT_COLUMNS.get(sort, _SORT_COLUMNS["newest"])
    items = (
        query.order_by(order, Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ProductPage(items=items, total=total)


def get_suggestions(
    db: Session,
    shop_id: int,
    *,
    category_id: int | None = None,
    brand: str | None = None,
    color: str | None = None,
    price_ref: float | None = None,
    limit: int = 8,
) -> list[Product]:
    """Return a handful of available products as suggestions when a search
    yields no results.

    Prioritisation strategy (best effort, falls back gracefully):
      1. Same category first (if the customer was browsing one).
      2. Same brand / same color next.
      3. Close price range (±50 % of the reference price).
      4. Fill any remaining slots with newest available stock.

    Results are de-duplicated; the final list never exceeds *limit*.
    """
    seen_ids: set[int] = set()
    results: list[Product] = []

    def _add(products: list[Product]) -> None:
        for p in products:
            if p.id not in seen_ids and len(results) < limit:
                seen_ids.add(p.id)
                results.append(p)

    base = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.images))
        .filter(Product.shop_id == shop_id, Product.status == ProductStatus.AVAILABLE)
    )

    # 1. Same category
    if category_id is not None:
        _add(
            base.filter(Product.category_id == category_id)
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )

    # 2. Same brand
    if brand and len(results) < limit:
        _add(
            base.filter(Product.brand.ilike(f"%{brand.strip()}%"))
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )

    # 3. Same color
    if color and len(results) < limit:
        _add(
            base.filter(Product.color.ilike(f"%{color.strip()}%"))
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )

    # 4. Similar price (±50 %)
    if price_ref is not None and price_ref > 0 and len(results) < limit:
        lo = price_ref * 0.5
        hi = price_ref * 1.5
        _add(
            base.filter(Product.price.between(lo, hi))
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )

    # 5. Fill remaining with newest available
    if len(results) < limit:
        _add(
            base.order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )

    return results


def get_product(db: Session, shop_id: int, product_id: int) -> Product | None:
    return (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.images))
        .filter(Product.id == product_id, Product.shop_id == shop_id)
        .first()
    )


def record_event(
    db: Session,
    shop_id: int,
    event_type: CustomerEventType,
    *,
    product_id: int | None = None,
    category_id: int | None = None,
    search_query: str | None = None,
    session_id: str | None = None,
) -> None:
    """Fire-and-forget anonymous analytics write. No personal information is
    collected -- `session_id` is an opaque, browser-generated identifier the
    frontend never ties to any account (customers don't have one).
    `category_id` (CATEGORY_VIEW) and `search_query` (SEARCH) let the Phase 6
    shop-owner analytics dashboard surface top categories/search terms;
    both are simply left null for every other event type."""
    db.add(
        CustomerEvent(
            shop_id=shop_id,
            product_id=product_id,
            category_id=category_id,
            event_type=event_type,
            anonymous_session_id=session_id[:64] if session_id else None,
            search_query=search_query[:255] if search_query else None,
        )
    )
    db.flush()
