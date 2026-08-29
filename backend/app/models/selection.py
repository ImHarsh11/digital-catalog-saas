"""Guest "My Selection" — a device-local shortlist a customer builds while
browsing and shows to shop staff in person (redesign Phase 4).

Not a cart: no checkout, no pricing total, no login. Keyed by a persistent
browser id (``device_id``, localStorage) so it survives closing the tab.
One selection per (shop, device). If the visitor later fills the optional
consent popup, ``customer_contact_id`` links the selection to that contact
so the shop owner's Leads view can show "who selected what".
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.customer_contact import CustomerContact
    from app.models.product import Product
    from app.models.shop import Shop


class Selection(Base, TimestampMixin):
    __tablename__ = "selections"
    __table_args__ = (
        UniqueConstraint("shop_id", "device_id", name="uq_selection_shop_device"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    customer_contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_contacts.id", ondelete="SET NULL"), nullable=True
    )

    shop: Mapped["Shop"] = relationship(back_populates="selections")
    contact: Mapped["CustomerContact | None"] = relationship(back_populates="selection")
    items: Mapped[list["SelectionItem"]] = relationship(
        back_populates="selection",
        cascade="all, delete-orphan",
        order_by="SelectionItem.added_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Selection id={self.id} shop_id={self.shop_id} items={len(self.items)}>"


class SelectionItem(Base):
    __tablename__ = "selection_items"
    __table_args__ = (
        UniqueConstraint("selection_id", "product_id", name="uq_selection_item_product"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    selection_id: Mapped[int] = mapped_column(
        ForeignKey("selections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    selection: Mapped["Selection"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SelectionItem selection_id={self.selection_id} product_id={self.product_id}>"
