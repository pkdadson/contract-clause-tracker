"""initial schema and clause types seed

Revision ID: 001_initial
Revises:
Create Date: 2026-06-04
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CLAUSE_TYPES = [
    ("liability",    "Limitation of Liability",     "Caps or excludes a party's financial exposure for damages.",  "--c-liability",     1),
    ("termination",  "Termination for Convenience", "Lets a party end the contract without cause on notice.",      "--c-termination",   2),
    ("confidential", "Confidentiality",             "Obligations to protect and not disclose information.",        "--c-confidential",  3),
    ("indemnity",    "Indemnification",             "One party agrees to cover losses or claims of another.",      "--c-indemnity",     4),
    ("ip",           "Intellectual Property",       "Ownership and licensing of IP and work product.",             "--c-ip",            5),
    ("payment",      "Payment Terms",               "Fees, invoicing, due dates and late payment.",                "--c-payment",       6),
    ("governing",    "Governing Law",               "The jurisdiction whose law governs the agreement.",           "--c-governing",     7),
    ("noncompete",   "Non-Compete",                 "Restrictions on competing activity for a period.",            "--c-noncompete",    8),
    ("dataprotect",  "Data Protection",             "Processing of personal data and GDPR obligations.",           "--c-dataprotect",   9),
    ("warranty",     "Warranty",                    "Promises about quality, performance or condition.",           "--c-warranty",     10),
]


def upgrade() -> None:
    op.create_table(
        "clause_types",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=False),
        sa.Column("color_token", sa.String, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("party", sa.String, nullable=True),
        sa.Column("contract_type", sa.String, nullable=False),
        sa.Column("uploaded_at", sa.DateTime, nullable=False),
        sa.Column("modified_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "sentences",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("document_id", sa.String, sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("idx", sa.Integer, nullable=False),
        sa.Column("text", sa.String, nullable=False),
        sa.Column("is_heading", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("clause_type_id", sa.String, sa.ForeignKey("clause_types.id"), nullable=True),
    )
    op.create_index("ix_sentences_document_id", "sentences", ["document_id"])
    op.create_index("ix_sentences_clause_type_id", "sentences", ["clause_type_id"])

    op.create_table(
        "clause_suggestions",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("sentence_id", sa.String, sa.ForeignKey("sentences.id"), nullable=False),
        sa.Column("clause_type_id", sa.String, sa.ForeignKey("clause_types.id"), nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_clause_suggestions_sentence_id", "clause_suggestions", ["sentence_id"])

    op.bulk_insert(
        sa.table(
            "clause_types",
            sa.column("id", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.String),
            sa.column("color_token", sa.String),
            sa.column("sort_order", sa.Integer),
        ),
        [
            dict(zip(["id", "name", "description", "color_token", "sort_order"], row))
            for row in CLAUSE_TYPES
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_clause_suggestions_sentence_id", "clause_suggestions")
    op.drop_table("clause_suggestions")
    op.drop_index("ix_sentences_clause_type_id", "sentences")
    op.drop_index("ix_sentences_document_id", "sentences")
    op.drop_table("sentences")
    op.drop_table("documents")
    op.drop_table("clause_types")
