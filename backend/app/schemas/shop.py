from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import SubscriptionStatus
from app.schemas.activity import RecentActivityItem
from app.schemas.user import UserRead

_SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class ShopBrief(BaseModel):
    """Minimal shop info embedded in the /api/auth/me response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool
    subscription_status: SubscriptionStatus
    trial_end_date: date | None
    trial_days_remaining: int
    trial_status_label: str


class ShopOwnerBrief(BaseModel):
    """Minimal owner info embedded in shop list/detail responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class ShopCreate(BaseModel):
    """Super Admin creates a shop and its owner account in one step.

    A 14-day trial is started automatically -- there's no field for it
    here, it's not something the caller controls.
    """

    name: str = Field(min_length=1, max_length=255)
    # Auto-generated from `name` if omitted; validated against the same
    # pattern either way so a manually-chosen slug can't produce a broken URL.
    slug: str | None = Field(default=None, pattern=_SLUG_PATTERN, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=1024)
    logo_url: str | None = Field(default=None, max_length=1024)

    owner_name: str = Field(min_length=1, max_length=255)
    owner_email: EmailStr
    # max_length=72 matches bcrypt's byte limit (app/auth/security.py) --
    # rejected here with a clean 422 rather than a 500 from hash_password.
    owner_password: str = Field(min_length=8, max_length=72)


class ShopUpdate(BaseModel):
    """Partial update of shop profile fields (Super Admin "Edit shop").

    Slug is intentionally not editable here -- shops are found by slug in
    already-shared/printed QR codes and URLs, so changing it after
    creation would silently break them.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=1024)
    logo_url: str | None = Field(default=None, max_length=1024)


class ShopStatusUpdate(BaseModel):
    """Activate/deactivate a shop's customer-facing catalog."""

    is_active: bool


class ShopListItem(BaseModel):
    """One row of the Super Admin shop table."""

    id: int
    name: str
    slug: str
    is_active: bool
    subscription_status: SubscriptionStatus
    trial_end_date: date | None
    trial_days_remaining: int
    trial_status_label: str
    owner: ShopOwnerBrief | None
    product_count: int
    created_at: datetime


class ShopDetail(ShopListItem):
    """Full shop profile + basic catalog stats (Super Admin shop detail page)."""

    description: str | None
    phone: str | None
    address: str | None
    city: str | None
    website: str | None
    logo_url: str | None
    updated_at: datetime
    products_available: int
    products_sold: int
    products_out_of_stock: int
    products_added_this_week: int


class ShopCreateResponse(BaseModel):
    shop: ShopDetail
    owner: UserRead


class ShopDetailResponse(BaseModel):
    shop: ShopDetail
    recent_activity: list[RecentActivityItem]
