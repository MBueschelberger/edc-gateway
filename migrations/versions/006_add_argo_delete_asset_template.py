"""add argo_delete_asset_template to edc_configs

Revision ID: 006
Revises: 005
Create Date: 2026-07-23

"""

import sqlalchemy as sa
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add argo_delete_asset_template column to edc_configs."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("edc_configs")}

    if "argo_delete_asset_template" not in existing_cols:
        op.add_column(
            "edc_configs",
            sa.Column(
                "argo_delete_asset_template",
                sa.String(),
                nullable=False,
                server_default="delete-asset",
            ),
        )


def downgrade() -> None:
    """Remove argo_delete_asset_template from edc_configs."""
    op.drop_column("edc_configs", "argo_delete_asset_template")
