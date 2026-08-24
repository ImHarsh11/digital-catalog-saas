"""Product interest/like from an anonymous catalog visitor.

Each like is scoped to a (shop, product, session) triple — the session id
is the browser-generated anonymous identifier, same as in CustomerEvent.
A customer can like a product once per session; the unique constraint
prevents duplicates.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.shop import Shop


class ProductLike(Base):
    __tablename__ = "product_likes"
    __table_args__ = (
        UniqueConstraint("product_id", "anonymous_session_id", name="uq_product_like_session"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    anonymous_session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    shop: Mapped["Shop"] = relationship()
    product: Mapped["Product"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ProductLike id={self.id} product_id={self.product_id}>"
