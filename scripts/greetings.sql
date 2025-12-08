-- Greetings table and seed for toggleable greetings
CREATE TABLE IF NOT EXISTS greetings (
    id serial PRIMARY KEY,
    message text NOT NULL,
    icon text,
    active boolean NOT NULL DEFAULT TRUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

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

INSERT INTO greetings (message, icon, active) VALUES
    ('Hej, {name}!', '👋', TRUE),
    ('TAKKEI ❤️ DIG!', '', TRUE),
    ('Nu kör vi!', '🚗', TRUE),
    ('Du är bäst!', '💪', TRUE),
    ('Du är en', '🌟', TRUE)
ON CONFLICT DO NOTHING;
