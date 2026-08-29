"""Unit tests for the billing lifecycle helpers (app/services/billing.py).

Uses lightweight stand-ins rather than real Shop rows -- the helpers only
touch `.is_active` and `.billing.*`.
"""

from datetime import date, timedelta
from types import SimpleNamespace

from app.models.enums import SubscriptionStatus
from app.services.billing import (
    is_catalog_live,
    is_trial_active,
    is_trial_expired,
    lifecycle_label,
    trial_days_remaining,
    trial_status_label,
)


def _shop(*, status=SubscriptionStatus.TRIAL, trial_end=None, paid_until=None, grace_until=None, is_active=True):
    return SimpleNamespace(
        is_active=is_active,
        billing=SimpleNamespace(
            status=status,
            trial_start_date=None,
            trial_end_date=trial_end,
            paid_until=paid_until,
            grace_until=grace_until,
        ),
    )


# -- trial countdown --------------------------------------------------------


def test_trial_with_days_remaining_is_active():
    shop = _shop(trial_end=date.today() + timedelta(days=5))
    assert trial_days_remaining(shop) == 5
    assert is_trial_active(shop)
    assert not is_trial_expired(shop)
    assert trial_status_label(shop) == "5 days remaining"


def test_trial_ending_today_is_still_active():
    shop = _shop(trial_end=date.today())
    assert is_trial_active(shop)
    assert trial_days_remaining(shop) == 0


def test_trial_that_ended_yesterday_is_expired():
    shop = _shop(trial_end=date.today() - timedelta(days=1))
    assert is_trial_expired(shop)
    assert trial_days_remaining(shop) == 0
    assert trial_status_label(shop) == "Trial expired"


def test_shop_with_no_trial_end_date_counts_as_expired():
    shop = _shop(trial_end=None)
    assert is_trial_expired(shop)
    assert trial_days_remaining(shop) == 0


def test_singular_day_label():
    shop = _shop(trial_end=date.today() + timedelta(days=1))
    assert trial_status_label(shop) == "1 day remaining"


# -- is_catalog_live ------------------------------------------------------


def test_live_trial_serves():
    assert is_catalog_live(_shop(trial_end=date.today() + timedelta(days=3)))


def test_expired_trial_does_not_serve():
    assert not is_catalog_live(_shop(trial_end=date.today() - timedelta(days=1)))


def test_deactivated_shop_never_serves_even_on_live_trial():
    shop = _shop(trial_end=date.today() + timedelta(days=3), is_active=False)
    assert not is_catalog_live(shop)


def test_active_subscription_serves():
    assert is_catalog_live(_shop(status=SubscriptionStatus.ACTIVE))


def test_past_due_serves_only_within_grace():
    assert is_catalog_live(
        _shop(status=SubscriptionStatus.PAST_DUE, grace_until=date.today() + timedelta(days=2))
    )
    assert not is_catalog_live(
        _shop(status=SubscriptionStatus.PAST_DUE, grace_until=date.today() - timedelta(days=1))
    )
    assert not is_catalog_live(_shop(status=SubscriptionStatus.PAST_DUE, grace_until=None))


def test_cancelled_serves_until_paid_until():
    assert is_catalog_live(
        _shop(status=SubscriptionStatus.CANCELLED, paid_until=date.today() + timedelta(days=10))
    )
    assert not is_catalog_live(
        _shop(status=SubscriptionStatus.CANCELLED, paid_until=date.today() - timedelta(days=1))
    )


def test_expired_and_suspended_never_serve():
    assert not is_catalog_live(_shop(status=SubscriptionStatus.EXPIRED))
    assert not is_catalog_live(_shop(status=SubscriptionStatus.SUSPENDED))


# -- lifecycle_label ------------------------------------------------------


def test_lifecycle_label_covers_every_state():
    assert lifecycle_label(_shop(trial_end=date.today() + timedelta(days=2))) == "2 days remaining"
    assert lifecycle_label(_shop(trial_end=date.today() - timedelta(days=2))) == "Trial expired"
    assert lifecycle_label(_shop(status=SubscriptionStatus.ACTIVE)) == "Active"
    assert lifecycle_label(_shop(status=SubscriptionStatus.PAST_DUE)) == "Payment overdue"
    assert lifecycle_label(_shop(status=SubscriptionStatus.EXPIRED)) == "Expired"
    assert lifecycle_label(_shop(status=SubscriptionStatus.SUSPENDED)) == "Suspended"
    assert lifecycle_label(_shop(status=SubscriptionStatus.CANCELLED)) == "Cancelled"
