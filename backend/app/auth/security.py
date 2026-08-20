"""Password hashing.

Uses the `bcrypt` library directly rather than passlib, to sidestep known
compatibility issues between passlib 1.7.x and bcrypt >=4.1 (passlib tries
to read a `__about__.__version__` attribute bcrypt no longer ships).
"""

import bcrypt

# bcrypt silently truncates/ignores input beyond 72 bytes; reject longer
# passwords explicitly instead of accepting them and generating a hash
# that behaves as if the extra characters didn't exist.
_MAX_PASSWORD_BYTES = 72


def hash_password(plain_password: str) -> str:
    if len(plain_password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {_MAX_PASSWORD_BYTES} bytes long.")
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash in the DB — treat as "doesn't match" rather than 500.
        return False
