"""14-day trial calculation tests (spec section 8 / 29).

Uses lightweight stand-ins (SimpleNamespace) rather than real Shop rows
since the trial functions only ever touch `.trial_end_date` — no DB
needed for this unit.
"""

from datetime import date, timedelta
from types import SimpleNamespace

from app.services.trial import (
    is_trial_active,
    is_trial_expired,
    trial_days_remaining,
    trial_status_label,
)


def _shop(trial_end_date):
    return SimpleNamespace(trial_end_date=trial_end_date)


def test_trial_with_days_remaining_is_active():
    shop = _shop(date.today() + timedelta(days=5))
    assert trial_days_remaining(shop) == 5
    assert is_trial_active(shop)
    assert not is_trial_expired(shop)
    assert trial_status_label(shop) == "5 days remaining"


def test_trial_ending_today_is_still_active():
    shop = _shop(date.today())
    assert is_trial_active(shop)
    assert trial_days_remaining(shop) == 0


def test_trial_that_ended_yesterday_is_expired():
    shop = _shop(date.today() - timedelta(days=1))
    assert is_trial_expired(shop)
    assert not is_trial_active(shop)
    assert trial_days_remaining(shop) == 0
    assert trial_status_label(shop) == "Trial expired"


def test_shop_with_no_trial_end_date_counts_as_expired():
    shop = _shop(None)
    assert is_trial_expired(shop)
    assert trial_days_remaining(shop) == 0


def test_singular_day_label():
    shop = _shop(date.today() + timedelta(days=1))
    assert trial_status_label(shop) == "1 day remaining"


def test_full_14_day_trial_from_creation():
    today = date.today()
    shop = _shop(today + timedelta(days=14))
    assert trial_days_remaining(shop, today=today) == 14
    assert is_trial_active(shop, today=today)
