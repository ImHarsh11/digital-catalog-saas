"""Authentication endpoints: POST /api/auth/login, GET /api/auth/me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.auth.security import verify_password
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.me import MeResponse
from app.schemas.shop import ShopBrief
from app.schemas.user import UserRead
from app.services.trial import trial_days_remaining, trial_status_label

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact support.",
        )

    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)) -> MeResponse:
    shop_brief: ShopBrief | None = None
    if current_user.shop is not None:
        shop = current_user.shop
        shop_brief = ShopBrief(
            id=shop.id,
            name=shop.name,
            slug=shop.slug,
            is_active=shop.is_active,
            subscription_status=shop.subscription_status,
            trial_end_date=shop.trial_end_date,
            trial_days_remaining=trial_days_remaining(shop),
            trial_status_label=trial_status_label(shop),
        )

    return MeResponse(user=UserRead.model_validate(current_user), shop=shop_brief)
