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

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.utils.rate_limit import limiter

from app.database.session import get_db
from app.models.category import Category
from app.models.enums import CustomerEventType
from app.models.product import Product
from app.models.shop import Shop
from app.schemas.public import (
    PublicCategory,
    PublicProductDetail,
    PublicProductImage,
    PublicProductListItem,
    PublicProductPage,
    PublicShop,
    PublicShopResponse,
)
from app.services import public_catalog as catalog_service

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


def _to_public_category(category: Category) -> PublicCategory:
    return PublicCategory(id=category.id, name=category.name)


def _to_list_item(product: Product) -> PublicProductListItem:
    return PublicProductListItem(
        id=product.id,
        name=product.name,
        product_code=product.product_code,
        category=_to_public_category(product.category),
        price=float(product.price),
        status=product.status,
        primary_image_url=product.primary_image_url,
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
) -> PublicShopResponse:
    shop = _get_shop_or_error(db, shop_slug)
    categories = catalog_service.list_categories(db, shop.id)
    catalog_service.record_event(db, shop.id, CustomerEventType.SHOP_VIEW, session_id=anon_session_id)
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
        categories=[_to_public_category(category) for category in categories],
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
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
) -> PublicProductPage:
    shop = _get_shop_or_error(db, shop_slug)
    result = catalog_service.list_products(
        db,
        shop.id,
        category_id=category_id,
        availability=availability,
        search=search,
        sort=sort,
        page=page,
        page_size=page_size,
    )

    # Best-effort, anonymous analytics -- a search and/or a category browse
    # can both be true of the same request (e.g. searching within a
    # category), so both are logged independently rather than one winning.
    if search:
        catalog_service.record_event(
            db, shop.id, CustomerEventType.SEARCH, search_query=search, session_id=anon_session_id
        )
    if category_id is not None:
        catalog_service.record_event(
            db, shop.id, CustomerEventType.CATEGORY_VIEW, category_id=category_id, session_id=anon_session_id
        )
    db.commit()

    return PublicProductPage(
        items=[_to_list_item(product) for product in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < result.total,
    )


@router.get("/{shop_slug}/products/{product_id}", response_model=PublicProductDetail)
@limiter.limit("60/minute")
def get_shop_product(
    request: Request,
    shop_slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    anon_session_id: str | None = Header(default=None, alias="X-Anon-Session-Id", max_length=64),
) -> PublicProductDetail:
    shop = _get_shop_or_error(db, shop_slug)
    product = catalog_service.get_product(db, shop.id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    catalog_service.record_event(
        db, shop.id, CustomerEventType.PRODUCT_VIEW, product_id=product.id, session_id=anon_session_id
    )
    db.commit()
    return _to_detail(product)
