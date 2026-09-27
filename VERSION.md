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

**v1.1.2** — 27 September 2026

## Changelog

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
