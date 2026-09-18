# Version history

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
