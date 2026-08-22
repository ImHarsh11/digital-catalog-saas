"""FastAPI dependencies for authentication and role-based authorization.

These are the building blocks Phase 3/4 endpoints (shop, product, category
management) will depend on to enforce "a shop owner can only ever touch
their own shop's data."
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwt import TokenError, decode_access_token
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated User from the Authorization: Bearer header.

    Always re-fetches the user from the database (rather than trusting the
    token payload alone) so a deactivated account or role change takes
    effect immediately rather than after the token expires.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise unauthorized from exc

    user_id = payload.get("sub")
    if user_id is None:
        raise unauthorized

    try:
        user = db.get(User, int(user_id))
    except (TypeError, ValueError) as exc:
        raise unauthorized from exc

    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_role(*allowed_roles: UserRole):
    """Dependency factory: 403s unless the current user has one of the roles."""

    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return _check


def get_current_shop_owner(
    current_user: User = Depends(require_role(UserRole.SHOP_OWNER)),
) -> User:
    """Like get_current_user, but guarantees role == SHOP_OWNER and a shop."""
    if current_user.shop_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not associated with a shop.",
        )
    return current_user


def verify_shop_ownership(current_user: User, resource_shop_id: int) -> None:
    """Raise 404 if `resource_shop_id` doesn't belong to `current_user`.

    A 404 (rather than 403) is used deliberately: it avoids confirming to
    an unauthorized caller that a resource with that id exists at all,
    which matters for a scheme (`/api/products/:id`) where ids are
    sequential and easy to guess.

    Super admins are exempt — they're allowed to manage any shop's data on
    the shop's behalf (catalog-management service).
    """
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    if current_user.shop_id != resource_shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found.",
        )


def require_shop_access(shop_id: int, current_user: User = Depends(get_current_user)) -> User:
    """Router-level dependency for every `/api/shops/{shop_id}/...` endpoint
    (categories, products, images, dashboard, profile -- Phase 4).

    FastAPI resolves `shop_id` from the path for a dependency the same way
    it does for an endpoint, so this can sit in an APIRouter's
    `dependencies=[...]` once instead of being repeated on every route.
    Delegates entirely to `verify_shop_ownership`: a shop owner only ever
    passes for their own shop_id, a super admin always passes.
    """
    verify_shop_ownership(current_user, shop_id)
    return current_user
