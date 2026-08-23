"""Unit tests for IST timezone boundaries in the rich analytics service.

These tests verify that _period_bounds() produces IST-aligned boundaries
and that events near midnight IST are bucketed into the correct day.

No database required — they test pure Python date logic.  The session-scoped
DB fixture from conftest runs but is irrelevant here (these tests don't use
any DB fixtures).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc

# IST is UTC+05:30, so midnight IST = 18:30 UTC previous day.


def _mock_now(ist_hour: int, ist_minute: int = 0, day: int = 23, month: int = 8, year: int = 2026):
    """Create a fixed 'now' at a specific IST time."""
    return datetime(year, month, day, ist_hour, ist_minute, 0, tzinfo=IST)


def _bounds(period: str, now_ist: datetime):
    """Call _period_bounds with a mocked datetime.now()."""
    with patch("app.services.analytics.datetime") as mock_dt:
        mock_dt.now.return_value = now_ist
        # Allow datetime(...) constructor calls to work normally
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
        from app.services.analytics import _period_bounds
        return _period_bounds(period)


# ── Today boundaries ────────────────────────────────────────────────────────


def test_today_starts_at_ist_midnight():
    """'today' period should start at 00:00 IST, not 00:00 UTC."""
    now_ist = _mock_now(23, 0)
    start, end, prev_start, prev_end = _bounds("today", now_ist)

    # Start should be midnight IST Aug 23 = 18:30 UTC Aug 22
    expected_start_utc = datetime(2026, 8, 22, 18, 30, 0, tzinfo=UTC)
    assert start == expected_start_utc, f"Expected {expected_start_utc}, got {start}"

    # End should be now (23:00 IST = 17:30 UTC Aug 23)
    expected_end_utc = now_ist.astimezone(UTC)
    assert end == expected_end_utc


def test_today_prev_is_yesterday_ist():
    """Previous period for 'today' should be yesterday's IST calendar day."""
    now_ist = _mock_now(10, 0)  # 10:00 IST Aug 23
    start, end, prev_start, prev_end = _bounds("today", now_ist)

    # prev_end should equal start (midnight IST today → 18:30 UTC Aug 22)
    assert prev_end == start

    # prev_start should be 1 day before start (midnight IST Aug 22 → 18:30 UTC Aug 21)
    expected_prev_start = datetime(2026, 8, 21, 18, 30, 0, tzinfo=UTC)
    assert prev_start == expected_prev_start


def test_visit_at_2330_ist_counted_as_same_day():
    """A visit at 23:30 IST on Aug 23 must be within today's bounds."""
    now_ist = _mock_now(23, 45)  # 23:45 IST Aug 23
    start, end, _, _ = _bounds("today", now_ist)

    # Event at 23:30 IST Aug 23 = 18:00 UTC Aug 23
    event_utc = datetime(2026, 8, 23, 18, 0, 0, tzinfo=UTC)
    assert start <= event_utc < end, "23:30 IST event should be within today's bounds"


def test_visit_at_0015_ist_counted_as_next_day():
    """A visit at 00:15 IST Aug 24 must NOT be in Aug 23's 'today'."""
    now_ist = _mock_now(23, 50)
    start, end, _, _ = _bounds("today", now_ist)

    # Event at 00:15 IST Aug 24 = 18:45 UTC Aug 23
    event_utc = datetime(2026, 8, 23, 18, 45, 0, tzinfo=UTC)
    # This event is at 00:15 IST next day — should be AFTER our end time
    # (which is now = 23:50 IST = 18:20 UTC)
    assert event_utc >= end, "00:15 IST next day should be after today's end"


# ── 7-day window ────────────────────────────────────────────────────────────


def test_7d_starts_at_ist_midnight():
    """7-day window should start at IST midnight 6 days ago, not UTC."""
    now_ist = _mock_now(14, 0, day=23, month=8)
    start, end, _, _ = _bounds("7d", now_ist)

    # Start = midnight IST Aug 17 = 18:30 UTC Aug 16
    expected_start = datetime(2026, 8, 16, 18, 30, 0, tzinfo=UTC)
    assert start == expected_start


# ── Monthly boundary ────────────────────────────────────────────────────────


def test_month_boundary_aug1_ist():
    """Aug 1 00:00 IST must belong to August, not July."""
    now_ist = _mock_now(12, 0, day=15, month=8)
    start, end, _, _ = _bounds("30d", now_ist)

    # Aug 1 00:00 IST = July 31 18:30 UTC
    aug1_ist_in_utc = datetime(2026, 7, 31, 18, 30, 0, tzinfo=UTC)
    assert start <= aug1_ist_in_utc < end, "Aug 1 00:00 IST should be in the 30d window"


# ── Year boundary ───────────────────────────────────────────────────────────


def test_year_boundary_jan1_ist():
    """Jan 1 00:00 IST must belong to the new year."""
    now_ist = _mock_now(12, 0, day=15, month=6, year=2027)
    start, end, _, _ = _bounds("1y", now_ist)

    # Jan 1 2027 00:00 IST = Dec 31 2026 18:30 UTC
    jan1_ist_in_utc = datetime(2026, 12, 31, 18, 30, 0, tzinfo=UTC)
    assert start <= jan1_ist_in_utc < end, "Jan 1 00:00 IST should be within 1y window"


# ── UTC-awareness ───────────────────────────────────────────────────────────


def test_all_bounds_are_utc_aware():
    """Every bound returned must be a timezone-aware UTC datetime."""
    now_ist = _mock_now(12, 0)

    for period in ("today", "7d", "30d", "3m", "1y"):
        bounds = _bounds(period, now_ist)
        for i, bound in enumerate(bounds):
            assert bound.tzinfo is not None, f"{period} bound[{i}] is naive"
            assert bound.utcoffset() == timedelta(0), \
                f"{period} bound[{i}] is not UTC: offset={bound.utcoffset()}"


# ── _pct_change edge cases ──────────────────────────────────────────────────


def test_pct_change_zero_to_positive():
    from app.services.analytics import _pct_change
    assert _pct_change(5, 0) == 100.0


def test_pct_change_zero_to_zero():
    from app.services.analytics import _pct_change
    assert _pct_change(0, 0) == 0.0


def test_pct_change_normal_growth():
    from app.services.analytics import _pct_change
    assert _pct_change(150, 100) == 50.0


def test_pct_change_decline():
    from app.services.analytics import _pct_change
    assert _pct_change(80, 100) == -20.0
