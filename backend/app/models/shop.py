from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import SubscriptionStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.catalog_activity import CatalogActivity
    from app.models.category import Category
    from app.models.customer_event import CustomerEvent
    from app.models.product import Product
    from app.models.user import User


class Shop(Base, TimestampMixin):
    """A single physical shop's digital catalog tenant.

    One shop = one catalog = (at most) one owner account. No branches, no
    multi-tenant inventory sharing.
    """

    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    trial_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    trial_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status", native_enum=True),
        default=SubscriptionStatus.TRIAL,
        server_default=SubscriptionStatus.TRIAL.value,
        nullable=False,
    )

    owner: Mapped["User | None"] = relationship(back_populates="shop", uselist=False)
    categories: Mapped[list["Category"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    catalog_activities: Mapped[list["CatalogActivity"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )
    customer_events: Mapped[list["CustomerEvent"]] = relationship(
        back_populates="shop", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Shop id={self.id} slug={self.slug!r}>"
