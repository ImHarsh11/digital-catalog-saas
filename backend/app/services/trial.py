"""14-day trial calculations (spec section 8).

Deliberately simple: no background jobs, nothing auto-deletes or
auto-mutates data when a trial expires. This module only answers
"where does this shop stand today", derived from trial_end_date; the
Super Admin activates/deactivates shops manually.
"""

from datetime import date

from app.models.shop import Shop


def trial_days_remaining(shop: Shop, *, today: date | None = None) -> int:
    """Whole days left in the trial. 0 if there's no trial or it has ended."""
    if shop.trial_end_date is None:
        return 0
    reference = today or date.today()
    remaining = (shop.trial_end_date - reference).days
    return max(remaining, 0)


def is_trial_expired(shop: Shop, *, today: date | None = None) -> bool:
    """True once trial_end_date has passed (or there is no trial at all)."""
    if shop.trial_end_date is None:
        return True
    reference = today or date.today()
    return reference > shop.trial_end_date


def is_trial_active(shop: Shop, *, today: date | None = None) -> bool:
    return not is_trial_expired(shop, today=today)


def trial_status_label(shop: Shop, *, today: date | None = None) -> str:
    """Human-readable label, e.g. "12 days remaining" or "Trial expired"."""
    if is_trial_expired(shop, today=today):
        return "Trial expired"
    days = trial_days_remaining(shop, today=today)
    if days == 1:
        return "1 day remaining"
    return f"{days} days remaining"
