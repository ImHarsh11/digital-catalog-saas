from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.catalog_activity import CatalogActivity
    from app.models.product import Product
    from app.models.shop import Shop


class User(Base, TimestampMixin):
    """A dashboard user: either the SaaS Super Admin or a shop owner.

    Customers are never stored here — they don't authenticate at all.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=True), nullable=False
    )
    # One shop = one owner account. NULL for SUPER_ADMIN users. The unique
    # constraint enforces "one shop = one account" at the database level.
    shop_id: Mapped[int | None] = mapped_column(
        ForeignKey("shops.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    shop: Mapped["Shop | None"] = relationship(back_populates="owner")
    created_products: Mapped[list["Product"]] = relationship(
        back_populates="creator", foreign_keys="Product.created_by"
    )
    catalog_activities: Mapped[list["CatalogActivity"]] = relationship(back_populates="user")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
