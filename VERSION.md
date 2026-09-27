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
- **MAJOR** (`1.9.0` → `2.0.0`): incompatible API, data, security, workflow, or deployment changes that require consumers or operators to adapt.

For every change set: select the increment before implementation; update this file and `frontend/package.json`; add a dated changelog entry describing user-visible changes and relevant migration/compatibility notes; validate the implementation; then commit the complete change together. Do not reuse a released version. If one change set spans categories, use the highest applicable increment. Purely local experiments that are not retained in the repository do not constitute a release.

New features and architecture changes also require updates to [APP_SUMMARY.md](APP_SUMMARY.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [AI_CHECKLIST.md](AI_CHECKLIST.md) wherever their content is affected.

## Current version

**v1.3.1** — 27 September 2026

## Changelog

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
