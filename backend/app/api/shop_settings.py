"""Shop-owner-facing dashboard stats and profile settings (Phase 4).

Mounted at /api/shops/{shop_id}. Deliberately reuses the Phase 3 shop
service functions (`get_shop_stats`, `update_shop`) rather than
duplicating them -- this router just exposes them to a shop owner acting
on their own shop (Super Admin already has equivalent access via
/api/super-admin/shops/{id}).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_shop_access
from app.database.session import get_db
from app.models.user import User
from app.schemas.dashboard import ShopOwnerDashboardStats
from app.schemas.shop import ShopDetail, ShopOwnerBrief, ShopUpdate
from app.services import shop as shop_service
from app.services.trial import trial_days_remaining, trial_status_label

router = APIRouter(prefix="/api/shops/{shop_id}", tags=["shop-settings"])


def _get_shop_or_404(db: Session, shop_id: int):
    shop = shop_service.get_shop(db, shop_id)
    if shop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found.")
    return shop


def _to_profile(shop, stats: dict[str, int]) -> ShopDetail:
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
        subscription_status=shop.subscription_status,
        trial_end_date=shop.trial_end_date,
        trial_days_remaining=trial_days_remaining(shop),
        trial_status_label=trial_status_label(shop),
        owner=owner,
        product_count=stats["product_count"],
        created_at=shop.created_at,
        description=shop.description,
        phone=shop.phone,
        address=shop.address,
        city=shop.city,
        website=shop.website,
        logo_url=shop.logo_url,
        updated_at=shop.updated_at,
        products_available=stats["products_available"],
        products_sold=stats["products_sold"],
        products_out_of_stock=stats["products_out_of_stock"],
        products_added_this_week=stats["products_added_this_week"],
    )


@router.get("/dashboard", response_model=ShopOwnerDashboardStats)
def get_dashboard(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> ShopOwnerDashboardStats:
    shop = _get_shop_or_404(db, shop_id)
    stats = shop_service.get_shop_stats(db, shop_id)
    return ShopOwnerDashboardStats(
        **stats,
        is_active=shop.is_active,
        subscription_status=shop.subscription_status,
        trial_days_remaining=trial_days_remaining(shop),
        trial_status_label=trial_status_label(shop),
    )


@router.get("/profile", response_model=ShopDetail)
def get_profile(
    shop_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_shop_access),
) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    stats = shop_service.get_shop_stats(db, shop_id)
    return _to_profile(shop, stats)


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
    stats = shop_service.get_shop_stats(db, shop_id)
    return _to_profile(shop, stats)
