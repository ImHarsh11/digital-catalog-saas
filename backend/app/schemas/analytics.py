from pydantic import BaseModel


# ─── Legacy flat analytics (Phase 6) ─────────────────────────────────────────


class TopProductStat(BaseModel):
    """One row of the "most-viewed products" list."""

    product_id: int
    name: str
    primary_image_url: str | None
    view_count: int


class TopSearchTerm(BaseModel):
    """One row of the "most-searched terms" list. `term` is lower-cased."""

    term: str
    count: int


class TopCategoryStat(BaseModel):
    """One row of the "category interest" list."""

    category_id: int
    name: str
    view_count: int


class ShopAnalytics(BaseModel):
    """Flat pilot analytics for the original /analytics endpoint."""

    shop_views_total: int
    shop_views_last_7_days: int
    product_views_total: int
    product_views_last_7_days: int
    searches_total: int
    searches_last_7_days: int
    top_products: list[TopProductStat]
    top_searches: list[TopSearchTerm]
    top_categories: list[TopCategoryStat]


# ─── Rich period-based analytics (Phase 7) ───────────────────────────────────


class PeriodKPI(BaseModel):
    """A metric value for the current period, the prior equal-length period,
    and the percentage change between them."""

    current: int
    previous: int
    change: float  # percentage, positive = growth


class TimeSeriesVisit(BaseModel):
    bucket: str  # ISO-8601 datetime string (truncated to hour/day/week/month)
    visits: int
    unique_visitors: int


class TimeSeriesSale(BaseModel):
    bucket: str
    sold: int


class RichProductStat(BaseModel):
    product_id: int
    name: str
    primary_image_url: str | None
    category_id: int | None
    category_name: str | None
    view_count: int


class RichSoldProductStat(BaseModel):
    product_id: int
    name: str
    primary_image_url: str | None
    category_id: int | None
    category_name: str | None
    sold_count: int


class CategoryStat(BaseModel):
    category_id: int
    name: str
    views: int
    unique_visitors: int
    sold: int
    sales_share: float  # percentage of total sold across all categories


class SearchInsight(BaseModel):
    term: str
    count: int


class SelectedProductStat(BaseModel):
    product_id: int
    name: str
    primary_image_url: str | None
    category_id: int | None
    category_name: str | None
    add_count: int


class RichAnalytics(BaseModel):
    """Comprehensive period-based analytics returned by /analytics/rich."""

    period: str  # today | 7d | 30d | 3m | 1y
    date_range_start: str
    date_range_end: str

    # KPI cards with period comparison
    visits: PeriodKPI
    unique_visitors: PeriodKPI
    product_views: PeriodKPI
    products_sold: PeriodKPI
    selection_adds: PeriodKPI

    # Averages
    avg_visits_per_day: float
    avg_unique_per_day: float

    # Time-series for charts
    visits_series: list[TimeSeriesVisit]
    sales_series: list[TimeSeriesSale]

    # Top lists
    top_viewed_products: list[RichProductStat]
    top_sold_products: list[RichSoldProductStat]
    top_selected_products: list[SelectedProductStat]

    # Breakdowns
    category_stats: list[CategoryStat]
    search_insights: list[SearchInsight]
