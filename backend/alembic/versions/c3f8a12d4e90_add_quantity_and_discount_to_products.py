"""add quantity_available and discount_percent to products

Revision ID: c3f8a12d4e90
Revises: beb2d57e0755
Create Date: 2026-08-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a12d4e90'
down_revision: Union[str, None] = 'beb2d57e0755'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('quantity_available', sa.Integer(), nullable=False, server_default='1'),
    )
    op.add_column(
        'products',
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=True),
    )
    op.create_check_constraint(
        'ck_products_discount_percent_range',
        'products',
        'discount_percent >= 0 AND discount_percent <= 100',
    )


def downgrade() -> None:
    op.drop_constraint('ck_products_discount_percent_range', 'products', type_='check')
    op.drop_column('products', 'discount_percent')
    op.drop_column('products', 'quantity_available')
