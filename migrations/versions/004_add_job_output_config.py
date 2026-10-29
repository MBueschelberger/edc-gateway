"""add job output whitelist and asset artifact config to edc_configs

Revision ID: 004
Revises: 003
Create Date: 2026-06-26

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add job output whitelist and asset artifact config columns to edc_configs."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("edc_configs")}

    if "job_output_parameter_whitelist" not in existing_cols:
        op.add_column(
            "edc_configs",
            sa.Column(
                "job_output_parameter_whitelist", postgresql.ARRAY(sa.String()), nullable=True
            ),
        )
    if "job_artifact_whitelist" not in existing_cols:
        op.add_column(
            "edc_configs",
            sa.Column("job_artifact_whitelist", postgresql.ARRAY(sa.String()), nullable=True),
        )
    if "job_asset_artifact_name" not in existing_cols:
        op.add_column(
            "edc_configs", sa.Column("job_asset_artifact_name", sa.String(), nullable=True)
        )
    if "job_asset_filename_parameter" not in existing_cols:
        op.add_column(
            "edc_configs", sa.Column("job_asset_filename_parameter", sa.String(), nullable=True)
        )


def downgrade() -> None:
    """Remove job output whitelist and asset artifact config columns."""
    op.drop_column("edc_configs", "job_asset_filename_parameter")
    op.drop_column("edc_configs", "job_asset_artifact_name")
    op.drop_column("edc_configs", "job_artifact_whitelist")
    op.drop_column("edc_configs", "job_output_parameter_whitelist")
