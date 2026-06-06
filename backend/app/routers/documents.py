import asyncio
import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload, sessionmaker

from ..config import settings
from ..contract_type import infer_from_title
from ..dependencies import get_db
from ..ingest import IngestRegistry, get_registry, parse_into
from ..models import Document, Sentence
from ..schemas import DocumentDetail, DocumentListItem, DocumentUpdateRequest

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("", response_model=DocumentDetail, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    reg: IngestRegistry = Depends(get_registry),
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
    doc = Document(title=title, contract_type=infer_from_title(title))
    db.add(doc)
    db.commit()
    db.refresh(doc)

    factory = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False)
    task = asyncio.create_task(parse_into(doc.id, text, reg, factory))
    reg.register_task(doc.id, task)

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


@router.get("/{document_id}/progress")
async def progress_stream(
    document_id: str,
    db: Session = Depends(get_db),
    reg: IngestRegistry = Depends(get_registry),
):
    exists = db.query(Document.id).filter(Document.id == document_id).first() is not None
    if not exists:
        raise HTTPException(status_code=404, detail="Document not found")

    if not reg.is_active(document_id):
        total = (
            db.query(Sentence)
            .filter(Sentence.document_id == document_id)
            .count()
        )

        async def closed_generator():
            payload = json.dumps({"phase": "done", "total": total})
            yield f"data: {payload}\n\n"

        return StreamingResponse(closed_generator(), media_type="text/event-stream")

    queue = reg.subscribe(document_id)

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("phase") in ("done", "error"):
                    return
        finally:
            reg.unsubscribe(document_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.patch("/{document_id}", response_model=DocumentDetail)
def update_document(
    document_id: str,
    body: DocumentUpdateRequest,
    db: Session = Depends(get_db),
) -> Document:
    doc = (
        db.query(Document)
        .options(selectinload(Document.sentences))
        .filter(Document.id == document_id)
        .one_or_none()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.contract_type = body.contract_type
    db.commit()
    db.refresh(doc)
    return doc