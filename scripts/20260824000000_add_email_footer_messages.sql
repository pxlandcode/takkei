-- Adds editable rotating footer messages for styled emails.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260824000000_add_email_footer_messages.sql

BEGIN;

CREATE TABLE IF NOT EXISTS email_footer_messages (
    id BIGSERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_footer_messages_active
    ON email_footer_messages (active);

CREATE OR REPLACE FUNCTION set_updated_at_email_footer_messages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_footer_messages_updated_at ON email_footer_messages;
CREATE TRIGGER trg_email_footer_messages_updated_at
BEFORE UPDATE ON email_footer_messages
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_email_footer_messages();

INSERT INTO email_footer_messages (message, active)
SELECT E'En timme i veckan\nHela kroppen\nRepetera', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM email_footer_messages WHERE message = E'En timme i veckan\nHela kroppen\nRepetera'
);

INSERT INTO email_footer_messages (message, active)
SELECT 'Kontinuitet är nyckeln till träningsframgång', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM email_footer_messages WHERE message = 'Kontinuitet är nyckeln till träningsframgång'
);

INSERT INTO email_footer_messages (message, active)
SELECT E'Smärtfri\nSmidig\nStark\nSnabb\n(Snygg)', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM email_footer_messages WHERE message = E'Smärtfri\nSmidig\nStark\nSnabb\n(Snygg)'
);

COMMIT;
