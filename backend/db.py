import os
import uuid
import contextvars
from pathlib import Path
from datetime import datetime, timezone, date

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

BASE_DB = os.environ["DB_NAME"]
PRIMARY_TENANT = "naidu"

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
platform_db = client[f"{BASE_DB}_platform"]
_tenant = contextvars.ContextVar("tenant_db", default=BASE_DB)


def tenant_db_name(tenant_id):
    if tenant_id in (None, "", PRIMARY_TENANT):
        return BASE_DB
    return f"{BASE_DB}_{tenant_id}"


def set_tenant(tenant_id):
    _tenant.set(tenant_db_name(tenant_id))


def tenant_db(tenant_id):
    return client[tenant_db_name(tenant_id)]


class _TenantDB:
    """Every business collection resolves to the signed-in tenant's own database."""

    def __getattr__(self, name):
        return client[_tenant.get()][name]

    def __getitem__(self, name):
        return client[_tenant.get()][name]


db = _TenantDB()


def new_id() -> str:
    return uuid.uuid4().hex


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today() -> str:
    return date.today().isoformat()


def ser(doc):
    if not doc:
        return None
    d = dict(doc)
    d["id"] = d.pop("_id")
    return d


def sers(docs):
    return [ser(d) for d in docs]
