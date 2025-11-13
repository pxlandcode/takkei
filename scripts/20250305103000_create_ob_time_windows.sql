-- Migration: create ob_time_windows table and seed defaults
-- Note: run manually in target database.

BEGIN;

CREATE TABLE IF NOT EXISTS ob_time_windows (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_minutes SMALLINT NOT NULL CHECK (start_minutes >= 0 AND start_minutes <= 1439),
    end_minutes SMALLINT NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 1440),
    weekday_mask INTEGER NOT NULL DEFAULT B'1111111'::int CHECK (weekday_mask >= 0 AND weekday_mask <= 127),
    include_holidays BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ob_time_windows_name_unique UNIQUE (name),
    CONSTRAINT ob_time_windows_range CHECK (start_minutes < end_minutes)
);

INSERT INTO ob_time_windows (name, start_minutes, end_minutes, weekday_mask, include_holidays, active)
VALUES
    ('Morgon OB', 0, 480, B'0111110'::int, TRUE, TRUE),
    ('Kväll OB', 1080, 1440, B'0111110'::int, TRUE, TRUE)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Down

BEGIN;
DROP TABLE IF EXISTS ob_time_windows;
COMMIT;
