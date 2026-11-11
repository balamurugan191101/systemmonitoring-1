# Security notes

- Never commit `.env`, database credentials, real session secrets, log data, or user credentials. Rotate any secret that may have been exposed.
- Use a private PostgreSQL network, a least-privilege database role, encrypted connections where supported, backups, and monitored patching.
- Production uses HttpOnly, Secure, SameSite=Strict session cookies, server-side PostgreSQL sessions, session ID regeneration on login, an 8-hour default expiry, and a 30-day expiry only when explicitly selected.
- Mutating authentication endpoints require a session-bound CSRF token. Login failures are generic and rate limited. Password hashes use Argon2id. Account activity and role are refreshed from PostgreSQL for protected requests.
- Audit records omit passwords, cookies, session identifiers, and tokens. Review audit table access and retention as security-sensitive data.
- Storage reporting is read-only. Super Admin-only API routes manage users, roles, computer registrations, computer grants, and audit review. Admins can edit metadata only for assigned computers. Mutations validate inputs, require CSRF tokens, and write audit records. There is no public registration route or monitoring-settings mutation route.
- Serve only over HTTPS in production and proxy the API through the same origin. Do not trust arbitrary forwarded headers or expose PostgreSQL, the API, or the watcher to the public internet.
- Provision the initial Super Admin from an authorized host using `npm run provision-admin`. The utility refuses a second initial Super Admin. Administrative account recovery must be performed through a controlled database operator procedure.
