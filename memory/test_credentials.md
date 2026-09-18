# Test credentials — Fleet Manager (multi-tenant ready)

## Platform owner (super admin — licence control)
- URL: /login then /platform
- username: `superadmin`
- password: `super123`

## Business owner — New Naidu Transport (Mr Priyanshu Naidu)
- username: `owner` / password: `owner123`
- alternate login: `priyanshu` / password: `owner123`

Notes:
- Users live in MongoDB `fleet_db_platform.users`; businesses (licences) in `fleet_db_platform.tenants`.
- Each business gets its own database: primary tenant `naidu` → `fleet_db`; new tenants → `fleet_db_<tenant_id>`.
- Env keys: OWNER_USERNAME / OWNER_PASSWORD / PLATFORM_USERNAME / PLATFORM_PASSWORD in `/app/backend/.env`.
