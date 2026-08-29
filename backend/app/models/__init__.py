"""ORM models package.

Importing this package registers every model's table on
`app.database.session.Base.metadata`, which is what Alembic autogenerate
and `Base.metadata.create_all()` (used in tests) rely on.
"""

from app.models.billing_plan import BillingPlan
from app.models.catalog_activity import CatalogActivity
from app.models.category import Category
from app.models.customer_contact import CustomerContact
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
from app.models.product_like import ProductLike
from app.models.razorpay_event import RazorpayEvent
from app.models.selection import Selection, SelectionItem
from app.models.shop import Shop
from app.models.shop_billing import ShopBilling
from app.models.subscription_invoice import SubscriptionInvoice
from app.models.user import User

__all__ = [
    "BillingPlan",
    "CatalogAction",
    "CatalogActivity",
    "Category",
    "CustomerContact",
    "CustomerEvent",
    "CustomerEventType",
    "Product",
    "ProductImage",
    "ProductLike",
    "ProductStatus",
    "RazorpayEvent",
    "Selection",
    "SelectionItem",
    "Shop",
    "ShopBilling",
    "SubscriptionInvoice",
    "SubscriptionStatus",
    "User",
    "UserRole",
]
