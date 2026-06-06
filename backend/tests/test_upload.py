import io
import time

from app.ingest import get_registry


def _upload(client, name: str, content: str):
    return client.post(
        "/api/documents",
        files={"file": (name, io.BytesIO(content.encode("utf-8")), "text/plain")},
    )


def _wait_for_parse(client, doc_id: str, timeout: float = 2.0):
    reg = get_registry()
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not reg.is_active(doc_id):
            return client.get(f"/api/documents/{doc_id}").json()
        time.sleep(0.02)
    raise AssertionError(f"parse for {doc_id} did not complete within {timeout}s")


def test_upload_returns_201_with_empty_sentences_immediately(client):
    r = _upload(client, "Mutual NDA.txt", "First clause. Second clause. Third.")
    assert r.status_code == 201
    doc = r.json()
    assert doc["title"] == "Mutual Nda"
    assert doc["contract_type"] == "NDA"
    assert doc["sentences"] == []


def test_upload_then_get_eventually_returns_full_sentence_list(client):
    r = _upload(client, "Mutual NDA.txt", "First clause. Second clause. Third.")
    doc_id = r.json()["id"]

    final = _wait_for_parse(client, doc_id)
    bodies = [s for s in final["sentences"] if not s["is_heading"]]
    assert [s["text"] for s in bodies] == ["First clause.", "Second clause.", "Third."]


def test_upload_with_unrecognised_filename_leaves_type_null_when_content_misses(client):
    r = _upload(client, "lines-20.txt", "Line 1.\nLine 2.\nLine 3.\n")
    doc_id = r.json()["id"]
    final = _wait_for_parse(client, doc_id)
    assert final["contract_type"] is None


def test_upload_content_sniff_runs_in_background_task(client):
    r = _upload(
        client,
        "agreement-2024.txt",
        "MASTER SERVICES AGREEMENT\n\nThis agreement governs services.\n",
    )
    doc_id = r.json()["id"]
    assert r.json()["contract_type"] is None

    final = _wait_for_parse(client, doc_id)
    assert final["contract_type"] == "MSA"


def test_upload_rejects_pdf(client):
    r = client.post(
        "/api/documents",
        files={"file": ("contract.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
    )
    assert r.status_code == 415
    assert ".pdf" in r.json()["detail"]


def test_upload_rejects_oversize(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "max_upload_size_bytes", 10)
    r = _upload(client, "big.txt", "x" * 100)
    assert r.status_code == 413
