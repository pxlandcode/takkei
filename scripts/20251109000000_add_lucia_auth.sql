-- Lucia authentication tables
CREATE TABLE IF NOT EXISTS auth_user (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('trainer', 'client')),
    trainer_id INTEGER REFERENCES users(id),
    client_id INTEGER REFERENCES clients(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_user_role_check CHECK (
        (kind = 'trainer' AND trainer_id IS NOT NULL AND client_id IS NULL) OR
        (kind = 'client' AND client_id IS NOT NULL AND trainer_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_trainer ON auth_user(trainer_id) WHERE trainer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_client ON auth_user(client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_unique_email ON auth_user(LOWER(email));

CREATE TABLE IF NOT EXISTS auth_key (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
    hashed_password TEXT,
    provider_id TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT auth_key_provider_unique UNIQUE (provider_id, provider_user_id)
);

CREATE TABLE IF NOT EXISTS auth_session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
    active_expires BIGINT NOT NULL,
    idle_expires BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id);
