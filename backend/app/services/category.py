"""Business logic for shop-owner (and super-admin-on-behalf-of) category
management (Phase 4).

Same conventions as `app/services/shop.py`: mutating functions `flush()`,
never `commit()`; the API layer owns the commit boundary.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.catalog_activity import CatalogActivity
from app.models.category import Category
from app.models.enums import CatalogAction
from app.models.product import Product
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryNameTakenError(Exception):
    def __init__(self, name: str):
        self.name = name
        super().__init__(f"A category named '{name}' already exists for this shop.")


class CategoryHasProductsError(Exception):
    """Raised instead of letting the DB's ON DELETE RESTRICT surface as a
    raw IntegrityError -- gives the caller an exact count for a clear
    error message."""

    def __init__(self, product_count: int):
        self.product_count = product_count
        super().__init__(
            f"This category has {product_count} product(s) assigned. "
            "Reassign or remove them before deleting it."
        )


def _product_counts(db: Session, shop_id: int) -> dict[int, int]:
    return dict(
        db.query(Product.category_id, func.count(Product.id))
        .filter(Product.shop_id == shop_id)
        .group_by(Product.category_id)
        .all()
    )


def list_categories(db: Session, shop_id: int) -> list[tuple[Category, int]]:
    categories = (
        db.query(Category)
        .filter(Category.shop_id == shop_id)
        .order_by(Category.display_order, Category.name)
        .all()
    )
    counts = _product_counts(db, shop_id)
    return [(category, counts.get(category.id, 0)) for category in categories]


def get_category(db: Session, shop_id: int, category_id: int) -> Category | None:
    return (
        db.query(Category)
        .filter(Category.id == category_id, Category.shop_id == shop_id)
        .first()
    )


def get_category_product_count(db: Session, category_id: int) -> int:
    return db.query(func.count(Product.id)).filter(Product.category_id == category_id).scalar() or 0


def create_category(
    db: Session, shop_id: int, payload: CategoryCreate, actor: User
) -> Category:
    if (
        db.query(Category.id)
        .filter(Category.shop_id == shop_id, Category.name == payload.name)
        .first()
        is not None
    ):
        raise CategoryNameTakenError(payload.name)

    category = Category(
        shop_id=shop_id,
        name=payload.name,
        description=payload.description,
        display_order=payload.display_order,
        is_active=True,
    )
    db.add(category)
    db.flush()

    db.add(
        CatalogActivity(
            shop_id=shop_id,
            user_id=actor.id,
            action=CatalogAction.CATEGORY_CREATED,
            activity_metadata={"category_name": category.name},
        )
    )
    db.flush()
    return category


def update_category(
    db: Session, category: Category, payload: CategoryUpdate, actor: User
) -> Category:
    changes = payload.model_dump(exclude_unset=True)

    new_name = changes.get("name")
    if new_name and new_name != category.name:
        clash = (
            db.query(Category.id)
            .filter(
                Category.shop_id == category.shop_id,
                Category.name == new_name,
                Category.id != category.id,
            )
            .first()
        )
        if clash is not None:
            raise CategoryNameTakenError(new_name)

    for field, value in changes.items():
        setattr(category, field, value)

    if changes:
        db.add(
            CatalogActivity(
                shop_id=category.shop_id,
                user_id=actor.id,
                action=CatalogAction.CATEGORY_UPDATED,
                activity_metadata={"category_name": category.name, "fields": sorted(changes.keys())},
            )
        )
    db.flush()
    return category


def delete_category(db: Session, category: Category, actor: User) -> None:
    product_count = get_category_product_count(db, category.id)
    if product_count > 0:
        raise CategoryHasProductsError(product_count)

    db.add(
        CatalogActivity(
            shop_id=category.shop_id,
            user_id=actor.id,
            action=CatalogAction.CATEGORY_DELETED,
            activity_metadata={"category_name": category.name},
        )
    )
    db.delete(category)
    db.flush()
