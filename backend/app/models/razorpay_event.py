"""Raw Razorpay webhook events, stored for idempotency and audit (Phase 5).

Every webhook delivery is recorded here keyed by Razorpay's `x-razorpay-event-id`
BEFORE it is acted on. A redelivery of the same event id is a no-op. The
full payload is kept so a mis-processed event can be replayed by hand.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class RazorpayEvent(Base):
    __tablename__ = "razorpay_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Razorpay's delivery id (`x-razorpay-event-id` header). Unique so a
    # redelivery collides and is skipped.
    event_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)

    # received | processed | ignored | failed
    status: Mapped[str] = mapped_column(String(12), default="received", nullable=False)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<RazorpayEvent {self.event_type} {self.event_id} {self.status}>"
