"""Unit tests for the Super Admin lifecycle/ops metrics
(app/services/admin_metrics.py). Revenue metrics are covered in Phase 5.
"""

from datetime import datetime, timedelta, timezone

from app.models import CatalogActivity, Shop, SubscriptionStatus
from app.models.enums import CatalogAction
from app.services import admin_metrics


def _shop(db, slug, *, status=SubscriptionStatus.TRIAL, is_active=True, trial_days=10):
    from datetime import date

    shop = Shop(
        name=slug.replace("-", " ").title(),
        slug=slug,
        is_active=is_active,
        subscription_status=status,
        trial_start_date=date.today(),
        trial_end_date=date.today() + timedelta(days=trial_days),
    )
    db.add(shop)
    db.flush()
    return shop


def _activity(db, shop, *, days_ago):
    db.add(
        CatalogActivity(
            shop_id=shop.id,
            action=CatalogAction.PRODUCT_CREATED,
            created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        )
    )
    db.flush()


def test_by_status_counts_every_state(db_session):
    _shop(db_session, "t1")
    _shop(db_session, "t2")
    _shop(db_session, "a1", status=SubscriptionStatus.ACTIVE)
    _shop(db_session, "x1", status=SubscriptionStatus.EXPIRED)

    data = admin_metrics.get_dashboard(db_session)
    assert data["by_status"]["TRIAL"] == 2
    assert data["by_status"]["ACTIVE"] == 1
    assert data["by_status"]["EXPIRED"] == 1
    assert data["by_status"]["CANCELLED"] == 0
    assert data["total_shops"] == 4
    assert data["revenue_pending"] is True


def test_live_catalog_count_excludes_expired_and_suspended(db_session):
    _shop(db_session, "live-trial", trial_days=5)
    _shop(db_session, "dead-trial", trial_days=-3)  # trial ended
    _shop(db_session, "susp", status=SubscriptionStatus.SUSPENDED, is_active=False)
    _shop(db_session, "paid", status=SubscriptionStatus.ACTIVE)

    data = admin_metrics.get_dashboard(db_session)
    assert data["live_catalogs"] == 2  # live-trial + paid


def test_trials_expiring_soon_window(db_session):
    _shop(db_session, "closing", trial_days=4)
    _shop(db_session, "plenty", trial_days=25)

    data = admin_metrics.get_dashboard(db_session)
    slugs = {r["slug"] for r in data["trials_expiring_soon"]}
    assert "closing" in slugs
    assert "plenty" not in slugs


def test_dormant_shops_are_live_shops_with_stale_or_no_activity(db_session):
    fresh = _shop(db_session, "fresh", trial_days=20)
    _activity(db_session, fresh, days_ago=2)

    stale = _shop(db_session, "stale", trial_days=20)
    _activity(db_session, stale, days_ago=45)

    _never = _shop(db_session, "never", trial_days=20)  # no activity at all

    # Expired shop with stale activity should NOT count -- it's not live.
    dead = _shop(db_session, "dead", trial_days=-5)
    _activity(db_session, dead, days_ago=60)

    data = admin_metrics.get_dashboard(db_session)
    dormant = {r["slug"] for r in data["dormant_shops"]}
    assert dormant == {"stale", "never"}


def test_new_shops_this_week_and_month(db_session):
    _shop(db_session, "s1")
    _shop(db_session, "s2")
    old = _shop(db_session, "old")
    old.created_at = datetime.now(timezone.utc) - timedelta(days=60)
    db_session.flush()

    data = admin_metrics.get_dashboard(db_session)
    assert data["new_shops_this_week"] == 2
    assert data["new_shops_this_month"] == 2


def test_signups_series_is_a_continuous_12_week_window(db_session):
    _shop(db_session, "recent")
    data = admin_metrics.get_dashboard(db_session)
    series = data["signups_series"]
    assert len(series) == 12
    assert all(set(p) == {"bucket", "count"} for p in series)
    # buckets are Mondays, one week apart, ascending
    assert series == sorted(series, key=lambda p: p["bucket"])
    # the newest bucket holds the shop we just made
    assert series[-1]["count"] >= 1
