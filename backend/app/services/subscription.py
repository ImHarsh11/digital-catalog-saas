"""Razorpay subscription lifecycle (redesign Phase 5).

Ties a shop's `ShopBilling` row to a Razorpay subscription and translates
Razorpay webhook events into `SubscriptionStatus` transitions. Also holds
the daily sweep that dark-ends trials and lapsed grace windows.

Convention (same as `app/services/shop.py`): functions here `flush()`,
never `commit()` -- the API layer owns the transaction.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.billing_plan import BillingPlan
from app.models.enums import SubscriptionStatus
from app.models.razorpay_event import RazorpayEvent
from app.models.shop import Shop
from app.models.shop_billing import ShopBilling
from app.models.subscription_invoice import SubscriptionInvoice
from app.services import razorpay_client
from app.services.billing import GRACE_DAYS

# A subscription.charged event pushes the paid-through date to Razorpay's
# `current_end`; if that is ever missing we fall back to +1 period.
_FALLBACK_PERIOD = {"monthly": timedelta(days=31), "yearly": timedelta(days=366)}


class SubscriptionError(RuntimeError):
    pass


# --------------------------------------------------------------------- plans


def get_active_plan(db: Session, code: str | None = None) -> BillingPlan | None:
    stmt = select(BillingPlan).where(BillingPlan.is_active.is_(True))
    if code:
        stmt = stmt.where(BillingPlan.code == code)
    return db.scalars(stmt.order_by(BillingPlan.id)).first()


def ensure_razorpay_plan(db: Session, plan: BillingPlan) -> str:
    """Return the Razorpay plan id for `plan`, creating it on Razorpay the
    first time (and caching it on the row)."""
    if plan.razorpay_plan_id:
        return plan.razorpay_plan_id
    client = razorpay_client.get_client()
    period = "yearly" if plan.interval == "yearly" else "monthly"
    created = client.create_plan(
        period=period,
        interval=plan.interval_count,
        amount=plan.amount,
        currency=plan.currency,
        name=f"{plan.name} ({plan.code})",
    )
    plan.razorpay_plan_id = created["id"]
    db.flush()
    return plan.razorpay_plan_id


# ------------------------------------------------------- start / cancel


def start_subscription(db: Session, shop: Shop, *, plan_code: str | None = None) -> ShopBilling:
    """Create a Razorpay subscription for a shop and stash its id + hosted
    authorization URL on the billing row. The owner then completes the UPI
    mandate at `short_url` (or via Checkout); webhooks drive the rest."""
    billing = shop.billing
    if billing.razorpay_subscription_id and billing.mandate_status not in (
        None,
        "cancelled",
        "completed",
        "expired",
    ):
        raise SubscriptionError("This shop already has an active subscription.")

    plan = get_active_plan(db, plan_code)
    if plan is None:
        raise SubscriptionError("No active billing plan is configured.")

    rzp_plan_id = ensure_razorpay_plan(db, plan)
    client = razorpay_client.get_client()
    sub = client.create_subscription(
        plan_id=rzp_plan_id,
        notes={"shop_id": str(shop.id), "shop_slug": shop.slug},
    )

    billing.plan_id = plan.id
    billing.razorpay_subscription_id = sub["id"]
    billing.razorpay_customer_id = sub.get("customer_id")
    billing.mandate_status = sub.get("status") or "created"
    billing.cancel_at_period_end = False
    db.flush()
    # `short_url` is Razorpay's hosted authorization page -- handed back to
    # the caller, not persisted.
    billing._short_url = sub.get("short_url")  # type: ignore[attr-defined]
    return billing


def cancel_subscription(db: Session, shop: Shop, *, at_period_end: bool = True) -> ShopBilling:
    billing = shop.billing
    if not billing.razorpay_subscription_id:
        raise SubscriptionError("This shop has no subscription to cancel.")
    client = razorpay_client.get_client()
    client.cancel_subscription(billing.razorpay_subscription_id, at_cycle_end=at_period_end)
    if at_period_end:
        billing.cancel_at_period_end = True
    else:
        billing.status = SubscriptionStatus.CANCELLED
        billing.mandate_status = "cancelled"
    db.flush()
    return billing


# ------------------------------------------------------- webhook intake


_HANDLED = {
    "subscription.authenticated",
    "subscription.activated",
    "subscription.charged",
    "subscription.pending",
    "subscription.halted",
    "subscription.cancelled",
    "subscription.completed",
    "subscription.paused",
    "subscription.resumed",
}


def record_and_process_event(
    db: Session, *, event_id: str, event_type: str, payload: dict[str, Any]
) -> RazorpayEvent:
    """Idempotently persist a webhook delivery and apply its effect.

    A redelivery of the same `event_id` returns the stored row untouched.
    """
    existing = db.scalars(
        select(RazorpayEvent).where(RazorpayEvent.event_id == event_id)
    ).first()
    if existing is not None:
        return existing

    row = RazorpayEvent(event_id=event_id, event_type=event_type, payload=payload)
    db.add(row)
    db.flush()

    if event_type not in _HANDLED:
        row.status = "ignored"
        db.flush()
        return row

    try:
        _apply_subscription_event(db, event_type, payload)
        row.status = "processed"
        row.processed_at = datetime.now(timezone.utc)
    except Exception as exc:  # noqa: BLE001 - recorded, not raised, so Razorpay stops retrying a poison event
        row.status = "failed"
        row.error = str(exc)[:500]
    db.flush()
    return row


def _epoch_to_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).date()
    except (TypeError, ValueError, OSError):
        return None


def _billing_for_subscription(db: Session, sub_id: str) -> ShopBilling | None:
    return db.scalars(
        select(ShopBilling).where(ShopBilling.razorpay_subscription_id == sub_id)
    ).first()


def _apply_subscription_event(db: Session, event_type: str, payload: dict[str, Any]) -> None:
    sub_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    sub_id = sub_entity.get("id")
    if not sub_id:
        raise SubscriptionError("Webhook payload has no subscription id.")

    billing = _billing_for_subscription(db, sub_id)
    if billing is None:
        raise SubscriptionError(f"No shop is linked to subscription {sub_id}.")

    period_end = _epoch_to_date(sub_entity.get("current_end"))
    rzp_status = sub_entity.get("status")
    if rzp_status:
        billing.mandate_status = rzp_status

    if event_type == "subscription.authenticated":
        # Mandate approved; first charge imminent. Leave lifecycle as-is
        # (still TRIAL/whatever) until money actually moves.
        return

    if event_type in ("subscription.activated", "subscription.resumed"):
        billing.status = SubscriptionStatus.ACTIVE
        billing.grace_until = None
        if period_end:
            billing.paid_until = period_end
        return

    if event_type == "subscription.charged":
        billing.status = SubscriptionStatus.ACTIVE
        billing.grace_until = None
        plan_period = billing.plan.interval if billing.plan else "monthly"
        billing.paid_until = period_end or (date.today() + _FALLBACK_PERIOD.get(plan_period, timedelta(days=31)))
        _record_invoice(db, billing, payload)
        if billing.cancel_at_period_end:
            # A charge went through after a scheduled cancel -- Razorpay only
            # cancels at cycle end, so this is expected; nothing to undo.
            pass
        return

    if event_type == "subscription.pending":
        billing.status = SubscriptionStatus.PAST_DUE
        billing.grace_until = date.today() + timedelta(days=GRACE_DAYS)
        return

    if event_type == "subscription.halted":
        billing.status = SubscriptionStatus.PAST_DUE
        if billing.grace_until is None:
            billing.grace_until = date.today() + timedelta(days=GRACE_DAYS)
        return

    if event_type == "subscription.cancelled":
        billing.status = SubscriptionStatus.CANCELLED
        billing.cancel_at_period_end = False
        # keep paid_until: catalog serves until the paid period ends
        return

    if event_type == "subscription.completed":
        billing.status = SubscriptionStatus.EXPIRED
        return

    if event_type == "subscription.paused":
        billing.status = SubscriptionStatus.PAST_DUE
        if billing.grace_until is None:
            billing.grace_until = date.today() + timedelta(days=GRACE_DAYS)
        return


def _record_invoice(db: Session, billing: ShopBilling, payload: dict[str, Any]) -> None:
    inv = payload.get("payload", {}).get("invoice", {}).get("entity", {})
    pay = payload.get("payload", {}).get("payment", {}).get("entity", {})
    invoice_id = inv.get("id")

    if invoice_id:
        dup = db.scalars(
            select(SubscriptionInvoice).where(SubscriptionInvoice.razorpay_invoice_id == invoice_id)
        ).first()
        if dup is not None:
            return

    amount = inv.get("amount") or pay.get("amount") or (billing.plan.amount if billing.plan else 0)
    paid_ts = pay.get("created_at") or inv.get("paid_at")
    paid_at = (
        datetime.fromtimestamp(int(paid_ts), tz=timezone.utc)
        if paid_ts
        else datetime.now(timezone.utc)
    )
    db.add(
        SubscriptionInvoice(
            shop_id=billing.shop_id,
            razorpay_invoice_id=invoice_id,
            razorpay_payment_id=pay.get("id"),
            razorpay_subscription_id=billing.razorpay_subscription_id,
            amount=int(amount),
            currency=(inv.get("currency") or pay.get("currency") or "INR"),
            period_start=_epoch_to_date(inv.get("billing_start")),
            period_end=_epoch_to_date(inv.get("billing_end")),
            paid_at=paid_at,
        )
    )
    db.flush()


# ------------------------------------------------------------- daily sweep


def sweep_expired(db: Session, *, today: date | None = None) -> dict[str, int]:
    """Flip shops whose access has genuinely lapsed to EXPIRED:
      - TRIAL past trial_end_date
      - PAST_DUE past grace_until
      - CANCELLED past paid_until

    Idempotent -- safe to run many times a day. Returns a per-reason count.
    Caller commits.
    """
    ref = today or date.today()
    out = {"trial": 0, "grace": 0, "cancelled": 0}

    trial_lapsed = db.scalars(
        select(ShopBilling).where(
            ShopBilling.status == SubscriptionStatus.TRIAL,
            ShopBilling.trial_end_date.isnot(None),
            ShopBilling.trial_end_date < ref,
        )
    ).all()
    for b in trial_lapsed:
        b.status = SubscriptionStatus.EXPIRED
        out["trial"] += 1

    grace_lapsed = db.scalars(
        select(ShopBilling).where(
            ShopBilling.status == SubscriptionStatus.PAST_DUE,
            ShopBilling.grace_until.isnot(None),
            ShopBilling.grace_until < ref,
        )
    ).all()
    for b in grace_lapsed:
        b.status = SubscriptionStatus.EXPIRED
        out["grace"] += 1

    cancelled_lapsed = db.scalars(
        select(ShopBilling).where(
            ShopBilling.status == SubscriptionStatus.CANCELLED,
            ShopBilling.paid_until.isnot(None),
            ShopBilling.paid_until < ref,
        )
    ).all()
    for b in cancelled_lapsed:
        b.status = SubscriptionStatus.EXPIRED
        out["cancelled"] += 1

    db.flush()
    return out


# --------------------------------------------------------------- reconcile


def reconcile_from_razorpay(db: Session, shop: Shop) -> ShopBilling:
    """Pull the subscription's current state from Razorpay and re-apply it.
    A manual 'something looks wrong' button for the Super Admin; also useful
    when a webhook was missed."""
    billing = shop.billing
    if not billing.razorpay_subscription_id:
        raise SubscriptionError("This shop has no subscription.")
    client = razorpay_client.get_client()
    sub = client.fetch_subscription(billing.razorpay_subscription_id)
    fake_event = {"payload": {"subscription": {"entity": sub}}}
    status_map = {
        "authenticated": "subscription.authenticated",
        "active": "subscription.activated",
        "pending": "subscription.pending",
        "halted": "subscription.halted",
        "cancelled": "subscription.cancelled",
        "completed": "subscription.completed",
        "paused": "subscription.paused",
    }
    mapped = status_map.get(sub.get("status", ""))
    if mapped:
        _apply_subscription_event(db, mapped, fake_event)
    else:
        billing.mandate_status = sub.get("status")
    db.flush()
    return billing
