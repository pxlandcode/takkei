-- Adds editable settings fields for training pass types.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260824010000_add_booking_content_settings.sql

BEGIN;

ALTER TABLE booking_contents
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Training';

UPDATE booking_contents
SET icon = CASE
    WHEN LOWER(TRIM(kind)) IN ('gymnastics', 'gymnastik') THEN 'Gymnastics'
    WHEN LOWER(TRIM(kind)) IN ('mobility', 'mobilitet') THEN 'Mobility'
    ELSE 'Training'
END
WHERE icon IS NULL
   OR icon = 'Training'
   OR TRIM(icon) = '';

ALTER TABLE booking_contents
    DROP CONSTRAINT IF EXISTS booking_contents_icon_check;

ALTER TABLE booking_contents
    ADD CONSTRAINT booking_contents_icon_check
    CHECK (icon IN (
        'Training',
        'Dumbbell',
        'Gymnastics',
        'Mobility',
        'Running',
        'Trophy',
        'GraduationCap',
        'ShiningStar'
    ));

CREATE INDEX IF NOT EXISTS idx_booking_contents_active
    ON booking_contents (active);

CREATE OR REPLACE FUNCTION set_updated_at_booking_contents()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_contents_updated_at ON booking_contents;
CREATE TRIGGER trg_booking_contents_updated_at
BEFORE UPDATE ON booking_contents
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_booking_contents();

COMMIT;
