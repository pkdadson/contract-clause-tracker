from __future__ import annotations

import asyncio
from typing import Any


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
