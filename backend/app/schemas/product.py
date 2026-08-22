from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ProductStatus, UserRole


class ProductCategoryBrief(BaseModel):
    id: int
    name: str


class ProductCreatorBrief(BaseModel):
    """Who added this product -- the shop owner themselves, or the SaaS
    catalog team (Super Admin) on their behalf. Surfaced in the admin UI so
    the paid catalog-management service can eventually be billed per
    product (spec: business model section)."""

    id: int
    name: str
    role: UserRole


class ProductImageRead(BaseModel):
    id: int
    image_url: str
    display_order: int
    created_at: datetime


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # Optional -- not every traditional shop numbers its stock, and the DB
    # column is nullable for exactly that reason. When given, it must be
    # unique within the shop (enforced in the service layer + DB constraint).
    product_code: str | None = Field(default=None, max_length=100)
    category_id: int
    price: float = Field(gt=0, le=10_000_000)
    description: str | None = Field(default=None, max_length=4000)
    status: ProductStatus = ProductStatus.AVAILABLE
    quantity_available: int = Field(default=1, ge=0)
    discount_percent: float | None = Field(default=None, ge=0, le=100)

    @field_validator("product_code")
    @classmethod
    def _blank_code_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ProductUpdate(BaseModel):
    """Partial update of product fields. Status is intentionally not here --
    it goes through the dedicated PATCH .../status endpoint so each
    transition (sold/available/out of stock) gets its own catalog_activity
    action, matching the ShopStatusUpdate pattern from Phase 3."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    product_code: str | None = Field(default=None, max_length=100)
    category_id: int | None = None
    price: float | None = Field(default=None, gt=0, le=10_000_000)
    description: str | None = Field(default=None, max_length=4000)
    quantity_available: int | None = Field(default=None, ge=0)
    discount_percent: float | None = Field(default=None, ge=0, le=100)

    @field_validator("product_code")
    @classmethod
    def _blank_code_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ProductStatusUpdate(BaseModel):
    status: ProductStatus


class ProductListItem(BaseModel):
    id: int
    shop_id: int
    name: str
    product_code: str | None
    category: ProductCategoryBrief
    price: float
    status: ProductStatus
    primary_image_url: str | None
    image_count: int
    created_by: ProductCreatorBrief | None
    created_at: datetime
    quantity_available: int
    discount_percent: float | None


class ProductDetail(ProductListItem):
    description: str | None
    images: list[ProductImageRead]
    updated_at: datetime


class ProductImageUploadResponse(BaseModel):
    """Returned after a successful image upload -- the new image plus the
    product's current primary_image_url (which may have just changed, if
    this was the product's first image)."""

    image: ProductImageRead
    primary_image_url: str | None
