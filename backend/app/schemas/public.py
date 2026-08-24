"""Response shapes for the public, unauthenticated customer catalog (Phase 5).

Deliberately a separate schema set from `app/schemas/product.py` /
`app/schemas/category.py` rather than reusing those with fields hidden at
the API layer -- these types are the enforcement mechanism that keeps
admin-only data (created_by, catalog_activity, trial/subscription status,
internal timestamps) out of anything a customer's browser can see. If a
field isn't listed on one of these models, it physically cannot leak here.
"""

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ProductStatus


class PublicCategory(BaseModel):
    id: int
    name: str


class PublicShop(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str | None
    description: str | None
    phone: str | None
    address: str | None
    city: str | None
    website: str | None


class PublicShopResponse(BaseModel):
    shop: PublicShop
    categories: list[PublicCategory]


class PublicProductImage(BaseModel):
    id: int
    image_url: str
    display_order: int


class PublicProductListItem(BaseModel):
    id: int
    name: str
    product_code: str | None
    category: PublicCategory
    price: float
    status: ProductStatus
    primary_image_url: str | None
    quantity_available: int
    discount_percent: float | None
    color: str | None
    brand: str | None


class PublicProductDetail(PublicProductListItem):
    description: str | None
    images: list[PublicProductImage]


class PublicProductPage(BaseModel):
    items: list[PublicProductListItem]
    total: int
    page: int
    page_size: int
    has_more: bool
    suggestions: list[PublicProductListItem] | None = None


class CustomerContactCreate(BaseModel):
    """Payload for the optional customer contact popup.
    At least one contact field must be provided so we don't store
    completely empty rows."""
    name: str | None = Field(default=None, max_length=255)
    whatsapp: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def at_least_one_field(self) -> "CustomerContactCreate":
        if not any([self.name, self.whatsapp, self.email]):
            raise ValueError("At least one of name, whatsapp, or email must be provided.")
        return self


class CustomerContactResponse(BaseModel):
    id: int
    name: str | None
    whatsapp: str | None
    email: str | None


class ProductLikeResponse(BaseModel):
    product_id: int
    liked: bool
    like_count: int
