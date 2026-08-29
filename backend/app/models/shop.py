from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import SubscriptionStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.catalog_activity import CatalogActivity
    from app.models.category import Category
    from app.models.customer_event import CustomerEvent
    from app.models.product import Product
    from app.models.shop_billing import ShopBilling
    from app.models.user import User

# Kept in sync with app.services.shop.TRIAL_LENGTH_DAYS; duplicated here only
# so a bare `Shop(...)` in a test still gets a sensible default trial.
_DEFAULT_TRIAL_DAYS = 14

# Legacy kwargs that used to be columns on `shops` and now live on
# `shop_billing`. `Shop(**kw)` still accepts them and routes them into the
# auto-created billing row, so existing call sites and tests keep working.
_BILLING_KWARGS = {
    "trial_start_date",
    "trial_end_date",
    "subscription_status",
    "paid_until",
    "grace_until",
}


class Shop(Base, TimestampMixin):
    """A single physical shop's digital catalog tenant.

    One shop = one catalog = (at most) one owner account. No branches, no
    multi-tenant inventory sharing. Billing lifecycle state (trial window,
    paid-through date, subscription status) lives on the 1:1 `billing`
    relationship (`shop_billing` table), not on this row.
    """

    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Validated semantic theme config (see app.schemas.theme.ThemeConfig).
    # NULL means "the default preset" -- the resolver handles it.
    theme: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    billing: Mapped["ShopBilling"] = relationship(
        back_populates="shop",
        uselist=False,
        lazy="joined",
        cascade="all, delete-orphan",
        single_parent=True,
    )
    owner: Mapped["User | None"] = relationship(back_populates="shop", uselist=False)
    categories: Mapped[list["Category"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    catalog_activities: Mapped[list["CatalogActivity"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    customer_events: Mapped[list["CustomerEvent"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )

    def __init__(self, **kw: Any) -> None:
        billing_kw = {k: kw.pop(k) for k in list(kw) if k in _BILLING_KWARGS}
        super().__init__(**kw)
        # Every shop always has a billing row. Defaults mirror what the
        # Super Admin's "create shop" flow does: a 14-day trial from today.
        from app.models.shop_billing import ShopBilling

        today = date.today()
        self.billing = ShopBilling(
            status=billing_kw.get("subscription_status") or SubscriptionStatus.TRIAL,
            trial_start_date=billing_kw.get("trial_start_date", today),
            trial_end_date=billing_kw.get(
                "trial_end_date", today + timedelta(days=_DEFAULT_TRIAL_DAYS)
            ),
            paid_until=billing_kw.get("paid_until"),
            grace_until=billing_kw.get("grace_until"),
        )

    # -- Backwards-compat read shims -------------------------------------
    # A number of call sites and tests still read `shop.subscription_status`
    # / `shop.trial_end_date`. These proxy to the billing row so they keep
    # working; new code should read `shop.billing.*` directly.

    @property
    def subscription_status(self) -> SubscriptionStatus | None:
        return self.billing.status if self.billing else None

    @property
    def trial_start_date(self) -> date | None:
        return self.billing.trial_start_date if self.billing else None

    @property
    def trial_end_date(self) -> date | None:
        return self.billing.trial_end_date if self.billing else None

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Shop id={self.id} slug={self.slug!r}>"
