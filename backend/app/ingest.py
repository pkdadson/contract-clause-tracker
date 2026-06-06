from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from .contract_type import infer_from_content
from .db import SessionLocal
from .models import Document, Sentence
from .sentence_splitter import split_into_sentences


class IngestRegistry:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        self._tasks: dict[str, asyncio.Task] = {}

    def subscribe(self, doc_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(doc_id, []).append(q)
        return q

    def unsubscribe(self, doc_id: str, queue: asyncio.Queue) -> None:
        if doc_id not in self._subscribers:
            return
        try:
            self._subscribers[doc_id].remove(queue)
        except ValueError:
            pass
        if not self._subscribers[doc_id]:
            del self._subscribers[doc_id]

    def publish(self, doc_id: str, event: dict[str, Any]) -> None:
        for q in list(self._subscribers.get(doc_id, [])):
            q.put_nowait(event)

    def is_active(self, doc_id: str) -> bool:
        return doc_id in self._tasks

    def register_task(self, doc_id: str, task: asyncio.Task) -> None:
        self._tasks[doc_id] = task

    def mark_inactive(self, doc_id: str) -> None:
        self._tasks.pop(doc_id, None)


registry = IngestRegistry()


def get_registry() -> IngestRegistry:
    return registry


BATCH_SIZE = 500


async def parse_into(
    doc_id: str,
    text: str,
    registry: IngestRegistry,
    session_factory: Callable[[], Session] = SessionLocal,
) -> None:
    db = session_factory()
    db.expire_on_commit = False
    try:
        doc = db.query(Document).filter(Document.id == doc_id).one_or_none()
        if doc is None:
            registry.publish(doc_id, {"phase": "error", "message": "Document not found"})
            return

        parsed = await asyncio.to_thread(split_into_sentences, text)

        if doc.contract_type is None:
            inferred = infer_from_content(parsed)
            if inferred:
                doc.contract_type = inferred
                db.commit()

        for start in range(0, len(parsed), BATCH_SIZE):
            chunk = parsed[start : start + BATCH_SIZE]
            inserted: list[Sentence] = []
            for ss in chunk:
                row = Sentence(
                    document_id=doc_id,
                    idx=ss.idx,
                    paragraph_idx=ss.paragraph_idx,
                    text=ss.text,
                    is_heading=ss.is_heading,
                )
                db.add(row)
                inserted.append(row)
            db.commit()
            registry.publish(doc_id, {
                "phase": "sentences",
                "items": [
                    {
                        "id": s.id,
                        "idx": s.idx,
                        "paragraph_idx": s.paragraph_idx,
                        "text": s.text,
                        "is_heading": s.is_heading,
                        "clause_type_id": None,
                    }
                    for s in inserted
                ],
            })
            await asyncio.sleep(0)

        registry.publish(doc_id, {"phase": "done", "total": len(parsed)})
    except Exception as exc:
        db.rollback()
        registry.publish(doc_id, {"phase": "error", "message": str(exc)})
    finally:
        registry.mark_inactive(doc_id)
        db.close()
