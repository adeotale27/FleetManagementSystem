# Fleet Manager v1.0.0

Transport office software for one or many logistics businesses.

- **Business owner** runs the office: trips, LR, vehicles, parties, team, money, reports.
- **Platform owner** issues licences, suspends businesses, resets owner passwords, and turns modules on/off per business.

This is **v1**. See [VERSION.md](VERSION.md) for what this release includes.

---

## 1. What you need on your machine

| Tool | Version (tested) | Why |
|------|------------------|-----|
| Python | 3.10+ | Backend (FastAPI) |
| Node.js | 18+ (npm included) | Frontend (React) |
| MongoDB | 6+ | Database |

Install MongoDB Community and start it so `mongodb://127.0.0.1:27017` answers.

---

## 2. Get the code

```bash
git clone <this-repo-url>
cd <repo-folder>
```

---

## 3. Environment files (required)

Copy the examples. Do not commit real `.env` files.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### `backend/.env`

| Key | Default in example | Meaning |
|-----|--------------------|---------|
| `MONGO_URL` | `mongodb://127.0.0.1:27017` | MongoDB connection |
| `DB_NAME` | `fleet_db` | Primary business DB name |
| `JWT_SECRET` | change this | Signs login tokens |
| `OWNER_USERNAME` | `owner` | Business owner login |
| `OWNER_PASSWORD` | `owner123` | Business owner password |
| `PLATFORM_USERNAME` | `superadmin` | Platform owner login |
| `PLATFORM_PASSWORD` | `super123` | Platform owner password |

Optional (logo / document uploads only): not required. Files save under `backend/data/uploads/`.

### `frontend/.env`

| Key | Default | Meaning |
|-----|---------|---------|
| `REACT_APP_BACKEND_URL` | `http://localhost:8000` | Backend origin (no trailing `/api`) |

Optional later: `REACT_APP_GOOGLE_MAPS_API_KEY`.

After changing frontend env, restart `npm start`.

---

## 4. Run locally (two terminals)

### Terminal A — MongoDB

If MongoDB is not already a service:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu
sudo systemctl start mongod
```

### Terminal B — backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

On start the backend **creates / refreshes**:

- Platform user `superadmin` (role `superadmin`)
- Business `naidu` = New Naidu Transport
- Business users `owner` and `priyanshu` (role `owner`)

API docs: http://localhost:8000/docs  
API prefix: `http://localhost:8000/api/...`

### Terminal C — frontend

```bash
cd frontend
npm install
npm start
```

Open **http://localhost:3000**

If port 3000 is taken, CRA will offer another port. The backend URL in `frontend/.env` does not change.

---

## 5. Logins (v1 defaults)

Sign-in page: http://localhost:3000/login

| Who | Username | Password | After login |
|-----|----------|----------|-------------|
| **Platform owner** | `superadmin` | `super123` | **`/platform`** — licences for all businesses |
| **Business owner** | `owner` | `owner123` | **`/`** — New Naidu Transport office |
| Same business (alt) | `priyanshu` | `owner123` | Same office as `owner` |

These values come from `backend/.env`. If you change them, restart the backend; seed will update name/role and **reset the password** if it no longer matches the env file.

---

## 6. Platform owner — how it works

Code: `backend/auth.py` (seed + `require_super`), `backend/server.py` (`/api/platform/...`), `frontend/src/pages/Platform.jsx`.

1. Log in as `superadmin`.
2. You land on **Platform Control**.
3. You can:
   - Issue a **new business licence** (new login + its own MongoDB)
   - **Suspend / activate** a licence (suspended owners cannot sign in)
   - **Reset** that business owner’s password
   - **Customise** modules (Trips, Vehicles, Finance, GPS, charts, …) for that business only

Platform APIs (Bearer JWT, role must be `superadmin`):

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/platform/summary` | Totals + every tenant + stats |
| GET | `/api/platform/tenants` | Licence list |
| POST | `/api/platform/tenants` | Create licence + owner user |
| PUT | `/api/platform/tenants/{id}` | Status, plan, features, expiry |
| POST | `/api/platform/tenants/{id}/reset-password` | New owner password (min 6 chars) |

Business-owner tokens get **403** on these routes.

---

## 7. Business owner — office modules

| Path | What |
|------|------|
| `/` | Dashboard |
| `/trips` | Trips (indoor / outdoor), status, cancel = reverse |
| `/lrs/new`, `/lrs/:id` | Lorry Receipt create / print |
| `/vehicles` | Fleet, documents, fuel, pumps |
| `/parties` | Customers, outstanding, ledger, payments |
| `/team` | Drivers and office staff, advances, salary |
| `/finance` | Cash/bank, collections, payables, Deewanji, diesel, 3PL |
| `/reports` | Filtered reports + CSV / Excel / PDF / print |
| `/settings` | Company, routes, numbering, opening cash/bank |

Money is derived from `ledger` + `cashbook`. Cancel reverses entries; rows are not deleted.

---

## 8. Data layout (MongoDB)

`DB_NAME` default `fleet_db`.

| Database | Contents |
|----------|----------|
| `fleet_db_platform` | `users`, `tenants` (licences) |
| `fleet_db` | Primary tenant `naidu` (New Naidu Transport) collections |
| `fleet_db_(BusinessName_OwnerName)` | Every additional licensed business (readable name, not a random id) |

Users collection id = username. Roles: `superadmin` (no tenant) or `owner` (has `tenant_id`).

---

## 9. Project map

```
backend/
  server.py      HTTP API
  auth.py        JWT, bcrypt, seed owner + platform owner
  db.py          Mongo + per-request tenant DB
  ledger.py      Balances and cashbook
  storage.py     Optional file uploads
  requirements.txt
frontend/
  src/App.js     Routes (platform route only for superadmin)
  src/pages/     Screens including Platform.jsx
  src/lib/api.js Axios → REACT_APP_BACKEND_URL/api
memory/          Product notes and test logins
VERSION.md       Changelog
```

---

## 10. Quick API check (optional)

With backend running:

```bash
# Platform owner
curl -s http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"super123"}'

# Business owner
curl -s http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner","password":"owner123"}'
```

Use the returned `token` as `Authorization: Bearer <token>`.

---

## 11. Common problems

| Problem | Fix |
|---------|-----|
| Backend crash on `MONGO_URL` / `JWT_SECRET` | Create `backend/.env` from the example |
| `Wrong username or password` for superadmin | Confirm `PLATFORM_*` in `backend/.env`, restart uvicorn |
| Frontend calls the wrong host | `REACT_APP_BACKEND_URL` must be origin only, then restart `npm start` |
| Blank page / CORS | Backend must be on port 8000 (or match the frontend env) |
| Uploads fail | Expected without `EMERGENT_LLM_KEY`; rest of the app still works |
| Owner blocked after suspend | Platform owner: Activate licence on `/platform` |

---

## 12. Tests (optional)

Backend tests in `backend/tests/` expect a running API and env similar to production (`REACT_APP_BACKEND_URL`). They are written against a deployed URL in some setups; for local, export that URL to `http://localhost:8000` first.

---

**v1.0.0** — local run documented; platform owner and business owner both active.
