# System Storage Monitor

Angular 22 dashboard with a Node.js API, PostgreSQL identity/session storage, and the existing Python filesystem watcher. The watcher and JSONL format are preserved. Monitoring records remain on disk and are served only through authenticated API routes.

## Architecture and access

`monitor/storage_monitor.py` writes nested file events to `storage_events.jsonl`. The Node API reads that configured log and reports local drive usage. PostgreSQL stores users, role assignments, computer grants, audit events, and server-side sessions. Angular restores the session from `/api/auth/me`, signs in at `/api/auth/login`, and sends the session cookie plus a session-bound CSRF header on state-changing requests. The server checks the current active account and computer grant for every dashboard API request. UI guards improve navigation only; the API is the security boundary.

The role names are `Super Admin`, `Admin`, `IT Engineer`, and `Viewer`. All have read access to the dashboard when granted access to computer `local`. Super Admin-only API routes manage accounts, roles, computer registrations, computer grants, and audit review. Admins can edit the display metadata of assigned computers. There is no public account creation or monitoring-settings endpoint. Password recovery needs a verified email delivery provider before it can be safely added. `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `GET /api/admin/computers`, `POST /api/admin/computers`, `PUT|DELETE /api/admin/computers/:id/access/:userId`, and `GET /api/admin/audit` provide the administrative operations; all mutations require the session CSRF header.

## Local setup

Requirements: Node.js 20 or newer, Python 3.10 or newer, and PostgreSQL 14 or newer. `psql` is optional; migrations use the Node PostgreSQL driver. Copy `.env.example` to `.env`, set a long random `SESSION_SECRET` and database connection string, then create a database and a least-privilege application role. For example, in `psql` or the pgAdmin query tool as a database administrator:

```sql
CREATE ROLE storage_app LOGIN PASSWORD 'replace-with-a-generated-secret';
CREATE DATABASE storage_monitor OWNER storage_app;
```

Install dependencies and apply the schema:

```powershell
npm install
npm run db:migrate
```

Provision the first administrator from a trusted terminal. The command prompts interactively, hashes the password with Argon2id, and refuses to create another Super Admin:

```powershell
npm run provision-admin
```

Grant another user access only after creating them through a trusted administrative procedure. For example, to grant the read-only local monitored host to an existing user, run as a database administrator:

```sql
INSERT INTO user_computer_access(user_id, computer_id)
SELECT id, 'local' FROM users WHERE username = 'engineer';
```

To run locally, use separate terminals:

```powershell
python -m pip install watchdog pywin32
python monitor/storage_monitor.py "D:\\Projects"
npm run api
npm start
```

The watcher writes to `C:\ProgramData\StorageMonitor` when permitted. If Windows denies access, it falls back to `%LOCALAPPDATA%\StorageMonitor`; the API checks both locations and reads the most recently updated event log. Optionally set `STORAGE_MONITOR_LOG_DIR` in `.env` to choose a writable absolute log folder shared by the watcher and API. The API reads at most the last 8 MiB and returns at most 1,000 valid events; temporary-file entries are filtered before display.

Set `LOG_FILE` in the API environment to select a different JSONL file. The API never accepts a filesystem path from a dashboard request and never falls back to the bundled sample data. If no monitor log exists yet, the events API returns an empty list until the Python watcher creates one.

## Deployment

Build with `npm run build`; Angular output is under `dist/storage-monitor-dashboard/browser`. Serve it from a production static server behind HTTPS. Keep the API and PostgreSQL private; proxy `/api/` through the same public origin to the Node service. Do not expose `ng serve`, PostgreSQL, the Python watcher, or the API directly to the public network.

Set `NODE_ENV=production`, a unique high-entropy `SESSION_SECRET`, `DATABASE_URL`, `PGSSL=true`, and the actual `LOG_FILE`. PostgreSQL TLS certificate verification is required for the API and both database commands. Session cookies use the Secure flag in production; local HTTP development leaves it off so the browser can retain the session. Always use HTTPS in production. The API binds to `127.0.0.1` by default; set `HOST` to a private interface only when the reverse proxy is on another host. Set `TRUST_PROXY=true` only when exactly one trusted reverse proxy sits in front of the API and configure that proxy to overwrite forwarded headers. If using a separate frontend origin, add its exact origin to `TRUSTED_ORIGINS` and configure a deliberate CORS/cookie deployment; same-origin proxying is the supported default. Restrict firewall ingress to HTTPS at the proxy and private API/database traffic from the application host. Back up PostgreSQL and the watcher log under the organization's retention policy.

Example Caddy routing (serve the Angular build from the static directory):

```caddyfile
monitor.example.com {
  header {
    Content-Security-Policy "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'"
  }
  root * /srv/storage-monitor/dist/storage-monitor-dashboard/browser
  route /api/* {
    reverse_proxy 127.0.0.1:3100
  }
  try_files {path} /index.html
  file_server
}
```

Use a process manager with restart and graceful termination for the Node API. The Python monitor should run as a restricted service account with access only to configured watched roots and its log directory. For monitoring from a different computer, this project still needs an authenticated encrypted device-ingestion protocol; do not expose the watcher or JSONL share publicly.

## Troubleshooting

- **API exits at startup:** check `DATABASE_URL`, PostgreSQL reachability, and that `npm run db:migrate` completed.
- **Login unavailable:** create the initial admin using `npm run provision-admin`; verify the account is active and the login identifier is its username or normalized email.
- **Dashboard returns 403:** grant that user's access to the monitored computer row (`local`) or sign in with a Super Admin account.
- **CSRF error:** reload the page to obtain a fresh CSRF token; ensure the browser keeps same-origin cookies and the reverse proxy preserves the request origin and host.
- **Repeated login after refresh:** use HTTPS in production, verify proxy trust/cookie settings and avoid mixing hostnames or origins.
- **No file events:** confirm the watcher process is monitoring the intended roots and has write access to its log directory. The watcher falls back from ProgramData to `%LOCALAPPDATA%`; the API checks both locations automatically unless `LOG_FILE` is explicitly set.
- **Windows drives missing:** run the API on the Windows host with access to the drives; inaccessible or disconnected drives are intentionally omitted.

## Daily drive screenshot email

The Windows report script reads the same local drive collector as the dashboard, renders a PNG screenshot with Microsoft Edge headless, and sends it through your SMTP account. Add your provider's SMTP host, port, username, app password, sender, and recipient to the ignored local `.env`; do not commit or share `.env`. For port 587 use `SMTP_SECURE=false` (STARTTLS is required); for port 465 use `SMTP_SECURE=true`.

Preview the screenshot with `npm run report:preview`. After SMTP settings are filled in and the preview looks right, create a Windows Task Scheduler task with `npm run report:schedule`. It runs daily at 9:00 AM Windows local time (Asia/Kolkata on the configured workstation) while your Windows account is signed in. Send a one-time test with `npm run report:send`. The report is generated on the machine running the task; keep it powered on and connected to the SMTP server at the scheduled time.

To start the API, Angular dashboard, and Python watcher in a single terminal, run `npm run start:all`. The watcher observes all existing drive roots by default; set `MONITOR_ROOTS=D:\;E:\` in `.env` to limit it to specific roots (separate them with semicolons). If all SMTP settings are present, this command also registers or refreshes the daily email task. Press Ctrl+C to stop the API, dashboard, and watcher; the registered daily task remains in Windows Task Scheduler.

## Tests and limitations

Run `npm test -- --watch=false` for Angular unit tests, `npm run test:api` for backend policy tests, `npm run build` for the production frontend build, and `python -m unittest discover -s tests` for Python tests. End-to-end authentication tests need an isolated PostgreSQL test database and are not substituted with a production database. No production database, HTTPS certificate, mail provider, or remote device transport is included in the repository.
