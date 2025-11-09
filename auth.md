# Authentication and Session Guide

Takkei now uses [Lucia](https://lucia-auth.com) with the PostgreSQL adapter to manage accounts and sessions for both trainers (legacy `users` table) and clients (`clients` table). The legacy Ruby on Rails application keeps working untouched – legacy columns remain intact and trainers can continue to sign in there with the original SHA-1 hashes.

## Database additions

The additive SQL migration (`scripts/20251109000000_add_lucia_auth.sql`) introduces the three Lucia tables:

| Table | Purpose |
| --- | --- |
| `auth_user` | Stores every Lucia account. Each row contains a `kind` (`trainer` or `client`) plus either `trainer_id` or `client_id`, keeping a strict one-to-one link back to the legacy tables without modifying their schema. |
| `auth_key` | Holds credential material for each account. Password hashes use Argon2id and include a metadata JSON column for algorithm versioning. |
| `auth_session` | Stores active opaque session IDs (UUIDs) managed by Lucia. |

All tables are additive; no legacy column was changed so the Rails app continues to run against the same schema.

## Login behaviour

### Trainers

1. A Lucia account is looked up by email.
2. If it exists, the Argon2id password is verified and re-hashed when metadata indicates an older format.
3. If Lucia has no account yet, the login falls back to the legacy `users.salt` + `users.crypted_password` SHA‑1 validation.
4. Successful legacy validation migrates the trainer into Lucia by creating the `auth_user` + `auth_key` rows with a fresh Argon2id hash (rehash-on-login).
5. Rails still depends on the SHA‑1 columns, so they are never altered.

### Clients

Clients sign in exclusively through Lucia (`kind = 'client'`). Each account links to `clients.id`. If an account is missing the API responds with a 403 so the trainer can provision credentials without affecting Rails data.

### Rate limiting

A lightweight in-memory limiter throttles login attempts (IP + email) to five tries per ten minutes. Exceeding the budget returns HTTP 429.

## Sessions and cookies

- Successful logins call `lucia.createSession()` which inserts an opaque session row in `auth_session`.
- The returned cookie is applied with `HttpOnly`, `Secure`, and `SameSite=Strict`. A 24h lifespan is set when “remember me” is ticked; otherwise Lucia’s default expiry is used.
- Logout endpoints invalidate the Lucia session, set the blank session cookie, and clear `event.locals`.

## Request lifecycle in SvelteKit

`src/hooks.server.ts` wires Lucia’s request handler together with the existing Paraglide/i18n handle. For every request:

1. `event.locals.auth`, `event.locals.session`, and `event.locals.user` are populated.
2. Public routes (`/login`, `/api/login`, `/api/signup`) bypass auth.
3. All other API requests demand a valid session. Default routes are trainer-only; `/client` and `/api/client*` are client-only.
4. Unauthorised access returns 401/403 for APIs or redirects to the appropriate dashboard.

Root layout and page loads consume `locals.user`, fetch trainer roles when needed, and surface the correct UI:

- Trainers keep the existing dashboard.
- Clients are routed to `/client`, a lightweight dashboard stub tailored for future client features.

## Development notes

- Lucia is configured in `src/lib/server/auth.ts` using the shared PostgreSQL pool from `src/lib/db.js`.
- Password hashing uses `oslo`’s `Argon2id`. Metadata versioning lets future migrations upgrade hashes transparently.
- Remember to run the migration SQL against every environment that shares the Rails database before deploying the new code.

With this structure, both SvelteKit and Rails can co-exist: Lucia handles modern sessions while the legacy SHA‑1 columns continue serving the Rails app until it is ready to migrate.
