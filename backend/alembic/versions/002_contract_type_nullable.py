"""contract_type becomes nullable; demote existing 'Other' to NULL

Revision ID: 002_contract_type_nullable
Revises: 001_initial
Create Date: 2026-06-05
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "002_contract_type_nullable"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("documents") as batch:
        batch.alter_column("contract_type", existing_type=sa.String(), nullable=True)
    op.execute("UPDATE documents SET contract_type = NULL WHERE contract_type = 'Other'")


def downgrade() -> None:
    op.execute("UPDATE documents SET contract_type = 'Other' WHERE contract_type IS NULL")
    with op.batch_alter_table("documents") as batch:
        batch.alter_column("contract_type", existing_type=sa.String(), nullable=False)
