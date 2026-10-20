# Accounts: Vercel Functions + Neon

The recommended deployment is Vercel static pages + a same-origin Better Auth Function at `/api/auth/*` + Neon PostgreSQL. No separate VM is required. PDF compression and comparison remain entirely local and work without an account; downloads require a fresh authenticated session. There is no PDF upload endpoint. PostgreSQL stores account metadata, password hashes, sessions, verification/OAuth and rate-limit records, never PDFs.

The download gate opens the existing login dialog without replacing the workspace. Same-page email sign-in closes the gate and unlocks downloading. Before Google navigation or sending email verification/recovery callbacks, the app commits the original/output blobs and mode to IndexedDB, then includes only a random workspace resume ID in the callback URL. It restores blobs into new object URLs on return, never reuses stale blob URLs and never recompresses just to recover state. Each tab has an independent resume ID unless a callback explicitly carries one. Reset/replacement clears the saved record; expired records are not restored after one hour. Storage failure blocks external login navigation with an actionable message while leaving email login and the in-memory result intact. See `tests/download-gate.test.mjs` for mocked login/callback coverage; it does not authenticate a real Google account.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the production procedure. Credentials are server-only. Never use `VITE_*` for secrets or put production credentials on Preview deployments.

## Configuration

Set a pooled Neon TLS `DATABASE_URL`, a cryptographically random `BETTER_AUTH_SECRET` of at least 32 characters and an exact HTTPS `PUBLIC_SITE_URL` origin. Authentication can fall back to configured `SITE_URL`, but explicitly set both to the same canonical origin. Production database URLs require `sslmode=require`, `verify-ca` or `verify-full`; do not globally disable TLS verification.

The Function lazily initializes the PostgreSQL pool. Missing or incomplete configuration leaves `/api/auth/config` available with `configured: false`; other account requests return unavailable. The UI disables unconfigured actions while compression remains available. Missing SMTP disables email registration/reset, while Google can work independently. Provider credentials must be configured in pairs. No account or mail success is simulated.

Migration is an explicit operator action, never part of a build, request handler or GitHub CI. From the root run `node --env-file=.env.local scripts/migrate.mjs` with an ignored local environment file. `DIRECT_DATABASE_URL` is preferred for migration, falling back to `DATABASE_URL`. Back up and review schema changes first. Preserve the auth secret across redeployments.

## Google and email

Create a Google OAuth Web application and configure the consent screen. For site `https://compresser.example`, use JavaScript origin `https://compresser.example` and redirect URI `https://compresser.example/api/auth/callback/google`. Set both Google credentials server-side. The callback is on the website, not Neon. Do not trust arbitrary Preview domains. Account linking is disabled; preexisting users may need their original sign-in method.

SMTP requires a real provider and validated sender. Port 587 uses STARTTLS; 465 implicit TLS. Configure SPF/DKIM/DMARC and test actual inbox and spam delivery. Passwords require at least 8 characters; email registration requires verification; password reset revokes existing sessions. UI and emails default to French, with English for requests from `/en/`. Mail locale is request-scoped and language return paths are preserved.

Cookies are host-only, HttpOnly, SameSite=Lax and Secure in production. Origin checks and database-backed rate limits are enabled. Only on Vercel infrastructure (`VERCEL=1`) does the Function use the platform client-IP header; outside it falls back to socket identity. Do not blindly trust arbitrary forwarded headers.

## Local and optional self-hosting

For local accounts, install the independent server dependencies and use development/test credentials, local PostgreSQL and `PUBLIC_SITE_URL=http://localhost:5178`. Migrate before running `server/index.js`. Start Vite with `ACCOUNT_DEV_PROXY=http://127.0.0.1:3001`. Never use production data for tests.

`server/compose.yml` remains an optional standalone account service + private PostgreSQL deployment. Copy configuration to `server/.env`, including `POSTGRES_PASSWORD`, then run `docker compose --env-file .env -f compose.yml up -d --build` from `server/`. Back up the `accounts_db` volume. Put HTTPS in front of loopback port 3001; never expose PostgreSQL publicly. The default Vercel Function connects directly to Neon: `AUTH_SERVER_URL` is not used. Self-hosting requires explicitly replacing the direct Function route with an appropriate reverse proxy; optional `TRUSTED_PROXY_SECRET` belongs to that separate ingress setup. The standalone service can use `ALLOW_INSECURE_LOCAL_DATABASE=true` only for its validated localhost/isolated Docker database connection; this exemption never applies on Vercel or to public databases. Neon always requires TLS.

## Verification and operations

Tests use real Better Auth and disposable PGlite/captured SMTP transport, not production credentials. They do not prove real Google, Neon, SMTP, HTTPS or backup behavior. Before launch verify registration → mail → verification → login → session → logout and recovery → old-session invalidation, then separately real Google login.

Monitor API errors, SMTP delivery and Neon quota. Redact passwords, cookies, OAuth codes, verification/reset query strings and database URLs. Never log filenames or file previews. The app emits only fixed operational events and random identifiers for server, mail and database errors. Failed auth-context startup is retried on the next request rather than permanently cached. See [MONITORING.md](MONITORING.md) for health checks and external alert setup, and [OPERATIONS.md](OPERATIONS.md) for encrypted backups, retention and restore drills.

Users can request deletion from My account, type a confirmation and receive a one-hour email link. The same user must still be signed in when opening it. Until confirmation no data is deleted; confirmation removes the active user, linked sign-ins and all sessions. It never deletes the user's Google account or device files. SMTP must be available; deletion is disabled when it is not. Contact for account/privacy requests: zhihaosong168@gmail.com. Reapply deletions made since an older backup before reopening a restored service. No external monitor or recurring cloud backup is created merely by installing the repository.
