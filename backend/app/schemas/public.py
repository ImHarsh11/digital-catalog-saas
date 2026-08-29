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
from app.schemas.theme import ResolvedTheme


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


class PublicPromo(BaseModel):
    key: str
    title: str
    subtitle: str
    kind: str  # on_sale | new_arrivals | new_collection


class PublicShopResponse(BaseModel):
    shop: PublicShop
    categories: list[PublicCategory]
    theme: ResolvedTheme
    promos: list[PublicPromo] = []


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
    """Payload for the optional consent popup on the public catalog.

    At least one contact field must be provided, and ``consent_processing``
    must be true -- storing the details is what the popup exists to do, so
    submitting without that consent is meaningless. ``consent_marketing``
    is separate and optional (DPDP Act 2023 -- unbundled consent).
    """

    name: str | None = Field(default=None, max_length=255)
    whatsapp: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=255)
    consent_processing: bool = False
    consent_marketing: bool = False

    @model_validator(mode="after")
    def _valid(self) -> "CustomerContactCreate":
        if not any([self.name, self.whatsapp, self.email]):
            raise ValueError("At least one of name, whatsapp, or email must be provided.")
        if not self.consent_processing:
            raise ValueError("Consent to store the details is required.")
        return self


class CustomerContactResponse(BaseModel):
    id: int
    name: str | None
    whatsapp: str | None
    email: str | None
    consent_marketing: bool


class ProductLikeResponse(BaseModel):
    product_id: int
    liked: bool
    like_count: int
