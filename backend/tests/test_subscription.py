"""Phase 5 -- Razorpay subscription lifecycle: webhook intake + signature,
event -> status mapping, idempotency, the daily sweep, the create/cancel
endpoints, and revenue metrics.

Razorpay HTTP is never hit -- `get_client` is monkeypatched to a stub.
"""

import hashlib
import hmac
import json
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import SubscriptionStatus
from app.models.billing_plan import BillingPlan
from app.models.razorpay_event import RazorpayEvent
from app.models.shop_billing import ShopBilling
from app.models.subscription_invoice import SubscriptionInvoice
from app.services import subscription as subscription_service
from app.utils.config import get_settings

from tests.conftest import auth_headers

WHSEC = "whsec_test_abc"


# --- fixtures ---------------------------------------------------------


@pytest.fixture()
def rzp_settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "razorpay_key_id", "rzp_test_key")
    monkeypatch.setattr(s, "razorpay_key_secret", "shhh")
    monkeypatch.setattr(s, "razorpay_webhook_secret", WHSEC)
    return s


@pytest.fixture()
def plan(db_session):
    p = BillingPlan(
        code="monthly-999", name="Monthly", amount=99900, currency="INR",
        interval="monthly", interval_count=1, razorpay_plan_id="plan_seed",
    )
    db_session.add(p)
    db_session.flush()
    return p


class _StubClient:
    """Stands in for RazorpayClient in the subscription service."""

    def __init__(self):
        self.created = []
        self.cancelled = []

    def create_plan(self, **kw):
        return {"id": "plan_stub"}

    def create_subscription(self, *, plan_id, total_count=120, customer_notify=True, notes=None):
        self.created.append(notes)
        return {
            "id": "sub_stub_1",
            "status": "created",
            "customer_id": "cust_stub_1",
            "short_url": "https://rzp.io/i/authorize-stub",
        }

    def fetch_subscription(self, sub_id):
        return {"id": sub_id, "status": "active", "current_end": _epoch(days=30)}

    def cancel_subscription(self, sub_id, *, at_cycle_end=False):
        self.cancelled.append((sub_id, at_cycle_end))
        return {"id": sub_id, "status": "cancelled"}


@pytest.fixture()
def stub_client(monkeypatch):
    stub = _StubClient()
    monkeypatch.setattr(subscription_service.razorpay_client, "get_client", lambda: stub)
    return stub


# --- helpers ---------------------------------------------------------


def _epoch(*, days=0):
    return int((datetime.now(timezone.utc) + timedelta(days=days)).timestamp())


def _link_subscription(db_session, shop, plan, sub_id="sub_stub_1"):
    b = shop.billing
    b.razorpay_subscription_id = sub_id
    b.plan_id = plan.id
    b.mandate_status = "authenticated"
    db_session.flush()
    return b


def _sub_payload(event, sub_id="sub_stub_1", *, status="active", current_end=None, invoice=None, payment=None):
    entity = {"id": sub_id, "status": status}
    if current_end is not None:
        entity["current_end"] = current_end
    body = {"event": event, "payload": {"subscription": {"entity": entity}}}
    if invoice is not None:
        body["payload"]["invoice"] = {"entity": invoice}
    if payment is not None:
        body["payload"]["payment"] = {"entity": payment}
    return body


def _post_webhook(client, payload, *, event_id="evt_1", secret=WHSEC, signed=True):
    raw = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "X-Razorpay-Event-Id": event_id}
    if signed:
        headers["X-Razorpay-Signature"] = hmac.new(
            secret.encode(), raw, hashlib.sha256
        ).hexdigest()
    return client.post("/api/webhooks/razorpay", content=raw, headers=headers)


# --- webhook auth ----------------------------------------------------


def test_webhook_rejects_bad_signature(client, rzp_settings):
    resp = _post_webhook(client, _sub_payload("subscription.activated"), signed=False)
    assert resp.status_code == 400


def test_webhook_rejects_wrong_secret(client, rzp_settings):
    resp = _post_webhook(client, _sub_payload("subscription.activated"), secret="nope")
    assert resp.status_code == 400


def test_webhook_503_when_secret_unset(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "razorpay_webhook_secret", "")
    resp = _post_webhook(client, _sub_payload("subscription.activated"), signed=False)
    assert resp.status_code == 503


# --- event -> status mapping ---------------------------------------


def test_activated_sets_active_and_paid_until(client, db_session, rzp_settings, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    end = _epoch(days=30)
    resp = _post_webhook(
        client, _sub_payload("subscription.activated", current_end=end), event_id="evt_act"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "processed"
    db_session.refresh(shop_a.billing)
    assert shop_a.billing.status == SubscriptionStatus.ACTIVE
    assert shop_a.billing.paid_until == datetime.fromtimestamp(end, tz=timezone.utc).date()


def test_charged_records_invoice_and_is_idempotent(client, db_session, rzp_settings, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    payload = _sub_payload(
        "subscription.charged",
        current_end=_epoch(days=30),
        invoice={"id": "inv_1", "amount": 99900, "currency": "INR"},
        payment={"id": "pay_1", "amount": 99900, "created_at": _epoch()},
    )
    r1 = _post_webhook(client, payload, event_id="evt_charge_1")
    assert r1.status_code == 200 and r1.json()["status"] == "processed"

    # Redelivery of the SAME event id -> stored row returned untouched, no dup invoice
    r2 = _post_webhook(client, payload, event_id="evt_charge_1")
    assert r2.status_code == 200

    invoices = db_session.query(SubscriptionInvoice).filter_by(shop_id=shop_a.id).all()
    assert len(invoices) == 1
    assert invoices[0].amount == 99900
    events = db_session.query(RazorpayEvent).filter_by(event_id="evt_charge_1").all()
    assert len(events) == 1


def test_pending_sets_past_due_with_grace(client, db_session, rzp_settings, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    resp = _post_webhook(client, _sub_payload("subscription.pending", status="pending"), event_id="evt_pend")
    assert resp.status_code == 200
    db_session.refresh(shop_a.billing)
    assert shop_a.billing.status == SubscriptionStatus.PAST_DUE
    assert shop_a.billing.grace_until == date.today() + timedelta(days=subscription_service.GRACE_DAYS)


def test_halted_stays_past_due(client, db_session, rzp_settings, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    _post_webhook(client, _sub_payload("subscription.halted", status="halted"), event_id="evt_halt")
    db_session.refresh(shop_a.billing)
    assert shop_a.billing.status == SubscriptionStatus.PAST_DUE
    assert shop_a.billing.grace_until is not None


def test_cancelled_keeps_paid_until(client, db_session, rzp_settings, shop_a, plan):
    b = _link_subscription(db_session, shop_a, plan)
    b.paid_until = date.today() + timedelta(days=12)
    b.status = SubscriptionStatus.ACTIVE
    db_session.flush()

    _post_webhook(client, _sub_payload("subscription.cancelled", status="cancelled"), event_id="evt_cxl")
    db_session.refresh(shop_a.billing)
    assert shop_a.billing.status == SubscriptionStatus.CANCELLED
    assert shop_a.billing.paid_until == date.today() + timedelta(days=12)


def test_unknown_subscription_is_recorded_failed_not_500(client, db_session, rzp_settings):
    resp = _post_webhook(
        client, _sub_payload("subscription.activated", sub_id="sub_ghost"), event_id="evt_ghost"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "failed"
    row = db_session.query(RazorpayEvent).filter_by(event_id="evt_ghost").one()
    assert row.status == "failed" and row.error


def test_unhandled_event_is_ignored(client, db_session, rzp_settings, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    resp = _post_webhook(
        client, {"event": "payment.captured", "payload": {}}, event_id="evt_ignore"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


# --- daily sweep ---------------------------------------------------


def test_sweep_expires_lapsed_trial_grace_and_cancelled(db_session, shop_a, shop_b, plan):
    # shop_a: trial ended yesterday
    shop_a.billing.status = SubscriptionStatus.TRIAL
    shop_a.billing.trial_end_date = date.today() - timedelta(days=1)
    # shop_b: past_due, grace ran out
    shop_b.billing.status = SubscriptionStatus.PAST_DUE
    shop_b.billing.grace_until = date.today() - timedelta(days=1)
    db_session.flush()

    result = subscription_service.sweep_expired(db_session)
    db_session.flush()

    assert result["trial"] == 1 and result["grace"] == 1
    db_session.refresh(shop_a.billing)
    db_session.refresh(shop_b.billing)
    assert shop_a.billing.status == SubscriptionStatus.EXPIRED
    assert shop_b.billing.status == SubscriptionStatus.EXPIRED


def test_sweep_leaves_healthy_shops_alone(db_session, shop_a):
    shop_a.billing.status = SubscriptionStatus.TRIAL
    shop_a.billing.trial_end_date = date.today() + timedelta(days=5)
    db_session.flush()
    subscription_service.sweep_expired(db_session)
    db_session.refresh(shop_a.billing)
    assert shop_a.billing.status == SubscriptionStatus.TRIAL


# --- endpoints ---------------------------------------------------


def test_super_admin_creates_subscription(client, db_session, rzp_settings, stub_client, super_admin, shop_a, plan):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(f"/api/super-admin/shops/{shop_a.id}/subscription", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["authorization_url"] == "https://rzp.io/i/authorize-stub"
    assert body["billing"]["has_subscription"] is True
    assert body["billing"]["razorpay_subscription_id"] == "sub_stub_1"


def test_owner_starts_own_subscription(client, db_session, rzp_settings, stub_client, owner_a, shop_a, plan):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.post(f"/api/shops/{shop_a.id}/billing/subscription", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["authorization_url"].startswith("https://")


def test_owner_billing_is_readonly_view(client, owner_a, shop_a, plan):
    headers = auth_headers(client, "ownera@test.com", "OwnerA123!")
    resp = client.get(f"/api/shops/{shop_a.id}/billing", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "TRIAL"
    assert body["has_subscription"] is False


def test_double_subscription_conflicts(client, db_session, rzp_settings, stub_client, super_admin, shop_a, plan):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    first = client.post(f"/api/super-admin/shops/{shop_a.id}/subscription", headers=headers)
    assert first.status_code == 200
    # mandate is now "created" (active-ish) -> a second create is a conflict
    shop_a.billing.mandate_status = "active"
    db_session.flush()
    second = client.post(f"/api/super-admin/shops/{shop_a.id}/subscription", headers=headers)
    assert second.status_code == 409


def test_cancel_subscription_at_period_end(client, db_session, rzp_settings, stub_client, super_admin, shop_a, plan):
    _link_subscription(db_session, shop_a, plan)
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post(
        f"/api/super-admin/shops/{shop_a.id}/subscription/cancel?at_period_end=true", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is True
    assert stub_client.cancelled == [("sub_stub_1", True)]


def test_sweep_endpoint(client, db_session, super_admin, shop_a):
    shop_a.billing.status = SubscriptionStatus.TRIAL
    shop_a.billing.trial_end_date = date.today() - timedelta(days=2)
    db_session.flush()
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.post("/api/super-admin/billing/sweep", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["trial"] == 1


def test_billing_plans_endpoint(client, super_admin, plan):
    headers = auth_headers(client, "admin@test.com", "Admin123!")
    resp = client.get("/api/super-admin/billing-plans", headers=headers)
    assert resp.status_code == 200
    codes = [p["code"] for p in resp.json()]
    assert "monthly-999" in codes


# --- revenue metrics ------------------------------------------


def test_dashboard_revenue_reflects_active_and_invoices(
    client, db_session, rzp_settings, super_admin, shop_a, shop_b, plan
):
    # shop_a active on the plan -> MRR 999
    shop_a.billing.status = SubscriptionStatus.ACTIVE
    shop_a.billing.plan_id = plan.id
    shop_a.billing.razorpay_subscription_id = "sub_a"
    db_session.add(
        SubscriptionInvoice(
            shop_id=shop_a.id, amount=99900, currency="INR",
            paid_at=datetime.now(timezone.utc), razorpay_invoice_id="inv_rev_1",
        )
    )
    db_session.flush()

    headers = auth_headers(client, "admin@test.com", "Admin123!")
    body = client.get("/api/super-admin/dashboard", headers=headers).json()
    assert body["revenue_pending"] is False
    assert body["mrr"] == 999.0
    assert body["arr"] == 11988.0
    assert body["revenue_this_month"] == 999.0
