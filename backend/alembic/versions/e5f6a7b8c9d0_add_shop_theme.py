"""Add shops.theme (JSONB)

Redesign Phase 2. Holds the validated semantic theme config
(app.schemas.theme.ThemeConfig). NULL = default preset.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-08-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("shops", sa.Column("theme", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("shops", "theme")
