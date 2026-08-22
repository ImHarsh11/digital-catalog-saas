"""Business logic for shop-owner (and super-admin-on-behalf-of) product and
product-image management (Phase 4).

Same conventions as `app/services/shop.py` and `app/services/category.py`:
mutating functions `flush()`, never `commit()` -- the API layer owns the
commit boundary. Storage side-effects (writing/deleting image files) are
kept out of this module where possible: `add_product_image` has to call
storage.save() before the DB insert (it needs the resulting URL), but
deletes are deliberately NOT performed here -- they're irreversible and
shouldn't happen before a transaction is known to have committed. Delete
functions instead return the URL(s) the caller should remove from storage
*after* `db.commit()` succeeds.
"""

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.catalog_activity import CatalogActivity
from app.models.category import Category
from app.models.enums import CatalogAction, ProductStatus
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.storage import get_image_storage, validate_image_upload


class ProductCodeTakenError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(f"Product code '{code}' is already used by another product in this shop.")


class CategoryNotInShopError(Exception):
    def __init__(self):
        super().__init__("That category does not belong to this shop.")


class ImageNotFoundError(Exception):
    def __init__(self):
        super().__init__("Image not found for this product.")


def _validate_category(db: Session, shop_id: int, category_id: int) -> None:
    exists = (
        db.query(Category.id)
        .filter(Category.id == category_id, Category.shop_id == shop_id)
        .first()
    )
    if exists is None:
        raise CategoryNotInShopError()


def _check_code_unique(
    db: Session, shop_id: int, code: str | None, *, exclude_product_id: int | None = None
) -> None:
    if code is None:
        return
    query = db.query(Product.id).filter(Product.shop_id == shop_id, Product.product_code == code)
    if exclude_product_id is not None:
        query = query.filter(Product.id != exclude_product_id)
    if query.first() is not None:
        raise ProductCodeTakenError(code)


def list_products(
    db: Session,
    shop_id: int,
    *,
    category_id: int | None = None,
    status: ProductStatus | None = None,
    search: str | None = None,
) -> list[Product]:
    query = (
        db.query(Product)
        .options(
            joinedload(Product.category),
            joinedload(Product.creator),
            joinedload(Product.images),
        )
        .filter(Product.shop_id == shop_id)
    )
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    if status is not None:
        query = query.filter(Product.status == status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(Product.name.ilike(pattern), Product.product_code.ilike(pattern))
        )
    return query.order_by(Product.created_at.desc()).all()


def get_product(db: Session, shop_id: int, product_id: int) -> Product | None:
    return (
        db.query(Product)
        .options(
            joinedload(Product.category),
            joinedload(Product.creator),
            joinedload(Product.images),
        )
        .filter(Product.id == product_id, Product.shop_id == shop_id)
        .first()
    )


def create_product(db: Session, shop_id: int, payload: ProductCreate, actor: User) -> Product:
    _validate_category(db, shop_id, payload.category_id)
    _check_code_unique(db, shop_id, payload.product_code)

    product = Product(
        shop_id=shop_id,
        category_id=payload.category_id,
        product_code=payload.product_code,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        status=payload.status,
        quantity_available=payload.quantity_available,
        discount_percent=payload.discount_percent,
        created_by=actor.id,
    )
    db.add(product)
    db.flush()

    db.add(
        CatalogActivity(
            shop_id=shop_id,
            product_id=product.id,
            user_id=actor.id,
            action=CatalogAction.PRODUCT_CREATED,
            activity_metadata={"product_name": product.name},
        )
    )
    db.flush()
    return product


def update_product(db: Session, product: Product, payload: ProductUpdate, actor: User) -> Product:
    changes = payload.model_dump(exclude_unset=True)

    if "category_id" in changes:
        _validate_category(db, product.shop_id, changes["category_id"])
    if "product_code" in changes:
        _check_code_unique(
            db, product.shop_id, changes["product_code"], exclude_product_id=product.id
        )

    for field, value in changes.items():
        setattr(product, field, value)

    if changes:
        db.add(
            CatalogActivity(
                shop_id=product.shop_id,
                product_id=product.id,
                user_id=actor.id,
                action=CatalogAction.PRODUCT_UPDATED,
                activity_metadata={"product_name": product.name, "fields": sorted(changes.keys())},
            )
        )
    db.flush()
    return product


_STATUS_ACTIONS = {
    ProductStatus.SOLD: CatalogAction.PRODUCT_MARKED_SOLD,
    ProductStatus.AVAILABLE: CatalogAction.PRODUCT_MARKED_AVAILABLE,
    ProductStatus.OUT_OF_STOCK: CatalogAction.PRODUCT_MARKED_OUT_OF_STOCK,
}


def set_product_status(db: Session, product: Product, new_status: ProductStatus, actor: User) -> Product:
    if product.status != new_status:
        product.status = new_status
        db.add(
            CatalogActivity(
                shop_id=product.shop_id,
                product_id=product.id,
                user_id=actor.id,
                action=_STATUS_ACTIONS[new_status],
                activity_metadata={"product_name": product.name},
            )
        )
        db.flush()
    return product


def delete_product(db: Session, product: Product, actor: User) -> list[str]:
    """Deletes the product (cascades to its ProductImage rows). Returns the
    distinct image URLs the caller should remove from storage after the
    transaction commits."""
    urls = {image.image_url for image in product.images}
    if product.primary_image_url:
        urls.add(product.primary_image_url)

    db.add(
        CatalogActivity(
            shop_id=product.shop_id,
            user_id=actor.id,
            action=CatalogAction.PRODUCT_DELETED,
            activity_metadata={"product_name": product.name},
        )
    )
    db.delete(product)
    db.flush()
    return sorted(urls)


def add_product_image(
    db: Session, product: Product, content: bytes, content_type: str | None, actor: User
) -> ProductImage:
    validate_image_upload(content, content_type)

    storage = get_image_storage()
    folder = f"products/{product.shop_id}/{product.id}"
    url = storage.save(content, content_type, folder=folder)  # type: ignore[arg-type]

    next_order = (
        db.query(func.max(ProductImage.display_order))
        .filter(ProductImage.product_id == product.id)
        .scalar()
    )
    image = ProductImage(
        product_id=product.id,
        image_url=url,
        display_order=(next_order + 1) if next_order is not None else 0,
    )
    db.add(image)
    db.flush()

    if product.primary_image_url is None:
        product.primary_image_url = url

    db.add(
        CatalogActivity(
            shop_id=product.shop_id,
            product_id=product.id,
            user_id=actor.id,
            action=CatalogAction.PRODUCT_IMAGE_UPLOADED,
            activity_metadata={"image_id": image.id},
        )
    )
    db.flush()
    return image


def delete_product_image(db: Session, product: Product, image_id: int, actor: User) -> str:
    """Deletes the image row (and reassigns the primary image if needed).
    Returns the URL for the caller to remove from storage after commit."""
    image = next((img for img in product.images if img.id == image_id), None)
    if image is None:
        raise ImageNotFoundError()

    was_primary = product.primary_image_url == image.image_url
    url = image.image_url

    db.delete(image)
    db.flush()

    if was_primary:
        remaining = (
            db.query(ProductImage)
            .filter(ProductImage.product_id == product.id)
            .order_by(ProductImage.display_order)
            .first()
        )
        product.primary_image_url = remaining.image_url if remaining else None

    db.add(
        CatalogActivity(
            shop_id=product.shop_id,
            product_id=product.id,
            user_id=actor.id,
            action=CatalogAction.PRODUCT_IMAGE_DELETED,
            activity_metadata={"image_id": image_id},
        )
    )
    db.flush()
    return url


def set_primary_image(db: Session, product: Product, image_id: int) -> Product:
    image = next((img for img in product.images if img.id == image_id), None)
    if image is None:
        raise ImageNotFoundError()
    product.primary_image_url = image.image_url
    db.flush()
    return product
