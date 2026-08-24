"""Optional customer contact info collected via a popup on the public catalog.

Customers are never required to provide this — the popup is skippable.
Contact info is tied to a shop so each shop owner sees only their own
customers. The anonymous_session_id links back to CustomerEvent rows for
the same browsing session.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    shop: Mapped["Shop"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CustomerContact id={self.id} shop_id={self.shop_id} name={self.name!r}>"
