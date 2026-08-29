"""Add device_id to customer_events (Phase 7)

So "unique visitors" can be counted by the persistent per-device id
(localStorage) instead of the per-tab session id -- a repeat QR scan from
the same phone is then one visitor, not a new one each time.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-08-29 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customer_events", sa.Column("device_id", sa.String(64), nullable=True))
    op.create_index("ix_customer_events_device_id", "customer_events", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_events_device_id", table_name="customer_events")
    op.drop_column("customer_events", "device_id")
