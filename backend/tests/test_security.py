import pytest

from app.auth.security import hash_password, verify_password


def test_hash_is_not_the_plain_password():
    hashed = hash_password("Sup3rSecret!")
    assert hashed != "Sup3rSecret!"
    assert hashed.startswith("$2b$")


def test_verify_correct_password_succeeds():
    hashed = hash_password("Sup3rSecret!")
    assert verify_password("Sup3rSecret!", hashed) is True


def test_verify_incorrect_password_fails():
    hashed = hash_password("Sup3rSecret!")
    assert verify_password("WrongPassword", hashed) is False


def test_verify_against_malformed_hash_fails_gracefully():
    assert verify_password("anything", "not-a-real-hash") is False


def test_password_over_72_bytes_is_rejected():
    with pytest.raises(ValueError):
        hash_password("x" * 100)


def test_two_hashes_of_same_password_differ_due_to_salt():
    assert hash_password("Sup3rSecret!") != hash_password("Sup3rSecret!")
