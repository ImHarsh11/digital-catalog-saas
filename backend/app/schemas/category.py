from datetime import datetime

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    display_order: int = Field(default=0, ge=0)


class CategoryUpdate(BaseModel):
    """Partial update -- all fields optional (PUT semantics, exclude_unset)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CategoryRead(BaseModel):
    id: int
    shop_id: int
    name: str
    description: str | None
    display_order: int
    is_active: bool
    product_count: int
    created_at: datetime
    updated_at: datetime
