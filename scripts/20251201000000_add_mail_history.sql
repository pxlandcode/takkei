-- Migration: Add mail_history table for email logging
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20251201000000_add_mail_history.sql

BEGIN;

CREATE TABLE IF NOT EXISTS mail_history (
    id BIGSERIAL PRIMARY KEY,
    sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_email TEXT,
    recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL,
    header TEXT,
    subheader TEXT,
    body_html TEXT,
    body_text TEXT,
    sent_from JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_mail_history_sent_at_desc ON mail_history (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_history_sender_user_id ON mail_history (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_mail_history_recipients_gin ON mail_history USING GIN (recipients);

COMMIT;
