import asyncio
import json
from collections import defaultdict

import orjson
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import and_, func, select
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
    docs = db.query(Document).order_by(Document.modified_at.desc()).all()

    body_filter = Sentence.is_heading == False  # noqa: E712 — SQL `=` semantics, not Python truthiness
    stats_rows = (
        db.query(
            Sentence.document_id,
            func.count().filter(body_filter).label("sentence_count"),
            func.count()
            .filter(and_(body_filter, Sentence.clause_type_id.isnot(None)))
            .label("labeled_count"),
        )
        .group_by(Sentence.document_id)
        .all()
    )
    stats: dict[str, tuple[int, int]] = {
        row.document_id: (row.sentence_count, row.labeled_count) for row in stats_rows
    }

    clause_types_by_doc: dict[str, set[str]] = defaultdict(set)
    for doc_id, ctype in (
        db.query(Sentence.document_id, Sentence.clause_type_id)
        .filter(body_filter, Sentence.clause_type_id.isnot(None))
        .distinct()
    ):
        clause_types_by_doc[doc_id].add(ctype)

    out: list[DocumentListItem] = []
    for doc in docs:
        sentence_count, labeled_count = stats.get(doc.id, (0, 0))
        out.append(DocumentListItem(
            id=doc.id,
            title=doc.title,
            party=doc.party,
            contract_type=doc.contract_type,
            uploaded_at=doc.uploaded_at,
            modified_at=doc.modified_at,
            sentence_count=sentence_count,
            labeled_count=labeled_count,
            clause_types_present=sorted(clause_types_by_doc[doc.id]),
        ))
    return out


@router.get("/{document_id}")
def get_document(document_id: str, db: Session = Depends(get_db)) -> Response:
    doc = db.query(Document).filter(Document.id == document_id).one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    rows = db.execute(
        select(
            Sentence.id,
            Sentence.idx,
            Sentence.paragraph_idx,
            Sentence.text,
            Sentence.is_heading,
            Sentence.clause_type_id,
        )
        .where(Sentence.document_id == document_id)
        .order_by(Sentence.idx)
    ).all()

    payload = {
        "id": doc.id,
        "title": doc.title,
        "party": doc.party,
        "contract_type": doc.contract_type,
        "uploaded_at": doc.uploaded_at.isoformat(),
        "modified_at": doc.modified_at.isoformat(),
        "sentences": [
            {
                "id": r[0],
                "idx": r[1],
                "paragraph_idx": r[2],
                "text": r[3],
                "is_heading": r[4],
                "clause_type_id": r[5],
            }
            for r in rows
        ],
    }
    return Response(content=orjson.dumps(payload), media_type="application/json")


@router.get("/{document_id}/progress")
async def progress_stream(
    document_id: str,
    db: Session = Depends(get_db),
    reg: IngestRegistry = Depends(get_registry),
):
    exists = db.query(Document.id).filter(Document.id == document_id).first() is not None
    if not exists:
        raise HTTPException(status_code=404, detail="Document not found")

    persisted = (
        db.query(Sentence)
        .filter(Sentence.document_id == document_id)
        .order_by(Sentence.idx)
        .all()
    )
    snapshot = [
        {
            "id": s.id,
            "idx": s.idx,
            "paragraph_idx": s.paragraph_idx,
            "text": s.text,
            "is_heading": s.is_heading,
            "clause_type_id": s.clause_type_id,
        }
        for s in persisted
    ]
    max_snapshot_idx = persisted[-1].idx if persisted else -1
    db.close()

    if not reg.is_active(document_id):
        async def closed_generator():
            if snapshot:
                yield f"data: {json.dumps({'phase': 'sentences', 'items': snapshot})}\n\n"
            yield f"data: {json.dumps({'phase': 'done', 'total': len(snapshot)})}\n\n"

        return StreamingResponse(closed_generator(), media_type="text/event-stream")

    queue = reg.subscribe(document_id)

    async def event_generator():
        try:
            if snapshot:
                yield f"data: {json.dumps({'phase': 'sentences', 'items': snapshot})}\n\n"
            while True:
                event = await queue.get()
                if event.get("phase") == "sentences":
                    fresh = [item for item in event["items"] if item["idx"] > max_snapshot_idx]
                    if not fresh:
                        continue
                    yield f"data: {json.dumps({'phase': 'sentences', 'items': fresh})}\n\n"
                else:
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