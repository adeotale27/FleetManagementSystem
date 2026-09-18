import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import PRIMARY_TENANT, platform_db, set_tenant

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
    payload = {"sub": username, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, SECRET, algorithm=ALGO)


async def upsert_user(username, name, password, role, tenant_id):
    existing = await platform_db.users.find_one({"_id": username})
    if existing:
        await platform_db.users.update_one(
            {"_id": username}, {"$set": {"name": name, "role": role, "tenant_id": tenant_id}})
        return
    await platform_db.users.insert_one({
        "_id": username, "name": name, "password": hash_pw(password),
        "role": role, "tenant_id": tenant_id, "active": True,
    })


async def seed_owner():
    """Platform super admin + the first business (New Naidu Transport) and its owner."""
    tenant = await platform_db.tenants.find_one({"_id": PRIMARY_TENANT})
    if not tenant:
        await platform_db.tenants.insert_one({
            "_id": PRIMARY_TENANT,
            "name": "New Naidu Transport",
            "owner_name": "Priyanshu Naidu",
            "owner_username": os.environ["OWNER_USERNAME"],
            "city": "Hinganghat", "state": "Maharashtra", "mobile": "",
            "plan": "Business", "license_status": "Active",
            "license_start": datetime.now(timezone.utc).date().isoformat(),
            "license_expiry": (datetime.now(timezone.utc) + timedelta(days=365)).date().isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await upsert_user(os.environ["PLATFORM_USERNAME"], "Platform Owner",
                      os.environ["PLATFORM_PASSWORD"], "superadmin", None)
    await upsert_user(os.environ["OWNER_USERNAME"], "Priyanshu Naidu",
                      os.environ["OWNER_PASSWORD"], "owner", PRIMARY_TENANT)
    await upsert_user("priyanshu", "Priyanshu Naidu",
                      os.environ["OWNER_PASSWORD"], "owner", PRIMARY_TENANT)


async def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data = jwt.decode(cred.credentials, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = await platform_db.users.find_one({"_id": data["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    role = user.get("role", "owner")
    tenant_id = user.get("tenant_id")
    tenant = await platform_db.tenants.find_one({"_id": tenant_id}) if tenant_id else None
    if tenant and tenant.get("license_status") != "Active" and role != "superadmin":
        raise HTTPException(status_code=403, detail="Licence is not active. Please contact the platform owner.")
    set_tenant(tenant_id)
    return {"username": user["_id"], "name": user.get("name", "Owner"), "role": role,
            "tenant_id": tenant_id, "tenant_name": (tenant or {}).get("name", "")}


async def require_super(u=Depends(current_user)):
    if u["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Platform owner access only")
    return u
