from __future__ import annotations
from datetime import datetime
from uuid import uuid4

from sqlalchemy import ForeignKey, String, Integer, Boolean, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _id() -> str:
    return uuid4().hex

class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    title: Mapped[str] = mapped_column(String)
    party: Mapped[str | None] = mapped_column(String, nullable=True)
    contract_type: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    modified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sentences: Mapped[list["Sentence"]] = relationship(
        back_populates="document",
        order_by="Sentence.idx",
        cascade="all, delete-orphan",
    )


class Sentence(Base):
    __tablename__ = "sentences"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    idx: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(String)
    is_heading: Mapped[bool] = mapped_column(Boolean, default=False)
    clause_type_id: Mapped[str | None] = mapped_column(
        ForeignKey("clause_types.id"), nullable=True, index=True
    )

    document: Mapped[Document] = relationship(back_populates="sentences")
    clause_type: Mapped["ClauseType | None"] = relationship()


class ClauseType(Base):
    __tablename__ = "clause_types"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    color_token: Mapped[str] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column(Integer)


class ClauseSuggestion(Base):
    """Stub for the pair session. Empty on day one."""
    __tablename__ = "clause_suggestions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    sentence_id: Mapped[str] = mapped_column(ForeignKey("sentences.id"), index=True)
    clause_type_id: Mapped[str] = mapped_column(ForeignKey("clause_types.id"))
    confidence: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)