import io
import time

from app.ingest import get_registry


def _upload(client, name="MSA.txt", content="Customer shall pay invoices in 30 days. All fees are exclusive of tax."):
    return client.post("/api/documents", files={"file": (name, io.BytesIO(content.encode()), "text/plain")}).json()


def _wait_for_parse(client, doc_id: str, timeout: float = 2.0):
    reg = get_registry()
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not reg.is_active(doc_id):
            return client.get(f"/api/documents/{doc_id}").json()
        time.sleep(0.02)
    raise AssertionError(f"parse for {doc_id} did not complete within {timeout}s")


def test_set_and_clear_label(client):
    doc = _upload(client)
    doc = _wait_for_parse(client, doc["id"])
    sid = doc["sentences"][0]["id"]
    r = client.put(f"/api/documents/{doc['id']}/sentences/{sid}/label", json={"clause_type_id": "payment"})
    assert r.status_code == 200
    assert r.json()["clause_type_id"] == "payment"

    r = client.delete(f"/api/documents/{doc['id']}/sentences/{sid}/label")
    assert r.status_code == 200
    assert r.json()["clause_type_id"] is None

def test_unknown_clause_type_rejected(client):
    doc = _upload(client)
    doc = _wait_for_parse(client, doc["id"])
    sid = doc["sentences"][0]["id"]
    r = client.put(f"/api/documents/{doc['id']}/sentences/{sid}/label", json={"clause_type_id": "made-up"})
    assert r.status_code == 400
