"""Shared enums used by both ORM models and Pydantic schemas.

Defined once here (rather than duplicated per-layer) so the set of valid
values only has to be updated in one place.
"""

import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SHOP_OWNER = "SHOP_OWNER"


class SubscriptionStatus(str, enum.Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"


class ProductStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    SOLD = "SOLD"
    OUT_OF_STOCK = "OUT_OF_STOCK"


class CatalogAction(str, enum.Enum):
    PRODUCT_CREATED = "PRODUCT_CREATED"
    PRODUCT_UPDATED = "PRODUCT_UPDATED"
    PRODUCT_DELETED = "PRODUCT_DELETED"
    PRODUCT_MARKED_SOLD = "PRODUCT_MARKED_SOLD"
    PRODUCT_MARKED_AVAILABLE = "PRODUCT_MARKED_AVAILABLE"
    PRODUCT_IMAGE_UPLOADED = "PRODUCT_IMAGE_UPLOADED"
    SHOP_UPDATED = "SHOP_UPDATED"


class CustomerEventType(str, enum.Enum):
    SHOP_VIEW = "SHOP_VIEW"
    PRODUCT_VIEW = "PRODUCT_VIEW"
    SEARCH = "SEARCH"
    CATEGORY_VIEW = "CATEGORY_VIEW"
