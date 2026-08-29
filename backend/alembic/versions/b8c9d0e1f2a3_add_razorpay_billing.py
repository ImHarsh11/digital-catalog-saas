"""Add Razorpay billing: plans, invoices, webhook events; subscription
columns on shop_billing

Redesign Phase 5. Razorpay Subscriptions with UPI autopay.

Revision ID: b8c9d0e1f2a3
Revises: f6a7b8c9d0e1
Create Date: 2026-08-29 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="INR", nullable=False),
        sa.Column("interval", sa.String(10), server_default="monthly", nullable=False),
        sa.Column("interval_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("razorpay_plan_id", sa.String(64), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Launch plan: single monthly plan, Rs.999 (99900 paise) with UPI autopay.
    op.execute(
        """
        INSERT INTO billing_plans (code, name, amount, currency, "interval", interval_count, is_active)
        VALUES ('monthly-999', 'Monthly', 99900, 'INR', 'monthly', 1, true)
        """
    )

    op.add_column(
        "shop_billing",
        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey("billing_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("shop_billing", sa.Column("razorpay_customer_id", sa.String(64), nullable=True))
    op.add_column(
        "shop_billing",
        sa.Column("razorpay_subscription_id", sa.String(64), nullable=True, unique=True),
    )
    op.add_column("shop_billing", sa.Column("mandate_status", sa.String(20), nullable=True))
    op.add_column(
        "shop_billing",
        sa.Column("cancel_at_period_end", sa.Boolean(), server_default="false", nullable=False),
    )

    op.create_table(
        "subscription_invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("razorpay_invoice_id", sa.String(64), nullable=True, unique=True),
        sa.Column("razorpay_payment_id", sa.String(64), nullable=True),
        sa.Column("razorpay_subscription_id", sa.String(64), nullable=True, index=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="INR", nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "razorpay_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.String(64), nullable=False, unique=True),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("status", sa.String(12), server_default="received", nullable=False),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("razorpay_events")
    op.drop_table("subscription_invoices")
    op.drop_column("shop_billing", "cancel_at_period_end")
    op.drop_column("shop_billing", "mandate_status")
    op.drop_column("shop_billing", "razorpay_subscription_id")
    op.drop_column("shop_billing", "razorpay_customer_id")
    op.drop_column("shop_billing", "plan_id")
    op.drop_table("billing_plans")
