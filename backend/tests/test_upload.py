import io

def _upload(client, name: str, content: str):
    return client.post(
        "/api/documents",
        files={"file": (name, io.BytesIO(content.encode("utf-8")), "text/plain")},
    )

def test_upload_txt_splits_into_sentences(client):
    r = _upload(client, "Mutual NDA.txt", "First clause. Second clause. Third.")
    assert r.status_code == 201
    doc = r.json()
    assert doc["title"] == "Mutual Nda"
    assert doc["contract_type"] == "NDA"
    bodies = [s for s in doc["sentences"] if not s["is_heading"]]
    assert [s["text"] for s in bodies] == ["First clause.", "Second clause.", "Third."]

def test_upload_with_unrecognised_filename_leaves_type_null(client):
    r = _upload(client, "lines-20.txt", "Line 1.\nLine 2.\nLine 3.\n")
    assert r.status_code == 201
    assert r.json()["contract_type"] is None

def test_upload_falls_back_to_content_sniff_for_type(client):
    r = _upload(
        client,
        "agreement-2024.txt",
        "MASTER SERVICES AGREEMENT\n\nThis agreement governs services.\n",
    )
    assert r.status_code == 201
    assert r.json()["contract_type"] == "MSA"

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
