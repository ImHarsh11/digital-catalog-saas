"""Add color and brand to products

Revision ID: a1b2c3d4e5f6
Revises: f7a2c891d034
Create Date: 2026-08-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7a2c891d034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("color", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("brand", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "brand")
    op.drop_column("products", "color")
