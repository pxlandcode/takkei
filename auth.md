# Authentication and Session Architecture

This SvelteKit app now uses [Lucia v4](https://lucia-auth.com/) with the official PostgreSQL adapter. Legacy Rails authentication data is preserved for backwards compatibility while new logins and sessions are handled by Lucia.

## Database objects

The SQL migration in `scripts/20250215_add_lucia_auth.sql` adds two new tables:

- `auth_accounts` stores credentials for both trainers and clients. Each row references either `users.id` (trainers) or `clients.id` (clients) and keeps an Argon2id password hash plus optional metadata. Legacy `users` columns remain untouched so Rails can continue to read `salt`/`crypted_password`.
- `auth_sessions` stores Lucia session records. Session identifiers are UUID strings enforced via a check constraint and linked back to `auth_accounts`.

The migration also enables the `pgcrypto` extension (for `gen_random_uuid`) and adds indexes on trainer/client foreign keys for efficient lookups.

## Lucia configuration

The Lucia instance is created in `src/lib/server/lucia.ts` with the PostgreSQL adapter and a one-day default session lifetime. Sessions are generated with `crypto.randomUUID()` to guarantee opaque UUID values and the session cookie is set to `HttpOnly`, `Secure` (in production), and `SameSite=strict`.

`src/app.d.ts` registers Lucia's types so `event.locals.user` and `event.locals.session` are available throughout the app. The global `handle` in `src/hooks.server.ts` wires Lucia's `handleRequest`, adds role-aware authorization guards, and still runs the Paraglide i18n hook.

## Login flows

### Trainers

1. Lucia first attempts to locate an `auth_accounts` record for the submitted email.
2. If none exists, the legacy SHA-1 `users.salt`/`users.crypted_password` values are used for a one-time verification.
3. After successful legacy verification, a new Lucia account is created with an Argon2id hash while leaving the legacy columns intact. Subsequent logins use the Lucia hash and trigger a rehash when parameters change.

### Clients

Clients are expected to authenticate exclusively through Lucia. API endpoints that create or onboard clients (e.g. `/api/create-client`, `/api/signup`) now accept an optional password and create or update the corresponding `auth_accounts` entry with `kind = 'client'` pointing at `clients.id`.

## Sessions and cookies

- `src/routes/api/login/+server.ts` issues Lucia sessions and sets the cookie via `lucia.createSessionCookie`. The Remember Me checkbox toggles between 30-minute and 24-hour session expirations.
- `src/routes/api/logout/+server.ts` invalidates the active session and clears the cookie using Lucia's blank session cookie helper.
- A lightweight in-memory rate limiter in `src/lib/server/rate-limit.ts` throttles login attempts per IP and email to reduce brute force risk.

## Request lifecycle and authorization

`src/hooks.server.ts` enforces:

- Public access only for the login/register pages and `/api/login`.
- Trainer-only access to the existing dashboard and API routes.
- Client-only access to the new `/client` section.

Every other page or API route either redirects unauthenticated users to `/login` or forbids access when a role mismatch is detected.

## Frontend updates

- The root layout reads `locals.user` and exposes trainer or client data to stores.
- Trainers retain the existing dashboard experience.
- Clients are routed to the new `/client` view (see `src/routes/client`) which is isolated from the trainer UI.

Refer to the inline comments in the linked files for additional implementation details.
