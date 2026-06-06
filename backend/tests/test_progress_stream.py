import json

import pytest

from app.ingest import IngestRegistry, get_registry
from app.main import app
from app.models import Document, Sentence


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


def test_progress_emits_persisted_sentences_then_done_when_no_active_task(client, db_session, custom_registry):
    doc = Document(title="Test")
    db_session.add(doc)
    db_session.commit()
    doc_id = doc.id
    for i in range(3):
        db_session.add(Sentence(document_id=doc_id, idx=i, text=f"S{i}.", is_heading=False))
    db_session.commit()

    with client.stream("GET", f"/api/documents/{doc_id}/progress") as r:
        events = _sse_payloads(r)

    assert [e["phase"] for e in events] == ["sentences", "done"]
    assert [s["text"] for s in events[0]["items"]] == ["S0.", "S1.", "S2."]
    assert events[1]["total"] == 3


def test_progress_emits_only_done_when_no_sentences_persisted(client, db_session, custom_registry):
    doc = Document(title="Empty")
    db_session.add(doc)
    db_session.commit()
    doc_id = doc.id

    with client.stream("GET", f"/api/documents/{doc_id}/progress") as r:
        events = _sse_payloads(r)

    assert events == [{"phase": "done", "total": 0}]


