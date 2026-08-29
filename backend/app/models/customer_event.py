from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import CustomerEventType

if TYPE_CHECKING:
    from app.models.category import Category
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
    # Which category a CATEGORY_VIEW event was for (null for every other
    # event type). SET NULL so a later category deletion doesn't destroy
    # historical analytics rows -- Phase 6 addition.
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
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
    # Persistent (localStorage) per-device id. Anonymous, no personal data.
    # Preferred key for "unique visitors" — survives closing the tab, so a
    # repeat QR scan from the same phone is the same visitor (Phase 7).
    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # The raw search text for a SEARCH event (null for every other event
    # type). Not collected in Phase 5 -- added in Phase 6 so the pilot
    # analytics dashboard can surface top searched terms; existing rows
    # simply have no value here.
    search_query: Mapped[str | None] = mapped_column(String(255), nullable=True)

    shop: Mapped["Shop"] = relationship(back_populates="customer_events")
    product: Mapped["Product | None"] = relationship()
    category: Mapped["Category | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CustomerEvent id={self.id} shop_id={self.shop_id} type={self.event_type}>"
