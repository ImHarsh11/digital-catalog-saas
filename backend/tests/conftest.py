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
from sqlalchemy import create_engine, event
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
    """A session whose writes -- including a real `db.commit()` from
    application code (Phase 3's shop create/update endpoints do this) --
    never actually reach the database.

    Standard SQLAlchemy "join a session into an external transaction"
    recipe: the outer transaction is never committed, and application-level
    commits only close a nested SAVEPOINT, which this immediately reopens.
    Without this, a test that exercises a real commit path would leak data
    into `digital_catalog_test` and silently break later tests (duplicate
    slugs/emails, inflated dashboard counts, ...).
    """
    connection = engine.connect()
    outer_transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        event.remove(session, "after_transaction_end", _restart_savepoint)
        session.close()
        if outer_transaction.is_active:
            outer_transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def auth_headers(client, email: str, password: str) -> dict[str, str]:
    """Log in via the real endpoint and return an Authorization header.

    Exercises the actual login flow (rather than minting a token directly)
    so every test using it also incidentally re-verifies login works.
    """
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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
