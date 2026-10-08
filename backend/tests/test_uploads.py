import asyncio
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import pytest
import storage
from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile

import server


@pytest.mark.parametrize("filename", ["logo.heic", "owner-photo.bmp", "logo"])
def test_logo_upload_rejects_unsupported_image_formats(filename):
    upload = UploadFile(
        filename=filename,
        file=BytesIO(b"not an image"),
        headers=Headers({"content-type": "image/heic"}),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.upload_file("logo", upload, {"tenant_id": "test"}))

    assert error.value.status_code == 415
    assert "Convert HEIC images" in error.value.detail


def test_supported_logo_format_passes_format_validation(monkeypatch):
    saved = {}

    def put_object(path, data, content_type):
        saved.update(path=path, data=data, content_type=content_type)
        return {"path": path, "size": len(data)}

    class FilesCollection:
        async def insert_one(self, record):
            saved["record"] = record

    async def run_inline(func, *args):
        return func(*args)

    monkeypatch.setattr(server.S, "build_path", lambda tenant, kind, filename: ("test/logo.png", "image/png"))
    monkeypatch.setattr(server.S, "put_object", put_object)
    monkeypatch.setattr(server, "run_in_threadpool", run_inline)
    monkeypatch.setattr(server, "db", SimpleNamespace(files=FilesCollection()))

    upload = UploadFile(
        filename="logo.png",
        file=BytesIO(b"png bytes"),
        headers=Headers({"content-type": "image/png"}),
    )
    result = asyncio.run(server.upload_file("logo", upload, {"tenant_id": "test"}))

    assert result["url"] == "/api/files/test/logo.png"
    assert saved["content_type"] == "image/png"


def test_upload_storage_can_use_a_persistent_configured_root(monkeypatch):
    with TemporaryDirectory(prefix="upload-storage-", dir=Path(__file__).parent) as directory:
        upload_root = Path(directory) / "persistent-uploads"
        monkeypatch.setattr(storage, "ROOT", upload_root)
        path, content_type = storage.build_path("tenant-a", "logo", "company.png")

        storage.put_object(path, b"persisted logo", content_type)
        data, stored_type = storage.get_object(path)

        assert (upload_root / path).is_file()
        assert data == b"persisted logo"
        assert stored_type == "image/png"
