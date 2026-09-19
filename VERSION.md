# Version history

## v1.1.1 — 19 September 2026

- LR uses the **business** logo (saved on upload). No ProFleet mark on the receipt if a logo exists; initials if none.
- `/api/masters/null` stopped (hooks skip empty master names).
- Platform owner: Licences + Console only (error log of 500s). No office settings/trips.
- Login: white card around logo, solid Sign in button, light favicon.
- Advance / Repayment is a primary button; export/PDF styling updated.

## v1.1.0 — 19 September 2026

### Added / fixed
- Logo and owner photo upload now save on this computer (no Emergent cloud). 502 on `/api/upload` is gone.
- Business logo shows before the company name in the sidebar (and on phones). Owner photo shows beside the signed-in name.
- ProFleet brand on login, favicon, app icon, and LR print fallback.
- Login no longer pre-fills or prints default passwords.
- Create trip: add a vehicle **or** a driver that is not in the list — temporary (this trip) or permanent (saved to master from the trip date). This-trip hire can be paid now (expense + cash) or left due on the driver ledger. Permanent driver uses a monthly payment cycle.
- New tenant MongoDB name: `fleet_db_(BusinessName_OwnerName)` instead of a random id.
- Rounder gradient buttons; LR actions wrap on small screens.

## v1.0.0 — 18 September 2026

First documented local-run release of **Fleet Manager**.

### Added
- End-to-end README: what the app is, how to run it on a local machine, roles, env files, and how data is split per business.
- `backend/.env.example` and `frontend/.env.example` (copy to `.env`).
- Platform owner account is **seeded and kept in sync** with `PLATFORM_USERNAME` / `PLATFORM_PASSWORD` on every backend start (role `superadmin`).
- After platform-owner login, the app opens **`/platform`** (licence control). Sidebar lists Platform first.
- Login screen lists both accounts: business owner and platform owner.
- Business owner account remains: `OWNER_USERNAME` / `OWNER_PASSWORD` (role `owner`) for New Naidu Transport.

### Already in this codebase (v1 scope)
- FastAPI + MongoDB backend; React 18 frontend (Tailwind, Recharts).
- Business office: Dashboard, Trips & LR, Vehicles, Parties, Team, Finance, Reports, Settings.
- Platform console: issue licences, suspend/activate, reset owner password, per-business modules.
- Each licensed business has its own MongoDB database; users/licences live in `fleet_db_platform`.
