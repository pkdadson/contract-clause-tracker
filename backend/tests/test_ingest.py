import asyncio
import pytest

from app.ingest import IngestRegistry


def test_subscribe_returns_queue_that_receives_published_events():
    async def scenario():
        reg = IngestRegistry()
        q = reg.subscribe("doc-1")
        reg.publish("doc-1", {"phase": "done", "total": 0})
        event = await asyncio.wait_for(q.get(), timeout=1.0)
        assert event == {"phase": "done", "total": 0}
    asyncio.run(scenario())


def test_publish_with_no_subscribers_is_noop():
    reg = IngestRegistry()
    reg.publish("nobody-listening", {"phase": "done", "total": 0})


def test_multiple_subscribers_receive_the_same_event():
    async def scenario():
        reg = IngestRegistry()
        q1 = reg.subscribe("doc-1")
        q2 = reg.subscribe("doc-1")
        reg.publish("doc-1", {"phase": "done", "total": 5})
        a = await asyncio.wait_for(q1.get(), timeout=1.0)
        b = await asyncio.wait_for(q2.get(), timeout=1.0)
        assert a == b == {"phase": "done", "total": 5}
    asyncio.run(scenario())


def test_unsubscribe_removes_only_that_queue():
    async def scenario():
        reg = IngestRegistry()
        q1 = reg.subscribe("doc-1")
        q2 = reg.subscribe("doc-1")
        reg.unsubscribe("doc-1", q1)
        reg.publish("doc-1", {"phase": "done", "total": 0})
        b = await asyncio.wait_for(q2.get(), timeout=1.0)
        assert b == {"phase": "done", "total": 0}
        assert q1.empty()
    asyncio.run(scenario())


def test_is_active_reflects_task_registration():
    reg = IngestRegistry()
    assert not reg.is_active("doc-1")

    async def noop():
        pass

    async def scenario():
        task = asyncio.create_task(noop())
        reg.register_task("doc-1", task)
        assert reg.is_active("doc-1")
        await task
        reg.mark_inactive("doc-1")
        assert not reg.is_active("doc-1")
    asyncio.run(scenario())


from collections.abc import Callable

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.ingest import IngestRegistry, parse_into, BATCH_SIZE
from app.models import Document, Sentence


@pytest.fixture
def session_factory() -> Callable[[], Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _seed_doc(session_factory) -> str:
    db = session_factory()
    doc = Document(title="Test")
    db.add(doc)
    db.commit()
    doc_id = doc.id
    db.close()
    return doc_id


def test_parse_into_commits_sentences_and_publishes_batches(session_factory):
    doc_id = _seed_doc(session_factory)
    reg = IngestRegistry()
    queue = reg.subscribe(doc_id)

    text = "First sentence. Second sentence. Third sentence. Fourth. Fifth. Sixth. Seventh."
    asyncio.run(parse_into(doc_id, text, reg, session_factory))

    events = []
    while not queue.empty():
        events.append(queue.get_nowait())

    assert events[-1] == {"phase": "done", "total": 7}
    sentence_events = [e for e in events if e["phase"] == "sentences"]
    assert sum(len(e["items"]) for e in sentence_events) == 7
    assert sentence_events[0]["items"][0]["text"].startswith("First")

    db = session_factory()
    persisted = db.query(Sentence).filter(Sentence.document_id == doc_id).all()
    assert len(persisted) == 7
    db.close()


def test_parse_into_batches_at_BATCH_SIZE(session_factory):
    doc_id = _seed_doc(session_factory)
    reg = IngestRegistry()
    queue = reg.subscribe(doc_id)

    n = BATCH_SIZE + 50
    text = " ".join(f"Sent{i}. " for i in range(n))
    asyncio.run(parse_into(doc_id, text, reg, session_factory))

    sentence_events = []
    while not queue.empty():
        e = queue.get_nowait()
        if e["phase"] == "sentences":
            sentence_events.append(e)

    assert len(sentence_events) == 2
    assert len(sentence_events[0]["items"]) == BATCH_SIZE
    assert len(sentence_events[1]["items"]) == 50


def test_parse_into_publishes_error_on_unknown_doc(session_factory):
    reg = IngestRegistry()
    queue = reg.subscribe("does-not-exist")
    asyncio.run(parse_into("does-not-exist", "Hello.", reg, session_factory))

    events = [queue.get_nowait() for _ in range(queue.qsize())]
    assert events[-1]["phase"] == "error"


def test_parse_into_runs_content_sniff_when_title_inference_missed(session_factory):
    db = session_factory()
    doc = Document(title="contract-2024", contract_type=None)
    db.add(doc)
    db.commit()
    doc_id = doc.id
    db.close()

    reg = IngestRegistry()
    asyncio.run(parse_into(
        doc_id,
        "MASTER SERVICES AGREEMENT\n\nThis agreement governs services rendered.\n",
        reg,
        session_factory,
    ))

    db = session_factory()
    refreshed = db.query(Document).filter(Document.id == doc_id).one()
    assert refreshed.contract_type == "MSA"
    db.close()


def test_parse_into_marks_registry_inactive_in_finally(session_factory):
    doc_id = _seed_doc(session_factory)
    reg = IngestRegistry()

    async def scenario():
        task = asyncio.create_task(parse_into(doc_id, "Hi.", reg, session_factory))
        reg.register_task(doc_id, task)
        await task
    asyncio.run(scenario())

    assert not reg.is_active(doc_id)
