"""Shop billing lifecycle: trial windows, paid-through dates, and the one
'is this catalog allowed to be shown to customers' check.

Phase 1 is entirely trial-driven -- the Super Admin moves a shop between
states by hand. Phase 5 (Razorpay) adds automatic transitions on webhook
events plus a daily sweep job; the read helpers here won't change.

Every function takes a `Shop` (or any object exposing `.is_active` and a
`.billing` with the same attributes as `ShopBilling`) so callers never
have to reach into the billing row themselves.
"""

from datetime import date

from app.models.enums import SubscriptionStatus

# How long a PAST_DUE shop's catalog keeps serving after a failed renewal
# before the sweep job flips it to EXPIRED (Phase 5).
GRACE_DAYS = 7


def _ref(today: date | None) -> date:
    return today or date.today()


def trial_days_remaining(shop, *, today: date | None = None) -> int:
    """Whole days left in the trial. 0 if there's no trial or it has ended."""
    end = shop.billing.trial_end_date if shop.billing else None
    if end is None:
        return 0
    return max((end - _ref(today)).days, 0)


def is_trial_expired(shop, *, today: date | None = None) -> bool:
    """True once the trial end date has passed (or there is no trial)."""
    end = shop.billing.trial_end_date if shop.billing else None
    if end is None:
        return True
    return _ref(today) > end


def is_trial_active(shop, *, today: date | None = None) -> bool:
    return not is_trial_expired(shop, today=today)


def trial_status_label(shop, *, today: date | None = None) -> str:
    """Short label for the trial countdown, e.g. "12 days remaining"."""
    if is_trial_expired(shop, today=today):
        return "Trial expired"
    days = trial_days_remaining(shop, today=today)
    return "1 day remaining" if days == 1 else f"{days} days remaining"


def is_catalog_live(shop, *, today: date | None = None) -> bool:
    """The single gate the public catalog runs every shop through.

    A shop is live only if the Super Admin hasn't switched it off AND its
    billing state currently permits serving customers. Nothing here reveals
    *why* a shop is dark -- callers turn a False into a generic 403.
    """
    if not shop.is_active or shop.billing is None:
        return False

    b = shop.billing
    ref = _ref(today)

    if b.status == SubscriptionStatus.ACTIVE:
        return True
    if b.status == SubscriptionStatus.TRIAL:
        return b.trial_end_date is not None and ref <= b.trial_end_date
    if b.status == SubscriptionStatus.PAST_DUE:
        return b.grace_until is not None and ref <= b.grace_until
    if b.status == SubscriptionStatus.CANCELLED:
        return b.paid_until is not None and ref <= b.paid_until
    # EXPIRED, SUSPENDED
    return False


def lifecycle_label(shop, *, today: date | None = None) -> str:
    """Human-readable billing state for the Super Admin and the owner's own
    read-only billing panel."""
    if shop.billing is None:
        return "No billing record"
    s = shop.billing.status
    if s == SubscriptionStatus.TRIAL:
        return trial_status_label(shop, today=today) if is_trial_active(
            shop, today=today
        ) else "Trial expired"
    return {
        SubscriptionStatus.ACTIVE: "Active",
        SubscriptionStatus.PAST_DUE: "Payment overdue",
        SubscriptionStatus.EXPIRED: "Expired",
        SubscriptionStatus.SUSPENDED: "Suspended",
        SubscriptionStatus.CANCELLED: "Cancelled",
    }.get(s, str(s.value))
