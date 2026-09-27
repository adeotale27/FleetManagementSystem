# Fleet Manager release control

## Source of truth

- The product release version is the `Current version` value below. Git commits and tags track source history; this file tracks the app's release history and policy.
- Keep `frontend/package.json`'s `version` in sync with this file (without the leading `v`).
- A release entry must be added here for every app change set. Do not merge or publish an app change with stale version metadata or no changelog entry.
- Documentation changes that alter project guidance, architecture, product behavior, or contributor workflow are release changes too. Use a patch increment unless they introduce/describe an app feature.

## Version policy (Semantic Versioning)

The version format is `MAJOR.MINOR.PATCH`:

- **PATCH** (`1.1.1` → `1.1.2`): backwards-compatible bug fixes, maintenance, and documentation/governance changes that affect how the app is built or maintained.
- **MINOR** (`1.1.2` → `1.2.0`): every new backwards-compatible user-facing feature or integration. A genuinely new feature must never be merged without a version increment and release notes.
- **MAJOR** (`1.13.0` → `2.0.0`): incompatible API, data, security, workflow, or deployment changes that require consumers or operators to adapt.

For every change set: select the increment before implementation; update this file and `frontend/package.json`; add a dated changelog entry describing user-visible changes and relevant migration/compatibility notes; validate the implementation; then commit the complete change together. Do not reuse a released version. If one change set spans categories, use the highest applicable increment. Purely local experiments that are not retained in the repository do not constitute a release.

New features and architecture changes also require updates to [APP_SUMMARY.md](APP_SUMMARY.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [AI_CHECKLIST.md](AI_CHECKLIST.md) wherever their content is affected.

## Current version

**v1.13.0** — 27 September 2026

## Changelog

### v1.13.0 — 27 September 2026

- **Cross-device live data updates:** Successful authenticated writes increment a tenant-scoped revision in the platform database. Active clients check that revision every two seconds, broadcast changes between same-business tabs, and refresh their mounted dashboard, finance, report, trip and LR data without a page reload.
- **Tenant-safe polling:** The revision endpoint exposes only the signed-in user's business revision, disables response caching, and returns a revision header on successful writes. Existing canonical MongoDB records and finance calculations remain the source of truth; no business data is copied into the platform database.
- **Verification:** Added backend coverage for tenant revision scoping/publication and frontend coverage for active polling and cross-tab notification.

### v1.12.0 — 27 September 2026

- **Trip-linked Booking Reports ledger:** Selecting a booking in Booking Reports now loads its trip details and the trip's LR ledger directly in the report. The ledger loads LRs in bounded pages and allows owner edits to sender/receiver contact and identity fields, goods, containers/quantities, bhada and hamali.
- **Canonical persistence and finance:** Each save updates the canonical site LR through the existing tenant/site-scoped audited endpoint, and server-returned balances replace the displayed ledger/report values. Rent corrections made alongside an allowed receiver change now post against the resolved receiver party. Posted payments remain immutable; collections, outstanding and payment status remain server-calculated.
- **Verification:** Added UI coverage for opening a trip-scoped ledger and saving editable LR details/finance, plus a backend regression test confirming first bhada posted with a receiver change is credited to the resolved party.

### v1.11.0 — 27 September 2026

- **Editable Booking Reports ledger:** Added in-place per-LR editing for receiver, goods, container lines/quantities, bhada and hamali in the Booking Reports table. The screen saves through the existing scoped, audited site-LR update API.
- **Finance stays transaction-derived:** Updated canonical LR values are returned to the report so bhada, collected, outstanding and payment status display the backend calculation. Collected/payment status remain read-only; receiver identity and bhada changes must be saved separately to preserve correct party ledger posting.
- **Verification:** Added report UI coverage for canonical row updates and displaying recalculated finance fields.

### v1.10.0 — 27 September 2026

- **In-app trip ledger editing:** Added expandable editable LR rows on site-booking trip details. Owners and site managers granted `lrs:update` can update sender/receiver, goods, container types and quantities in the trip without downloading or re-uploading a CSV.
- **Permission and data safeguards:** LR edits use the existing tenant/site-scoped update API, preserve backend validation and audit history, and are reflected by booking finance/reports. Charge edits remain limited to owners or managers with both `lrs:update` and `finance:update`; closed trips must be reopened and reconciled/paid identity restrictions remain in force. Payment events are unchanged.
- **Verification:** Added frontend coverage for manager LR editing and for hiding the editor without `lrs:update`; existing owner charge editing remains covered.

### v1.9.3 — 27 September 2026

- **Daily booking ledger download:** Added a site/day CSV export containing all trips and LRs for the selected operating date, including goods, quantities, bhada, hamali, collected/outstanding amounts, payment status and payment details.
- **Manager permission:** Added the explicit `ledger:export` site permission and a plain-language checkbox in Booking access management. Newly assigned managers receive it by default; existing managers need the owner to grant it. Owners can always download the ledger. The API verifies tenant/site access and the export permission and enforces bounded daily record counts.
- **Verification:** Added daily multi-trip export content/scope checks, permission-denial coverage, and a manager UI download test.

### v1.9.2 — 27 September 2026

- **Manager booking resources:** Site managers with trip-create or trip-read permission can load shared vehicle and driver master records for booking assignment. The resource endpoint remains tenant- and assigned-site-scoped; managers without either permission are denied.
- **Independent resource loading:** The Booking Dashboard now loads vehicle/driver options separately from site trip lists and dashboard data, so a manager who can create bookings is not blocked from seeing assignment options when another read permission is unavailable. Any unavailable data is reported explicitly.
- **Verification:** Added backend authorization/resource-shape tests and a frontend regression test for manager booking creation with shared vehicle and driver choices.

### v1.9.1 — 27 September 2026

- **Booking Finance and Reports routing:** Moved owner-only Booking Finance and Booking Reports routes into the business-owner route set. Owners can open both pages directly; site managers continue to be redirected to their site workspace.
- **New-business empty states:** Confirmed zero-value Finance metrics and a zero-row Reports state are rendered when a business has no sites or booking activity.
- **Manager access clarity:** Grouped site permission checkboxes by dashboard, trips, LRs, and finance/payments with plain-language action labels and a clear site-specific explanation.
- **Manager passwords:** Removed the 12-character minimum and bcrypt 72-byte cutoff for new/reset manager passwords. New manager hashes use SHA-256 pre-hashing with bcrypt; existing bcrypt hashes remain verifiable. Passwords are still never stored or returned in plaintext; the newly set value is displayed once in the page for copying.
- **Verification:** Added direct-route role tests, fresh-business zero-state tests, grouped-permission UI coverage, and long/new plus legacy password-hash tests.

### v1.9.0 — 27 September 2026

- **Booking setup & access page:** Moved site creation/editing, manager assignment and permissions, legacy assignment tools, and booking categories out of the operational Booking Dashboard to a dedicated owner-only `/booking-setup` page. Added an owner dashboard shortcut; site managers cannot navigate to the page.
- **Office Team manager selection:** Site creation now lets the owner select an active Office Team member with a manager role, or add a new manager profile. When the selected profile has no login, the flow creates a separate site-manager login and reveals its temporary password once. Existing linked logins can be assigned to additional sites.
- **Identity linkage:** Site-manager platform accounts can retain a `team_member_id` link to a tenant Office Team profile. No credentials are stored on or copied into Team profiles; existing tenant/team records remain intact.
- **Dashboard focus and field labels:** Removed setup/access/category controls from the operational dashboard. Site-add manager selection uses the Team roster; site metadata remains clearly labeled.
- **Verification:** Added tests for owner-only navigation, manager-only Team selection, login creation/linkage, and temporary credential visibility.

### v1.8.1 — 27 September 2026

- **Owner-only Booking access management:** Separated site-manager assignment, permissions, manager register, password reset and deactivation into its own Booking Dashboard section. Site managers do not see this owner-only section.
- **Booking categories:** Moved goods/container category controls into their own separate section.
- **Selected-site form clarity:** The previously blank third field is the optional City. Added visible labels and helpful placeholders for the site name, location, city and time zone.
- **Compatibility:** Presentation-only change; no API, storage, or data migration changes.
- **Verification:** Added frontend checks for role separation, distinct section headings and the selected-site City field label.

### v1.8.0 — 27 September 2026

- **Manager account register:** Booking Dashboard owner settings now keep manager IDs, status and assigned sites visible in a dedicated register.
- **One-time temporary credentials:** A password is shown in the current page only after assignment or reset so the owner can copy/share it securely. Existing passwords cannot be retrieved; issue a reset to create a new temporary credential. Passwords remain bcrypt-hashed in platform storage and are never included in manager-list responses.
- **Existing-manager reassignment:** If the owner supplies a temporary password while assigning an existing manager, it is now hashed and applied; the password reset is recorded in the site audit log without recording the credential.
- **Compatibility:** No database schema, collection or migration change.
- **Verification:** Added manager-register and existing-manager password-hash regression coverage, plus a frontend test for ID/site listing and one-time reset display.

### v1.7.0 — 27 September 2026

- **Booking Finance and Reports:** Added owner-only booking-specific Finance and LR Reports screens. Booking Finance uses the existing site dashboard aggregation and reports query canonical site LR records with tenant/site scope, date filters, search and pagination, with CSV export for the rows currently loaded. These screens do not use or include industrial records.
- **Less cluttered Booking Dashboard:** Kept its main KPIs focused on booking activity and moved detailed collections, outstanding, expense and receiver/goods breakdowns to Booking Finance.
- **LR charge sheet:** Added a spreadsheet-style per-LR bhada/hamali editor on the owner’s site-trip page. Saves use the existing audited, validated LR update API and canonical `site_lrs` record; reconciled LRs remain locked, closed trips must be reopened, and bhada cannot be reduced below posted payments.
- **Compatibility and storage:** No new collection, database, dependency or migration. Existing `site_lrs`/`site_trips` remain the booking source of truth; the LR report is read-only and paginated.
- **Verification:** Added offline tests for tenant/site report-query scope, owner navigation boundaries, booking report/finance rendering and charge-sheet update requests. The write-enabled API workflow remains opt-in and requires a disposable test tenant.

### v1.6.0 — 27 September 2026

- **Separate booking and industrial workflows:** Booking Dashboard/site trips remain the daily small-goods flow; owner-only Industrial Trips, LRs, Finance and Reports no longer embed or quick-link into site booking records. Global industrial search and Quick Add actions are hidden on booking routes. Shared vehicle/driver/master data remains available.
- **Role boundary:** Industrial business APIs now allow only business owners. Site identity/site authorization remains available to site managers, while platform superadmins continue to use independently guarded platform APIs.
- **Financial isolation:** Industrial ledger balances/statements, cash positions, trip costs, expense lists/cancellation, vehicle expense context, cashbook and chart reads exclude site-tagged shared records. Site expenses cannot be cancelled through the industrial endpoint.
- **Compatibility:** Site and industrial trips/LRs remain in their existing tenant-local collections. Site expenses and postings continue using existing shared collections with `site_id`; no collection, tenant database, migration, or record reset was introduced.
- **Verification:** Focused offline backend authorization, financial-scope and site-operations tests passed (51); frontend suite passed (15 tests across 6 suites); production build completed. Live/write-enabled end-to-end tests were not run because the available local API was not confirmed to belong to this project or a disposable tenant.

### v1.5.0 — 27 September 2026

- **Premium presentation foundation:** Added shared brand-derived CSS/Tailwind tokens, refined surfaces and elevation, numeric typography, keyboard focus styling, and reduced-motion handling without changing the light forest-green/amber palette.
- **Navigation:** Refined the responsive owner sidebar and mobile navigation, made Trips and LRs directly addressable as separate tabs, and kept route selection accurate when other query parameters are present.
- **Booking Dashboard:** Added a more visual KPI/site/activity presentation, quick actions, selected-site drill-down, and responsive charts using site-dashboard data, including daily trip/LR counts and selected-period site totals. Currency charts retain their INR units.
- **Remaining business modules:** Applied the shared visual language to Trips/LR, Finance, Reports, Vehicles, Parties, Team, Settings, and their supporting details/forms while preserving existing API and accounting workflows.
- **Scope and compatibility:** Added a read-only `activity_by_date` aggregate to the site dashboard response; this requires no data migration, new collection, or dependency. Office and site trips/LRs remain distinct canonical record families; no data unification is implied.
- **Verification:** Frontend suite passed (13 tests), focused offline backend site-operations suite passed (39 tests), and production build completed. The write-enabled API workflow was not run. Browser review reached the login page, but the local API was unavailable, so authenticated owner-dashboard visual review could not be completed.

### v1.4.0 — 27 September 2026

- **Owner Trips & LR visibility:** Added an on-demand Site bookings panel for site-created trips and their LRs, with site/trip selection, pagination, CSV export, and links to the canonical site detail/print workflows. Existing office trip/LR screens and site-specific permissions remain unchanged; records are not copied and financial events are not duplicated.
- **Bookings Window Board clarity:** Kept the key site/trip/outstanding indicators visible while grouping detailed business analytics, alerts, filters, site setup, manager permissions, and booking categories into collapsed sections. Trip creation and the selected-site booking/LR context remain in the main workflow.
- **Owner landing/navigation:** Made Booking Dashboard the owner home and sidebar entry, redirected the former `/dashboard` page, and added date presets and quick actions. Total trip KPIs are now explicitly computed for the selected date/site/trip filters.
- **Compatibility and data safety:** No API schema, database, ledger, or storage migration is introduced. The panel reads the existing site-scoped endpoints only when opened and preserves tenant/site authorization.
- **Verification:** Frontend suite passed (13 tests), focused offline backend suite passed (48 tests), and the production build completed. No live MongoDB latency benchmark or migration was run.

### v1.3.1 — 27 September 2026

- **Startup compatibility:** Aligned the trip-expense idempotency index declaration with the existing named index in deployed business databases, so application startup reuses it instead of failing with `IndexKeySpecsConflict`. No records or indexes are dropped.
- **Window loading:** Lazy-loaded route page bundles, removed duplicate Bookings Window Board fetch cycles, and delayed Trips-page master/settings requests until the Trips tab is opened.
- **Trip list scaling:** Bounded related LR/expense/fuel aggregation work to the current page of trip IDs instead of grouping all matching tenant history for every list request.
- **Data safety:** No database reset, destructive migration, or storage-format rewrite is required. Existing tenant data remains in place.
- **Verification:** Backend regression tests and frontend tests/build; live database latency and production request timings remain deployment-specific and were not measured here.

### v1.3.0 — 27 September 2026

- **Operation feedback:** Added top-right confirmations for successful updates and actionable failure notices. Unexpected server failures include a reference ID and are retained in the platform error log for super-admin follow-up; sensitive request content is excluded.
- **Bookings Window Board:** Reframed the multi-site owner dashboard around bookings, with current site/trip/LR context and receiver-/goods-oriented outstanding summaries.
- **Trip and LR workflow:** Added optional sender/receiver phone numbers, faster LR print-after-create behavior with repeatable browser print, and clearer mobile-friendly owner/manager trip and LR screens.
- **Trip expense accountability:** Added trip-linked expenses using existing ledger/cashbook accounting and an auditable record of responsibility.
- **Structured ledger reports:** Kept the immutable-ID import template contract intact while making report CSVs easier to read and adding detailed goods/container rows with clear scope and amount units.

### v1.2.2 — 27 September 2026

- **Dashboard/site listing fix:** Preserved top-level MongoDB IDs in the site API serializer, resolving the `KeyError: '_id'` 500 shown by `/api/sites` and `/api/sites/system-dashboard` and restoring populated site selectors.
- **Trip assignments:** Added permission-checked tenant vehicle/driver choices, retained IDs plus trip snapshots, and added manual fallback. Managers and owners can edit assignments while the trip is open.
- **End-to-end coverage:** Added an opt-in workflow test for site/manager setup, trip and LR create/edit, payments, ledger export/import/reconciliation, and dashboard aggregation. It is disabled by default to prevent writing to an unintended live API.
- **Pylance diagnostics:** Fixed optional-value and untyped response issues in `site_ops.py` and removed unused imports/locals.

### v1.2.1 — 27 September 2026

- **Startup fix:** Made the unique payment reversal index match the sparse index already created in existing tenant databases, avoiding `IndexKeySpecsConflict` during backend startup.
- **Payment integrity:** Rejected balance-invalid payment events are now marked rejected and excluded from collected totals; owners can retry interrupted ledger/cashbook postings, and payment reversals can resume idempotently.
- **Payment UX:** Payment submissions reuse an idempotency key across retries, reset after success, display posting state, and explain the reversal-and-reentry correction workflow.
- **Authorization and dashboard consistency:** Finance editors can retrieve the current values they are permitted to change; site and system dashboards exclude rejected payment events from collection totals.
- **Verification:** Added offline regression tests for the deployed index specification and rejection of invalid payment balances.

### v1.2.0 — 27 September 2026

- **Multi-site operations:** Added business sites with stable IDs, unique codes, operating timezones and owner-managed lifecycle.
- **Roles and access:** Added site-manager accounts, explicit site/action grants, manager replacement/deactivation, and backend-enforced tenant/site authorization.
- **System Dashboard:** Added business-wide and site-specific operational/financial summaries, filters, alerts, activity, and drill-down.
- **Trips and LRs:** Added site-scoped daily trips and LRs with atomic numbering, multi-container booking, receiver duplicate confirmation, close/reopen controls, custom categories and printable customer LRs.
- **Ledger reconciliation:** Added per-trip versioned CSV exports and owner-only staged import preview/edit/confirmation, immutable-ID matching, idempotency and recovery state.
- **Payments:** Added auditable partial payment and reversal events; separated recorded rent, reconciled rent, actual collections, outstanding balances and hamali.
- **Migration and operations:** Added explicit legacy site-assignment preview/apply, tenant-local indexes, and timezone data dependency.
- **Documentation and tests:** Documented roles, routes, storage/security boundaries, migration, accounting caveats and architecture diagrams; added offline site-operation unit tests.
- **Compatibility/limitations:** Existing tenant-per-database and legacy APIs remain in place. Businesses must create a default site and explicitly apply legacy assignment. CSV uses separate files rather than workbook sheets; ledger originals still use local storage. Hamali remains informational.

### v1.1.2 — 27 September 2026

- **Documentation:** Added an end-to-end product summary, architecture and design diagrams, and a mandatory AI/maintainer change checklist.
- **Release process:** Established SemVer rules, required version synchronization, and a changelog entry for every retained app change set.
- **Metadata:** Aligned the frontend package version with the product release.

### v1.1.1 — 19 September 2026

- LR uses the business logo saved on upload, with initials when no logo exists.
- Prevented empty master requests such as `/api/masters/null`.
- Limited platform-owner navigation to Licences and Console; added the server error log view.
- Updated login branding and button styling; improved advance/repayment and export/PDF presentation.

### v1.1.0 — 19 September 2026

- Logo and owner-photo uploads save locally without a cloud key; business branding appears in the UI and LR.
- Added ProFleet branding and removed default-password prefill/display from login.
- Added temporary or permanent trip vehicles/drivers and trip-hire payment/due handling.
- Changed new tenant database names to readable business/owner-derived names.
- Improved small-screen LR actions and button styling.

### v1.0.0 — 18 September 2026

- First documented local-run release, including environment setup, roles, and tenant data separation.
- Added platform-owner seeding/configuration and platform licence-control navigation.
- Documented the FastAPI + MongoDB backend, React 18 frontend, transport-office workflows, and multi-tenant platform.
