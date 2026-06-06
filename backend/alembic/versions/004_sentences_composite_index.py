"""composite index on sentences(document_id, idx) for ordered fetch

Revision ID: 004_sentences_composite_index
Revises: 003_sentence_paragraph_idx
Create Date: 2026-06-07
"""
from collections.abc import Sequence

from alembic import op


revision: str = "004_sentences_composite_index"
down_revision: str | None = "003_sentence_paragraph_idx"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_sentences_document_id_idx",
        "sentences",
        ["document_id", "idx"],
    )


def downgrade() -> None:
    op.drop_index("ix_sentences_document_id_idx", table_name="sentences")
