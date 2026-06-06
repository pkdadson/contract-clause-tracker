import asyncio
import json

import pytest

from app.ingest import IngestRegistry, get_registry
from app.main import app
from app.models import Document, Sentence


async def _sse_payloads_async(stream_response):
    out = []
    async for raw in stream_response.aiter_lines():
        if not raw:
            continue
        line = raw if isinstance(raw, str) else raw.decode("utf-8")
        if line.startswith("data: "):
            out.append(json.loads(line[len("data: ") :]))
    return out

def _sse_payloads(stream_response):
    out = []
    for raw in stream_response.iter_lines():
        if not raw:
            continue
        line = raw if isinstance(raw, str) else raw.decode("utf-8")
        if line.startswith("data: "):
            out.append(json.loads(line[len("data: ") :]))
    return out


@pytest.fixture
def custom_registry():
    reg = IngestRegistry()
    app.dependency_overrides[get_registry] = lambda: reg
    yield reg
    app.dependency_overrides.pop(get_registry, None)


def test_progress_404_for_unknown_doc(client):
    r = client.get("/api/documents/no-such-id/progress")
    assert r.status_code == 404


def test_progress_emits_immediate_done_when_no_active_task(client, db_session, custom_registry):
    doc = Document(title="Test")
    db_session.add(doc)
    db_session.commit()
    doc_id = doc.id
    for i in range(3):
        db_session.add(Sentence(document_id=doc_id, idx=i, text=f"S{i}.", is_heading=False))
    db_session.commit()

    with client.stream("GET", f"/api/documents/{doc_id}/progress") as r:
        events = _sse_payloads(r)

    assert events == [{"phase": "done", "total": 3}]


@pytest.mark.asyncio
async def test_progress_streams_published_events_in_order(db_session, custom_registry):
    from httpx import AsyncClient, ASGITransport
    from app.dependencies import get_db
    from app.main import app

    doc = Document(title="Streaming")
    db_session.add(doc)
    db_session.commit()
    doc_id = doc.id

    # Create a fake never-ending task to mark the parse as active
    async def fake_task():
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            pass

    task = asyncio.create_task(fake_task())
    custom_registry.register_task(doc_id, task)

    # Schedule publishing in background
    async def publisher():
        await asyncio.sleep(0.01)
        custom_registry.publish(doc_id, {"phase": "sentences", "items": [{"id": "s1", "idx": 0, "text": "First.", "is_heading": False, "clause_type_id": None}]})
        await asyncio.sleep(0.01)
        custom_registry.publish(doc_id, {"phase": "done", "total": 1})

    def override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override

    try:
        pub_task = asyncio.create_task(publisher())

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
            async with ac.stream("GET", f"/api/documents/{doc_id}/progress") as r:
                events = await _sse_payloads_async(r)

        await pub_task
    finally:
        app.dependency_overrides.clear()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert [e["phase"] for e in events] == ["sentences", "done"]
    assert events[0]["items"][0]["text"] == "First."
