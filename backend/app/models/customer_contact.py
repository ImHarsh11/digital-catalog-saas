"""Optional customer contact info collected via a consent popup on the
public catalog (redesign Phase 4).

Customers are never required to provide this — the popup is skippable.
Two separate, unbundled consents are recorded (India DPDP Act 2023):
``consent_processing`` (store my details so the shop can assist me —
required to submit) and ``consent_marketing`` (send me updates — optional).
Contact info is tied to a shop so each owner sees only their own customers.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:
    from app.models.selection import Selection
    from app.models.shop import Shop


class CustomerContact(Base):
    __tablename__ = "customer_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    anonymous_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    consent_processing: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    consent_marketing: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    consent_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    shop: Mapped["Shop"] = relationship()
    selection: Mapped["Selection | None"] = relationship(
        back_populates="contact", uselist=False
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CustomerContact id={self.id} shop_id={self.shop_id} name={self.name!r}>"
