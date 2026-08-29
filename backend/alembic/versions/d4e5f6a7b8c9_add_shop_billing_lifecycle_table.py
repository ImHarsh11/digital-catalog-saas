"""Add shop_billing lifecycle table; move trial/subscription off shops

Redesign Phase 1. Introduces a 1:1 ``shop_billing`` row per shop as the
single source of truth for billing lifecycle (trial window, paid-through
date, subscription status), and removes the equivalent columns from
``shops``. Also extends the ``subscription_status`` enum with the two
states Razorpay will drive in Phase 5 (PAST_DUE, CANCELLED).

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-08-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The already-existing PG enum type -- create_type=False so SQLAlchemy
# neither CREATEs nor DROPs it, it just references it.
subscription_status = postgresql.ENUM(
    "TRIAL",
    "ACTIVE",
    "PAST_DUE",
    "EXPIRED",
    "SUSPENDED",
    "CANCELLED",
    name="subscription_status",
    create_type=False,
)


def upgrade() -> None:
    # 1. New enum values (PG 12+ allows ADD VALUE inside a transaction as
    #    long as the value isn't used in the same transaction -- the
    #    backfill below only ever copies pre-existing values).
    op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'PAST_DUE'")
    op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'CANCELLED'")

    # 2. shop_billing table
    op.create_table(
        "shop_billing",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("status", subscription_status, server_default="TRIAL", nullable=False),
        sa.Column("trial_start_date", sa.Date(), nullable=True),
        sa.Column("trial_end_date", sa.Date(), nullable=True),
        sa.Column("paid_until", sa.Date(), nullable=True),
        sa.Column("grace_until", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. Backfill one row per existing shop from the columns about to be dropped.
    op.execute(
        """
        INSERT INTO shop_billing
            (shop_id, status, trial_start_date, trial_end_date, created_at, updated_at)
        SELECT id, subscription_status, trial_start_date, trial_end_date, now(), now()
        FROM shops
        """
    )

    # 4. Drop the now-migrated columns from shops.
    op.drop_column("shops", "subscription_status")
    op.drop_column("shops", "trial_start_date")
    op.drop_column("shops", "trial_end_date")


def downgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("subscription_status", subscription_status, server_default="TRIAL", nullable=False),
    )
    op.add_column("shops", sa.Column("trial_start_date", sa.Date(), nullable=True))
    op.add_column("shops", sa.Column("trial_end_date", sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE shops s SET
            subscription_status = b.status,
            trial_start_date = b.trial_start_date,
            trial_end_date = b.trial_end_date
        FROM shop_billing b
        WHERE b.shop_id = s.id
        """
    )
    op.drop_table("shop_billing")
    # The two added enum values are left in place -- PostgreSQL cannot drop
    # enum values, and leaving them is harmless.
