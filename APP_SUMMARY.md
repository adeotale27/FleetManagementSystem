# Fleet Manager — app summary

## Why this app exists

Fleet Manager is transport-office software for moving a logistics business's day-to-day work out of disconnected paper, spreadsheets, and manually reconciled cash records. It brings trips, lorry receipts (LRs), fleet and people, collections, expenses, and business reports into one operational workflow. Its financial balances are calculated from recorded transactions rather than maintained as hand-entered totals.

The product began as a focused tool for a local transport business. The current implementation also supports a platform operator issuing licences to multiple independent businesses. Each business uses the same application while its operational records remain in its own MongoDB database.

## Who uses it

- **Business owner (`owner`)**: operates the Booking Dashboard for daily site bookings and the separate industrial Trips & LRs, fleet, parties, team, finance, reports, and settings.
- **Site manager (`site_manager`)**: operates only explicitly assigned, active site bookings: create/update site trips, book site LRs, and close trips according to per-site actions granted by the owner. Site managers are denied access to industrial business routes.
- **Platform owner (`superadmin`)**: creates and manages business licences, activates/suspends businesses, resets owner passwords, configures per-tenant feature visibility, and views platform activity/error summaries.

Platform administration is not a tenant business role. A platform user has no tenant association and platform administration reads platform records; a business user is associated with a tenant database.

## What it does today

| Area | Purpose and principal workflows |
|---|---|
| Booking Dashboard | Daily small-goods site bookings for the owner and authorized site managers: focused booking KPIs, date/site/status filters, operational drill-down and booking creation. Site administration/access and categories are on a distinct owner-only Booking Setup & Access page; detailed booking charges, collections, expenses and receivables are on the separate owner-only Booking Finance page. |
| Booking Finance & Reports | Owner-only site-booking finance summaries and site-scoped expense/receivable breakdowns; searchable, date/site-filtered, paginated reports of canonical booking LRs with an export of the rows currently loaded. These are separate from industrial Finance and Reports. |
| Booking Setup & Access | Owner-only `/booking-setup`: create/edit sites, preview/confirm legacy assignment, assign Office Team managers, manage site permissions, reset/deactivate manager logins, and configure booking categories. Site managers are selectable from active Team profiles with manager roles; owners can add a missing profile inline. A selected Team profile is linked to a distinct site-manager login by ID; credentials stay out of Team records. Temporary passwords are shown only after assignment/reset. |
| Sites & managers | Managers have tenant-scoped platform login accounts and explicit site permissions. Keep manager IDs/status/site access in the setup register; securely reset credentials and revoke assignments when replacing/deactivating. Authorized managers see only their site assignments. |
| Site trips & LRs | Timezone-based daily trip references, atomic daily sequencing, trip close/owner reopen, vehicle/driver selection from tenant fleet records or manual entry, editable trip attributes while open, site/day LR numbers, multiple container lines, optional sender/receiver phone numbers, duplicate receiver confirmation, custom categories, quick-printable A4 LRs, and an owner-only LR charge sheet for bhada/hamali edits. |
| Site ledger & payments | Per-trip goods summary, detailed good/container, receiver, summary and stable-ID import-template CSVs; owner preview/edit/confirm/reconciliation; multiple payment events and owner reversals. |
| Site trip expenses | Auditable trip-linked expense recording and display using the established shared ledger/cashbook posting model, with every booking posting tagged to its site. |
| Industrial Trips & LRs | Owner-only large industrial shipments: indoor routes or outdoor addresses; trip assignment, cost/profit view, industrial LRs with freight and consignor/receiver details, and receipt status. Site booking trips and LRs are not shown or edited here. |
| Vehicles | Fleet records, status, documents/expiry, vehicle history, and fuel/expense context. |
| Parties | Customer records, receivables, party ledger, LRs, and collections. |
| Team | Drivers and office team, profiles, advances/repayments, and Deewanji collection handovers. |
| Industrial Finance | Owner-only industrial receivables/payables, collections, cashbook, expenses, fuel, payments, advances, Deewanji, and third-party logistics (3PL). Site-tagged bookings, expenses, ledger rows and cashbook rows are excluded. |
| Industrial Reports | Owner-only date/search-filtered industrial reports with CSV, Excel-compatible, PDF, and print exports; site booking records are excluded. |
| Settings | Company/branding, locations and routes, numbering, due days, opening balances, categories, payment modes, and partners. |
| Platform control | Tenant licences, tenant activity, status and expiry, feature visibility, and owner password reset. |

## Important business rules

1. **Tenant and workflow boundaries:** licence/user records are in the platform database; each business resolves to its own tenant database. Within that tenant, industrial trips/LRs (`trips`, `lrs`) and site bookings (`site_trips`, `site_lrs`) remain separate canonical record families.
2. **Financial source of truth:** `ledger` holds entity debits/credits; `cashbook` holds cash, bank, and Deewanji movements. Site postings carry `site_id`; industrial balances, reports and expense reads exclude site-tagged rows. Site booking totals use site-scoped booking/payment/expense data. UI balances are derived, with settings opening cash/bank added where appropriate.
3. **No destructive transaction cancellation:** cancellation marks a source transaction and its ledger/cashbook postings as cancelled; it retains the historical records.
4. **Trip and LR revenue:** trips and LRs can relate to the same freight. Dashboard monthly revenue avoids counting trip-linked LR freight twice.
5. **Role boundary:** industrial business endpoints require an `owner`; site operations resolve the owner or site manager and enforce site/action scope; platform endpoints require `superadmin`. Platform users do not inherit business-owner access.
6. **Site isolation:** site records live in the authenticated business's existing MongoDB database and carry `business_id`/`site_id`; every site API checks those values and the current user's assignment/action grant. Cross-site manager access is opt-in.
7. **Historical ownership:** creator and payment events are append-only audit facts. Replacing a manager revokes access without rewriting historical identities.
8. **Manager credentials and identity:** platform user records store bcrypt password hashes only. Owner manager lists never return password fields; a temporary password is held in the browser page only after assignment/reset and must be copied securely at that time. A manager account may reference an Office Team record by `team_member_id`; it remains a separate login identity. Reset credentials to replace a forgotten password.
9. **Reconciliation:** uploaded ledgers are versioned CSV templates matched by immutable LR ID plus business/site/trip scope. Preview is validated before application; deterministic staged effects, unique financial posting references and row progress make retries safe. Missing LRs require explicit acknowledgement and remain unreconciled.
10. **Financial meaning:** bhada is recorded separately from reconciled bhada and actual payment events. Hamali remains a distinct informational charge until its accounting meaning is established; it is not presented as collected rent or a cost.
11. **Legacy data:** legacy records without a site are not silently assigned. The owner first previews the unassigned counts and explicitly confirms a repeatable assignment to the designated default site.
12. **Operation feedback:** mutating requests give users clear success/failure feedback; unexpected server errors have a reference identifier and a sanitized platform error-log record for super-admin investigation.

## Presentation system

The frontend uses a light, brand-preserving design system: forest green and its existing shades for primary actions, amber for financial attention, and neutral layered surfaces. Shared CSS variables and Tailwind mappings cover brand, canvas, surfaces, text, borders, focus and elevation. The responsive shell separates the Booking Dashboard, Booking Finance/Reports and site booking pages from owner-only Industrial Trips, LRs, Finance and Reports. The owner dashboard emphasizes operational KPIs; actual finance values are shown on the dedicated booking finance page. Trip charge edits use the existing scoped LR update API and are reflected in subsequent booking, finance and report reads. Motion is reduced when the user requests reduced motion. This is a CSS/SVG/chart-based visual treatment, not a 3D rendering engine.

## Current boundaries (do not imply these are complete features)

- GPS live tracking is implemented as a per-vehicle WheelsEye API lookup and requires a token on each vehicle; it is not a built-in fleet tracking service.
- Google Maps address autocomplete and map pinning require `REACT_APP_GOOGLE_MAPS_API_KEY`; plain address entry remains available without it.
- Uploads are stored on the backend's local disk (`backend/data/uploads/`), so production deployments need an explicit persistence/backup strategy.
- This is a single FastAPI service with most API routes and business orchestration in `backend/server.py`; it is not a set of independently deployed services.
- Booking and industrial workflows are separate within one tenant database, not separate MongoDB databases. Site expenses use the existing `expenses` collection with `site_id`; ledger/cashbook postings are likewise tagged and must be filtered from industrial read models. Shared vehicle/driver/party masters remain common by design.
- Per-tenant feature flags are currently returned to the frontend and used to control navigation visibility. Do not assume backend endpoint authorization is automatically disabled by a feature flag.
- New site-ledger originals are stored beneath the existing private local upload store and are blocked from the legacy unauthenticated file route. Production still needs durable private storage, backups, and multi-instance deployment configuration.
- The multi-site ledger supports CSV (separate goods, goods-detail, receiver, summary, and import-template downloads; CSV has no worksheets), not XLSX. Hamali is not integrated into profit/cash-flow reporting.
- Existing integration tests expect a running configured service and some tests mutate tenant/trip records; inspect their host/data target before invoking them. `backend/tests/test_site_ops_units.py` is offline and uses synthetic data.

## Where to learn more

- Setup and local run: [README.md](README.md)
- Architecture and diagrams: [ARCHITECTURE.md](ARCHITECTURE.md)
- Required AI/maintainer process: [AI_CHECKLIST.md](AI_CHECKLIST.md)
- Versions and changelog: [VERSION.md](VERSION.md)
