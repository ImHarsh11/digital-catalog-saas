"""Database-level constraint tests for the core models (spec section 7)."""

from datetime import date, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Category, Product, ProductStatus, Shop, SubscriptionStatus, User, UserRole


def _trial_dates():
    return date.today(), date.today() + timedelta(days=14)


def test_shop_slug_must_be_unique(db_session, shop_a):
    start, end = _trial_dates()
    dup = Shop(
        name="Duplicate Slug Shop",
        slug=shop_a.slug,
        is_active=True,
        trial_start_date=start,
        trial_end_date=end,
        subscription_status=SubscriptionStatus.TRIAL,
    )
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_user_email_must_be_unique(db_session, owner_a, shop_b):
    dup = User(
        name="Duplicate Email",
        email=owner_a.email,
        password_hash="x",
        role=UserRole.SHOP_OWNER,
        shop_id=shop_b.id,
        is_active=True,
    )
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_one_shop_cannot_have_two_owner_accounts(db_session, owner_a, shop_a):
    second_owner = User(
        name="Second Owner",
        email="second-owner@test.com",
        password_hash="x",
        role=UserRole.SHOP_OWNER,
        shop_id=shop_a.id,
        is_active=True,
    )
    db_session.add(second_owner)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_category_name_must_be_unique_within_a_shop(db_session, shop_a):
    db_session.add(Category(shop_id=shop_a.id, name="Silk Sarees", display_order=0, is_active=True))
    db_session.flush()

    dup = Category(shop_id=shop_a.id, name="Silk Sarees", display_order=1, is_active=True)
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_same_category_name_allowed_in_different_shops(db_session, shop_a, shop_b):
    db_session.add(Category(shop_id=shop_a.id, name="Silk Sarees", display_order=0, is_active=True))
    db_session.add(Category(shop_id=shop_b.id, name="Silk Sarees", display_order=0, is_active=True))
    db_session.flush()  # must not raise


def test_product_code_unique_within_shop_but_not_globally(db_session, shop_a, shop_b):
    cat_a = Category(shop_id=shop_a.id, name="Sarees", display_order=0, is_active=True)
    cat_b = Category(shop_id=shop_b.id, name="Sarees", display_order=0, is_active=True)
    db_session.add_all([cat_a, cat_b])
    db_session.flush()

    db_session.add(
        Product(
            shop_id=shop_a.id,
            category_id=cat_a.id,
            product_code="SKU1",
            name="Product A",
            price="100.00",
            status=ProductStatus.AVAILABLE,
        )
    )
    db_session.add(
        Product(
            shop_id=shop_b.id,
            category_id=cat_b.id,
            product_code="SKU1",
            name="Product B",
            price="100.00",
            status=ProductStatus.AVAILABLE,
        )
    )
    db_session.flush()  # same code, different shops -- must not raise

    dup = Product(
        shop_id=shop_a.id,
        category_id=cat_a.id,
        product_code="SKU1",
        name="Product C",
        price="50.00",
        status=ProductStatus.AVAILABLE,
    )
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_category_with_products_cannot_be_deleted(db_session, shop_a):
    category = Category(shop_id=shop_a.id, name="Lehengas", display_order=0, is_active=True)
    db_session.add(category)
    db_session.flush()

    db_session.add(
        Product(
            shop_id=shop_a.id,
            category_id=category.id,
            name="Bridal Lehenga",
            price="20000.00",
            status=ProductStatus.AVAILABLE,
        )
    )
    db_session.flush()

    db_session.delete(category)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_shop_owner_created_by_tracking(db_session, shop_a, owner_a, super_admin):
    category = Category(shop_id=shop_a.id, name="Cotton Sarees", display_order=0, is_active=True)
    db_session.add(category)
    db_session.flush()

    owner_made = Product(
        shop_id=shop_a.id,
        category_id=category.id,
        name="Owner Uploaded Saree",
        price="2000.00",
        status=ProductStatus.AVAILABLE,
        created_by=owner_a.id,
    )
    admin_made = Product(
        shop_id=shop_a.id,
        category_id=category.id,
        name="Catalog Team Uploaded Saree",
        price="3000.00",
        status=ProductStatus.AVAILABLE,
        created_by=super_admin.id,
    )
    db_session.add_all([owner_made, admin_made])
    db_session.flush()

    assert owner_made.creator.role == UserRole.SHOP_OWNER
    assert admin_made.creator.role == UserRole.SUPER_ADMIN
