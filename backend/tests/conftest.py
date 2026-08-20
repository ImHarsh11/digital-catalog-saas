"""Shared pytest fixtures.

Tests run against a dedicated `digital_catalog_test` PostgreSQL database
(never the dev `digital_catalog` one). Tables are created once per test
session from the SQLAlchemy models (not via Alembic, to keep tests fast
and independent of migration history) and dropped afterwards. Each test
gets its own outer transaction that's rolled back at teardown, so tests
never see each other's data.
"""

import os
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import side effect: registers all model tables on Base.metadata.
from app import models  # noqa: F401
from app.auth.security import hash_password
from app.database.session import Base, get_db
from app.main import app
from app.models import Shop, SubscriptionStatus, User, UserRole

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://catalog_user:catalog_pass@localhost:5432/digital_catalog_test",
)

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        # A test that triggers an IntegrityError (e.g. asserting a unique
        # constraint) already aborts this transaction when flush() fails,
        # so it may no longer be active by the time we get here.
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Common domain fixtures --------------------------------------------


@pytest.fixture()
def shop_a(db_session) -> Shop:
    shop = Shop(
        name="Shop A",
        slug="shop-a",
        is_active=True,
        trial_start_date=date.today(),
        trial_end_date=date.today() + timedelta(days=14),
        subscription_status=SubscriptionStatus.TRIAL,
    )
    db_session.add(shop)
    db_session.flush()
    return shop


@pytest.fixture()
def shop_b(db_session) -> Shop:
    shop = Shop(
        name="Shop B",
        slug="shop-b",
        is_active=True,
        trial_start_date=date.today(),
        trial_end_date=date.today() + timedelta(days=14),
        subscription_status=SubscriptionStatus.TRIAL,
    )
    db_session.add(shop)
    db_session.flush()
    return shop


@pytest.fixture()
def super_admin(db_session) -> User:
    user = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("Admin123!"),
        role=UserRole.SUPER_ADMIN,
        shop_id=None,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def owner_a(db_session, shop_a) -> User:
    user = User(
        name="Owner A",
        email="ownera@test.com",
        password_hash=hash_password("OwnerA123!"),
        role=UserRole.SHOP_OWNER,
        shop_id=shop_a.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def owner_b(db_session, shop_b) -> User:
    user = User(
        name="Owner B",
        email="ownerb@test.com",
        password_hash=hash_password("OwnerB123!"),
        role=UserRole.SHOP_OWNER,
        shop_id=shop_b.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture()
def inactive_owner(db_session, shop_b) -> User:
    user = User(
        name="Inactive Owner",
        email="inactive@test.com",
        password_hash=hash_password("Inactive123!"),
        role=UserRole.SHOP_OWNER,
        shop_id=shop_b.id,
        is_active=False,
    )
    db_session.add(user)
    db_session.flush()
    return user
