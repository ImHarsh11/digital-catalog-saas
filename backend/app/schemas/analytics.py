from pydantic import BaseModel


class TopProductStat(BaseModel):
    """One row of the "most-viewed products" list."""

    product_id: int
    name: str
    primary_image_url: str | None
    view_count: int


class TopSearchTerm(BaseModel):
    """One row of the "most-searched terms" list. `term` is lower-cased so
    "Saree" and "saree" count as the same search."""

    term: str
    count: int


class TopCategoryStat(BaseModel):
    """One row of the "category interest" list."""

    category_id: int
    name: str
    view_count: int


class ShopAnalytics(BaseModel):
    """Pilot analytics for a single shop owner's own catalog (Phase 6).

    Deliberately simple stat-card + top-N shape -- no time series, no new
    charting dependency (matches the scoped-down Phase 6 spec).
    """

    shop_views_total: int
    shop_views_last_7_days: int
    product_views_total: int
    product_views_last_7_days: int
    searches_total: int
    searches_last_7_days: int
    top_products: list[TopProductStat]
    top_searches: list[TopSearchTerm]
    top_categories: list[TopCategoryStat]
