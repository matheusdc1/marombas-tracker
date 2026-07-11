"""Fotos de evolução física — upload local, sem integração externa.

Os arquivos ficam ao lado do banco (db_path().parent/photos), então no
Railway caem dentro do volume junto com o SQLite.
"""

import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .db import db_path, get_db
from .routes import valid_day

router = APIRouter(prefix="/api")

CATEGORIES = ("Frente", "Lado", "Costas")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def photos_dir() -> Path:
    return db_path().parent / "photos"


def _to_public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "day": row["day"],
        "category": row["category"],
        "url": f"/api/photos/file/{row['filename']}",
    }


@router.post("/photos", status_code=201)
async def upload_photo(
    day: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
):
    valid_day(day)
    if category not in CATEGORIES:
        raise HTTPException(400, "categoria invalida: use Frente, Lado ou Costas")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "formato invalido: use jpg, jpeg, png ou webp")
    filename = f"{uuid4().hex}{ext}"
    directory = photos_dir()
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(await file.read())
    cur = db.execute(
        "INSERT INTO photos (day, category, filename) VALUES (?, ?, ?)",
        (day, category, filename),
    )
    return {"id": cur.lastrowid, "day": day, "category": category, "url": f"/api/photos/file/{filename}"}


@router.get("/photos")
def list_photos(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT * FROM photos ORDER BY day DESC, id DESC")
    return [_to_public(r) for r in rows]


@router.get("/photos/file/{filename}")
def photo_file(filename: str):
    if Path(filename).name != filename:  # bloqueia path traversal
        raise HTTPException(404, "arquivo nao encontrado")
    path = photos_dir() / filename
    if not path.is_file():
        raise HTTPException(404, "arquivo nao encontrado")
    return FileResponse(path)


@router.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT filename FROM photos WHERE id = ?", (photo_id,)).fetchone()
    if not row:
        raise HTTPException(404, "foto nao encontrada")
    db.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    (photos_dir() / row["filename"]).unlink(missing_ok=True)
    return {"ok": True}
