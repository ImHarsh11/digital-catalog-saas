"""Tests for the shop-ownership guard that Phase 3/4 endpoints will use.

Spec section 19 / 29: "Shop A cannot access Shop B's products, and vice
versa" -- verified here at the helper-function level since the concrete
product/category endpoints that call it don't exist until Phase 4.
"""

import pytest
from fastapi import HTTPException

from app.auth.dependencies import verify_shop_ownership


def test_owner_can_access_their_own_shop(owner_a, shop_a):
    verify_shop_ownership(owner_a, shop_a.id)  # should not raise


def test_owner_a_cannot_access_shop_b(owner_a, shop_b):
    with pytest.raises(HTTPException) as exc_info:
        verify_shop_ownership(owner_a, shop_b.id)
    assert exc_info.value.status_code == 404


def test_owner_b_cannot_access_shop_a(owner_b, shop_a):
    with pytest.raises(HTTPException) as exc_info:
        verify_shop_ownership(owner_b, shop_a.id)
    assert exc_info.value.status_code == 404


def test_super_admin_can_access_any_shop(super_admin, shop_a, shop_b):
    verify_shop_ownership(super_admin, shop_a.id)
    verify_shop_ownership(super_admin, shop_b.id)
