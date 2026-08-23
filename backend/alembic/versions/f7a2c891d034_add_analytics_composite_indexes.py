"""Add composite indexes for analytics time-range queries.

Every analytics query filters on (shop_id, created_at). The existing
single-column shop_id index helps with isolation but leaves PostgreSQL
doing a full-index-scan to evaluate the created_at predicate at scale.
Adding (shop_id, created_at) composite indexes makes period-bounded
aggregations efficient even when a table has millions of rows.

Revision ID: f7a2c891d034
Revises: c3f8a12d4e90
Create Date: 2026-08-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f7a2c891d034'
down_revision: Union[str, None] = 'c3f8a12d4e90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # customer_events: all analytics queries filter (shop_id, event_type, created_at)
    op.create_index(
        'ix_customer_events_shop_id_created_at',
        'customer_events',
        ['shop_id', 'created_at'],
        unique=False,
    )
    # catalog_activity: sales analytics filters (shop_id, action, created_at)
    op.create_index(
        'ix_catalog_activity_shop_id_created_at',
        'catalog_activity',
        ['shop_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_catalog_activity_shop_id_created_at', table_name='catalog_activity')
    op.drop_index('ix_customer_events_shop_id_created_at', table_name='customer_events')
