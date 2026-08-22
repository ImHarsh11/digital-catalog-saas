from pydantic import BaseModel

from app.models.enums import SubscriptionStatus


class SuperAdminDashboardStats(BaseModel):
    """Top-line counters for the Super Admin dashboard (spec section 9)."""

    total_shops: int
    active_shops: int
    trial_shops: int
    expired_trials: int
    total_products: int
    products_added_this_week: int


class ShopOwnerDashboardStats(BaseModel):
    """Top-line counters for the shop-owner dashboard (Phase 4).

    Reuses `shop_service.get_shop_stats` -- the same product breakdown
    already built for the Super Admin's shop-detail page in Phase 3 --
    plus the shop's own trial status, so the dashboard is a single request.
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
