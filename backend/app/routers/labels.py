from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..dependencies import get_db
from ..models import ClauseType, Document, Sentence
from ..schemas import LabelSetRequest, SentenceOut

router = APIRouter(
    prefix="/api/documents/{document_id}/sentences/{sentence_id}/label",
    tags=["labels"],
)


def _get_sentence(db: Session, document_id: str, sentence_id: str) -> Sentence:
    sent = (
        db.query(Sentence)
        .filter(Sentence.id == sentence_id, Sentence.document_id == document_id)
        .one_or_none()
    )
    if not sent:
        raise HTTPException(status_code=404, detail="Sentence not found")
    if sent.is_heading:
        raise HTTPException(status_code=409, detail="Headings cannot be labeled")
    return sent


@router.put("", response_model=SentenceOut)
def set_label(
    document_id: str,
    sentence_id: str,
    payload: LabelSetRequest,
    db: Session = Depends(get_db),
) -> Sentence:
    sent = _get_sentence(db, document_id, sentence_id)
    ct = db.query(ClauseType).filter(ClauseType.id == payload.clause_type_id).one_or_none()
    if not ct:
        raise HTTPException(status_code=400, detail=f"Unknown clause type: {payload.clause_type_id}")
    sent.clause_type_id = ct.id
    db.query(Document).filter(Document.id == document_id).update({"modified_at": datetime.utcnow()})
    db.commit()
    db.refresh(sent)
    return sent


@router.delete("", response_model=SentenceOut)
def clear_label(document_id: str, sentence_id: str, db: Session = Depends(get_db)) -> Sentence:
    sent = _get_sentence(db, document_id, sentence_id)
    sent.clause_type_id = None
    db.query(Document).filter(Document.id == document_id).update({"modified_at": datetime.utcnow()})
    db.commit()
    db.refresh(sent)
    return sent