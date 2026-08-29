"""Read-only aggregation backing the shop-owner analytics dashboard.

Phase 6 original: flat totals + top-N lists.
Phase 7 extension: rich period-based analytics with time-series, KPI comparisons,
  top sold products (from catalog_activity), category performance, and
  deduped search insights.

`get_shop_analytics` is kept unchanged for backwards compatibility with the
existing /analytics endpoint. The new `get_rich_analytics` backs /analytics/rich.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import distinct as sa_distinct
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.catalog_activity import CatalogActivity
from app.models.category import Category
from app.models.customer_event import CustomerEvent
from app.models.enums import CatalogAction, CustomerEventType
from app.models.product import Product

TOP_N = 5
TOP_N_RICH = 10
MIN_SEARCH_LEN = 3  # Filter out single-char / 2-char partial keystrokes

# All analytics period boundaries and chart buckets are expressed in the
# business timezone. DB timestamps stay TIMESTAMPTZ (UTC-stored); we
# convert boundaries to UTC for comparison and use AT TIME ZONE in
# date_trunc so chart buckets align to IST calendar days/hours/months.
BUSINESS_TZ = ZoneInfo("Asia/Kolkata")
BUSINESS_TZ_PG = "Asia/Kolkata"  # PostgreSQL timezone name for AT TIME ZONE


# ─── Legacy analytics (unchanged) ────────────────────────────────────────────


def _count(db: Session, shop_id: int, event_type: CustomerEventType, *, since: datetime | None = None) -> int:
    query = db.query(func.count(CustomerEvent.id)).filter(
        CustomerEvent.shop_id == shop_id, CustomerEvent.event_type == event_type
    )
    if since is not None:
        query = query.filter(CustomerEvent.created_at >= since)
    return query.scalar() or 0


def _top_products(db: Session, shop_id: int) -> list[dict]:
    rows = (
        db.query(
            Product.id, Product.name, Product.primary_image_url, func.count(CustomerEvent.id).label("view_count")
        )
        .join(CustomerEvent, CustomerEvent.product_id == Product.id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.PRODUCT_VIEW,
            CustomerEvent.product_id.isnot(None),
        )
        .group_by(Product.id, Product.name, Product.primary_image_url)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [
        {"product_id": row.id, "name": row.name, "primary_image_url": row.primary_image_url, "view_count": row.view_count}
        for row in rows
    ]


def _top_categories(db: Session, shop_id: int) -> list[dict]:
    rows = (
        db.query(Category.id, Category.name, func.count(CustomerEvent.id).label("view_count"))
        .join(CustomerEvent, CustomerEvent.category_id == Category.id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.CATEGORY_VIEW,
            CustomerEvent.category_id.isnot(None),
        )
        .group_by(Category.id, Category.name)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [{"category_id": row.id, "name": row.name, "view_count": row.view_count} for row in rows]


def _top_searches(db: Session, shop_id: int) -> list[dict]:
    term = func.lower(CustomerEvent.search_query).label("term")
    rows = (
        db.query(term, func.count(CustomerEvent.id).label("count"))
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.SEARCH,
            CustomerEvent.search_query.isnot(None),
        )
        .group_by(term)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(TOP_N)
        .all()
    )
    return [{"term": row.term, "count": row.count} for row in rows]


def get_shop_analytics(db: Session, shop_id: int) -> dict:
    week_ago = datetime.utcnow() - timedelta(days=7)
    return {
        "shop_views_total": _count(db, shop_id, CustomerEventType.SHOP_VIEW),
        "shop_views_last_7_days": _count(db, shop_id, CustomerEventType.SHOP_VIEW, since=week_ago),
        "product_views_total": _count(db, shop_id, CustomerEventType.PRODUCT_VIEW),
        "product_views_last_7_days": _count(db, shop_id, CustomerEventType.PRODUCT_VIEW, since=week_ago),
        "searches_total": _count(db, shop_id, CustomerEventType.SEARCH),
        "searches_last_7_days": _count(db, shop_id, CustomerEventType.SEARCH, since=week_ago),
        "top_products": _top_products(db, shop_id),
        "top_searches": _top_searches(db, shop_id),
        "top_categories": _top_categories(db, shop_id),
    }


# ─── Rich period-based analytics ─────────────────────────────────────────────


def _period_bounds(period: str) -> tuple[datetime, datetime, datetime, datetime]:
    """Return (current_start, current_end, prev_start, prev_end) as UTC-aware
    datetimes whose boundaries align to the BUSINESS_TZ calendar.

    "today" means 00:00 IST today → now.
    "7d" / "30d" are rolling windows from midnight-IST N days ago → now.
    "3m" / "1y" similarly use IST midnight boundaries.

    Each period is compared against an equal-length window immediately before
    ``current_start`` so percentage changes are apple-to-apple comparisons.
    All returned datetimes are timezone-aware (UTC) for safe comparison against
    PostgreSQL TIMESTAMPTZ columns.
    """
    now_ist = datetime.now(BUSINESS_TZ)
    now_utc = now_ist.astimezone(timezone.utc)
    # Midnight IST today, expressed as a UTC-aware datetime
    midnight_ist_today = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "today":
        start = midnight_ist_today.astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=1)
    elif period == "7d":
        start = (midnight_ist_today - timedelta(days=6)).astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=7)
    elif period == "30d":
        start = (midnight_ist_today - timedelta(days=29)).astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=30)
    elif period == "3m":
        start = (midnight_ist_today - timedelta(days=90)).astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=91)
    elif period == "1y":
        start = (midnight_ist_today - timedelta(days=364)).astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=365)
    else:
        start = (midnight_ist_today - timedelta(days=6)).astimezone(timezone.utc)
        end = now_utc
        delta = timedelta(days=7)
    return start, end, start - delta, start


def _trunc_unit(period: str) -> str:
    return {"today": "hour", "7d": "day", "30d": "day", "3m": "week", "1y": "month"}.get(period, "day")


def _pct_change(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _count_events(
    db: Session, shop_id: int, event_type: CustomerEventType, start: datetime, end: datetime
) -> int:
    return (
        db.query(func.count(CustomerEvent.id))
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == event_type,
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .scalar()
        or 0
    )


# The persistent per-device id is the real "who" — a repeat QR scan from the
# same phone reuses it. Older events (pre-Phase-7) have no device_id, so
# fall back to the per-tab session id for those.
_VISITOR_KEY = func.coalesce(CustomerEvent.device_id, CustomerEvent.anonymous_session_id)


def _count_unique_visitors(
    db: Session, shop_id: int, event_type: CustomerEventType, start: datetime, end: datetime
) -> int:
    """Count distinct visitors -- keyed by the persistent device id where we
    have one, else the per-tab session id. NULLs (no header at all) excluded."""
    return (
        db.query(func.count(sa_distinct(_VISITOR_KEY)))
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == event_type,
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
            _VISITOR_KEY.isnot(None),
        )
        .scalar()
        or 0
    )


def _count_sales(db: Session, shop_id: int, start: datetime, end: datetime) -> int:
    """Count PRODUCT_MARKED_SOLD actions — this is how sales are recorded in the
    system (shop owner manually marks a product as sold after a customer buys it
    in-person or via WhatsApp)."""
    return (
        db.query(func.count(CatalogActivity.id))
        .filter(
            CatalogActivity.shop_id == shop_id,
            CatalogActivity.action == CatalogAction.PRODUCT_MARKED_SOLD,
            CatalogActivity.created_at >= start,
            CatalogActivity.created_at < end,
        )
        .scalar()
        or 0
    )


def _visits_series(db: Session, shop_id: int, period: str, start: datetime, end: datetime) -> list[dict]:
    unit = _trunc_unit(period)
    # Truncate in IST so hourly/daily/weekly/monthly buckets align to the
    # business calendar, then convert back to TIMESTAMPTZ for consistent output.
    bucket_col = func.date_trunc(
        unit,
        func.timezone(BUSINESS_TZ_PG, CustomerEvent.created_at),
    ).label("bucket")
    rows = (
        db.query(
            bucket_col,
            func.count(CustomerEvent.id).label("visits"),
            func.count(sa_distinct(_VISITOR_KEY)).label("unique_visitors"),
        )
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.SHOP_VIEW,
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .group_by(bucket_col)
        .order_by(bucket_col)
        .all()
    )
    return [
        {
            "bucket": row.bucket.isoformat(),
            "visits": row.visits,
            "unique_visitors": row.unique_visitors,
        }
        for row in rows
    ]


def _sales_series(db: Session, shop_id: int, period: str, start: datetime, end: datetime) -> list[dict]:
    unit = _trunc_unit(period)
    bucket_col = func.date_trunc(
        unit,
        func.timezone(BUSINESS_TZ_PG, CatalogActivity.created_at),
    ).label("bucket")
    rows = (
        db.query(bucket_col, func.count(CatalogActivity.id).label("sold"))
        .filter(
            CatalogActivity.shop_id == shop_id,
            CatalogActivity.action == CatalogAction.PRODUCT_MARKED_SOLD,
            CatalogActivity.created_at >= start,
            CatalogActivity.created_at < end,
        )
        .group_by(bucket_col)
        .order_by(bucket_col)
        .all()
    )
    return [{"bucket": row.bucket.isoformat(), "sold": row.sold} for row in rows]


def _top_viewed_products_rich(
    db: Session, shop_id: int, start: datetime, end: datetime, n: int = TOP_N_RICH
) -> list[dict]:
    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.primary_image_url,
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(CustomerEvent.id).label("view_count"),
        )
        .join(CustomerEvent, CustomerEvent.product_id == Product.id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.PRODUCT_VIEW,
            CustomerEvent.product_id.isnot(None),
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .group_by(Product.id, Product.name, Product.primary_image_url, Category.id, Category.name)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(n)
        .all()
    )
    return [
        {
            "product_id": r.id,
            "name": r.name,
            "primary_image_url": r.primary_image_url,
            "category_id": r.category_id,
            "category_name": r.category_name,
            "view_count": r.view_count,
        }
        for r in rows
    ]


def _top_selected_products_rich(
    db: Session, shop_id: int, start: datetime, end: datetime, n: int = TOP_N_RICH
) -> list[dict]:
    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.primary_image_url,
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(CustomerEvent.id).label("add_count"),
        )
        .join(CustomerEvent, CustomerEvent.product_id == Product.id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.ADD_TO_SELECTION,
            CustomerEvent.product_id.isnot(None),
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .group_by(Product.id, Product.name, Product.primary_image_url, Category.id, Category.name)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(n)
        .all()
    )
    return [
        {
            "product_id": r.id,
            "name": r.name,
            "primary_image_url": r.primary_image_url,
            "category_id": r.category_id,
            "category_name": r.category_name,
            "add_count": r.add_count,
        }
        for r in rows
    ]


def _top_sold_products_rich(
    db: Session, shop_id: int, start: datetime, end: datetime, n: int = TOP_N_RICH
) -> list[dict]:
    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.primary_image_url,
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(CatalogActivity.id).label("sold_count"),
        )
        .join(CatalogActivity, CatalogActivity.product_id == Product.id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(
            CatalogActivity.shop_id == shop_id,
            CatalogActivity.action == CatalogAction.PRODUCT_MARKED_SOLD,
            CatalogActivity.product_id.isnot(None),
            CatalogActivity.created_at >= start,
            CatalogActivity.created_at < end,
        )
        .group_by(Product.id, Product.name, Product.primary_image_url, Category.id, Category.name)
        .order_by(func.count(CatalogActivity.id).desc())
        .limit(n)
        .all()
    )
    return [
        {
            "product_id": r.id,
            "name": r.name,
            "primary_image_url": r.primary_image_url,
            "category_id": r.category_id,
            "category_name": r.category_name,
            "sold_count": r.sold_count,
        }
        for r in rows
    ]


def _category_stats_rich(
    db: Session, shop_id: int, start: datetime, end: datetime, n: int = TOP_N_RICH
) -> list[dict]:
    # Category-browse events
    view_rows = (
        db.query(
            Category.id,
            Category.name,
            func.count(CustomerEvent.id).label("views"),
            func.count(sa_distinct(_VISITOR_KEY)).label("unique_visitors"),
        )
        .join(CustomerEvent, CustomerEvent.category_id == Category.id)
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.CATEGORY_VIEW,
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .group_by(Category.id, Category.name)
        .all()
    )

    # Products sold per category in the same window
    sold_rows = (
        db.query(Product.category_id, func.count(CatalogActivity.id).label("sold"))
        .join(CatalogActivity, CatalogActivity.product_id == Product.id)
        .filter(
            CatalogActivity.shop_id == shop_id,
            CatalogActivity.action == CatalogAction.PRODUCT_MARKED_SOLD,
            CatalogActivity.created_at >= start,
            CatalogActivity.created_at < end,
        )
        .group_by(Product.category_id)
        .all()
    )
    sold_by_cat: dict[int, int] = {r.category_id: r.sold for r in sold_rows}
    total_sold = sum(sold_by_cat.values()) or 1  # avoid division by zero

    result = sorted(
        [
            {
                "category_id": r.id,
                "name": r.name,
                "views": r.views,
                "unique_visitors": r.unique_visitors,
                "sold": sold_by_cat.get(r.id, 0),
                "sales_share": round(sold_by_cat.get(r.id, 0) / total_sold * 100, 1),
            }
            for r in view_rows
        ],
        key=lambda x: x["views"],
        reverse=True,
    )
    return result[:n]


def _search_insights_rich(
    db: Session, shop_id: int, start: datetime, end: datetime, n: int = TOP_N_RICH
) -> list[dict]:
    """Only count search terms >= MIN_SEARCH_LEN characters to filter out
    single-keypress partial queries (r, re, red, etc.) that occur because the
    public catalog fires a search request on every debounce tick."""
    term_col = func.lower(CustomerEvent.search_query).label("term")
    rows = (
        db.query(term_col, func.count(CustomerEvent.id).label("count"))
        .filter(
            CustomerEvent.shop_id == shop_id,
            CustomerEvent.event_type == CustomerEventType.SEARCH,
            CustomerEvent.search_query.isnot(None),
            func.length(CustomerEvent.search_query) >= MIN_SEARCH_LEN,
            CustomerEvent.created_at >= start,
            CustomerEvent.created_at < end,
        )
        .group_by(term_col)
        .order_by(func.count(CustomerEvent.id).desc())
        .limit(n)
        .all()
    )
    return [{"term": r.term, "count": r.count} for r in rows]


def get_rich_analytics(db: Session, shop_id: int, period: str = "7d") -> dict:
    """Return a comprehensive analytics snapshot for the given period.

    All counts are scoped to [start, end) and compared against the equal-length
    window immediately before start (prev_start, prev_end = start).
    """
    start, end, prev_start, prev_end = _period_bounds(period)

    # ── KPIs ──────────────────────────────────────────────────────────────────
    visits = _count_events(db, shop_id, CustomerEventType.SHOP_VIEW, start, end)
    prev_visits = _count_events(db, shop_id, CustomerEventType.SHOP_VIEW, prev_start, prev_end)

    unique = _count_unique_visitors(db, shop_id, CustomerEventType.SHOP_VIEW, start, end)
    prev_unique = _count_unique_visitors(db, shop_id, CustomerEventType.SHOP_VIEW, prev_start, prev_end)

    views = _count_events(db, shop_id, CustomerEventType.PRODUCT_VIEW, start, end)
    prev_views = _count_events(db, shop_id, CustomerEventType.PRODUCT_VIEW, prev_start, prev_end)

    sold = _count_sales(db, shop_id, start, end)
    prev_sold = _count_sales(db, shop_id, prev_start, prev_end)

    adds = _count_events(db, shop_id, CustomerEventType.ADD_TO_SELECTION, start, end)
    prev_adds = _count_events(db, shop_id, CustomerEventType.ADD_TO_SELECTION, prev_start, prev_end)

    # ── Averages ──────────────────────────────────────────────────────────────
    duration_days = max(1, (end - start).total_seconds() / 86400)

    return {
        "period": period,
        "date_range_start": start.isoformat(),
        "date_range_end": end.isoformat(),
        # KPI blocks
        "visits": {
            "current": visits,
            "previous": prev_visits,
            "change": _pct_change(visits, prev_visits),
        },
        "unique_visitors": {
            "current": unique,
            "previous": prev_unique,
            "change": _pct_change(unique, prev_unique),
        },
        "product_views": {
            "current": views,
            "previous": prev_views,
            "change": _pct_change(views, prev_views),
        },
        "products_sold": {
            "current": sold,
            "previous": prev_sold,
            "change": _pct_change(sold, prev_sold),
        },
        "selection_adds": {
            "current": adds,
            "previous": prev_adds,
            "change": _pct_change(adds, prev_adds),
        },
        # Averages
        "avg_visits_per_day": round(visits / duration_days, 1),
        "avg_unique_per_day": round(unique / duration_days, 1),
        # Time-series
        "visits_series": _visits_series(db, shop_id, period, start, end),
        "sales_series": _sales_series(db, shop_id, period, start, end),
        # Top lists
        "top_viewed_products": _top_viewed_products_rich(db, shop_id, start, end),
        "top_sold_products": _top_sold_products_rich(db, shop_id, start, end),
        "top_selected_products": _top_selected_products_rich(db, shop_id, start, end),
        # Breakdowns
        "category_stats": _category_stats_rich(db, shop_id, start, end),
        "search_insights": _search_insights_rich(db, shop_id, start, end),
    }
