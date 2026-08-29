from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import SubscriptionStatus


class TrialExpiringItem(BaseModel):
    shop_id: int
    name: str
    slug: str
    owner_email: str | None
    trial_end_date: date | None
    days_remaining: int
    expired: bool


class DormantShopItem(BaseModel):
    shop_id: int
    name: str
    slug: str
    last_activity_at: datetime | None


class SignupsPoint(BaseModel):
    bucket: str
    count: int


class SuperAdminDashboardStats(BaseModel):
    """Tenant-lifecycle and revenue view for the Super Admin.

    Deliberately carries no catalog-engagement data (product views,
    searches, sales) -- that belongs to the shop owner after the role
    redesign. Revenue fields are None with `revenue_pending=True` until
    Razorpay lands in Phase 5.
    """

    total_shops: int
    live_catalogs: int
    by_status: dict[str, int]
    new_shops_this_week: int
    new_shops_this_month: int
    signups_series: list[SignupsPoint]
    trials_expiring_soon: list[TrialExpiringItem]
    dormant_shops: list[DormantShopItem]

    revenue_pending: bool
    mrr: float | None
    arr: float | None
    revenue_this_month: float | None
    trial_to_paid_rate: float | None
    churn_this_month: int | None


class ShopOwnerDashboardStats(BaseModel):
    """Top-line counters for the shop-owner dashboard.

    Reuses `shop_service.get_shop_stats` -- the product breakdown -- plus
    the shop's own billing status, so the dashboard is a single request.
    """

    product_count: int
    products_available: int
    products_sold: int
    products_out_of_stock: int
    products_added_this_week: int
    is_active: bool
    subscription_status: SubscriptionStatus
    trial_days_remaining: int
    trial_status_label: str
