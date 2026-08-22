"""add category and product activity actions

Revision ID: e1adb7be813b
Revises: aa94da966ee8
Create Date: 2026-08-22 02:11:39.595806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1adb7be813b'
down_revision: Union[str, None] = 'aa94da966ee8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Phase 4 adds status/OOS tracking, image deletion, and category CRUD --
# all need their own catalog_activity action so the activity feed can
# describe them precisely instead of falling back to a generic label.
NEW_VALUES = [
    "PRODUCT_MARKED_OUT_OF_STOCK",
    "PRODUCT_IMAGE_DELETED",
    "CATEGORY_CREATED",
    "CATEGORY_UPDATED",
    "CATEGORY_DELETED",
]

ORIGINAL_VALUES = [
    "PRODUCT_CREATED",
    "PRODUCT_UPDATED",
    "PRODUCT_DELETED",
    "PRODUCT_MARKED_SOLD",
    "PRODUCT_MARKED_AVAILABLE",
    "PRODUCT_IMAGE_UPLOADED",
    "SHOP_UPDATED",
]


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside the migration's normal
    # transaction block on PostgreSQL (a new enum value can't be used in
    # the same transaction it was added in, and older PG versions reject
    # the statement in a transaction at all) -- run each as its own
    # autocommit statement instead.
    with op.get_context().autocommit_block():
        for value in NEW_VALUES:
            op.execute(f"ALTER TYPE catalog_action ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres has no "DROP VALUE" for enums. Recreate the type with only
    # the original values and cast the column across. This intentionally
    # fails if any row already uses one of the Phase 4 values -- that's
    # the correct, safe behavior for a downgrade rather than silently
    # corrupting data.
    op.execute("ALTER TYPE catalog_action RENAME TO catalog_action_old")
    new_enum = sa.Enum(*ORIGINAL_VALUES, name="catalog_action")
    new_enum.create(op.get_bind(), checkfirst=False)
    op.execute(
        "ALTER TABLE catalog_activity "
        "ALTER COLUMN action TYPE catalog_action "
        "USING action::text::catalog_action"
    )
    op.execute("DROP TYPE catalog_action_old")
