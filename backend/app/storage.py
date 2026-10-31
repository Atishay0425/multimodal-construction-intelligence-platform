"""SQLite history + on-disk image storage (the 'Data Storage' box in the architecture)."""
import json
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone

from .config import get_settings
from .images import ProcessedImage


def _db_path():
    d = get_settings().data_dir
    d.mkdir(parents=True, exist_ok=True)
    (d / "uploads").mkdir(exist_ok=True)
    return d / "history.sqlite3"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY, kind TEXT NOT NULL, mode TEXT NOT NULL, model TEXT NOT NULL,
            created_at TEXT NOT NULL, image_urls TEXT NOT NULL,
            context TEXT NOT NULL, result TEXT NOT NULL)"""
    )
    return conn


def save_images(analysis_id: str, images: list[ProcessedImage]) -> list[str]:
    uploads = get_settings().data_dir / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    urls = []
    for i, img in enumerate(images):
        fname = f"{analysis_id}_{i}.jpg"
        (uploads / fname).write_bytes(img.data)
        urls.append(f"/uploads/{fname}")
    return urls


def save_analysis(kind: str, mode: str, model: str, image_urls: list[str],
                  context: dict, result: dict, analysis_id: str | None = None) -> dict:
    row = {
        "id": analysis_id or uuid.uuid4().hex,
        "kind": kind, "mode": mode, "model": model,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "image_urls": image_urls, "context": context, "result": result,
    }
    with closing(_conn()) as conn, conn:
        conn.execute(
            "INSERT INTO analyses VALUES (?,?,?,?,?,?,?,?)",
            (row["id"], kind, mode, model, row["created_at"],
             json.dumps(image_urls), json.dumps(context), json.dumps(result)),
        )
    return row


def _row_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"], "kind": r["kind"], "mode": r["mode"], "model": r["model"],
        "created_at": r["created_at"], "image_urls": json.loads(r["image_urls"]),
        "context": json.loads(r["context"]), "result": json.loads(r["result"]),
    }


def list_analyses(kind: str | None = None, limit: int = 50) -> list[dict]:
    q, args = "SELECT * FROM analyses", []
    if kind:
        q += " WHERE kind = ?"
        args.append(kind)
    q += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with closing(_conn()) as conn:
        return [_row_to_dict(r) for r in conn.execute(q, args)]


def get_analysis(analysis_id: str) -> dict | None:
    with closing(_conn()) as conn:
        r = conn.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    return _row_to_dict(r) if r else None


def delete_analysis(analysis_id: str) -> bool:
    with closing(_conn()) as conn, conn:
        cur = conn.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
    for f in (get_settings().data_dir / "uploads").glob(f"{analysis_id}_*.jpg"):
        f.unlink(missing_ok=True)
    return cur.rowcount > 0
