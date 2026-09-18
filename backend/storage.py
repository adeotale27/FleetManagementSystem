import os
import uuid

import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "fleet-manager"

MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
        "gif": "image/gif", "pdf": "application/pdf"}

storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    def _put(key):
        return requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    r = _put(init_storage())
    if r.status_code == 404:
        r = _put(init_storage(force=True))
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    def _get(key):
        return requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r = _get(init_storage())
    if r.status_code == 404:
        r = _get(init_storage(force=True))
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


def build_path(tenant_id: str, kind: str, filename: str) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    if ext not in MIME:
        ext = "jpg"
    return f"{APP_NAME}/{tenant_id or 'main'}/{kind}/{uuid.uuid4()}.{ext}", MIME[ext]
