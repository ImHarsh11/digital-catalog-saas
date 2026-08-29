"""A successful subscription charge (redesign Phase 5).

Written from the Razorpay `subscription.charged` webhook. This is the
source of truth for the Super Admin's revenue figures (revenue this month,
and historical). One row per paid billing cycle.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:
    from app.models.shop import Shop


class SubscriptionInvoice(Base):
    __tablename__ = "subscription_invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )

    razorpay_invoice_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # paise
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    shop: Mapped["Shop"] = relationship(back_populates="invoices")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SubscriptionInvoice shop_id={self.shop_id} amount={self.amount} paid_at={self.paid_at}>"
