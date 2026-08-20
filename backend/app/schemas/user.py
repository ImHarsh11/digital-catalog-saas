from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    shop_id: int | None
    is_active: bool
    created_at: datetime
