import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import db

SECRET = os.environ["JWT_SECRET"]
ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


async def seed_owner():
    username = os.environ["OWNER_USERNAME"]
    existing = await db.users.find_one({"_id": username})
    if not existing:
        await db.users.insert_one(
            {
                "_id": username,
                "name": "Owner",
                "password": hash_pw(os.environ["OWNER_PASSWORD"]),
            }
        )


async def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data = jwt.decode(cred.credentials, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = await db.users.find_one({"_id": data["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"username": user["_id"], "name": user.get("name", "Owner")}
