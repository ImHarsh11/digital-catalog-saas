"""HTTP-level tests for the role-based authorization dependencies.

These mount the real dependency functions (get_current_user, require_role,
get_current_shop_owner) on a throwaway router/app defined only in this test
module -- the product/shop endpoints that will use these dependencies for
real don't exist until Phase 3/4, but the authorization mechanism itself
is a Phase 2 deliverable and needs to be verified end-to-end over HTTP.
"""

from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_shop_owner, get_current_user, require_role
from app.auth.jwt import create_access_token
from app.database.session import get_db
from app.models.enums import UserRole


def _build_test_app(db_session):
    test_app = FastAPI()
    router = APIRouter()

    @router.get("/super-admin-only")
    def super_admin_only(user=Depends(require_role(UserRole.SUPER_ADMIN))):
        return {"ok": True, "user_id": user.id}

    @router.get("/shop-owner-only")
    def shop_owner_only(user=Depends(get_current_shop_owner)):
        return {"ok": True, "shop_id": user.shop_id}

    @router.get("/any-authenticated-user")
    def any_authenticated_user(user=Depends(get_current_user)):
        return {"ok": True, "user_id": user.id}

    test_app.include_router(router)
    test_app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(test_app)


def _auth_header(user) -> dict[str, str]:
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


def test_unauthenticated_request_is_rejected(db_session):
    client = _build_test_app(db_session)
    resp = client.get("/any-authenticated-user")
    assert resp.status_code == 401


def test_super_admin_can_access_super_admin_route(db_session, super_admin):
    client = _build_test_app(db_session)
    resp = client.get("/super-admin-only", headers=_auth_header(super_admin))
    assert resp.status_code == 200
    assert resp.json()["user_id"] == super_admin.id


def test_shop_owner_is_blocked_from_super_admin_route(db_session, owner_a):
    client = _build_test_app(db_session)
    resp = client.get("/super-admin-only", headers=_auth_header(owner_a))
    assert resp.status_code == 403


def test_shop_owner_can_access_shop_owner_route(db_session, owner_a):
    client = _build_test_app(db_session)
    resp = client.get("/shop-owner-only", headers=_auth_header(owner_a))
    assert resp.status_code == 200
    assert resp.json()["shop_id"] == owner_a.shop_id


def test_super_admin_is_blocked_from_shop_owner_only_route(db_session, super_admin):
    client = _build_test_app(db_session)
    resp = client.get("/shop-owner-only", headers=_auth_header(super_admin))
    assert resp.status_code == 403


def test_deactivated_user_is_rejected_even_with_valid_token(db_session, inactive_owner):
    client = _build_test_app(db_session)
    resp = client.get("/any-authenticated-user", headers=_auth_header(inactive_owner))
    assert resp.status_code == 401


def test_token_for_nonexistent_user_is_rejected(db_session):
    client = _build_test_app(db_session)
    token = create_access_token(subject="999999", role="SHOP_OWNER")
    resp = client.get(
        "/any-authenticated-user", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401
