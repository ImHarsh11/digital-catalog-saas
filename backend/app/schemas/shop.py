from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import SubscriptionStatus
from app.schemas.theme import ResolvedTheme, ThemeConfig
from app.schemas.user import UserRead
from app.services.theme import PRESETS

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


class ShopBillingDetail(BaseModel):
    """The Super Admin's Billing tab for one shop, and the owner's own
    read-only billing panel. Razorpay fields arrive in Phase 5."""

    status: SubscriptionStatus
    trial_start_date: date | None
    trial_end_date: date | None
    paid_until: date | None
    grace_until: date | None
    days_remaining: int
    lifecycle_label: str
    is_catalog_live: bool


class ShopCreate(BaseModel):
    """Super Admin creates a shop and its owner account in one step.

    A trial is started automatically; `trial_days` lets the onboarding flow
    pick its length (default 14).
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
    trial_days: int = Field(default=14, ge=1, le=90)
    theme_preset: str | None = None

    owner_name: str = Field(min_length=1, max_length=255)
    owner_email: EmailStr
    # max_length=72 matches bcrypt's byte limit (app/auth/security.py) --
    # rejected here with a clean 422 rather than a 500 from hash_password.
    owner_password: str = Field(min_length=8, max_length=72)

    @field_validator("theme_preset")
    @classmethod
    def _known_preset(cls, v: str | None) -> str | None:
        if v is not None and v not in PRESETS:
            raise ValueError(f"Unknown theme preset '{v}'.")
        return v


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


class ShopBillingUpdate(BaseModel):
    """Manual billing adjustment by the Super Admin (pre-Razorpay).

    Every field is optional -- send only what changes. Setting `status` to
    ACTIVE without a `paid_until` is allowed: it means "the admin has
    vouched for this shop" until Phase 5 makes payment the source of truth.
    """

    status: SubscriptionStatus | None = None
    trial_end_date: date | None = None
    paid_until: date | None = None
    grace_until: date | None = None


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
    """Full shop profile (Super Admin shop detail, and the owner's own
    profile). Catalog stats live on the owner's /dashboard, not here."""

    description: str | None
    phone: str | None
    address: str | None
    city: str | None
    website: str | None
    logo_url: str | None
    updated_at: datetime


class ShopCreateResponse(BaseModel):
    shop: ShopDetail
    owner: UserRead


class ShopDetailResponse(BaseModel):
    shop: ShopDetail
    billing: ShopBillingDetail
    theme_config: ThemeConfig
    theme_resolved: ResolvedTheme
