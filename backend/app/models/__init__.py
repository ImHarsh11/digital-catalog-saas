"""ORM models package.

Importing this package registers every model's table on
`app.database.session.Base.metadata`, which is what Alembic autogenerate
and `Base.metadata.create_all()` (used in tests) rely on.
"""

from app.models.catalog_activity import CatalogActivity
from app.models.category import Category
from app.models.customer_event import CustomerEvent
from app.models.enums import (
    CatalogAction,
    CustomerEventType,
    ProductStatus,
    SubscriptionStatus,
    UserRole,
)
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.shop import Shop
from app.models.user import User

__all__ = [
    "CatalogAction",
    "CatalogActivity",
    "Category",
    "CustomerEvent",
    "CustomerEventType",
    "Product",
    "ProductImage",
    "ProductStatus",
    "Shop",
    "SubscriptionStatus",
    "User",
    "UserRole",
]
