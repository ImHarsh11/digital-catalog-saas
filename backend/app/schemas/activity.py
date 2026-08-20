from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CatalogAction


class RecentActivityItem(BaseModel):
    """A single catalog_activity row, with related names denormalized in
    (rather than nested product/user objects) since this is only ever used
    for a simple activity feed."""

    id: int
    action: CatalogAction
    product_id: int | None
    product_name: str | None
    user_id: int | None
    user_name: str | None
    created_at: datetime
