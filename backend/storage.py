"""Local disk uploads so logos and photos work without a cloud key."""
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "data" / "uploads"
APP_NAME = "fleet-manager"
MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
        "gif": "image/gif", "pdf": "application/pdf"}


def _safe(path: str) -> Path:
    ROOT.mkdir(parents=True, exist_ok=True)
    p = (ROOT / path).resolve()
    if not str(p).startswith(str(ROOT.resolve())):
        raise ValueError("Invalid storage path")
    return p


def put_object(path: str, data: bytes, content_type: str) -> dict:
    fp = _safe(path)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_bytes(data)
    return {"path": path, "size": len(data), "content_type": content_type}


def get_object(path: str):
    fp = _safe(path)
    if not fp.is_file():
        raise FileNotFoundError(path)
    ext = fp.suffix.lstrip(".").lower()
    return fp.read_bytes(), MIME.get(ext, "application/octet-stream")


def build_path(tenant_id: str, kind: str, filename: str) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    if ext not in MIME:
        ext = "jpg"
    rel = f"{APP_NAME}/{tenant_id or 'main'}/{kind}/{uuid.uuid4().hex}.{ext}"
    return rel, MIME[ext]
