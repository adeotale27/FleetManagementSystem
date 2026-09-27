# Fleet Manager — app summary

## Why this app exists

Fleet Manager is transport-office software for moving a logistics business's day-to-day work out of disconnected paper, spreadsheets, and manually reconciled cash records. It brings trips, lorry receipts (LRs), fleet and people, collections, expenses, and business reports into one operational workflow. Its financial balances are calculated from recorded transactions rather than maintained as hand-entered totals.

The product began as a focused tool for a local transport business. The current implementation also supports a platform operator issuing licences to multiple independent businesses. Each business uses the same application while its operational records remain in its own MongoDB database.

## Who uses it

- **Business owner (`owner`)**: operates one transport office and its trips, LRs, fleet, parties, team, finance, reports, and settings.
- **Platform owner (`superadmin`)**: creates and manages business licences, activates/suspends businesses, resets owner passwords, configures per-tenant feature visibility, and views platform activity/error summaries.

Platform administration is not a tenant business role. A platform user has no tenant association and platform administration reads platform records; a business user is associated with a tenant database.

## What it does today

| Area | Purpose and principal workflows |
|---|---|
| Dashboard | Today/active/completed trips, fleet availability, collections and cash, alerts, receivables, and monthly business charts. |
| Trips & LR | Indoor routes or outdoor addresses; trip assignment, cost/profit view, LRs with freight and consignor/receiver details, and receipt status. |
| Vehicles | Fleet records, status, documents/expiry, vehicle history, and fuel/expense context. |
| Parties | Customer records, receivables, party ledger, LRs, and collections. |
| Team | Drivers and office team, profiles, advances/repayments, and Deewanji collection handovers. |
| Finance | Receivables/payables, collections, cashbook, expenses, fuel, payments, advances, Deewanji, and third-party logistics (3PL). |
| Reports | Date/search-filtered business reports with CSV, Excel-compatible, PDF, and print exports. |
| Settings | Company/branding, locations and routes, numbering, due days, opening balances, categories, payment modes, and partners. |
| Platform control | Tenant licences, tenant activity, status and expiry, feature visibility, and owner password reset. |

## Important business rules

1. **Tenant boundaries:** licence/user records are in the platform database; each tenant's office records resolve to that tenant's separate database.
2. **Financial source of truth:** `ledger` holds entity debits/credits; `cashbook` holds cash, bank, and Deewanji movements. UI balances and reports are derived from those records, with settings opening cash/bank added where appropriate.
3. **No destructive transaction cancellation:** cancellation marks a source transaction and its ledger/cashbook postings as cancelled; it retains the historical records.
4. **Trip and LR revenue:** trips and LRs can relate to the same freight. Dashboard monthly revenue avoids counting trip-linked LR freight twice.
5. **Platform role boundary:** platform endpoints require `superadmin`; normal office endpoints use the authenticated user's tenant context.

## Current boundaries (do not imply these are complete features)

- GPS live tracking is implemented as a per-vehicle WheelsEye API lookup and requires a token on each vehicle; it is not a built-in fleet tracking service.
- Google Maps address autocomplete and map pinning require `REACT_APP_GOOGLE_MAPS_API_KEY`; plain address entry remains available without it.
- Uploads are stored on the backend's local disk (`backend/data/uploads/`), so production deployments need an explicit persistence/backup strategy.
- This is a single FastAPI service with most API routes and business orchestration in `backend/server.py`; it is not a set of independently deployed services.
- Per-tenant feature flags are currently returned to the frontend and used to control navigation visibility. Do not assume backend endpoint authorization is automatically disabled by a feature flag.
- The repository has a backend API test module and a smoke script, but its tests expect a running service and test configuration; inspect their host/environment assumptions before invoking them.

## Where to learn more

- Setup and local run: [README.md](README.md)
- Architecture and diagrams: [ARCHITECTURE.md](ARCHITECTURE.md)
- Required AI/maintainer process: [AI_CHECKLIST.md](AI_CHECKLIST.md)
- Versions and changelog: [VERSION.md](VERSION.md)
