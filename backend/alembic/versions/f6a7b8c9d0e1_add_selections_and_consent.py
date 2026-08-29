"""Add selections + selection_items; consent columns on customer_contacts

Redesign Phase 4a. The guest "My Selection" shortlist and the consent
popup that turns an anonymous browser into a follow-up lead.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-29 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE customer_event_type ADD VALUE IF NOT EXISTS 'ADD_TO_SELECTION'")

    op.add_column(
        "customer_contacts", sa.Column("device_id", sa.String(64), nullable=True)
    )
    op.create_index("ix_customer_contacts_device_id", "customer_contacts", ["device_id"])
    op.add_column(
        "customer_contacts",
        sa.Column("consent_processing", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "customer_contacts",
        sa.Column("consent_marketing", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("customer_contacts", sa.Column("consent_version", sa.String(20), nullable=True))
    op.add_column(
        "customer_contacts", sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "customer_contacts", sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "selections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("device_id", sa.String(64), nullable=False, index=True),
        sa.Column(
            "customer_contact_id",
            sa.Integer(),
            sa.ForeignKey("customer_contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("shop_id", "device_id", name="uq_selection_shop_device"),
    )

    op.create_table(
        "selection_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "selection_id",
            sa.Integer(),
            sa.ForeignKey("selections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            sa.Integer(),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("selection_id", "product_id", name="uq_selection_item_product"),
    )


def downgrade() -> None:
    op.drop_table("selection_items")
    op.drop_table("selections")
    for col in (
        "withdrawn_at",
        "consent_at",
        "consent_version",
        "consent_marketing",
        "consent_processing",
    ):
        op.drop_column("customer_contacts", col)
    op.drop_index("ix_customer_contacts_device_id", table_name="customer_contacts")
    op.drop_column("customer_contacts", "device_id")
    # The added enum value is left in place — PostgreSQL cannot drop one.
