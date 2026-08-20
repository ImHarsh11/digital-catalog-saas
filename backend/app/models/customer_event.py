from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import CustomerEventType

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.shop import Shop


class CustomerEvent(Base):
    """Anonymous customer-side analytics event (no login, minimal PII).

    e.g. SHOP_VIEW, PRODUCT_VIEW, SEARCH, CATEGORY_VIEW.
    """

    __tablename__ = "customer_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[CustomerEventType] = mapped_column(
        Enum(CustomerEventType, name="customer_event_type", native_enum=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Anonymous, ephemeral, browser-generated session id — not tied to any
    # personal identity. Used only to de-duplicate/session-group events.
    anonymous_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    shop: Mapped["Shop"] = relationship(back_populates="customer_events")
    product: Mapped["Product | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CustomerEvent id={self.id} shop_id={self.shop_id} type={self.event_type}>"
