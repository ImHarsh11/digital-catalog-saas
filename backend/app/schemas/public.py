"""Response shapes for the public, unauthenticated customer catalog (Phase 5).

Deliberately a separate schema set from `app/schemas/product.py` /
`app/schemas/category.py` rather than reusing those with fields hidden at
the API layer -- these types are the enforcement mechanism that keeps
admin-only data (created_by, catalog_activity, trial/subscription status,
internal timestamps) out of anything a customer's browser can see. If a
field isn't listed on one of these models, it physically cannot leak here.
"""

from pydantic import BaseModel

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


class PublicProductDetail(PublicProductListItem):
    description: str | None
    images: list[PublicProductImage]


class PublicProductPage(BaseModel):
    items: list[PublicProductListItem]
    total: int
    page: int
    page_size: int
    has_more: bool
