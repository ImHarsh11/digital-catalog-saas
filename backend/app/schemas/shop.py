from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import SubscriptionStatus


class ShopBrief(BaseModel):
    """Minimal shop info embedded in the /api/auth/me response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool
    subscription_status: SubscriptionStatus
    trial_end_date: date | None
    trial_days_remaining: int
    trial_status_label: str
