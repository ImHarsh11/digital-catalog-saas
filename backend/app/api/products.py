"""Shop-scoped product CRUD, status changes, and image management (Phase 4).

Mounted at /api/shops/{shop_id}/products. Same access pattern as
categories.py: `shop_id` always comes from the URL path, and every
endpoint resolves the caller through `require_shop_access` (404s a shop
owner reaching for another shop's id, always lets a super admin through).
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_shop_access
from app.database.session import get_db
from app.models.enums import ProductStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    ProductCategoryBrief,
    ProductCreate,
    ProductCreatorBrief,
    ProductDetail,
    ProductImageRead,
    ProductImageUploadResponse,
    ProductListItem,
    ProductStatusUpdate,
    ProductUpdate,
)
from app.services import product as product_service
from app.services.storage import ImageValidationError, get_image_storage
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/shops/{shop_id}/products", tags=["products"])


def _creator_brief(product: Product) -> ProductCreatorBrief | None:
    if product.creator is None:
        return None
    return ProductCreatorBrief(id=product.creator.id, name=product.creator.name, role=product.creator.role)


def _to_list_item(product: Product) -> ProductListItem:
    return ProductListItem(
        id=product.id,
        shop_id=product.shop_id,
        name=product.name,
        product_code=product.product_code,
        category=ProductCategoryBrief(id=product.category.id, name=product.category.name),
        price=float(product.price),
        status=product.status,
        primary_image_url=product.primary_image_url,
        image_count=len(product.images),
        created_by=_creator_brief(product),
        created_at=product.created_at,
        quantity_available=product.quantity_available,
        discount_percent=float(product.discount_percent) if product.discount_percent is not None else None,
        color=product.color,
        brand=product.brand,
    )


def _to_detail(product: Product) -> ProductDetail:
    base = _to_list_item(product)
    return ProductDetail(
        **base.model_dump(),
        description=product.description,
        images=[
            ProductImageRead(
                id=image.id,
                image_url=image.image_url,
                display_order=image.display_order,
                created_at=image.created_at,
            )
            for image in product.images
        ],
        updated_at=product.updated_at,
    )


def _get_product_or_404(db: Session, shop_id: int, product_id: int) -> Product:
    product = product_service.get_product(db, shop_id, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return product


@router.get("", response_model=list[ProductListItem])
def list_products(
    shop_id: int,
    category_id: int | None = Query(default=None),
    status_filter: ProductStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=255),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> list[ProductListItem]:
    products = product_service.list_products(
        db, shop_id, category_id=category_id, status=status_filter, search=search
    )
    return [_to_list_item(product) for product in products]


@router.post("", response_model=ProductDetail, status_code=status.HTTP_201_CREATED)
def create_product(
    shop_id: int,
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> ProductDetail:
    try:
        product = product_service.create_product(db, shop_id, payload, current_user)
        db.commit()
    except product_service.CategoryNotInShopError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except product_service.ProductCodeTakenError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    product = _get_product_or_404(db, shop_id, product.id)
    return _to_detail(product)


@router.get("/{product_id}", response_model=ProductDetail)
def get_product(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> ProductDetail:
    return _to_detail(_get_product_or_404(db, shop_id, product_id))


@router.put("/{product_id}", response_model=ProductDetail)
def update_product(
    shop_id: int,
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> ProductDetail:
    product = _get_product_or_404(db, shop_id, product_id)
    try:
        product_service.update_product(db, product, payload, current_user)
        db.commit()
    except product_service.CategoryNotInShopError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except product_service.ProductCodeTakenError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    product = _get_product_or_404(db, shop_id, product_id)
    return _to_detail(product)


@router.patch("/{product_id}/status", response_model=ProductDetail)
def update_product_status(
    shop_id: int,
    product_id: int,
    payload: ProductStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> ProductDetail:
    product = _get_product_or_404(db, shop_id, product_id)
    product_service.set_product_status(db, product, payload.status, current_user)
    db.commit()
    product = _get_product_or_404(db, shop_id, product_id)
    return _to_detail(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> None:
    product = _get_product_or_404(db, shop_id, product_id)
    urls = product_service.delete_product(db, product, current_user)
    db.commit()
    # Storage cleanup only after the delete is durably committed.
    storage = get_image_storage()
    for url in urls:
        storage.delete(url)


@router.post(
    "/{product_id}/images",
    response_model=ProductImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
async def upload_product_image(
    request: Request,
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
    file: UploadFile = File(...),
) -> ProductImageUploadResponse:
    product = _get_product_or_404(db, shop_id, product_id)
    content = await file.read()
    try:
        image = product_service.add_product_image(db, product, content, file.content_type, current_user)
        db.commit()
    except ImageValidationError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    product = _get_product_or_404(db, shop_id, product_id)
    return ProductImageUploadResponse(
        image=ProductImageRead(
            id=image.id,
            image_url=image.image_url,
            display_order=image.display_order,
            created_at=image.created_at,
        ),
        primary_image_url=product.primary_image_url,
    )


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_image(
    shop_id: int,
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> None:
    product = _get_product_or_404(db, shop_id, product_id)
    try:
        url = product_service.delete_product_image(db, product, image_id, current_user)
    except product_service.ImageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.commit()
    get_image_storage().delete(url)


@router.patch("/{product_id}/images/{image_id}/primary", response_model=ProductDetail)
def set_primary_image(
    shop_id: int,
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_shop_access),
) -> ProductDetail:
    product = _get_product_or_404(db, shop_id, product_id)
    try:
        product_service.set_primary_image(db, product, image_id)
    except product_service.ImageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    db.commit()
    product = _get_product_or_404(db, shop_id, product_id)
    return _to_detail(product)
