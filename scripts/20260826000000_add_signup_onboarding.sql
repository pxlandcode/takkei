-- Durable administrator workflow for public signup submissions.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260826000000_add_signup_onboarding.sql

BEGIN;

CREATE TABLE IF NOT EXISTS signup_onboarding_cases (
	id BIGSERIAL PRIMARY KEY,
	status TEXT NOT NULL DEFAULT 'new'
		CHECK (status IN ('new', 'in_progress', 'waiting', 'completed', 'cancelled')),
	submitted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	provisional_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
	provisional_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
	provisional_package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
	resolved_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
	resolved_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
	resolved_package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
	client_resolution TEXT NOT NULL DEFAULT 'pending'
		CHECK (client_resolution IN ('pending', 'confirmed_new', 'merged')),
	customer_resolution TEXT NOT NULL DEFAULT 'pending'
		CHECK (customer_resolution IN ('pending', 'kept', 'merged', 'connected', 'not_required')),
	package_resolution TEXT NOT NULL DEFAULT 'pending'
		CHECK (package_resolution IN ('pending', 'kept', 'connected', 'not_required')),
	primary_assignment_resolution TEXT NOT NULL DEFAULT 'pending'
		CHECK (primary_assignment_resolution IN ('pending', 'selected', 'skipped')),
	booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
	waiting_note TEXT,
	completion_note TEXT,
	completed_at TIMESTAMPTZ,
	cancelled_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remove assignment fields if an earlier draft of this migration was already run.
DROP INDEX IF EXISTS idx_signup_onboarding_cases_assigned;
ALTER TABLE signup_onboarding_cases DROP COLUMN IF EXISTS assigned_user_id;

ALTER TABLE signup_onboarding_cases
	ADD COLUMN IF NOT EXISTS primary_assignment_resolution TEXT NOT NULL DEFAULT 'pending'
	CHECK (primary_assignment_resolution IN ('pending', 'selected', 'skipped'));

UPDATE signup_onboarding_cases
SET primary_assignment_resolution = 'skipped'
WHERE status = 'completed'
	AND primary_assignment_resolution = 'pending';

CREATE TABLE IF NOT EXISTS signup_onboarding_actions (
	id BIGSERIAL PRIMARY KEY,
	case_id BIGINT NOT NULL REFERENCES signup_onboarding_cases(id) ON DELETE CASCADE,
	actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	action_type TEXT NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_onboarding_cases_status_created
	ON signup_onboarding_cases (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signup_onboarding_actions_case
	ON signup_onboarding_actions (case_id, created_at DESC);

COMMIT;
