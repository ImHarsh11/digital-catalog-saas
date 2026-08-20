import pytest

from app.auth.jwt import TokenError, create_access_token, decode_access_token


def test_create_and_decode_roundtrip():
    token = create_access_token(subject="42", role="SHOP_OWNER")
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "SHOP_OWNER"
    assert "exp" in payload


def test_decode_garbage_token_raises():
    with pytest.raises(TokenError):
        decode_access_token("this-is-not-a-jwt")


def test_expired_token_raises():
    token = create_access_token(subject="1", role="SUPER_ADMIN", expires_minutes=-1)
    with pytest.raises(TokenError):
        decode_access_token(token)


def test_token_signed_with_different_secret_is_rejected():
    from jose import jwt as jose_jwt

    forged = jose_jwt.encode({"sub": "1", "role": "SUPER_ADMIN"}, "wrong-secret", algorithm="HS256")
    with pytest.raises(TokenError):
        decode_access_token(forged)
