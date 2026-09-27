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
- [ ] For manager assignment/replacement, preserve creator/audit identities, revoke old access, hash credentials, and verify replacement/deactivation behavior. Default cross-site access to denied; grants must identify site and action.
- [ ] For legacy records without a site, implement a repeatable preview/report and explicit owner confirmation. Never silently choose or assign a default site.
- [ ] For a new API route, specify method/path, input/output shape, validation, authorization, error cases, and tenant ownership.
- [ ] For money-related work, identify the source document and exact ledger/cashbook effects. Reuse `backend/ledger.py`; derive displayed totals; cancel by reversing/marking records, never by deleting history.
- [ ] For trip expenses, preserve a source record linked to tenant/site/trip, record the authenticated actor and accountable party, and make ledger/cashbook postings idempotent. Test retry behavior, reversals/cancellation, and trip/dashboard totals.
- [ ] For ledger imports, match immutable IDs; validate the entire file before changes; enforce size/type/scope limits; preview discrepancies; require owner confirmation; protect source files; test idempotency and recovery. Escape spreadsheet formula prefixes in exports.
- [ ] For site money, use Decimal-safe values and append-only payment/reversal events. Distinguish recorded, reconciled, collected and outstanding amounts; do not treat informational hamali as collected bhada or a cost without an established accounting rule.
- [ ] For notification/error logging changes, distinguish validation errors from unexpected server failures, show actionable user-safe feedback with a reference ID for 5xx errors, and never persist request bodies, credentials, bearer tokens or private LR data in platform logs.
- [ ] For trips/LRs, verify timezone-based daily sequencing is atomic, unique under concurrency, and independent of mutable truck/receiver display labels.
- [ ] Consider existing data, duplicate submissions, cancel/edit behavior, date/number formats, mobile UX, empty/loading/error states, exports, permissions, and testability.
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
