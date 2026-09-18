import requests, json, datetime
B = "http://localhost:8001/api"
t = requests.post(f"{B}/auth/login", json={"username": "owner", "password": "owner123"}).json()["token"]
H = {"Authorization": f"Bearer {t}"}
today = datetime.date.today().isoformat()
ok = lambda r: (r.status_code, r.json() if r.content else None)

def post(p, b):
    r = requests.post(f"{B}{p}", json=b, headers=H)
    if r.status_code >= 400: print("FAIL", p, r.status_code, r.text[:200]); raise SystemExit(1)
    return r.json()

def get(p, **kw):
    r = requests.get(f"{B}{p}", headers=H, params=kw)
    if r.status_code >= 400: print("FAIL GET", p, r.status_code, r.text[:200]); raise SystemExit(1)
    return r.json()

s = get("/settings")
v = post("/masters/vehicles", {"vehicle_no": "MH34AB1234", "vehicle_type": "Truck", "make": "Tata",
     "documents": {"insurance": {"number": "INS99", "expiry": (datetime.date.today()+datetime.timedelta(days=20)).isoformat()}}})
d = post("/masters/drivers", {"name": "Ramesh Yadav", "mobile": "9876543210", "licence_no": "MH123",
     "licence_expiry": (datetime.date.today()+datetime.timedelta(days=15)).isoformat()})
dw = post("/masters/team", {"name": "Shyam Deewanji", "role": "Deewanji", "salary": 18000})
pump = post("/masters/fuel_pumps", {"name": "HP Hinganghat", "location": "NH44"})
partner = post("/masters/partners", {"name": "Sai Logistics", "mobile": "9000000001"})

route = s["routes"][0]["id"]
trip = post("/trips", {"mode": "indoor", "route_id": route, "trip_type": "One Way", "start_date": today,
      "vehicle_id": v["id"], "driver_id": d["id"], "trip_amount": 12000, "party_name": "Prakash Food",
      "party_mobile": "9822011111"})
print("trip", trip["trip_no"], trip["from_name"], "->", trip["to_name"])

# temp vehicle trip
trip2 = post("/trips", {"mode": "outdoor", "from_name": "Hinganghat MIDC", "to_name": "Pune",
      "trip_type": "Round Trip", "start_date": today, "return_date": today,
      "temp_vehicle": {"vehicle_no": "MH40XY9999", "vehicle_type": "Tempo"}, "trip_amount": 25000})
print("trip2", trip2["trip_no"], trip2["vehicle_no"], trip2["temp_vehicle"])

lr = post("/lrs", {"trip_id": trip["id"], "sender": {"name": "Prakash Food", "mobile": "9822011111", "city": "Hinganghat"},
     "receiver": {"name": "Nagpur Traders", "mobile": "9822022222", "city": "Nagpur"},
     "goods_description": "Rice bags", "items": [{"description": "Rice", "quantity": 100, "weight": 5000, "rate": 120}],
     "freight_type": "NOT PAID"})
print("lr", lr["lr_no"], lr["freight"])

parties = get("/parties/suggest", q="PRAK")
print("suggest", [(p["name"], p["balance"]) for p in parties])
pid = parties[0]["id"]

post("/receipts", {"party_id": pid, "lr_id": lr["id"], "lr_no": lr["lr_no"], "amount": 5000, "mode": "Cash",
      "collected_by_type": "deewanji", "deewanji_id": dw["id"], "date": today})
post("/handovers", {"deewanji_id": dw["id"], "amount": 3000, "mode": "Cash", "date": today})
post("/expenses", {"category": "Toll", "amount": 800, "vehicle_id": v["id"], "trip_id": trip["id"], "mode": "Cash", "date": today})
post("/fuel", {"vehicle_id": v["id"], "pump_id": pump["id"], "quantity": 50, "rate": 92, "mode": "Credit", "date": today})
post("/payments", {"entity_type": "fuel_pump", "entity_id": pump["id"], "amount": 2000, "mode": "Bank", "date": today})
post("/advances", {"entity_type": "driver", "entity_id": d["id"], "kind": "Advance", "amount": 10000, "date": today})
post("/advances", {"entity_type": "driver", "entity_id": d["id"], "kind": "Repayment", "amount": 3000, "date": today})
post("/tpl", {"party_name": "Bharat Steel", "partner_id": partner["id"], "from_name": "Nagpur", "to_name": "Surat",
      "customer_amount": 40000, "partner_amount": 32000, "expenses": 1000, "date": today})
requests.put(f"{B}/trips/{trip2['id']}", json={"status": "Completed"}, headers=H)

led = get(f"/ledger/party/{pid}")
print("party ledger bal", led["balance"], "rows", len(led["rows"]))
fin = get("/finance/summary")
print("finance", {k: fin[k] for k in ("to_receive", "to_pay", "received_today", "cash", "bank", "deewanji_cash", "driver_advances")})
dash = get("/dashboard")
print("dash trips", dash["trips"], "coll", dash["collections"], "alerts", dash["alerts"])
print("recv", get("/finance/receivables")["total"], "pay", get("/finance/payables")["total"])
print("pump", {k: get(f"/profile/fuel_pump/{pump['id']}")[k] for k in ("purchased", "paid", "outstanding")})
print("driver out", get(f"/profile/driver/{d['id']}")["outstanding"])
print("deewanji daily", get("/deewanji/daily")["rows"])
for r in ["trips", "lrs", "vehicles", "drivers", "party_ledger", "receivables", "payables", "collections",
          "deewanji", "expenses", "fuel", "employee_ledger", "driver_advances", "tpl", "cashflow"]:
    rep = get(f"/reports/{r}", frm="2000-01-01", to="2999-12-31")
    print("report", r, len(rep["rows"]), "cols", len(rep["columns"]))
print("search", [x["type"] for x in get("/search", q="MH34")])
print("ALL OK")
