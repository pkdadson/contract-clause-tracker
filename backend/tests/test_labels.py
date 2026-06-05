import io

def _upload(client, name="MSA.txt", content="Customer shall pay invoices in 30 days. All fees are exclusive of tax."):
    return client.post("/api/documents", files={"file": (name, io.BytesIO(content.encode()), "text/plain")}).json()

def test_set_and_clear_label(client):
    doc = _upload(client)
    sid = doc["sentences"][0]["id"]
    r = client.put(f"/api/documents/{doc['id']}/sentences/{sid}/label", json={"clause_type_id": "payment"})
    assert r.status_code == 200
    assert r.json()["clause_type_id"] == "payment"

    r = client.delete(f"/api/documents/{doc['id']}/sentences/{sid}/label")
    assert r.status_code == 200
    assert r.json()["clause_type_id"] is None

def test_unknown_clause_type_rejected(client):
    doc = _upload(client)
    sid = doc["sentences"][0]["id"]
    r = client.put(f"/api/documents/{doc['id']}/sentences/{sid}/label", json={"clause_type_id": "made-up"})
    assert r.status_code == 400