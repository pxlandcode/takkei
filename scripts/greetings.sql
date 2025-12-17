-- Greetings table and seed for toggleable greetings
-- Audiences are constrained to a Postgres enum to avoid typos
DO $$ BEGIN
    CREATE TYPE greeting_audience_enum AS ENUM ('client', 'user', 'both');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS greetings (
    id serial PRIMARY KEY,
    message text NOT NULL,
    icon text,
    active boolean NOT NULL DEFAULT TRUE,
    audience greeting_audience_enum NOT NULL DEFAULT 'both', -- 'client', 'user', or 'both'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure column exists when updating an existing table
ALTER TABLE greetings
    ADD COLUMN IF NOT EXISTS audience greeting_audience_enum NOT NULL DEFAULT 'both';

-- If the column existed as text, convert it to the enum safely
-- Drop any text default first to avoid cast errors, then set a new enum default.
ALTER TABLE greetings
    ALTER COLUMN audience DROP DEFAULT;

ALTER TABLE greetings
    ALTER COLUMN audience TYPE greeting_audience_enum
    USING (CASE LOWER(audience)
              WHEN 'client' THEN 'client'::greeting_audience_enum
              WHEN 'user' THEN 'user'::greeting_audience_enum
              ELSE 'both'::greeting_audience_enum
          END);

ALTER TABLE greetings
    ALTER COLUMN audience SET DEFAULT 'both';

CREATE INDEX IF NOT EXISTS idx_greetings_active ON greetings (active);

CREATE OR REPLACE FUNCTION set_updated_at_greetings()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_greetings_updated_at ON greetings;
CREATE TRIGGER trg_greetings_updated_at
BEFORE UPDATE ON greetings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_greetings();

INSERT INTO greetings (message, icon, active, audience) VALUES
    ('Hej, {name}!', '👋', TRUE, 'both'),
    ('TAKKEI ❤️ DIG!', '', TRUE, 'both'),
    ('Nu kör vi!', '🚗', TRUE, 'user'),
    ('Du är bäst!', '💪', TRUE, 'both'),
    ('Du är en', '🌟', TRUE, 'client')
ON CONFLICT DO NOTHING;
