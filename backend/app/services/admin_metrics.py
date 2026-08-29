"""Read-only aggregation for the Super Admin dashboard (redesign Phase 1).

The Super Admin owns tenant lifecycle and revenue -- not catalog
engagement. Nothing in this module touches `customer_events`,
`catalog_activity` (beyond a single "last activity" timestamp used to flag
dormant shops), product views, searches or sales. Those belong to the shop
owner alone now.

Revenue metrics (MRR, conversion, churn) are stubbed until Phase 5 wires
Razorpay -- `revenue_pending` is True and the numbers are None so the
frontend can render the cards as "coming soon" rather than as zeros.
"""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.catalog_activity import CatalogActivity
from app.models.enums import SubscriptionStatus
from app.models.shop import Shop
from app.models.shop_billing import ShopBilling
from app.services import billing as billing_service

TRIAL_EXPIRING_WITHIN_DAYS = 7
DORMANT_AFTER_DAYS = 30


def _by_status(db: Session) -> dict[str, int]:
    rows = (
        db.query(ShopBilling.status, func.count(ShopBilling.id))
        .group_by(ShopBilling.status)
        .all()
    )
    counts = {s.value: 0 for s in SubscriptionStatus}
    for status_value, count in rows:
        key = status_value.value if hasattr(status_value, "value") else str(status_value)
        counts[key] = count
    return counts


def _trials_expiring(db: Session, *, within_days: int = TRIAL_EXPIRING_WITHIN_DAYS) -> list[dict]:
    today = date.today()
    cutoff = today + timedelta(days=within_days)
    shops = (
        db.query(Shop)
        .options(joinedload(Shop.owner))
        .join(ShopBilling)
        .filter(
            ShopBilling.status == SubscriptionStatus.TRIAL,
            ShopBilling.trial_end_date.isnot(None),
            ShopBilling.trial_end_date <= cutoff,
        )
        .order_by(ShopBilling.trial_end_date.asc())
        .all()
    )
    return [
        {
            "shop_id": s.id,
            "name": s.name,
            "slug": s.slug,
            "owner_email": s.owner.email if s.owner else None,
            "trial_end_date": s.billing.trial_end_date,
            "days_remaining": billing_service.trial_days_remaining(s, today=today),
            "expired": billing_service.is_trial_expired(s, today=today),
        }
        for s in shops
    ]


def _dormant_shops(db: Session, *, after_days: int = DORMANT_AFTER_DAYS) -> list[dict]:
    """Live shops with no catalog edit in `after_days` -- a signal the owner
    has gone quiet and may need a nudge before the trial lapses."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=after_days)
    last_activity = (
        db.query(
            CatalogActivity.shop_id,
            func.max(CatalogActivity.created_at).label("last_at"),
        )
        .group_by(CatalogActivity.shop_id)
        .subquery()
    )
    shops = (
        db.query(Shop, last_activity.c.last_at)
        .outerjoin(last_activity, last_activity.c.shop_id == Shop.id)
        .filter(Shop.is_active.is_(True))
        .all()
    )
    out: list[dict] = []
    for shop, last_at in shops:
        if not billing_service.is_catalog_live(shop):
            continue
        if last_at is None or last_at < cutoff:
            out.append(
                {
                    "shop_id": shop.id,
                    "name": shop.name,
                    "slug": shop.slug,
                    "last_activity_at": last_at,
                }
            )
    # Shops that have never had any activity sort first, then oldest-activity first.
    out.sort(
        key=lambda r: (
            r["last_activity_at"] is not None,
            r["last_activity_at"] or datetime.min.replace(tzinfo=timezone.utc),
        )
    )
    return out


def _new_shops(db: Session, *, since: datetime) -> int:
    return (
        db.query(func.count(Shop.id)).filter(Shop.created_at >= since).scalar() or 0
    )


BUSINESS_TZ_PG = "Asia/Kolkata"
SIGNUPS_WEEKS = 12


def _signups_series(db: Session) -> list[dict]:
    """Shops created per ISO week for the last ~12 weeks, bucketed on the
    business calendar. Weeks with no signups are filled with 0 so the chart
    has a continuous x-axis."""
    now_ist = datetime.now(timezone.utc).astimezone(ZoneInfo(BUSINESS_TZ_PG))
    start = (now_ist - timedelta(weeks=SIGNUPS_WEEKS - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    # Monday of that week
    start -= timedelta(days=start.weekday())

    bucket = func.date_trunc("week", func.timezone(BUSINESS_TZ_PG, Shop.created_at)).label("bucket")
    rows = dict(
        db.query(bucket, func.count(Shop.id))
        .filter(Shop.created_at >= start.astimezone(timezone.utc))
        .group_by(bucket)
        .all()
    )
    counts = {d.date() if hasattr(d, "date") else d: n for d, n in rows.items()}

    out: list[dict] = []
    cursor = start
    for _ in range(SIGNUPS_WEEKS):
        out.append({"bucket": cursor.date().isoformat(), "count": counts.get(cursor.date(), 0)})
        cursor += timedelta(weeks=1)
    return out


def get_dashboard(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    all_shops = db.query(Shop).all()
    total_shops = len(all_shops)
    live_catalogs = sum(1 for s in all_shops if billing_service.is_catalog_live(s))

    return {
        "total_shops": total_shops,
        "live_catalogs": live_catalogs,
        "by_status": _by_status(db),
        "new_shops_this_week": _new_shops(db, since=week_ago),
        "new_shops_this_month": _new_shops(db, since=month_ago),
        "signups_series": _signups_series(db),
        "trials_expiring_soon": _trials_expiring(db),
        "dormant_shops": _dormant_shops(db),
        # Phase 5 (Razorpay) fills these in.
        "revenue_pending": True,
        "mrr": None,
        "arr": None,
        "revenue_this_month": None,
        "trial_to_paid_rate": None,
        "churn_this_month": None,
    }
