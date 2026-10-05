import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
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
