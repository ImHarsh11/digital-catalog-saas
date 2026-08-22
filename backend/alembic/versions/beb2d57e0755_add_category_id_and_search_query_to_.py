"""add category_id and search_query to customer_events

Revision ID: beb2d57e0755
Revises: e1adb7be813b
Create Date: 2026-08-22 05:04:05.338994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'beb2d57e0755'
down_revision: Union[str, None] = 'e1adb7be813b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FK_NAME = "fk_customer_events_category_id_categories"


def upgrade() -> None:
    op.add_column('customer_events', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('customer_events', sa.Column('search_query', sa.String(length=255), nullable=True))
    # Named explicitly (rather than autogenerate's `None`, which relies on a
    # naming_convention this project doesn't configure) so downgrade() has a
    # real name to drop -- `op.drop_constraint(None, ...)` isn't valid.
    op.create_foreign_key(
        FK_NAME, 'customer_events', 'categories', ['category_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint(FK_NAME, 'customer_events', type_='foreignkey')
    op.drop_column('customer_events', 'search_query')
    op.drop_column('customer_events', 'category_id')
