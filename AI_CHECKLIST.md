# AI and maintainer checklist

Follow this checklist for every retained change to Fleet Manager. Do not treat this file as optional release guidance.

## 1. Orient before editing

- [ ] Read [README.md](README.md) for setup and current operator instructions.
- [ ] Read [APP_SUMMARY.md](APP_SUMMARY.md) for product intent, roles, business rules, and current gaps.
- [ ] Read the relevant sections of [ARCHITECTURE.md](ARCHITECTURE.md) and inspect the corresponding source files and callers.
- [ ] Read [VERSION.md](VERSION.md) and check both `VERSION.md` and `frontend/package.json` to identify the current app release.
- [ ] Inspect `git status` and the diff before edits. Preserve pre-existing user changes; do not discard or overwrite unrelated work.
- [ ] Never read, print, commit, or copy real `.env`, credentials, tokens, tenant data, or uploaded documents. Use `.env.example` and synthetic test data.

## 2. Trace the behavior and plan the complete change

- [ ] Search existing helpers, UI patterns, endpoint conventions, schema fields, tests, and docs before adding a duplicate implementation.
- [ ] Trace the feature end-to-end: screen/form → API client → route → auth/tenant dependency → persistence/ledger/storage → response → display/report.
- [ ] For latency reports, inspect browser request waterfalls and server/database query scope before changing storage. Bound aggregations to requested page IDs, select only needed fields, keep list endpoints paginated, and avoid sequentially awaiting independent reads when semantics permit.
- [ ] For tenant-scoped code, confirm every read/write is routed through the authenticated tenant database. Keep platform-wide data limited to platform records.
- [ ] For site-scoped code, verify backend authorization on every endpoint using the authenticated tenant, active site assignment, and required action permission. Never trust client-supplied role/business/site/owner IDs. Ensure list, detail, search, export, upload and download paths all enforce scope.
- [ ] Keep daily site bookings (`site_trips`, `site_lrs`) separate from owner-only industrial Trips/LRs (`trips`, `lrs`) in navigation, details, finance and reports. Do not copy/mirror records or create cross-workflow postings; shared master data is allowed.
- [ ] Site trip creation may reference tenant-shared vehicles/drivers. Ensure managers authorized for `trips:create` can load the minimal assignable master-data fields while requests remain scoped to their assigned site and tenant; do not require unrelated trip-list read permission to populate creation forms.
- [ ] For daily booking ledger exports, scope trips, LRs, and payments to the authenticated tenant/site and selected operating date; require owner access or the explicit site-level `ledger:export` grant. Bound result counts, formula-neutralize CSV text, and keep industrial records out.
- [ ] Site booking expenses may use shared `expenses`, `ledger` and `cashbook` collections but must carry `site_id`. Scope every industrial read/aggregate/profile/report to exclude site-tagged rows; scope booking queries by authenticated tenant, `business_id` and `site_id`.
- [ ] Enforce industrial business APIs with the owner dependency, site APIs with site authorization, and platform APIs with the superadmin dependency. Platform users must not inherit tenant business access; verify each role at the backend, not just in navigation.
- [ ] For manager assignment/replacement, preserve creator/audit identities, revoke old access, hash credentials, and verify replacement/deactivation behavior. Default cross-site access to denied; grants must identify site and action.
- [ ] Never persist or return recoverable manager passwords. New manager passwords use SHA-256 pre-hashing plus bcrypt; preserve verification for legacy direct-bcrypt hashes. Show a temporary credential only immediately after assignment/reset in page memory; verify owner manager-list responses exclude password/hash fields and document the reset path for lost credentials. Manager passwords must be non-empty; explain that short passwords are weak.
- [ ] For legacy records without a site, implement a repeatable preview/report and explicit owner confirmation. Never silently choose or assign a default site.
- [ ] For a new API route, specify method/path, input/output shape, validation, authorization, error cases, and tenant ownership.
- [ ] For money-related work, identify the source document and exact ledger/cashbook effects. Reuse `backend/ledger.py`; derive displayed totals; cancel by reversing/marking records, never by deleting history.
- [ ] For cross-workflow finance changes, audit all reads and mutations of shared `ledger`, `cashbook` and `expenses`; test that industrial balances, cash positions, trip costs, profiles, Finance and Reports exclude site-tagged postings and that cancellation cannot mutate a site expense.
- [ ] For trip expenses, preserve a source record linked to tenant/site/trip, record the authenticated actor and accountable party, and make ledger/cashbook postings idempotent. Test retry behavior, reversals/cancellation, and trip/dashboard totals.
- [ ] For ledger imports, match immutable IDs; validate the entire file before changes; enforce size/type/scope limits; preview discrepancies; require owner confirmation; protect source files; test idempotency and recovery. Escape spreadsheet formula prefixes in exports.
- [ ] For site money, use Decimal-safe values and append-only payment/reversal events. Distinguish recorded, reconciled, collected and outstanding amounts; do not treat informational hamali as collected bhada or a cost without an established accounting rule.
- [ ] For booking receipts and inline ledger edits, persist only to canonical `site_trips`/`site_lrs` through site-scoped APIs. Preserve atomic server-side trip/LR numbering, receipt idempotency, trip association, audit history, and open-trip/reconciliation/payment-history safeguards. Do not move or delete historical records.
- [ ] Record creator login ID, login, name/role snapshot and timestamp for new booking records and manager/tenant logins. Audit events must capture actor ID and timestamp, remain owner-only, and never expose creator metadata in manager-facing booking responses.
- [ ] On the booking UI, keep only Dashboard, Receipts and Ledger as primary options. Trip assignment details are optional and inherited by receipts. Keep sender/receiver addresses optional, expose five goods rows by default, and retain original text separately from editable Hindi values.
- [ ] Enforce owner or site `lrs:update` access for receipt details and Bhada/Hamali edits. Keep site/tenant scope on all list/detail/update/void/export paths. Return authoritative saved values; never permit a crafted request to reassign another site's trip or LR. Store charge editor identity/timestamp internally, expose only the A/M role marker in the ledger, and keep full audit details owner-only.
- [ ] Keep Booking Finance and Booking Audit owner-only in both routes and API authorization. Derive grand total from canonical active site LR Bhada + Hamali, distinguish posted Bhada collections/outstanding from unpriced/unreconciled rows, and persist payment-promise follow-ups with actor/time audit.
- [ ] Derive total rent server-side as Bhada + Hamali using Decimal-safe calculations. Keep payment and reversal events append-only and separate from charges; do not treat a charge as a collected payment. Keep receipt-print charge visibility aligned with the approved customer-facing print contract and existing finance-read permission; never expose internal payment information.
- [ ] Ledger filters, print and CSV/XLSX exports must operate on authorized canonical site records. Test saved-data export, multiple goods rows, formula neutralization, date/site scoping, workbook structure and charge permission. Void receipts through an audited process; never silently delete financial history.
- [ ] Keep legacy booking finance, report, reconciliation and payment APIs for existing consumers unless all consumers are proven obsolete. The redesigned booking navigation must not expose their former complex screens, and no site data may leak into industrial Finance/Reports.
- [ ] For notification/error logging changes, distinguish validation errors from unexpected server failures, show actionable user-safe feedback with a reference ID for 5xx errors, and never persist request bodies, credentials, bearer tokens or private LR data in platform logs.
- [ ] For app-wide live updates, increment only the authenticated tenant's revision after a successful API write; keep the revision endpoint authenticated, uncached and tenant-scoped. Verify active `useFetch` and direct-fetch screens refresh on remote revision changes, same-business tabs receive notifications, failed sync is surfaced/retried, and business records/finance remain sourced from canonical tenant data. Protect unsaved edits from being silently overwritten by remote refreshes.
- [ ] For trips/LRs, verify timezone-based daily sequencing is atomic, unique under concurrency, and independent of mutable truck/receiver display labels.
- [ ] Consider existing data, duplicate submissions, cancel/edit behavior, date/number formats, mobile UX, empty/loading/error states, exports, permissions, and testability.
- [ ] Keep the desktop booking ledger fitted to the available window without horizontal scrolling; stack Hindi under its English name and omit sender/receiver addresses from ledger views and exports.
- [ ] For frontend work, inspect the current brand tokens and shared UI primitives first. Reuse the shared light-theme palette, typography, spacing, focus, elevation, and reduced-motion rules; do not create a competing visual system or add heavyweight 3D/chart dependencies without evidence they are needed.
- [ ] Keep chart series, filters, captions, units, and tooltips semantically aligned with the API data actually returned. Never substitute sample values for production data; label the data source and date range where appropriate.
- [ ] For navigation changes, verify desktop and mobile routes, feature-flag visibility, active-route states (including query parameters), keyboard focus, and manager/owner role boundaries.
- [ ] Keep owner-only site-manager permissions and account controls in the distinct Booking access management section; keep category setup separate and verify field labels are visible for optional site metadata.
- [ ] Group manager permission checkboxes into named capabilities with plain-language labels and explain that each saved grant applies only to the selected site.
- [ ] Keep site creation, manager assignment/permissions, legacy assignment and booking categories on owner-only `/booking-setup`; keep operational dashboard focused. When linking an Office Team manager, store only the Team profile ID on the separate platform login, preserve password hashing, and verify site-manager routes cannot access setup.
- [ ] Treat existing business data as valuable: never reset/drop a tenant database for a suspected performance problem. Prefer compatible indexes and additive migrations; run `explain`/latency measurements on representative data before proposing storage rewrites.
- [ ] If behavior, scope, compatibility, data migration, or external-service behavior is materially ambiguous, ask the user before choosing between reasonable alternatives.

## 3. Select and apply the release version

- [ ] Every retained app change set gets a new release version and a dated `VERSION.md` changelog entry.
- [ ] Use **PATCH** for compatible fixes, maintenance, and documentation/governance changes; **MINOR** for every backwards-compatible new feature/integration; **MAJOR** for breaking API, schema, security, workflow, or deployment changes.
- [ ] When a change spans categories, choose the highest applicable increment. Never reuse a released version.
- [ ] Update `VERSION.md` current version/changelog and `frontend/package.json` version together; keep the numeric versions identical.
- [ ] Explain user-visible additions/changes/fixes and any migration, compatibility, or operational implications in the changelog.
- [ ] Do not claim a feature is released, working, or tested unless the source and verification support that claim.

## 4. Update all affected surfaces

- [ ] Update [APP_SUMMARY.md](APP_SUMMARY.md) if product purpose, role behavior, feature scope, rules, or limitations change.
- [ ] Update [ARCHITECTURE.md](ARCHITECTURE.md) for any change to components, request/data flow, tenant boundary, storage, APIs/contracts, integrations, runtime configuration, or user navigation.
- [ ] Update its Mermaid diagrams in the same change when their depicted flow changes; add a dated architecture change note for architecture-affecting work.
- [ ] Update [README.md](README.md) when setup, configuration, operation, test commands, or user-facing navigation changes.
- [ ] Update tests and relevant fixtures for changed behavior. Avoid documenting credentials; use synthetic/local test identities.
- [ ] For multi-site changes, cover business/site isolation, manager assignment and revocation, numbering, trip lifecycle, CSV scope/duplicate/idempotency/recovery, payment arithmetic, printable privacy, and migration where applicable.
- [ ] For site/trip/LR workflows, test site serialization and dashboard selectors, vehicle/driver dropdown and manual-entry paths, manager and owner trip edits, multiple LRs, ledger posting/export/import, payment events and dashboard totals as one end-to-end flow. Run write-enabled acceptance tests only against an explicitly disposable API/tenant.
- [ ] For workflow separation, test owner/site-manager/superadmin access, absence of site rows from industrial Trips/LRs/Finance/Reports, and correct site-scoped booking results. Never run write-enabled checks against an unverified or production API.
- [ ] For the replacement booking workspace, test trip creation without vehicle/driver, selected-trip receipt association, optional sender, five default goods rows, goods descriptions, Hindi original/correction persistence, server-derived total rent, repeat print without duplicate creation, inline ledger autosave/conflict behavior, and scoped `.xlsx` export. Test site and charge permissions on the backend.
- [ ] For CSV exports, test exact headers and grouping grain, scope and unit labels, formula-injection handling, and confirm detailed line rows do not multiply LR-level money totals. Keep report exports distinct from the stable import-template contract.
- [ ] For LR printing, test create-to-print navigation, repeat print/save-PDF controls, readable A4 output, and mobile browser/OS print behavior. Do not promise device-specific printer pairing beyond browser support.
- [ ] Keep older changelog entries intact; append a new release entry rather than silently rewriting release history.

## 5. Verify before declaring completion

- [ ] Run the smallest relevant existing test/build/lint command; expand validation if targeted checks reveal an issue.
- [ ] The frontend has `npm run build`. Backend API tests require a running API and test-specific configuration; inspect `backend/tests/test_multitenant_features.py` before running. `scripts/smoke.py` also requires a running API.
- [ ] Check formatting/syntax and inspect validation output; do not claim a pass if a command was not run or could not complete.
- [ ] Review the final diff for accidental `.env`, credentials, uploads, generated files, unrelated edits, stale version values, and missing changelog/docs updates.
- [ ] Report changed files, version increment, tests/build run and results, and any remaining limitation.

## Stop conditions

Stop and ask for direction instead of guessing if a change requires a destructive data migration, alters tenant isolation or role boundaries, changes financial accounting semantics, exposes uploaded files, introduces a production integration/credential requirement, or has incompatible user-facing behavior that has no clearly established policy.
