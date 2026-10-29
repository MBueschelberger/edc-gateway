"""add argo workflow template fields to edc_configs

Revision ID: 001
Revises:
Create Date: 2026-06-08

"""

import sqlalchemy as sa
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add argo_consume_template and argo_create_asset_template columns to edc_configs."""
    op.add_column(
        "edc_configs",
        sa.Column(
            "argo_consume_template",
            sa.String(),
            nullable=False,
            server_default="consume-asset",
        ),
    )
    op.add_column(
        "edc_configs",
        sa.Column(
            "argo_create_asset_template",
            sa.String(),
            nullable=False,
            server_default="create-asset",
        ),
    )


def downgrade() -> None:
    """Remove argo workflow template columns from edc_configs."""
    op.drop_column("edc_configs", "argo_create_asset_template")
    op.drop_column("edc_configs", "argo_consume_template")
