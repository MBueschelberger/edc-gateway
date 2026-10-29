"""add dcat_catalog_url and dcat_sparql_query to edc_configs

Revision ID: 003
Revises: 002
Create Date: 2026-06-24

"""

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add dcat_catalog_url and dcat_sparql_query columns to edc_configs."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {c["name"] for c in inspector.get_columns("edc_configs")}

    if "dcat_catalog_url" not in existing_cols:
        op.add_column("edc_configs", sa.Column("dcat_catalog_url", sa.String(), nullable=True))
    if "dcat_sparql_query" not in existing_cols:
        op.add_column("edc_configs", sa.Column("dcat_sparql_query", sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove dcat_catalog_url and dcat_sparql_query from edc_configs."""
    op.drop_column("edc_configs", "dcat_sparql_query")
    op.drop_column("edc_configs", "dcat_catalog_url")
