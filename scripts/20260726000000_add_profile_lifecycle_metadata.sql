-- Migration: Add GDPR lifecycle metadata for clients and customers.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260726000000_add_profile_lifecycle_metadata.sql

BEGIN;

CREATE TABLE IF NOT EXISTS gdpr_profile_lifecycle (
	id BIGSERIAL PRIMARY KEY,
	profile_type TEXT NOT NULL CHECK (profile_type IN ('client', 'customer')),
	client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
	customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
	gdpr_deleted_at TIMESTAMPTZ,
	gdpr_deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	gdpr_delete_token TEXT,
	merged_into_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
	merged_into_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT gdpr_profile_lifecycle_subject_check CHECK (
		(
			profile_type = 'client'
			AND client_id IS NOT NULL
			AND customer_id IS NULL
			AND merged_into_customer_id IS NULL
		)
		OR
		(
			profile_type = 'customer'
			AND customer_id IS NOT NULL
			AND client_id IS NULL
			AND merged_into_client_id IS NULL
		)
	)
);

ALTER TABLE gdpr_profile_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gdpr_profile_lifecycle_client
	ON gdpr_profile_lifecycle (client_id)
	WHERE profile_type = 'client';

CREATE UNIQUE INDEX IF NOT EXISTS idx_gdpr_profile_lifecycle_customer
	ON gdpr_profile_lifecycle (customer_id)
	WHERE profile_type = 'customer';

CREATE INDEX IF NOT EXISTS idx_gdpr_profile_lifecycle_deleted_at
	ON gdpr_profile_lifecycle (gdpr_deleted_at);

CREATE INDEX IF NOT EXISTS idx_gdpr_profile_lifecycle_merged_client
	ON gdpr_profile_lifecycle (merged_into_client_id)
	WHERE profile_type = 'client';

CREATE INDEX IF NOT EXISTS idx_gdpr_profile_lifecycle_merged_customer
	ON gdpr_profile_lifecycle (merged_into_customer_id)
	WHERE profile_type = 'customer';

COMMIT;
