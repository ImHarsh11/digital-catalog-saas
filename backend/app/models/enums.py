"""Shared enums used by both ORM models and Pydantic schemas.

Defined once here (rather than duplicated per-layer) so the set of valid
values only has to be updated in one place.
"""

import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SHOP_OWNER = "SHOP_OWNER"


class SubscriptionStatus(str, enum.Enum):
    """A shop's billing lifecycle state (stored on `shop_billing.status`).

    TRIAL     -- inside the free trial window (trial_end_date in the future)
    ACTIVE    -- a paid subscription is current
    PAST_DUE  -- a renewal charge failed; inside the grace window, catalog
                 stays live (added with Razorpay, Phase 5)
    EXPIRED   -- trial ended without payment, or grace window elapsed
    SUSPENDED -- switched off by the Super Admin, regardless of billing
    CANCELLED -- subscription cancelled; catalog stays live until paid_until
                 (added with Razorpay, Phase 5)
    """

    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"


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
    PRODUCT_MARKED_OUT_OF_STOCK = "PRODUCT_MARKED_OUT_OF_STOCK"
    PRODUCT_IMAGE_UPLOADED = "PRODUCT_IMAGE_UPLOADED"
    PRODUCT_IMAGE_DELETED = "PRODUCT_IMAGE_DELETED"
    CATEGORY_CREATED = "CATEGORY_CREATED"
    CATEGORY_UPDATED = "CATEGORY_UPDATED"
    CATEGORY_DELETED = "CATEGORY_DELETED"
    SHOP_UPDATED = "SHOP_UPDATED"


class CustomerEventType(str, enum.Enum):
    SHOP_VIEW = "SHOP_VIEW"
    PRODUCT_VIEW = "PRODUCT_VIEW"
    SEARCH = "SEARCH"
    CATEGORY_VIEW = "CATEGORY_VIEW"
    ADD_TO_SELECTION = "ADD_TO_SELECTION"
