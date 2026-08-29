"""Business logic for Super Admin shop management (Phase 3).

Mutating functions here only `flush()` (never `commit()`) -- committing is
the API layer's job, same convention `app/database/seed.py` already uses,
so a failed request can be cleanly rolled back by its caller.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth.security import hash_password
from app.models.catalog_activity import CatalogActivity
from app.models.enums import CatalogAction, ProductStatus, SubscriptionStatus, UserRole
from app.models.product import Product
from app.models.shop import Shop
from app.models.shop_billing import ShopBilling
from app.models.user import User
from app.schemas.shop import ShopBillingUpdate, ShopCreate, ShopUpdate
from app.utils.slugify import slugify

TRIAL_LENGTH_DAYS = 14


class ShopSlugTakenError(Exception):
    def __init__(self, slug: str):
        self.slug = slug
        super().__init__(f"Slug '{slug}' is already in use.")


class OwnerEmailTakenError(Exception):
    def __init__(self, email: str):
        self.email = email
        super().__init__(f"Email '{email}' is already in use.")


def _unique_slug(db: Session, base_name: str) -> str:
    base = slugify(base_name)
    slug = base
    counter = 2
    while db.query(Shop.id).filter(Shop.slug == slug).first() is not None:
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def create_shop_with_owner(db: Session, payload: ShopCreate) -> tuple[Shop, User]:
    """Create a shop, start its 14-day trial, and create its owner account.

    All three happen together -- per the spec, a shop is only ever created
    by the Super Admin, and it always has exactly one owner account from
    the moment it exists.
    """
    if payload.slug:
        slug = slugify(payload.slug)
        if db.query(Shop.id).filter(Shop.slug == slug).first() is not None:
            raise ShopSlugTakenError(slug)
    else:
        slug = _unique_slug(db, payload.name)

    if db.query(User.id).filter(User.email == payload.owner_email).first() is not None:
        raise OwnerEmailTakenError(payload.owner_email)

    today = date.today()
    trial_days = getattr(payload, "trial_days", None) or TRIAL_LENGTH_DAYS
    shop = Shop(
        name=payload.name,
        slug=slug,
        logo_url=payload.logo_url,
        description=payload.description,
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        website=payload.website,
        is_active=True,
        trial_start_date=today,
        trial_end_date=today + timedelta(days=trial_days),
        subscription_status=SubscriptionStatus.TRIAL,
        theme={"preset": payload.theme_preset} if getattr(payload, "theme_preset", None) else None,
    )
    db.add(shop)
    db.flush()  # populates shop.id (and shop_billing.shop_id) for the owner's FK

    owner = User(
        name=payload.owner_name,
        email=payload.owner_email,
        password_hash=hash_password(payload.owner_password),
        role=UserRole.SHOP_OWNER,
        shop_id=shop.id,
        is_active=True,
    )
    db.add(owner)
    db.flush()

    return shop, owner


def update_shop(db: Session, shop: Shop, payload: ShopUpdate) -> Shop:
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(shop, field, value)
    if changes:
        db.add(
            CatalogActivity(
                shop_id=shop.id,
                action=CatalogAction.SHOP_UPDATED,
                activity_metadata={"fields": sorted(changes.keys())},
            )
        )
    db.flush()
    return shop


def update_billing(db: Session, shop: Shop, payload: ShopBillingUpdate) -> Shop:
    """Manual billing adjustment (Super Admin, pre-Razorpay). Only the
    fields present in the payload are changed."""
    if shop.billing is None:
        shop.billing = ShopBilling(shop_id=shop.id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(shop.billing, field, value)
    db.flush()
    return shop


def set_shop_active(db: Session, shop: Shop, is_active: bool) -> Shop:
    shop.is_active = is_active
    db.add(
        CatalogActivity(
            shop_id=shop.id,
            action=CatalogAction.SHOP_UPDATED,
            activity_metadata={"is_active": is_active},
        )
    )
    db.flush()
    return shop


def list_shops(db: Session) -> list[Shop]:
    return (
        db.query(Shop)
        .options(joinedload(Shop.owner))
        .order_by(Shop.created_at.desc())
        .all()
    )


def get_shop(db: Session, shop_id: int) -> Shop | None:
    return (
        db.query(Shop).options(joinedload(Shop.owner)).filter(Shop.id == shop_id).first()
    )


def get_product_counts_by_shop(db: Session) -> dict[int, int]:
    return dict(db.query(Product.shop_id, func.count(Product.id)).group_by(Product.shop_id).all())


def get_shop_stats(db: Session, shop_id: int) -> dict[str, int]:
    status_counts = dict(
        db.query(Product.status, func.count(Product.id))
        .filter(Product.shop_id == shop_id)
        .group_by(Product.status)
        .all()
    )
    week_ago = datetime.utcnow() - timedelta(days=7)
    products_this_week = (
        db.query(func.count(Product.id))
        .filter(Product.shop_id == shop_id, Product.created_at >= week_ago)
        .scalar()
        or 0
    )
    return {
        "product_count": sum(status_counts.values()),
        "products_available": status_counts.get(ProductStatus.AVAILABLE, 0),
        "products_sold": status_counts.get(ProductStatus.SOLD, 0),
        "products_out_of_stock": status_counts.get(ProductStatus.OUT_OF_STOCK, 0),
        "products_added_this_week": products_this_week,
    }


def get_recent_activity(db: Session, shop_id: int, limit: int = 20) -> list[CatalogActivity]:
    return (
        db.query(CatalogActivity)
        .options(joinedload(CatalogActivity.product), joinedload(CatalogActivity.user))
        .filter(CatalogActivity.shop_id == shop_id)
        .order_by(CatalogActivity.created_at.desc())
        .limit(limit)
        .all()
    )
