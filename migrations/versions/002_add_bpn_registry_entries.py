"""add bpn_registry_entries and bpn_registry_endpoints tables

Revision ID: 002
Revises: 001
Create Date: 2026-06-08

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create bpn_registry_entries and bpn_registry_endpoints tables."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "bpn_registry_entries" not in existing_tables:
        op.create_table(
            "bpn_registry_entries",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("edc_id", sa.String(), nullable=False),
            sa.Column("bpn", sa.String(), nullable=False),
            sa.Column("did", sa.String(), nullable=True),
            sa.Column("dsp_suffix", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["edc_id"], ["edc_configs.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("edc_id", "bpn", name="uq_bpn_registry_edc_bpn"),
        )
        op.create_index("ix_bpn_registry_entries_edc_id", "bpn_registry_entries", ["edc_id"])
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("bpn_registry_entries")}
        if "did" not in existing_cols:
            op.add_column("bpn_registry_entries", sa.Column("did", sa.String(), nullable=True))
        if "dsp_suffix" not in existing_cols:
            op.add_column(
                "bpn_registry_entries", sa.Column("dsp_suffix", sa.String(), nullable=True)
            )

    if "bpn_registry_endpoints" not in existing_tables:
        op.create_table(
            "bpn_registry_endpoints",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("entry_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("url", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(["entry_id"], ["bpn_registry_entries.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_bpn_registry_endpoints_entry_id", "bpn_registry_endpoints", ["entry_id"]
        )


def downgrade() -> None:
    """Drop bpn_registry_entries and bpn_registry_endpoints tables."""
    op.drop_index("ix_bpn_registry_endpoints_entry_id", table_name="bpn_registry_endpoints")
    op.drop_table("bpn_registry_endpoints")
    op.drop_index("ix_bpn_registry_entries_edc_id", table_name="bpn_registry_entries")
    op.drop_table("bpn_registry_entries")
