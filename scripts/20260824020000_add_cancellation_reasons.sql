-- Adds editable cancellation reasons for booking cancellation flows.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260824020000_add_cancellation_reasons.sql

BEGIN;

CREATE TABLE IF NOT EXISTS cancellation_reasons (
    id BIGSERIAL PRIMARY KEY,
    value TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancellation_reasons_label_unique
    ON cancellation_reasons (LOWER(TRIM(label)));

CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_active
    ON cancellation_reasons (active);

CREATE OR REPLACE FUNCTION set_updated_at_cancellation_reasons()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cancellation_reasons_updated_at ON cancellation_reasons;
CREATE TRIGGER trg_cancellation_reasons_updated_at
BEFORE UPDATE ON cancellation_reasons
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_cancellation_reasons();

INSERT INTO cancellation_reasons (value, label, active) VALUES
    ('Rebook', 'Flyttat träningen', TRUE),
    ('Family', 'Familj', TRUE),
    ('Work', 'Arbete', TRUE),
    ('Travel', 'Resa', TRUE),
    ('Illness', 'Sjukdom', TRUE),
    ('Injury', 'Skada', TRUE),
    ('Injury Takkei', 'Skada på Takkei', TRUE),
    ('Injury external', 'Skada utanför Takkei', TRUE),
    ('No_show', 'Dök inte upp', TRUE),
    ('Other', 'Övrigt', TRUE),
    ('Unknown', 'Vet ej', TRUE)
ON CONFLICT (value) DO NOTHING;

COMMIT;
