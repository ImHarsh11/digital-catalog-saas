from pydantic import BaseModel

from app.schemas.shop import ShopBrief
from app.schemas.user import UserRead


class MeResponse(BaseModel):
    user: UserRead
    shop: ShopBrief | None = None
