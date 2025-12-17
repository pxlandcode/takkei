# booking_notes

SQL to manually create the booking_notes join table.

```sql
CREATE TABLE IF NOT EXISTS booking_notes (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_notes_note_id ON booking_notes(note_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_notes_booking_note ON booking_notes(booking_id, note_id);
```
