from pydantic import BaseModel


class SuperAdminDashboardStats(BaseModel):
    """Top-line counters for the Super Admin dashboard (spec section 9)."""

    total_shops: int
    active_shops: int
    trial_shops: int
    expired_trials: int
    total_products: int
    products_added_this_week: int
