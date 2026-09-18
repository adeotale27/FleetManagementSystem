"""Single source of truth for all money. Nothing is ever typed by hand."""
from db import db, new_id, now_iso

# entity_type: party | driver | employee | fuel_pump | partner
# debit  = entity owes us more (receivable up)  / we paid a payable
# credit = entity owes us less (money received) / we owe entity more


async def post(entity_type, entity_id, dt, description, debit=0.0, credit=0.0,
               ref_type=None, ref_id=None, meta=None):
    if not entity_id:
        return None
    doc = {
        "_id": new_id(),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "date": dt,
        "description": description,
        "debit": float(debit or 0),
        "credit": float(credit or 0),
        "ref_type": ref_type,
        "ref_id": ref_id,
        "meta": meta or {},
        "cancelled": False,
        "created_at": now_iso(),
    }
    await db.ledger.insert_one(doc)
    return doc["_id"]


async def cash(account, direction, amount, dt, description, ref_type=None,
               ref_id=None, deewanji_id=None, mode=None):
    """account: cash | bank | deewanji ; direction: in | out"""
    doc = {
        "_id": new_id(),
        "account": account,
        "direction": direction,
        "amount": float(amount or 0),
        "date": dt,
        "description": description,
        "ref_type": ref_type,
        "ref_id": ref_id,
        "deewanji_id": deewanji_id,
        "mode": mode,
        "cancelled": False,
        "created_at": now_iso(),
    }
    await db.cashbook.insert_one(doc)
    return doc["_id"]


async def reverse(ref_type, ref_id):
    await db.ledger.update_many(
        {"ref_type": ref_type, "ref_id": ref_id}, {"$set": {"cancelled": True}}
    )
    await db.cashbook.update_many(
        {"ref_type": ref_type, "ref_id": ref_id}, {"$set": {"cancelled": True}}
    )


async def balances(entity_type):
    """{entity_id: {debit, credit, balance}} — balance>0 means entity owes us."""
    pipeline = [
        {"$match": {"entity_type": entity_type, "cancelled": False}},
        {"$group": {"_id": "$entity_id", "debit": {"$sum": "$debit"},
                    "credit": {"$sum": "$credit"},
                    "last_date": {"$max": "$date"}}},
    ]
    out = {}
    async for r in db.ledger.aggregate(pipeline):
        out[r["_id"]] = {
            "debit": round(r["debit"], 2),
            "credit": round(r["credit"], 2),
            "balance": round(r["debit"] - r["credit"], 2),
            "last_date": r.get("last_date"),
        }
    return out


async def balance_of(entity_type, entity_id):
    b = await balances(entity_type)
    return b.get(entity_id, {"debit": 0, "credit": 0, "balance": 0, "last_date": None})


async def statement(entity_type, entity_id, frm=None, to=None):
    q = {"entity_type": entity_type, "entity_id": entity_id}
    rows = await db.ledger.find(q).sort("date", 1).to_list(5000)
    rows = sorted(rows, key=lambda r: (r["date"], r["created_at"]))
    running = 0.0
    out = []
    for r in rows:
        if not r["cancelled"]:
            running += r["debit"] - r["credit"]
        if frm and r["date"] < frm:
            continue
        if to and r["date"] > to:
            continue
        out.append({
            "id": r["_id"], "date": r["date"], "description": r["description"],
            "debit": r["debit"], "credit": r["credit"],
            "balance": round(running, 2), "ref_type": r.get("ref_type"),
            "ref_id": r.get("ref_id"), "cancelled": r["cancelled"],
        })
    return out, round(running, 2)


async def cash_position():
    pipeline = [
        {"$match": {"cancelled": False}},
        {"$group": {"_id": {"a": "$account", "d": "$direction"},
                    "t": {"$sum": "$amount"}}},
    ]
    acc = {"cash": 0.0, "bank": 0.0, "deewanji": 0.0}
    async for r in db.cashbook.aggregate(pipeline):
        a = r["_id"]["a"]
        if a not in acc:
            acc[a] = 0.0
        acc[a] += r["t"] if r["_id"]["d"] == "in" else -r["t"]
    return {k: round(v, 2) for k, v in acc.items()}


async def deewanji_cash():
    pipeline = [
        {"$match": {"cancelled": False, "account": "deewanji"}},
        {"$group": {"_id": {"d": "$deewanji_id", "dir": "$direction"},
                    "t": {"$sum": "$amount"}}},
    ]
    out = {}
    async for r in db.cashbook.aggregate(pipeline):
        k = r["_id"]["d"] or "unknown"
        out.setdefault(k, 0.0)
        out[k] += r["t"] if r["_id"]["dir"] == "in" else -r["t"]
    return {k: round(v, 2) for k, v in out.items()}
