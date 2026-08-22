from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import ProductStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.product_image import ProductImage
    from app.models.shop import Shop
    from app.models.user import User


class Product(Base, TimestampMixin):
    """A single catalog item belonging to one shop."""

    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("shop_id", "product_code", name="uq_product_shop_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT: a category with products can't be deleted out from under them;
    # the shop owner must reassign/remove the products first.
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    product_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status", native_enum=True),
        default=ProductStatus.AVAILABLE,
        server_default=ProductStatus.AVAILABLE.value,
        nullable=False,
    )
    primary_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    quantity_available: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    # Who uploaded this product — shop owner themselves, or the SaaS catalog
    # team on their behalf. Drives the future per-product service billing.
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    shop: Mapped["Shop"] = relationship(back_populates="products")
    category: Mapped["Category"] = relationship(back_populates="products")
    creator: Mapped["User | None"] = relationship(
        back_populates="created_products", foreign_keys=[created_by]
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Product id={self.id} shop_id={self.shop_id} name={self.name!r}>"
