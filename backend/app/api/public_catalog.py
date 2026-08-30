"""Public, unauthenticated customer-catalog endpoints (Phase 5).

Mounted at /api/public/shops/{shop_slug}. No auth dependency anywhere in
this router -- these are the only endpoints in the whole app a customer
(no account, no login) ever calls, matching the spec: `/shop/:shopSlug`
must work with zero authentication.

`_get_shop_or_error` is the one gate every route runs through first. It
turns the two ways a shop can be unreachable into two distinct, safe HTTP
responses:

  - slug matches nothing               -> 404, "couldn't find this catalog"
  - slug matches an inactive/suspended
    shop                                -> 403, "currently unavailable"

Neither response leaks *why* (subscription_status, trial dates, etc. never
appear here) -- see `app/services/public_catalog.py`. Product detail is
looked up by (shop_id, product_id) together, so a product belonging to a
different shop 404s exactly like a nonexistent one; the URL's shop slug is
the only source of truth for which shop's catalog is being read.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.utils.rate_limit import limiter

from app.database.session import get_db
from app.models.category import Category
from app.models.enums import CustomerEventType
from app.models.product import Product
from app.models.shop import Shop
from app.models.customer_contact import CustomerContact
from app.models.product_like import ProductLike
from app.schemas.public import (
    CustomerContactCreate,
    CustomerContactResponse,
    ProductLikeResponse,
    PublicCategory,
    PublicProductDetail,
    PublicProductImage,
    PublicProductListItem,
    PublicProductPage,
    PublicPromo,
    PublicShop,
    PublicShopResponse,
)
from app.schemas.selection import (
    PublicSelection,
    PublicSelectionItem,
    SelectionItemAdd,
    SelectionItemNote,
)
from app.schemas.theme import ResolvedTheme
from app.services import public_catalog as catalog_service
from app.services import selection as selection_service
from app.services import theme as theme_service

router = APIRouter(prefix="/api/public/shops", tags=["public-catalog"])

NOT_FOUND_MESSAGE = "We couldn't find this catalog."
UNAVAILABLE_MESSAGE = "This catalog is currently unavailable."


def _get_shop_or_error(db: Session, shop_slug: str) -> Shop:
    try:
        return catalog_service.get_active_shop(db, shop_slug)
    except catalog_service.ShopNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_MESSAGE) from exc
    except catalog_service.ShopUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=UNAVAILABLE_MESSAGE) from exc


def _to_public_category(
    category: Category, cover_url: str | None = None
) -> PublicCategory:
    return PublicCategory(
        id=category.id, name=category.name, cover_image_url=cover_url
    )


def _to_list_item(product: Product) -> PublicProductListItem:
    return PublicProductListItem(
        id=product.id,
        name=product.name,
        product_code=product.product_code,
        category=_to_public_category(product.category),
        price=float(product.price),
        status=product.status,
        primary_image_url=product.primary_image_url,
        quantity_available=product.quantity_available,
        discount_percent=float(product.discount_percent) if product.discount_percent is not None else None,
        color=product.color,
        brand=product.brand,
    )


def _to_detail(product: Product) -> PublicProductDetail:
    base = _to_list_item(product)
    return PublicProductDetail(
        **base.model_dump(),
        description=product.description,
        images=[
            PublicProductImage(id=image.id, image_url=image.image_url, display_order=image.display_order)
            for image in product.images
        ],
    )


@router.get("/{shop_slug}", response_model=PublicShopResponse)
@limiter.limit("60/minute")
def get_shop_catalog(
    request: Request,
    shop_slug: str,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicShopResponse:
    shop = _get_shop_or_error(db, shop_slug)
    categories = catalog_service.list_categories(db, shop.id)
    covers = catalog_service.get_category_covers(db, shop.id)
    hero_images = catalog_service.get_hero_images(db, shop.id)
    catalog_service.record_event(
        db, shop.id, CustomerEventType.SHOP_VIEW, session_id=anon_session_id, device_id=device_id
    )
    db.commit()
    return PublicShopResponse(
        shop=PublicShop(
            id=shop.id,
            name=shop.name,
            slug=shop.slug,
            logo_url=shop.logo_url,
            description=shop.description,
            phone=shop.phone,
            address=shop.address,
            city=shop.city,
            website=shop.website,
        ),
        categories=[
            _to_public_category(cat, covers.get(cat.id))
            for cat in categories
        ],
        theme=ResolvedTheme(**theme_service.resolve_theme(shop.theme)),
        promos=[PublicPromo(**p) for p in catalog_service.get_promos(db, shop.id)],
        hero_images=hero_images,
    )


@router.get("/{shop_slug}/products", response_model=PublicProductPage)
@limiter.limit("60/minute")
def list_shop_products(
    request: Request,
    shop_slug: str,
    category_id: int | None = Query(default=None),
    availability: str | None = Query(default=None, pattern="^(available|unavailable)$"),
    search: str | None = Query(default=None, max_length=255),
    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(
        default=catalog_service.DEFAULT_PAGE_SIZE, ge=1, le=catalog_service.MAX_PAGE_SIZE
    ),
    color: str | None = Query(default=None, max_length=100),
    brand: str | None = Query(default=None, max_length=255),
    price_min: float | None = Query(default=None, ge=0),
    price_max: float | None = Query(default=None, ge=0),
    discounted: bool = Query(default=False),
    new_within_days: int | None = Query(default=None, ge=1, le=90),
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicProductPage:
    shop = _get_shop_or_error(db, shop_slug)

    # Gracefully handle min > max: swap them so the query still makes sense
    # rather than returning zero results for a user mistake.
    if price_min is not None and price_max is not None and price_min > price_max:
        price_min, price_max = price_max, price_min

    result = catalog_service.list_products(
        db,
        shop.id,
        category_id=category_id,
        availability=availability,
        search=search,
        sort=sort,
        page=page,
        page_size=page_size,
        color=color,
        brand=brand,
        price_min=price_min,
        price_max=price_max,
        discounted=discounted,
        new_within_days=new_within_days,
    )

    # Best-effort, anonymous analytics -- a search and/or a category browse
    # can both be true of the same request (e.g. searching within a
    # category), so both are logged independently rather than one winning.
    if search:
        catalog_service.record_event(
            db,
            shop.id,
            CustomerEventType.SEARCH,
            search_query=search,
            session_id=anon_session_id,
            device_id=device_id,
        )
    if category_id is not None:
        catalog_service.record_event(
            db,
            shop.id,
            CustomerEventType.CATEGORY_VIEW,
            category_id=category_id,
            session_id=anon_session_id,
            device_id=device_id,
        )
    db.commit()

    # When a search/filter yields zero results, include a few suggested
    # available products so the customer still sees something useful.
    suggestions = None
    has_filters = bool(search or category_id is not None or color or brand or price_min is not None or price_max is not None)
    if result.total == 0 and has_filters:
        # Pass whatever context the customer was filtering by so
        # suggestions are prioritised by relevance (same category,
        # brand, color, similar price) rather than purely chronological.
        suggested = catalog_service.get_suggestions(
            db,
            shop.id,
            category_id=category_id,
            brand=brand,
            color=color,
            price_ref=price_min if price_min is not None else price_max,
        )
        suggestions = [_to_list_item(p) for p in suggested]

    return PublicProductPage(
        items=[_to_list_item(product) for product in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < result.total,
        suggestions=suggestions,
    )


@router.get("/{shop_slug}/products/{product_id}", response_model=PublicProductDetail)
@limiter.limit("60/minute")
def get_shop_product(
    request: Request,
    shop_slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicProductDetail:
    shop = _get_shop_or_error(db, shop_slug)
    product = catalog_service.get_product(db, shop.id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    catalog_service.record_event(
        db,
        shop.id,
        CustomerEventType.PRODUCT_VIEW,
        product_id=product.id,
        session_id=anon_session_id,
        device_id=device_id,
    )
    db.commit()
    return _to_detail(product)


# ── Guest selection list ─────────────────────────────────────────────────────


def _to_public_selection(sel) -> PublicSelection:
    if sel is None:
        return PublicSelection(items=[], count=0, contact_captured=False)
    return PublicSelection(
        items=[
            PublicSelectionItem(product=_to_list_item(i.product), note=i.note, added_at=i.added_at)
            for i in sel.items
        ],
        count=len(sel.items),
        contact_captured=sel.customer_contact_id is not None,
    )


def _require_device_id(device_id: str | None) -> str:
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing device id."
        )
    return device_id[:64]


@router.get("/{shop_slug}/selection", response_model=PublicSelection)
@limiter.limit("60/minute")
def get_selection(
    request: Request,
    shop_slug: str,
    db: Session = Depends(get_db),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicSelection:
    shop = _get_shop_or_error(db, shop_slug)
    if not device_id:
        return PublicSelection(items=[], count=0, contact_captured=False)
    return _to_public_selection(selection_service.get_selection(db, shop.id, device_id))


@router.post("/{shop_slug}/selection/items", response_model=PublicSelection)
@limiter.limit("60/minute")
def add_selection_item(
    request: Request,
    shop_slug: str,
    payload: SelectionItemAdd,
    db: Session = Depends(get_db),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicSelection:
    shop = _get_shop_or_error(db, shop_slug)
    dev = _require_device_id(device_id)
    sel = selection_service.add_item(db, shop.id, dev, payload.product_id, payload.note)
    if sel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    db.commit()
    db.refresh(sel)
    return _to_public_selection(sel)


@router.patch("/{shop_slug}/selection/items/{product_id}", response_model=PublicSelection)
@limiter.limit("60/minute")
def update_selection_item(
    request: Request,
    shop_slug: str,
    product_id: int,
    payload: SelectionItemNote,
    db: Session = Depends(get_db),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicSelection:
    shop = _get_shop_or_error(db, shop_slug)
    dev = _require_device_id(device_id)
    sel = selection_service.set_note(db, shop.id, dev, product_id, payload.note)
    db.commit()
    if sel is None:
        return PublicSelection(items=[], count=0, contact_captured=False)
    db.refresh(sel)
    return _to_public_selection(sel)


@router.delete("/{shop_slug}/selection/items/{product_id}", response_model=PublicSelection)
@limiter.limit("60/minute")
def remove_selection_item(
    request: Request,
    shop_slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> PublicSelection:
    shop = _get_shop_or_error(db, shop_slug)
    dev = _require_device_id(device_id)
    sel = selection_service.remove_item(db, shop.id, dev, product_id)
    db.commit()
    if sel is None:
        return PublicSelection(items=[], count=0, contact_captured=False)
    db.refresh(sel)
    return _to_public_selection(sel)


# ── Consent popup ────────────────────────────────────────────────────────────


@router.post("/{shop_slug}/contacts", response_model=CustomerContactResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def submit_customer_contact(
    request: Request,
    shop_slug: str,
    payload: CustomerContactCreate,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
    device_id: str | None = Header(default=None, alias="X-Device-Id", max_length=64),
) -> CustomerContactResponse:
    """Store optional customer details from the consent popup and, if this
    device has a selection, link it so the owner's Leads view can show what
    they picked."""
    shop = _get_shop_or_error(db, shop_slug)
    now = datetime.now(timezone.utc)
    contact = CustomerContact(
        shop_id=shop.id,
        name=payload.name,
        whatsapp=payload.whatsapp,
        email=payload.email,
        anonymous_session_id=anon_session_id[:64] if anon_session_id else None,
        device_id=device_id[:64] if device_id else None,
        consent_processing=payload.consent_processing,
        consent_marketing=payload.consent_marketing,
        consent_version=selection_service.CONSENT_VERSION,
        consent_at=now,
    )
    db.add(contact)
    db.flush()
    selection_service.link_contact(db, contact)
    db.commit()
    db.refresh(contact)
    return CustomerContactResponse(
        id=contact.id,
        name=contact.name,
        whatsapp=contact.whatsapp,
        email=contact.email,
        consent_marketing=contact.consent_marketing,
    )


# ── Product likes / interest ──────────────────────────────────────────────────


@router.post("/{shop_slug}/products/{product_id}/like", response_model=ProductLikeResponse)
@limiter.limit("60/minute")
def toggle_product_like(
    request: Request,
    shop_slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
) -> ProductLikeResponse:
    """Toggle like on a product. If already liked by this session, unlike it."""
    shop = _get_shop_or_error(db, shop_slug)
    product = catalog_service.get_product(db, shop.id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    if not anon_session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session ID required.")

    session_id = anon_session_id[:64]
    existing = (
        db.query(ProductLike)
        .filter(ProductLike.product_id == product_id, ProductLike.anonymous_session_id == session_id)
        .first()
    )
    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(ProductLike(shop_id=shop.id, product_id=product_id, anonymous_session_id=session_id))
        liked = True
    db.commit()

    like_count = db.query(ProductLike).filter(ProductLike.product_id == product_id).count()
    return ProductLikeResponse(product_id=product_id, liked=liked, like_count=like_count)


@router.get("/{shop_slug}/products/{product_id}/like", response_model=ProductLikeResponse)
@limiter.limit("60/minute")
def get_product_like_status(
    request: Request,
    shop_slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
) -> ProductLikeResponse:
    """Check if the current session has liked this product."""
    shop = _get_shop_or_error(db, shop_slug)
    product = catalog_service.get_product(db, shop.id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    liked = False
    if anon_session_id:
        session_id = anon_session_id[:64]
        existing = (
            db.query(ProductLike)
            .filter(ProductLike.product_id == product_id, ProductLike.anonymous_session_id == session_id)
            .first()
        )
        liked = existing is not None

    like_count = db.query(ProductLike).filter(ProductLike.product_id == product_id).count()
    return ProductLikeResponse(product_id=product_id, liked=liked, like_count=like_count)
