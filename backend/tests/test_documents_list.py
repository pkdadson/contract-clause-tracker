import io
import time

from app.ingest import get_registry


def _upload(client, name, content):
    return client.post("/api/documents", files={"file": (name, io.BytesIO(content.encode()), "text/plain")}).json()


def _wait_for_parse(client, doc_id: str, timeout: float = 2.0):
    reg = get_registry()
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not reg.is_active(doc_id):
            return client.get(f"/api/documents/{doc_id}").json()
        time.sleep(0.02)
    raise AssertionError(f"parse for {doc_id} did not complete within {timeout}s")


def test_list_embeds_counts_and_clause_types_present(client):
    doc = _upload(client, "Payment Terms NDA.txt",
                  "Customer shall pay invoices in 30 days. The parties shall keep info confidential.")
    doc = _wait_for_parse(client, doc["id"])
    s0 = doc["sentences"][0]["id"]
    s1 = doc["sentences"][1]["id"]
    client.put(f"/api/documents/{doc['id']}/sentences/{s0}/label", json={"clause_type_id": "payment"})
    client.put(f"/api/documents/{doc['id']}/sentences/{s1}/label", json={"clause_type_id": "confidential"})

    rows = client.get("/api/documents").json()
    assert len(rows) == 1
    row = rows[0]
    assert row["sentence_count"] == 2
    assert row["labeled_count"] == 2
    assert sorted(row["clause_types_present"]) == ["confidential", "payment"]
