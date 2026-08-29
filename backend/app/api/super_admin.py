"""Super Admin endpoints: shop lifecycle, manual billing, activation.

Every route requires the SUPER_ADMIN role, enforced once at the router
level. After the role redesign the Super Admin owns tenant lifecycle and
revenue only -- no catalog engagement data (product views, searches,
sales, activity feed) is exposed here; that belongs to the shop owner.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.shop import Shop
from app.schemas.dashboard import SuperAdminDashboardStats
from app.schemas.shop import (
    ShopBillingDetail,
    ShopBillingUpdate,
    ShopCreate,
    ShopCreateResponse,
    ShopDetail,
    ShopDetailResponse,
    ShopListItem,
    ShopOwnerBrief,
    ShopStatusUpdate,
    ShopUpdate,
)
from app.schemas.theme import ResolvedTheme, ThemeConfig, ThemePresetInfo
from app.schemas.user import UserRead
from app.services import admin_metrics as metrics_service
from app.services import billing as billing_service
from app.services import qr as qr_service
from app.services import shop as shop_service
from app.services import theme as theme_service

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
        subscription_status=shop.billing.status,
        trial_end_date=shop.billing.trial_end_date,
        trial_days_remaining=billing_service.trial_days_remaining(shop),
        trial_status_label=billing_service.lifecycle_label(shop),
        owner=_owner_brief(shop),
        product_count=product_count,
        created_at=shop.created_at,
    )


def _to_detail(shop: Shop, product_count: int) -> ShopDetail:
    return ShopDetail(
        **_to_list_item(shop, product_count).model_dump(),
        description=shop.description,
        phone=shop.phone,
        address=shop.address,
        city=shop.city,
        website=shop.website,
        logo_url=shop.logo_url,
        updated_at=shop.updated_at,
    )


def _billing_detail(shop: Shop) -> ShopBillingDetail:
    b = shop.billing
    return ShopBillingDetail(
        status=b.status,
        trial_start_date=b.trial_start_date,
        trial_end_date=b.trial_end_date,
        paid_until=b.paid_until,
        grace_until=b.grace_until,
        days_remaining=billing_service.trial_days_remaining(shop),
        lifecycle_label=billing_service.lifecycle_label(shop),
        is_catalog_live=billing_service.is_catalog_live(shop),
    )


def _get_shop_or_404(db: Session, shop_id: int) -> Shop:
    shop = shop_service.get_shop(db, shop_id)
    if shop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found.")
    return shop


def _detail_response(db: Session, shop: Shop) -> ShopDetailResponse:
    product_count = shop_service.get_product_counts_by_shop(db).get(shop.id, 0)
    return ShopDetailResponse(
        shop=_to_detail(shop, product_count),
        billing=_billing_detail(shop),
        theme_config=ThemeConfig(**(shop.theme or {})),
        theme_resolved=ResolvedTheme(**theme_service.resolve_theme(shop.theme)),
    )


@router.get("/dashboard", response_model=SuperAdminDashboardStats)
def get_dashboard(db: Session = Depends(get_db)) -> SuperAdminDashboardStats:
    return SuperAdminDashboardStats(**metrics_service.get_dashboard(db))


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
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the shop -- it conflicts with an existing shop or account.",
        ) from exc

    db.refresh(shop)
    return ShopCreateResponse(shop=_to_detail(shop, 0), owner=UserRead.model_validate(owner))


@router.get("/theme-presets", response_model=list[ThemePresetInfo])
def list_theme_presets() -> list[ThemePresetInfo]:
    return [ThemePresetInfo(**p) for p in theme_service.preset_choices()]


@router.get("/shops/{shop_id}", response_model=ShopDetailResponse)
def get_shop_detail(shop_id: int, db: Session = Depends(get_db)) -> ShopDetailResponse:
    shop = _get_shop_or_404(db, shop_id)
    return _detail_response(db, shop)


@router.put("/shops/{shop_id}/theme", response_model=ShopDetailResponse)
def update_shop_theme(
    shop_id: int, payload: ThemeConfig, db: Session = Depends(get_db)
) -> ShopDetailResponse:
    """Replace a shop's theme config. The frontend sends the full config
    (preset + any overrides); validation is enforced by ThemeConfig."""
    shop = _get_shop_or_404(db, shop_id)
    shop.theme = payload.model_dump(mode="json")
    db.commit()
    db.refresh(shop)
    return _detail_response(db, shop)


@router.get("/shops/{shop_id}/qr-code", response_class=Response)
def get_shop_qr_code(shop_id: int, db: Session = Depends(get_db)) -> Response:
    """PNG QR code encoding this shop's public catalog URL, for a Super
    Admin to print/display when onboarding a new shop."""
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
    db.refresh(shop)
    product_count = shop_service.get_product_counts_by_shop(db).get(shop.id, 0)
    return _to_detail(shop, product_count)


@router.patch("/shops/{shop_id}/status", response_model=ShopDetail)
def update_shop_status(
    shop_id: int, payload: ShopStatusUpdate, db: Session = Depends(get_db)
) -> ShopDetail:
    shop = _get_shop_or_404(db, shop_id)
    shop = shop_service.set_shop_active(db, shop, payload.is_active)
    db.commit()
    db.refresh(shop)
    product_count = shop_service.get_product_counts_by_shop(db).get(shop.id, 0)
    return _to_detail(shop, product_count)


@router.patch("/shops/{shop_id}/billing", response_model=ShopBillingDetail)
def update_shop_billing(
    shop_id: int, payload: ShopBillingUpdate, db: Session = Depends(get_db)
) -> ShopBillingDetail:
    """Manual billing controls until Razorpay lands (Phase 5): set the
    lifecycle status, extend a trial, or record a paid-through date."""
    shop = _get_shop_or_404(db, shop_id)
    shop_service.update_billing(db, shop, payload)
    db.commit()
    db.refresh(shop)
    return _billing_detail(shop)
