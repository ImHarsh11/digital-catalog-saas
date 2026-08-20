from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import CatalogAction

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.shop import Shop
    from app.models.user import User


class CatalogActivity(Base):
    """Audit trail of admin-side actions, used to understand pilot usage.

    e.g. PRODUCT_CREATED, PRODUCT_MARKED_SOLD, SHOP_UPDATED, ...
    """

    __tablename__ = "catalog_activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[CatalogAction] = mapped_column(
        Enum(CatalogAction, name="catalog_action", native_enum=True), nullable=False
    )
    # Mapped to the DB column "metadata"; the Python attribute is renamed to
    # avoid clashing with SQLAlchemy's reserved `Base.metadata` attribute.
    activity_metadata: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    shop: Mapped["Shop"] = relationship(back_populates="catalog_activities")
    product: Mapped["Product | None"] = relationship()
    user: Mapped["User | None"] = relationship(back_populates="catalog_activities")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CatalogActivity id={self.id} shop_id={self.shop_id} action={self.action}>"
