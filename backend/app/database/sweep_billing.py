"""Daily billing sweep (redesign Phase 5).

Flips shops whose access has genuinely lapsed to EXPIRED:
  - TRIAL past its trial_end_date
  - PAST_DUE past its grace_until
  - CANCELLED past its paid_until

Run once a day from a scheduler (Render Cron / GitHub Actions / cron):

    python -m app.database.sweep_billing

Idempotent and safe against production -- it only ever moves a shop to
EXPIRED, never the other way, and Razorpay webhooks remain the source of
truth for everything else.
"""

from app.database.session import SessionLocal
from app.services import subscription as subscription_service


def main() -> None:
    db = SessionLocal()
    try:
        result = subscription_service.sweep_expired(db)
        db.commit()
        print(
            "billing sweep: "
            f"{result['trial']} trial(s), {result['grace']} grace window(s), "
            f"{result['cancelled']} cancelled -> EXPIRED"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
