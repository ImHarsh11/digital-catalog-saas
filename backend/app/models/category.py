from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.shop import Shop


class Category(Base, TimestampMixin):
    """A product category, scoped to a single shop (no global categories)."""

    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("shop_id", "name", name="uq_category_shop_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    shop: Mapped["Shop"] = relationship(back_populates="categories")
    products: Mapped[list["Product"]] = relationship(back_populates="category")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Category id={self.id} shop_id={self.shop_id} name={self.name!r}>"
