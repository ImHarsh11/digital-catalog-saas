"""Schemas for the guest selection list and the owner's Leads view."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.public import PublicProductListItem


class SelectionItemAdd(BaseModel):
    product_id: int
    note: str | None = Field(default=None, max_length=255)


class SelectionItemNote(BaseModel):
    note: str | None = Field(default=None, max_length=255)


class PublicSelectionItem(BaseModel):
    product: PublicProductListItem
    note: str | None
    added_at: datetime


class PublicSelection(BaseModel):
    items: list[PublicSelectionItem]
    count: int
    contact_captured: bool


# ── Owner: Leads ────────────────────────────────────────────────────────────


class LeadSelectionItem(BaseModel):
    product_id: int
    name: str
    primary_image_url: str | None
    price: float
    discount_percent: float | None = None
    note: str | None


class Lead(BaseModel):
    contact_id: int
    name: str | None
    whatsapp: str | None
    email: str | None
    consent_marketing: bool
    created_at: datetime
    selected_items: list[LeadSelectionItem]
