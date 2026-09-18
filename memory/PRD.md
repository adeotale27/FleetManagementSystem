# Fleet Manager — Transport Business Management App (PRD)

## Original problem statement
Complete, simple, professional truck/transport management app for ONE local logistics business.
Single owner login. Sections: Dashboard, Trips & LR, Vehicles, Parties, Team, Finance, Reports, Settings.
No ERP complexity, no multi-company, no GPS/WhatsApp/payroll. Mobile-first usability.
User choices: simple owner login (owner/owner123), Google Maps key to be supplied later, INR + DD-MM-YYYY.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`, `ledger.py`, `auth.py`, `db.py`), MongoDB (motor), JWT + bcrypt.
- Frontend: React 18 + React Router + Tailwind + Recharts + lucide-react (`/app/frontend/src`).
- Money model: single `ledger` collection (entity_type = party/driver/employee/fuel_pump/partner) and
  `cashbook` collection (cash/bank/deewanji). EVERY balance (party outstanding, driver advance,
  fuel pump payable, deewanji cash, receivable aging) is derived — never typed. Cancel = reverse, never delete.

## Implemented (18-09-2026)
- Owner login + app shell (sidebar, global search, mobile bottom nav + quick-action sheet).
- Dashboard: trips/vehicles/money/collections/people stats, alerts, today's trips, receivables, recent entries; all drill-down.
- Trips: indoor (routes from Settings) & outdoor (address/map-ready picker), one-way/round trip,
  existing or temporary vehicle (optional save as permanent), driver/vehicle conflict checks, status flow, cancel+reverse.
- LR: created from trip with auto-prefill, SENDER auto-saved to Party master + autocomplete (mobile disambiguates),
  receiver manual, multi-item goods with totals, PAID / NOT PAID, optional details collapsed, professional print/download doc.
- Parties: list with outstanding, profile with ledger / LRs / payments, record payment, ledger export.
- Vehicles: fleet, documents (RC/Insurance/Permit/Fitness/PUC with Valid/Expiring/Expired), fuel + expense history, fuel pumps.
- Team: drivers + office team, advances/loans/pre-salary/repayment/deduction/salary paid, per-person ledger.
- Finance: overview + charts (money in/out, collection trend, expense pie, receivable aging),
  receivables with aging buckets, payables, collections, Deewanji day-wise + handover, payments, expenses, diesel, 3PL, cash & bank.
- Reports: 15 reports with date/search filters, CSV / Excel / PDF / print export.
- Settings: company + logo + LR terms, base locations, indoor routes, LR/trip numbering, due days,
  opening cash/bank, expense categories, payment modes, 3PL partners.

## Backlog
- P1: Google Maps key wiring (`REACT_APP_GOOGLE_MAPS_API_KEY`) to enable search + pin drop.
- P1: Edit existing trip/LR fields from UI (currently status + cancel only for trips).
- P2: Salary due accrual per month, maintenance-due alerts, attachment uploads for documents.
- P2: Trip profitability view (trip amount vs diesel + expenses).
