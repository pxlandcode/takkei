CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('trainer', 'client')),
    trainer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_accounts_owner_check CHECK (
        (kind = 'trainer' AND trainer_id IS NOT NULL AND client_id IS NULL) OR
        (kind = 'client' AND client_id IS NOT NULL AND trainer_id IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_sessions_id_uuid CHECK (
        id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_trainer_id ON auth_accounts (trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_accounts_client_id ON auth_accounts (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
