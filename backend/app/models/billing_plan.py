"""Subscription plans a shop can be billed on (redesign Phase 5).

One row per purchasable plan. Launch has a single plan -- ₹999/month with
UPI autopay -- but the table lets the Super Admin add or retire plans
without a code change. `razorpay_plan_id` is the id of the matching Plan in
the Razorpay dashboard; it is filled in the first time a subscription is
created against this plan (or set by hand).
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.shop_billing import ShopBilling


class BillingPlan(Base, TimestampMixin):
    __tablename__ = "billing_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable internal identifier, e.g. "monthly-999". Never shown to users.
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # Amount charged each period, in the smallest currency unit (paise).
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    # "monthly" or "yearly" -- Razorpay's `period`.
    interval: Mapped[str] = mapped_column(String(10), default="monthly", nullable=False)
    interval_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    razorpay_plan_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    billings: Mapped[list["ShopBilling"]] = relationship(back_populates="plan")

    @property
    def amount_rupees(self) -> float:
        return self.amount / 100

    @property
    def monthly_amount(self) -> int:
        """`amount` normalised to a single month, for MRR math."""
        months = 12 * self.interval_count if self.interval == "yearly" else self.interval_count
        return round(self.amount / months) if months else self.amount

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<BillingPlan {self.code} {self.amount}{self.currency}/{self.interval}>"
