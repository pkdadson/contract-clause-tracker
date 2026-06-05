from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..dependencies import get_db
from ..models import Document, Sentence
from ..schemas import DocumentDetail, DocumentListItem
from ..sentence_splitter import split_into_sentences

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _infer_contract_type(title: str) -> str:
    lower = title.lower()
    for keyword, ctype in [
        ("nda", "NDA"),
        ("non-disclosure", "NDA"),
        ("master services", "MSA"),
        ("services agreement", "MSA"),
        ("employment", "Employment"),
        ("data processing", "DPA"),
        ("dpa", "DPA"),
        ("reseller", "Reseller"),
    ]:
        if keyword in lower:
            return ctype
    return "Other"


@router.post("", response_model=DocumentDetail, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Document:
    filename = file.filename or "untitled"
    ext = Path(filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Files must be .txt or .md (got {ext or 'no extension'})",
        )
    body = await file.read()
    if len(body) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Files must be under 5 MB (got {len(body) / 1024 / 1024:.1f} MB)",
        )
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text") from exc

    title = Path(filename).stem.replace("_", " ").replace("-", " ").title()
    doc = Document(title=title, contract_type=_infer_contract_type(title))
    db.add(doc)
    db.flush()

    for ss in split_into_sentences(text):
        db.add(Sentence(
            document_id=doc.id,
            idx=ss.idx,
            text=ss.text,
            is_heading=ss.is_heading,
        ))
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentListItem]:
    docs = (
        db.query(Document)
        .options(selectinload(Document.sentences))
        .order_by(Document.modified_at.desc())
        .all()
    )
    out: list[DocumentListItem] = []
    for doc in docs:
        body = [s for s in doc.sentences if not s.is_heading]
        clause_ids = sorted({s.clause_type_id for s in body if s.clause_type_id})
        out.append(DocumentListItem(
            id=doc.id,
            title=doc.title,
            party=doc.party,
            contract_type=doc.contract_type,
            uploaded_at=doc.uploaded_at,
            modified_at=doc.modified_at,
            sentence_count=len(body),
            labeled_count=sum(1 for s in body if s.clause_type_id),
            clause_types_present=clause_ids,
        ))
    return out


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str, db: Session = Depends(get_db)) -> Document:
    doc = (
        db.query(Document)
        .options(selectinload(Document.sentences))
        .filter(Document.id == document_id)
        .one_or_none()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc