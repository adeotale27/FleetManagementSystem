# Fleet Manager v1.7.0

Transport office software for one or many logistics businesses.

- **Business owner** operates two distinct workflows: daily site bookings on the Booking Dashboard and large industrial shipments in Industrial Trips & LRs, with separate finances and reports.
- **Business owner** can administer multiple sites, assign site managers, review site operations and reconcile per-trip ledgers.
- **Site manager** operates only assigned site bookings and granted actions; industrial business routes are owner-only.
- **Platform owner** issues licences, suspends businesses, resets owner passwords, and turns modules on/off per business; platform access does not grant business-owner access.

Current application version: **v1.7.0**. See [VERSION.md](VERSION.md) for the release policy and changelog.

## Project guide

- [APP_SUMMARY.md](APP_SUMMARY.md) — product purpose, roles, features, and current boundaries.
- [ARCHITECTURE.md](ARCHITECTURE.md) — application architecture, data flows, design map, and diagrams.
- [AI_CHECKLIST.md](AI_CHECKLIST.md) — required steps for AI contributors and maintainers.
- [VERSION.md](VERSION.md) — authoritative app version, release rules, and changelog.

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
source .venv/Scripts/activate          # Windows: .venv\Scripts\activate
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
| **Business owner** | `owner` | `owner123` | **`/sites`** — Booking Dashboard |
| Same business (alt) | `priyanshu` | `owner123` | Same office as `owner` |
| **Site manager** | Created by the business owner | Set during assignment/reset | Assigned-site workspace at **`/sites`** |

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

## 7. Business owner — business modules

| Path | What |
|------|------|
| `/sites` | Booking Dashboard for daily site bookings, site administration and scoped booking access |
| `/booking-finance` | Owner-only Finance for site booking charges, posted collections, expenses and collectible balances |
| `/booking-reports` | Owner-only searchable, paginated site LR report and loaded-row CSV export |
| `/dashboard` | Redirects to the Booking Dashboard; the retired office dashboard remains only as legacy API code |
| `/trips?tab=trips` | Owner-only Industrial Trips (indoor / outdoor), status, cancel = reverse |
| `/trips?tab=lrs`, `/lrs/new`, `/lrs/:id` | Owner-only Industrial LRs; create / print |
| `/vehicles` | Fleet, documents, fuel, pumps |
| `/parties` | Customers, outstanding, ledger, payments |
| `/team` | Drivers and office staff, advances, salary |
| `/finance` | Industrial cash/bank, collections, payables, Deewanji, diesel, 3PL |
| `/reports` | Industrial reports + CSV / Excel / PDF / print |
| `/settings` | Company, routes, numbering, opening cash/bank |

Industrial money is derived from unscoped (`site_id` absent) `ledger`, `cashbook` and `expenses` records. Site booking entries use separate trip/LR/payment collections and tag shared expense/ledger/cashbook rows with `site_id`; they are visible through the Booking Dashboard/site views, not industrial Finance or Reports. Cancellation reverses entries; rows are not deleted.

---

## 8. Data layout (MongoDB)

`DB_NAME` default `fleet_db`.

Booking and industrial workflows are distinct record families within each tenant database; they are not separate MongoDB databases. Industrial operations use `trips`/`lrs`; site bookings use `site_trips`/`site_lrs` and site payment/reconciliation records. Vehicles, drivers and selected party/master records are shared. No data migration or collection replacement is introduced by this separation.

| Database | Contents |
|----------|----------|
| `fleet_db_platform` | `users`, `tenants` (licences) |
| `fleet_db` | Primary tenant `naidu` (New Naidu Transport) collections |
| `fleet_db_BusinessName_OwnerName` | Every additional licensed business |

Users collection id = username. Roles include `superadmin` (no tenant), `owner` (has `tenant_id`), and owner-created `site_manager` accounts (tenant and explicitly assigned site/action grants).

---

## 9. Multi-site business workflow (v1.2.0)

### Owner: create sites and assign access

1. Sign in as the business owner. Booking Dashboard is the default page at **`/sites`**. The old `/dashboard` browser route redirects here.
2. Create a site with a unique short code and an IANA timezone such as `Asia/Kolkata`. Codes are unique within the business.
3. Assign a site manager with a unique username and a strong initial password. The password is bcrypt-hashed; managers access only explicitly assigned sites and permitted actions.
4. Use manager access controls to grant/revoke per-site actions, reset credentials, replace a manager, or deactivate access. Deactivation preserves audit history and does not rewrite historical trip/LR creators.
5. Use the board's site/trip filters to inspect business-wide or site-level bookings, LRs and financial summaries.
6. Use **Booking Finance** for site booking charges, collections, trip expenses and collectible outstanding. Use **Booking Reports** to filter canonical LRs by date/site/search and export the rows currently loaded.

### Site manager: trips, LRs and collections

Site managers use the normal login and are routed to their assigned-site workspace. They can create multiple trips per operating day, select a tenant vehicle and driver from the trip form or enter either manually if it is not in the list, edit trip assignments while the trip is open, book LRs with multiple container lines, and close trips when authorized. The selected vehicle/driver IDs are retained alongside the trip's identifying number/name snapshots. The operating date uses the site's timezone. Trip/LR numbering is server-generated and atomic; truck number is descriptive, not an identifier. Owners can reopen a closed trip with a recorded reason.

Sender and receiver phone numbers are optional LR fields. After booking an LR, the app opens its printable detail view for quick browser/OS printing; the print action remains available later and can also save to PDF. On a phone, select any printer exposed by the browser or operating system (availability depends on the device and printer setup). The A4 LR view includes rent only when recorded and excludes hamali, internal identifiers, payment status and private ledger notes. Financial fields/actions follow the manager's assigned permissions.

Create/update actions show a top-right success or failure notice. Unexpected server failures use a reference ID; platform owners can use it to find the sanitized diagnostic in the platform error log. Validation feedback remains visible to the person correcting the form.

### Trip ledger export and reconciliation

Owners can download separate versioned CSV files for goods-wise and receiver-wise ledgers, a summary, and an import template for a selected trip. CSV has no worksheet concept, so these are separate files. The template includes immutable LR/trip/site IDs; receiver names and row order are never matching keys.

On an open site booking, the owner can use its **LR charge sheet** to edit bhada and hamali per LR. Each row saves via the existing audited site-LR update route, so the canonical booking LR and subsequent Booking Finance/Reports reads use the same values. Reconciled LRs remain locked; the booking must be reopened before editing closed-trip charges, and bhada cannot be reduced below payments already recorded.

1. Select the site and trip, then upload the completed CSV template.
2. Review the entire staged preview: matched records, changes, missing/unknown IDs, duplicates, invalid values and scope conflicts.
3. Correct or skip rows and explicitly acknowledge missing LRs where appropriate.
4. Confirm only after resolving the preview. Cancellation leaves trip/LR/financial data unchanged.
5. Review the reconciliation result and audit entry. Re-uploading an identical file is idempotent and returns the existing import result.

Imports are owner-only and tied to one business, site and trip. They update rent/hamali and payment details by LR ID. Payment events are auditable; partial payments are supported and reversals create separate events. Outstanding amounts derive from reconciled rent and actual payments. Hamali is a separate recorded charge, not collected rent or a cost.

### Existing businesses: explicit legacy assignment

Legacy records are not silently assigned to a site. First create the intended default site. As owner, review the **Legacy migration** preview and unassigned counts, then explicitly apply the assignment. The migration is repeatable and fills only missing site IDs; it does not reassign already-scoped records. Back up the tenant database before production migration.

### Multi-site API groups

All paths below are under `/api` and use the normal bearer token. Owner-only actions are enforced server-side.

| API group | Route examples | Purpose |
|---|---|---|
| Sites/managers | `/sites`, `/sites/{site_id}`, `/sites/{site_id}/manager`, `/sites/managers/...` | Site lifecycle, assignment, grants and credential operations |
| Bookings board | `/sites/system-dashboard`, `/sites/{site_id}/dashboard` | Business-wide and authorized site summaries and outstanding breakdowns |
| Booking LR report | `/sites/system-reports/lrs` | Owner-only date/site/search filtered and paginated report from canonical `site_lrs` |
| Trips | `/sites/{site_id}/trips...`, `/sites/{site_id}/trip-resources`, `/sites/{site_id}/trips/{trip_id}/expenses` | Scoped trip lifecycle, fleet/driver dropdown choices, and ledger-posted trip expenses |
| LRs/categories | `/sites/{site_id}/trips/{trip_id}/lrs...`, `/sites/{site_id}/categories` | Booking, paging, audited edits including charge sheet updates, categories and details |
| Payments/audit | LR `/payments` routes including `/retry`, `/sites/{site_id}/audit` | Payment/reversal events, interrupted posting retry and audit history |
| Ledger | `/sites/{site_id}/trips/{trip_id}/ledger/{section}`, `ledger-imports/...` | CSV export, staged preview/edit/commit and private original download |
| Legacy migration | `/sites/migration/legacy` | Owner preview and explicit assignment of unscoped legacy records |

See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams, data boundaries, indexes and retry behavior. API docs are at `http://localhost:8000/docs`.

---

## 10. Project map

```
backend/
  server.py      HTTP API
  auth.py        JWT, bcrypt, seed owner + platform owner
  db.py          Mongo + per-request tenant DB
  ledger.py      Balances and cashbook
  site_ops.py    Multi-site auth, operations, booking board, expenses, finance and CSV reconciliation
  storage.py     Optional file uploads
  requirements.txt
frontend/
  src/App.js     Role-aware routes
  src/pages/     Office, platform and multi-site screens
  src/lib/api.js Axios → REACT_APP_BACKEND_URL/api
memory/          Product notes and test logins
VERSION.md       Changelog
```

---

## 11. Quick API check (optional)

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

## 12. Common problems

| Problem | Fix |
|---------|-----|
| Backend crash on `MONGO_URL` / `JWT_SECRET` | Create `backend/.env` from the example |
| `Wrong username or password` for superadmin | Confirm `PLATFORM_*` in `backend/.env`, restart uvicorn |
| Frontend calls the wrong host | `REACT_APP_BACKEND_URL` must be origin only, then restart `npm start` |
| Blank page / CORS | Backend must be on port 8000 (or match the frontend env) |
| Backend startup reports `IndexKeySpecsConflict` for `site_trip_expense_idempotency_unique` | Deploy the compatible index declaration in v1.3.1 and restart. It reuses the existing index; do not drop collections or reset tenant databases. |
| Uploads fail | Expected without `EMERGENT_LLM_KEY`; rest of the app still works |
| Owner blocked after suspend | Platform owner: Activate licence on `/platform` |

Page bundles are loaded on demand and the trip list now limits its related financial aggregation to the trips in the current page. If a deployment still feels slow, capture request timings and MongoDB query plans on a representative tenant before considering a migration; do not clear production business data as a performance fix.

---

## 13. Tests (optional)

Run the focused offline multi-site unit tests with the configured backend pytest environment:

```bash
cd backend
pytest -q tests/test_site_ops_units.py
pytest -q tests/test_authorization.py tests/test_financial_separation_units.py
```

An opt-in end-to-end acceptance test is available at `backend/tests/test_site_ops_workflow.py`. It creates a site, manager, trip, two LRs, edits trip/LR values, records payments and trip expenses, exports/imports/reconciles the ledger, and checks the owner booking board. It creates persistent records and deactivates the test site/manager afterward; run it only against a disposable test tenant/API. Set `FMS_SITE_OPS_E2E_ALLOW_WRITES=1`, `FMS_SITE_OPS_E2E_BASE_URL`, `FMS_SITE_OPS_E2E_OWNER_USERNAME`, and `FMS_SITE_OPS_E2E_OWNER_PASSWORD` in the test process. It skips by default.

Build the frontend with `cd frontend && npm run build`. Existing API integration tests require a running, explicitly configured API and may create tenants or mutate trip data; inspect their fixtures and target before invoking. Never point them at production.

---

**v1.7.0** — added separate owner Booking Finance and paginated Booking Reports, reduced Booking Dashboard financial clutter, and added an audited per-LR bhada/hamali charge sheet using the canonical site LR update API. No new collection or migration. See [VERSION.md](VERSION.md).

**v1.6.0** — clearly separated daily site bookings from owner-only industrial Trips/LRs and Finance/Reports, hid industrial search/Quick Add on booking routes, and scoped site-tagged financial rows out of industrial balances, expenses and cashbook views. No migration or new booking collection. See [VERSION.md](VERSION.md).

**v1.5.0** — shared brand-derived presentation tokens, responsive navigation refinements, page-level refinements across business modules, and Booking Dashboard charts with backend-sourced daily/site data. An additive read-only dashboard response field supports the daily counts; office and site trip/LR storage remain distinct. See [VERSION.md](VERSION.md).

**v1.4.0** — owner Trips & LR visibility for site trips/LRs, a clearer Bookings Window Board, and on-demand site data loading without copying or duplicating financial records. See [VERSION.md](VERSION.md).

**v1.3.1** — startup compatibility for the deployed trip-expense index, bounded trip-list aggregation, and lazy-loaded route pages. See [VERSION.md](VERSION.md).

**v1.3.0** — operation notifications/error logging, Bookings Window Board, trip expenses, structured ledger exports, mobile trip/LR forms, and quicker LR printing. See [VERSION.md](VERSION.md).
