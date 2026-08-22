"""Super Admin endpoints: shop CRUD, activation, dashboard stats.

Every route in this router requires the SUPER_ADMIN role, enforced once at
the router level (`dependencies=[...]`) rather than repeated per-endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.shop import Shop
from app.schemas.activity import RecentActivityItem
from app.schemas.dashboard import SuperAdminDashboardStats
from app.schemas.shop import (
    ShopCreate,
    ShopCreateResponse,
    ShopDetail,
    ShopDetailResponse,
    ShopListItem,
    ShopOwnerBrief,
    ShopStatusUpdate,
    ShopUpdate,
)
from app.schemas.user import UserRead
from app.services import qr as qr_service
from app.services import shop as shop_service
from app.services.trial import trial_days_remaining, trial_status_label

router = APIRouter(
    prefix="/api/super-admin",
    tags=["super-admin"],
    dependencies=[Depends(require_role(UserRole.SUPER_ADMIN))],
)


def _owner_brief(shop: Shop) -> ShopOwnerBrief | None:
    if shop.owner is None:
        return None
    return ShopOwnerBrief(id=shop.owner.id, name=shop.owner.name, email=shop.owner.email)


def _to_list_item(shop: Shop, product_count: int) -> ShopListItem:
    return ShopListItem(
        id=shop.id,
        name=shop.name,
        slug=shop.slug,
        is_active=shop.is_active,
        subscription_status=shop.subscription_status,
        trial_end_date=shop.trial_end_date,
        trial_days_remaining=trial_days_remaining(shop),
        trial_status_label=trial_status_label(shop),
        owner=_owner_brief(shop),
        product_count=product_count,
        created_at=shop.created_at,
    )


def _to_detail(shop: Shop, stats: dict[str, int]) -> ShopDetail:
    return ShopDetail(
        id=shop.id,
        name=shop.name,
        slug=shop.slug,
        is_active=shop.is_active,
        subscription_status=shop.subscription_status,
        trial_end_date=shop.trial_end_date,
        trial_days_remaining=trial_days_remaining(shop),
        trial_status_label=trial_status_label(shop),
        owner=_owner_brief(shop),
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


def _get_shop_or_404(db: Session, shop_id: int) -> Shop:
    shop = shop_service.get_shop(db, shop_id)
    if shop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found.")
    return shop


@router.get("/dashboard", response_model=SuperAdminDashboardStats)
def get_dashboard(db: Session = Depends(get_db)) -> SuperAdminDashboardStats:
    return SuperAdminDashboardStats(**shop_service.get_dashboard_counts(db))


@router.get("/shops", response_model=list[ShopListItem])
def list_shops(db: Session = Depends(get_db)) -> list[ShopListItem]:
    shops = shop_service.list_shops(db)
    counts = shop_service.get_product_counts_by_shop(db)
    return [_to_list_item(shop, counts.get(shop.id, 0)) for shop in shops]


@router.post("/shops", response_model=ShopCreateResponse, status_code=status.HTTP_201_CREATED)
def create_shop(payload: ShopCreate, db: Session = Depends(get_db)) -> ShopCreateResponse:
    try:
        shop, owner = shop_service.create_shop_with_owner(db, payload)
        db.commit()
    except shop_service.ShopSlugTakenError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The shop URL '{exc.slug}' is already taken.",
        ) from exc
    except shop_service.OwnerEmailTakenError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The email '{exc.email}' is already registered.",
        ) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except IntegrityError as exc:
        # Fallback for a race condition slipping past the pre-checks above.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the shop -- it conflicts with an existing shop or account.",
        ) from exc

    stats = shop_service.get_shop_stats(db, shop.id)
    return ShopCreateResponse(shop=_to_detail(shop, stats), owner=UserRead.model_validate(owner))


@router.get("/shops/{shop_id}", response_model=ShopDetailResponse)
def get_shop_detail(shop_id: int, db: Session = Depends(get_db)) -> ShopDetailResponse:
    shop = _get_shop_or_404(db, shop_id)
    stats = shop_service.get_shop_stats(db, shop.id)
    activities = shop_service.get_recent_activity(db, shop.id)
    recent_activity = [
        RecentActivityItem(
            id=activity.id,
            action=activity.action,
            product_id=activity.product_id,
            product_name=activity.product.name if activity.product else None,
            user_id=activity.user_id,
            user_name=activity.user.name if activity.user else None,
            created_at=activity.created_at,
        )
        for activity in activities
    ]
    return ShopDetailResponse(shop=_to_detail(shop, stats), recent_activity=recent_activity)


@router.get("/shops/{shop_id}/qr-code", response_class=Response)
def get_shop_qr_code(shop_id: int, db: Session = Depends(get_db)) -> Response:
    """PNG QR code encoding this shop's public catalog URL, for a Super
    Admin to print/display when onboarding a new shop. Not cached -- it's
    cheap to regenerate and the shop's slug can change (see `update_shop`).
    """
    shop = _get_shop_or_404(db, shop_id)
    png_bytes = qr_service.generate_shop_qr_png(shop.slug)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{shop.slug}-qr-code.png"'},
    )


@router.put("/shops/{shop_id}", response_model=ShopDetail)
def update_shop(shop_id: int, payload: ShopUpdate, db: Session = Depends(get_db)) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    shop = shop_service.update_shop(db, shop, payload)
    db.commit()
    stats = shop_service.get_shop_stats(db, shop.id)
    return _to_detail(shop, stats)


@router.patch("/shops/{shop_id}/status", response_model=ShopDetail)
def update_shop_status(
    shop_id: int, payload: ShopStatusUpdate, db: Session = Depends(get_db)
) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    shop = shop_service.set_shop_active(db, shop, payload.is_active)
    db.commit()
    stats = shop_service.get_shop_stats(db, shop.id)
    return _to_detail(shop, stats)
