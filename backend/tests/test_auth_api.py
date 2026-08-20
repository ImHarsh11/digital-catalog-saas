"""Integration tests for POST /api/auth/login and GET /api/auth/me."""


def test_login_success_returns_bearer_token(client, owner_a):
    resp = client.post(
        "/api/auth/login", json={"email": "ownera@test.com", "password": "OwnerA123!"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]


def test_login_wrong_password_is_rejected(client, owner_a):
    resp = client.post(
        "/api/auth/login", json={"email": "ownera@test.com", "password": "WrongPassword"}
    )
    assert resp.status_code == 401


def test_login_unknown_email_is_rejected(client):
    resp = client.post(
        "/api/auth/login", json={"email": "nobody@test.com", "password": "whatever"}
    )
    assert resp.status_code == 401


def test_login_unknown_email_and_wrong_password_get_same_generic_message(client, owner_a):
    """Don't leak whether an email exists via a different error message."""
    unknown = client.post(
        "/api/auth/login", json={"email": "nobody@test.com", "password": "whatever"}
    )
    wrong_pw = client.post(
        "/api/auth/login", json={"email": "ownera@test.com", "password": "WrongPassword"}
    )
    assert unknown.json()["detail"] == wrong_pw.json()["detail"]


def test_login_deactivated_account_is_rejected(client, inactive_owner):
    resp = client.post(
        "/api/auth/login", json={"email": "inactive@test.com", "password": "Inactive123!"}
    )
    assert resp.status_code == 403


def test_login_rejects_malformed_body(client):
    resp = client.post("/api/auth/login", json={"email": "not-an-email"})
    assert resp.status_code == 422


def test_me_requires_authentication(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_rejects_garbage_token(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_me_returns_shop_owner_with_shop_and_trial_info(client, owner_a, shop_a):
    login = client.post(
        "/api/auth/login", json={"email": "ownera@test.com", "password": "OwnerA123!"}
    )
    token = login.json()["access_token"]

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "ownera@test.com"
    assert body["user"]["role"] == "SHOP_OWNER"
    assert body["shop"]["slug"] == "shop-a"
    assert body["shop"]["trial_days_remaining"] == 14
    assert body["shop"]["trial_status_label"] == "14 days remaining"


def test_me_for_super_admin_has_no_shop(client, super_admin):
    login = client.post(
        "/api/auth/login", json={"email": "admin@test.com", "password": "Admin123!"}
    )
    token = login.json()["access_token"]

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["shop"] is None
    assert resp.json()["user"]["role"] == "SUPER_ADMIN"


def test_deactivating_user_immediately_blocks_further_access(client, db_session, owner_a):
    login = client.post(
        "/api/auth/login", json={"email": "ownera@test.com", "password": "OwnerA123!"}
    )
    token = login.json()["access_token"]

    # Token is already issued; account gets deactivated mid-session.
    owner_a.is_active = False
    db_session.flush()

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
