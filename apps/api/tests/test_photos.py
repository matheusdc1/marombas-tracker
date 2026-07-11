import io

import pytest
from fastapi import HTTPException

from app.photos import photo_file

PNG = b"\x89PNG\r\n\x1a\nconteudo-fake-de-imagem"


def _upload(client, day="2026-07-06", category="Frente", name="foto.png"):
    return client.post(
        "/api/photos",
        data={"day": day, "category": category},
        files={"file": (name, io.BytesIO(PNG), "image/png")},
    )


def test_upload_lista_serve_e_apaga(client):
    created = _upload(client)
    assert created.status_code == 201
    body = created.json()
    assert body["category"] == "Frente"
    assert body["url"].startswith("/api/photos/file/")

    served = client.get(body["url"])
    assert served.status_code == 200
    assert served.content == PNG

    _upload(client, day="2026-07-07", category="Lado", name="b.jpg")
    photos = client.get("/api/photos").json()
    assert [p["day"] for p in photos] == ["2026-07-07", "2026-07-06"]
    assert photos[0]["category"] == "Lado"

    assert client.delete(f"/api/photos/{body['id']}").json() == {"ok": True}
    assert client.get(body["url"]).status_code == 404
    assert len(client.get("/api/photos").json()) == 1
    assert client.delete(f"/api/photos/{body['id']}").status_code == 404


def test_validacoes_do_upload(client):
    assert _upload(client, day="ontem").status_code == 400
    assert _upload(client, category="Diagonal").status_code == 400
    assert _upload(client, name="script.exe").status_code == 400
    assert client.get("/api/photos/file/nao-existe.png").status_code == 404


def test_guarda_contra_path_traversal():
    with pytest.raises(HTTPException):
        photo_file("../segredo.png")
