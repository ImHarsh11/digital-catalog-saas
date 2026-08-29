"""Per-shop billing lifecycle state (redesign Phase 1).

One row per shop, 1:1 with `shops`. This is the single source of truth for
"where does this shop stand" -- trial window, paid-through date, and the
current `SubscriptionStatus`. It replaces the `trial_start_date`,
`trial_end_date` and `subscription_status` columns that used to live
directly on `shops`.

Phase 1 keeps this deliberately small (trial + paid/grace dates). Phase 5
(Razorpay) adds the subscription/customer ids, mandate status and a
`plan_id` FK onto this same row, so nothing here has to move again.
"""

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import SubscriptionStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.billing_plan import BillingPlan
    from app.models.shop import Shop


class ShopBilling(Base, TimestampMixin):
    __tablename__ = "shop_billing"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )

    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status", native_enum=True),
        default=SubscriptionStatus.TRIAL,
        server_default=SubscriptionStatus.TRIAL.value,
        nullable=False,
    )

    trial_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    trial_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Date the shop's paid access runs through (set on a successful charge,
    # Phase 5). Null while on trial.
    paid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    # While PAST_DUE, the catalog stays live through this date before the
    # sweep job flips the shop to EXPIRED (Phase 5).
    grace_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Razorpay Subscriptions (Phase 5) -------------------------------
    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_plans.id", ondelete="SET NULL"), nullable=True
    )
    razorpay_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    # created | authenticated | active | paused | halted | cancelled | completed
    # Mirrors Razorpay's subscription `status`; null before a subscription exists.
    mandate_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Set when the owner cancels but keeps access until `paid_until`.
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    shop: Mapped["Shop"] = relationship(back_populates="billing")
    plan: Mapped["BillingPlan | None"] = relationship(back_populates="billings")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ShopBilling shop_id={self.shop_id} status={self.status}>"
