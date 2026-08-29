"""Shop-owner-facing dashboard, analytics and profile settings.

Mounted at /api/shops/{shop_id}.

- /profile (GET/PUT) uses `require_shop_access`: the shop's owner, or a
  Super Admin helping set the shop up.
- /dashboard and /analytics* use `require_shop_owner_self`: the owner only.
  After the role redesign, catalog-engagement data (counts, views,
  searches, sales) is the shop owner's alone -- a Super Admin gets a 404.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_shop_access, require_shop_owner_self
from app.database.session import get_db
from app.models.user import User
from app.schemas.analytics import RichAnalytics, ShopAnalytics
from app.schemas.dashboard import ShopOwnerDashboardStats
from app.schemas.selection import Lead
from app.schemas.shop import (
    InvoiceItem,
    ShopBillingDetail,
    ShopDetail,
    ShopOwnerBrief,
    ShopUpdate,
    SubscriptionActionResponse,
)
from app.services import analytics as analytics_service
from app.services import billing as billing_service
from app.services import selection as selection_service
from app.services import shop as shop_service
from app.services import subscription as subscription_service
from app.services.razorpay_client import RazorpayError

router = APIRouter(prefix="/api/shops/{shop_id}", tags=["shop-settings"])


def _get_shop_or_404(db: Session, shop_id: int):
    shop = shop_service.get_shop(db, shop_id)
    if shop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found.")
    return shop


def _to_profile(shop, product_count: int) -> ShopDetail:
    owner = (
        ShopOwnerBrief(id=shop.owner.id, name=shop.owner.name, email=shop.owner.email)
        if shop.owner
        else None
    )
    return ShopDetail(
        id=shop.id,
        name=shop.name,
        slug=shop.slug,
        is_active=shop.is_active,
        subscription_status=shop.billing.status,
        trial_end_date=shop.billing.trial_end_date,
        trial_days_remaining=billing_service.trial_days_remaining(shop),
        trial_status_label=billing_service.lifecycle_label(shop),
        owner=owner,
        product_count=product_count,
        created_at=shop.created_at,
        description=shop.description,
        phone=shop.phone,
        address=shop.address,
        city=shop.city,
        website=shop.website,
        logo_url=shop.logo_url,
        updated_at=shop.updated_at,
    )


@router.get("/dashboard", response_model=ShopOwnerDashboardStats)
def get_dashboard(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> ShopOwnerDashboardStats:
    shop = _get_shop_or_404(db, shop_id)
    stats = shop_service.get_shop_stats(db, shop_id)
    return ShopOwnerDashboardStats(
        **stats,
        is_active=shop.is_active,
        subscription_status=shop.billing.status,
        trial_days_remaining=billing_service.trial_days_remaining(shop),
        trial_status_label=billing_service.lifecycle_label(shop),
    )


@router.get("/profile", response_model=ShopDetail)
def get_profile(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    counts = shop_service.get_product_counts_by_shop(db)
    return _to_profile(shop, counts.get(shop_id, 0))


@router.get("/analytics", response_model=ShopAnalytics)
def get_analytics(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> ShopAnalytics:
    _get_shop_or_404(db, shop_id)
    return ShopAnalytics(**analytics_service.get_shop_analytics(db, shop_id))


@router.get("/analytics/rich", response_model=RichAnalytics)
def get_rich_analytics(
    shop_id: int,
    period: str = Query(default="7d", pattern="^(today|7d|30d|3m|1y)$"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> RichAnalytics:
    """Rich period-based analytics with time-series, comparisons, and breakdowns."""
    _get_shop_or_404(db, shop_id)
    return RichAnalytics(**analytics_service.get_rich_analytics(db, shop_id, period))


@router.get("/leads", response_model=list[Lead])
def get_leads(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> list[Lead]:
    """Customers who left contact details via the consent popup, newest
    first, each with the products they'd selected. Owner-only."""
    _get_shop_or_404(db, shop_id)
    return [Lead(**row) for row in selection_service.list_leads(db, shop_id)]


# --- Billing (owner: read-only status + self-serve autopay setup) --------


@router.get("/billing", response_model=ShopBillingDetail)
def get_billing(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> ShopBillingDetail:
    shop = _get_shop_or_404(db, shop_id)
    return ShopBillingDetail(**billing_service.billing_summary(shop))


@router.post("/billing/subscription", response_model=SubscriptionActionResponse)
def start_billing_subscription(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> SubscriptionActionResponse:
    """Owner self-serve: create the Razorpay subscription and return the
    hosted URL to approve the UPI autopay mandate."""
    shop = _get_shop_or_404(db, shop_id)
    try:
        billing = subscription_service.start_subscription(db, shop)
    except subscription_service.SubscriptionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except RazorpayError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Payment setup failed: {exc}"
        ) from exc
    auth_url = getattr(billing, "_short_url", None)
    db.commit()
    db.refresh(shop)
    return SubscriptionActionResponse(
        billing=ShopBillingDetail(**billing_service.billing_summary(shop)),
        authorization_url=auth_url,
    )


@router.get("/invoices", response_model=list[InvoiceItem])
def list_invoices(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_owner_self),
) -> list[InvoiceItem]:
    shop = _get_shop_or_404(db, shop_id)
    return [
        InvoiceItem(
            amount=inv.amount,
            currency=inv.currency,
            period_start=inv.period_start,
            period_end=inv.period_end,
            paid_at=inv.paid_at,
        )
        for inv in shop.invoices
    ]


@router.put("/profile", response_model=ShopDetail)
def update_profile(
    shop_id: int,
    payload: ShopUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    shop = shop_service.update_shop(db, shop, payload)
    db.commit()
    db.refresh(shop)
    counts = shop_service.get_product_counts_by_shop(db)
    return _to_profile(shop, counts.get(shop_id, 0))
