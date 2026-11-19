-- Migration 007: World State & Chat

-- Persistent world modifications (player-made changes to the world)
CREATE TABLE IF NOT EXISTS world_modifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region VARCHAR(32) NOT NULL,
  chunk_x INTEGER NOT NULL,
  chunk_y INTEGER NOT NULL,
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  modification_type VARCHAR(32) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_mods_chunk ON world_modifications(region, chunk_x, chunk_y);

-- Resource node persistent state
CREATE TABLE IF NOT EXISTS resource_node_state (
  id VARCHAR(128) PRIMARY KEY,
  region VARCHAR(32) NOT NULL,
  depleted BOOLEAN DEFAULT FALSE,
  respawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_resource_nodes_respawn ON resource_node_state(respawn_at) WHERE depleted = TRUE;

-- Chat messages (persist last 24h)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel VARCHAR(32) NOT NULL,
  sender_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  sender_name VARCHAR(24),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, created_at DESC);

-- Auto-delete chat messages older than 24 hours (run via pg_cron if available)
-- SELECT cron.schedule('delete-old-chat', '0 * * * *', $$DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '24 hours'$$);

-- Guilds
CREATE TABLE IF NOT EXISTS guilds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(32) UNIQUE NOT NULL,
  description TEXT,
  leader_character_id UUID NOT NULL REFERENCES characters(id),
  emblem VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  member_count INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS guild_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  rank VARCHAR(32) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
