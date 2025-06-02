-- 1️⃣ Create target_kinds table (if missing)
CREATE TABLE IF NOT EXISTS target_kinds (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    rules JSONB,
    is_achievement BOOLEAN,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 2️⃣ Create targets table (if missing)
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    target INTEGER,
    achieved INTEGER,
    start_date DATE,
    end_date DATE,
    target_kind_id INTEGER REFERENCES target_kinds(id),
    user_ids INTEGER[],
    location_ids INTEGER[],
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 3️⃣ Create note_kinds table (if missing)
CREATE TABLE IF NOT EXISTS note_kinds (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 4️⃣ Add color column to locations (if missing)
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';

-- 5️⃣ Create event_types table (if missing)
CREATE TABLE IF NOT EXISTS event_types (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255)
);

-- 6️⃣ Add event_type_id column to events (if missing)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_type_id INTEGER;

-- 7️⃣ Insert default event types (skip if exists)
INSERT INTO event_types (type)
SELECT 'client'
WHERE NOT EXISTS (SELECT 1 FROM event_types WHERE type = 'client');

INSERT INTO event_types (type)
SELECT 'alert'
WHERE NOT EXISTS (SELECT 1 FROM event_types WHERE type = 'alert');

-- 8️⃣ Create events_done table (if missing)
CREATE TABLE IF NOT EXISTS events_done (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    done_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- 9️⃣ Create index on events_done (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_events_done_user_event'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_events_done_user_event ON events_done (user_id, event_id);
    END IF;
END$$;

-- 🔟 Add created_by column to events (if missing)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- 11️⃣ Ensure targets sequence
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'targets_id_seq'
          AND n.nspname = 'public'
    ) THEN
        CREATE SEQUENCE targets_id_seq OWNED BY targets.id;
        ALTER TABLE targets ALTER COLUMN id SET DEFAULT nextval('targets_id_seq');
        SELECT setval('targets_id_seq', (SELECT MAX(id) FROM targets));
    END IF;
END$$;

-- ✅ SAFE PRODUCTION MIGRATION COMPLETE
