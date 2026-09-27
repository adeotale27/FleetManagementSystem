import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import auth


def test_business_api_requires_owner(monkeypatch):
    async def resolve_owner(_credentials):
        return {"role": "owner", "username": "owner"}

    monkeypatch.setattr(auth, "_resolve_principal", resolve_owner)

    assert asyncio.run(auth.current_user(SimpleNamespace()))["role"] == "owner"


@pytest.mark.parametrize("role", ["site_manager", "superadmin", "unknown"])
def test_business_api_rejects_non_owners(monkeypatch, role):
    async def resolve_user(_credentials):
        return {"role": role, "username": role}

    monkeypatch.setattr(auth, "_resolve_principal", resolve_user)

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.current_user(SimpleNamespace()))

    assert error.value.status_code == 403
    assert error.value.detail == "Business owner access only"


def test_site_operations_can_resolve_site_manager(monkeypatch):
    async def resolve_manager(_credentials):
        return {"role": "site_manager", "username": "manager"}

    monkeypatch.setattr(auth, "_resolve_principal", resolve_manager)

    assert asyncio.run(auth.site_user(SimpleNamespace()))["role"] == "site_manager"


def test_platform_guard_accepts_superadmin_without_business_access(monkeypatch):
    async def resolve_superadmin(_credentials):
        return {"role": "superadmin", "username": "platform"}

    monkeypatch.setattr(auth, "_resolve_principal", resolve_superadmin)

    assert asyncio.run(auth.require_super(SimpleNamespace()))["role"] == "superadmin"


def test_platform_guard_rejects_business_owner(monkeypatch):
    async def resolve_owner(_credentials):
        return {"role": "owner", "username": "owner"}

    monkeypatch.setattr(auth, "_resolve_principal", resolve_owner)

    with pytest.raises(HTTPException) as error:
        asyncio.run(auth.require_super(SimpleNamespace()))

    assert error.value.status_code == 403
