"""Inbound webhooks (redesign Phase 5).

Razorpay subscription events. This endpoint is public (Razorpay has no
bearer token) but every request is authenticated by an HMAC-SHA256
signature over the raw body using the dashboard webhook secret. Unsigned
or mis-signed requests get a 400 and are never persisted.

Once the event is stored it returns 200 even if *applying* it failed --
the failure is recorded on `razorpay_events.status` and we don't want
Razorpay to keep retrying a poison event. A true infrastructure failure
(DB down) surfaces as a 500 so Razorpay retries later.
"""

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services import subscription as subscription_service
from app.services.razorpay_client import verify_webhook_signature
from app.utils.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/razorpay", status_code=status.HTTP_200_OK)
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None),
    x_razorpay_event_id: str | None = Header(default=None),
) -> dict[str, str]:
    settings = get_settings()
    raw = await request.body()

    if not settings.razorpay_webhook_secret:
        logger.warning("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is unset")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhooks not configured."
        )

    if not verify_webhook_signature(
        raw, x_razorpay_signature or "", settings.razorpay_webhook_secret
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature.")

    try:
        payload = json.loads(raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed JSON.") from exc

    event_type = payload.get("event", "")
    # Razorpay's `x-razorpay-event-id` header is the canonical de-dupe key.
    event_id = x_razorpay_event_id or payload.get("id") or f"anon:{abs(hash(raw))}"

    try:
        row = subscription_service.record_and_process_event(
            db, event_id=event_id, event_type=event_type, payload=payload
        )
        db.commit()
    except Exception:  # noqa: BLE001 - let Razorpay retry a true infra failure
        db.rollback()
        logger.exception("Razorpay webhook %s (%s) failed hard", event_type, event_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Processing error."
        )

    return {"status": row.status}
