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
