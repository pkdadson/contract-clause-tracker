import io


def _upload(client, name: str = "Mutual NDA.txt", content: str = "Hello.") -> str:
    r = client.post(
        "/api/documents",
        files={"file": (name, io.BytesIO(content.encode("utf-8")), "text/plain")},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_patch_sets_contract_type(client):
    doc_id = _upload(client)
    r = client.patch(f"/api/documents/{doc_id}", json={"contract_type": "MSA"})
    assert r.status_code == 200
    assert r.json()["contract_type"] == "MSA"


def test_patch_can_clear_contract_type_to_null(client):
    doc_id = _upload(client)
    r = client.patch(f"/api/documents/{doc_id}", json={"contract_type": None})
    assert r.status_code == 200
    assert r.json()["contract_type"] is None


def test_patch_rejects_unknown_value(client):
    doc_id = _upload(client)
    r = client.patch(f"/api/documents/{doc_id}", json={"contract_type": "Custom"})
    assert r.status_code == 422


def test_patch_returns_404_for_unknown_document(client):
    r = client.patch("/api/documents/does-not-exist", json={"contract_type": "MSA"})
    assert r.status_code == 404


def test_patch_rejects_extra_fields(client):
    doc_id = _upload(client)
    r = client.patch(f"/api/documents/{doc_id}", json={"contract_type": "NDA", "party": "x"})
    assert r.status_code == 422
