-- Adds read state, like reactions, comments, and pinned news.
-- Run manually, e.g.:
--   psql "$DATABASE_URL" -f scripts/20260825000000_add_news_interactions.sql

BEGIN;

ALTER TABLE news_items
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS news_item_reads (
    id BIGSERIAL PRIMARY KEY,
    news_item_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (news_item_id, user_id)
);

CREATE TABLE IF NOT EXISTS news_item_reactions (
    id BIGSERIAL PRIMARY KEY,
    news_item_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'like',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (news_item_id, user_id, reaction_type)
);

DO $$
DECLARE
    existing_constraint TEXT;
BEGIN
    SELECT conname
    INTO existing_constraint
    FROM pg_constraint
    WHERE conrelid = 'news_item_reactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%reaction_type%'
    LIMIT 1;

    IF existing_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE news_item_reactions DROP CONSTRAINT %I', existing_constraint);
    END IF;

    ALTER TABLE news_item_reactions ALTER COLUMN reaction_type SET DEFAULT 'like';
    DELETE FROM news_item_reactions old_reaction
    USING news_item_reactions new_reaction
    WHERE old_reaction.reaction_type = 'useful'
      AND new_reaction.reaction_type = 'like'
      AND old_reaction.news_item_id = new_reaction.news_item_id
      AND old_reaction.user_id = new_reaction.user_id;

    UPDATE news_item_reactions SET reaction_type = 'like' WHERE reaction_type = 'useful';

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'news_item_reactions'::regclass
          AND conname = 'news_item_reactions_reaction_type_check'
    ) THEN
        ALTER TABLE news_item_reactions
            ADD CONSTRAINT news_item_reactions_reaction_type_check
            CHECK (reaction_type IN ('like'));
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS news_item_comments (
    id BIGSERIAL PRIMARY KEY,
    news_item_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Interaction data is server-only. Application authorization happens in
-- SvelteKit before server-side pg queries.
ALTER TABLE news_item_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_item_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_item_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE news_item_reads FROM PUBLIC;
REVOKE ALL ON TABLE news_item_reactions FROM PUBLIC;
REVOKE ALL ON TABLE news_item_comments FROM PUBLIC;
REVOKE ALL ON SEQUENCE news_item_reads_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE news_item_reactions_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE news_item_comments_id_seq FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE news_item_reads FROM anon;
        REVOKE ALL ON TABLE news_item_reactions FROM anon;
        REVOKE ALL ON TABLE news_item_comments FROM anon;
        REVOKE ALL ON SEQUENCE news_item_reads_id_seq FROM anon;
        REVOKE ALL ON SEQUENCE news_item_reactions_id_seq FROM anon;
        REVOKE ALL ON SEQUENCE news_item_comments_id_seq FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE news_item_reads FROM authenticated;
        REVOKE ALL ON TABLE news_item_reactions FROM authenticated;
        REVOKE ALL ON TABLE news_item_comments FROM authenticated;
        REVOKE ALL ON SEQUENCE news_item_reads_id_seq FROM authenticated;
        REVOKE ALL ON SEQUENCE news_item_reactions_id_seq FROM authenticated;
        REVOKE ALL ON SEQUENCE news_item_comments_id_seq FROM authenticated;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_news_items_pinned_created_at
    ON news_items (pinned, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_item_reads_user_item
    ON news_item_reads (user_id, news_item_id);

CREATE INDEX IF NOT EXISTS idx_news_item_reactions_item_type
    ON news_item_reactions (news_item_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_news_item_comments_item_created_at
    ON news_item_comments (news_item_id, created_at);

-- Treat all news that exists when this migration runs as already read, so
-- trainers do not need to clear historical news manually.
INSERT INTO news_item_reads (news_item_id, user_id, read_at)
SELECT news_items.id, users.id, COALESCE(news_items.published_at, news_items.created_at, NOW())
FROM news_items
CROSS JOIN users
ON CONFLICT (news_item_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at_news_item_comments()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_news_item_comments_updated_at ON news_item_comments;
CREATE TRIGGER trg_news_item_comments_updated_at
BEFORE UPDATE ON news_item_comments
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_news_item_comments();

COMMIT;
