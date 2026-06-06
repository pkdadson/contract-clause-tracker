"""sentences gain paragraph_idx; backfill existing rows as one sentence per paragraph

Revision ID: 003_sentence_paragraph_idx
Revises: 002_contract_type_nullable
Create Date: 2026-06-06
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "003_sentence_paragraph_idx"
down_revision: str | None = "002_contract_type_nullable"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("sentences") as batch:
        batch.add_column(sa.Column("paragraph_idx", sa.Integer, nullable=False, server_default="0"))
    op.execute("UPDATE sentences SET paragraph_idx = idx")
    with op.batch_alter_table("sentences") as batch:
        batch.alter_column("paragraph_idx", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("sentences") as batch:
        batch.drop_column("paragraph_idx")
