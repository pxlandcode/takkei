-- Adds tokenized no-login calendar subscription feeds for clients.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260818000000_add_client_calendar_subscriptions.sql

BEGIN;

CREATE TABLE IF NOT EXISTS client_calendar_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ
);

-- Token material is server-only. Keep this table inaccessible to public/database
-- browser roles; application authorization happens in SvelteKit before server-side pg queries.
ALTER TABLE client_calendar_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE client_calendar_subscriptions FROM PUBLIC;
REVOKE ALL ON SEQUENCE client_calendar_subscriptions_id_seq FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE client_calendar_subscriptions FROM anon;
        REVOKE ALL ON SEQUENCE client_calendar_subscriptions_id_seq FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE client_calendar_subscriptions FROM authenticated;
        REVOKE ALL ON SEQUENCE client_calendar_subscriptions_id_seq FROM authenticated;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_calendar_subscriptions_one_active
    ON client_calendar_subscriptions (client_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_calendar_subscriptions_client_id
    ON client_calendar_subscriptions (client_id);

CREATE INDEX IF NOT EXISTS idx_client_calendar_subscriptions_active_lookup
    ON client_calendar_subscriptions (id, nonce)
    WHERE revoked_at IS NULL;

COMMIT;
