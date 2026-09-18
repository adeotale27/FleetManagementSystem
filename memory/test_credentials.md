# Test Credentials

## Owner login (single user)
- URL: app root `/login`
- Username: `owner`
- Password: `owner123`
- Seeded on backend startup from `OWNER_USERNAME` / `OWNER_PASSWORD` in `/app/backend/.env` (bcrypt hashed, idempotent).

No other logins exist (single-business app by design).
