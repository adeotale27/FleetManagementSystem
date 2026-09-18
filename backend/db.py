import os
import uuid
from pathlib import Path
from datetime import datetime, timezone, date

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


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
