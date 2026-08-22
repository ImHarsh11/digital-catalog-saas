"""Create a production Super Admin account from environment variables.

Usage:
    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... python -m app.database.create_admin

Idempotent: if the email already exists, prints a notice and exits.
Does NOT use the development seed credentials. The password must be at
least 8 characters and is never printed to stdout.

This script is safe to run against a production database.
"""

import os
import sys

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.database.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def create_admin(db: Session, *, email: str, password: str, name: str) -> None:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"User with email {email} already exists (role={existing.role.value}). Skipping.")
        return

    admin = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=UserRole.SUPER_ADMIN,
        shop_id=None,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print(f"Super Admin account created: {email}")


def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "").strip()
    name = os.environ.get("ADMIN_NAME", "Admin").strip()

    if not email:
        print("ERROR: ADMIN_EMAIL environment variable is required.", file=sys.stderr)
        sys.exit(1)
    if not password or len(password) < 8:
        print(
            "ERROR: ADMIN_PASSWORD environment variable is required "
            "and must be at least 8 characters.",
            file=sys.stderr,
        )
        sys.exit(1)

    db = SessionLocal()
    try:
        create_admin(db, email=email, password=password, name=name)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
