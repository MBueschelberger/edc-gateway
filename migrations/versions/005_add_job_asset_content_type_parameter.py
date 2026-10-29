"""add job_asset_content_type_parameter to edc_configs

Revision ID: 005
Revises: 004
Create Date: 2026-06-28

"""

import sqlalchemy as sa
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add job_asset_content_type_parameter column to edc_configs."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("edc_configs")}

    if "job_asset_content_type_parameter" not in existing_cols:
        op.add_column(
            "edc_configs", sa.Column("job_asset_content_type_parameter", sa.String(), nullable=True)
        )


def downgrade() -> None:
    """Remove job_asset_content_type_parameter from edc_configs."""
    op.drop_column("edc_configs", "job_asset_content_type_parameter")
