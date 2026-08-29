"""Minimal Razorpay REST client (redesign Phase 5).

Deliberately a thin wrapper over `httpx` + `hmac` rather than the official
SDK -- matches the codebase's "no heavy deps, raw HTTP" style (cf.
SupabaseImageStorage) and keeps tests hermetic (monkeypatch one method).

Only the Subscriptions surface we actually use is implemented:
  - create / fetch / cancel a subscription
  - ensure a Plan exists for one of our BillingPlan rows
  - verify a webhook signature

Every call raises `RazorpayError` on a non-2xx response. Callers are
expected to check `settings.razorpay_enabled` first; `RazorpayNotConfigured`
is raised if not.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx

from app.utils.config import get_settings

_API_BASE = "https://api.razorpay.com/v1"
_TIMEOUT = httpx.Timeout(15.0)


class RazorpayError(RuntimeError):
    """A Razorpay API call failed."""

    def __init__(self, message: str, *, status_code: int | None = None, body: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RazorpayNotConfigured(RazorpayError):
    def __init__(self) -> None:
        super().__init__("Razorpay keys are not configured on this environment.")


class RazorpayClient:
    def __init__(self, key_id: str | None = None, key_secret: str | None = None) -> None:
        settings = get_settings()
        self._key_id = key_id or settings.razorpay_key_id
        self._key_secret = key_secret or settings.razorpay_key_secret

    @property
    def configured(self) -> bool:
        return bool(self._key_id and self._key_secret)

    # -- low level ------------------------------------------------------

    def _request(self, method: str, path: str, *, json: dict | None = None) -> dict[str, Any]:
        if not self.configured:
            raise RazorpayNotConfigured()
        try:
            resp = httpx.request(
                method,
                f"{_API_BASE}{path}",
                json=json,
                auth=(self._key_id, self._key_secret),
                timeout=_TIMEOUT,
            )
        except httpx.HTTPError as exc:  # network / timeout
            raise RazorpayError(f"Could not reach Razorpay: {exc}") from exc

        if resp.status_code >= 300:
            body: Any
            try:
                body = resp.json()
            except ValueError:
                body = resp.text
            message = body.get("error", {}).get("description") if isinstance(body, dict) else str(body)
            raise RazorpayError(
                message or f"Razorpay returned HTTP {resp.status_code}",
                status_code=resp.status_code,
                body=body,
            )
        return resp.json()

    # -- plans --------------------------------------------------------

    def create_plan(self, *, period: str, interval: int, amount: int, currency: str, name: str) -> dict:
        return self._request(
            "POST",
            "/plans",
            json={
                "period": period,  # "monthly" | "yearly" | "weekly" | "daily"
                "interval": interval,
                "item": {"name": name, "amount": amount, "currency": currency},
            },
        )

    # -- subscriptions ----------------------------------------------

    def create_subscription(
        self,
        *,
        plan_id: str,
        total_count: int = 120,
        customer_notify: bool = True,
        notes: dict[str, str] | None = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "plan_id": plan_id,
            "total_count": total_count,
            "customer_notify": 1 if customer_notify else 0,
        }
        if notes:
            payload["notes"] = notes
        return self._request("POST", "/subscriptions", json=payload)

    def fetch_subscription(self, subscription_id: str) -> dict:
        return self._request("GET", f"/subscriptions/{subscription_id}")

    def cancel_subscription(self, subscription_id: str, *, at_cycle_end: bool = False) -> dict:
        return self._request(
            "POST",
            f"/subscriptions/{subscription_id}/cancel",
            json={"cancel_at_cycle_end": 1 if at_cycle_end else 0},
        )


def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Constant-time check of the `X-Razorpay-Signature` header against the
    raw request body. Returns False for a missing signature/secret rather
    than raising."""
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


_client: RazorpayClient | None = None


def get_client() -> RazorpayClient:
    global _client
    if _client is None:
        _client = RazorpayClient()
    return _client
