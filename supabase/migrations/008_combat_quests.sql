-- Migration 008: Combat Logs & PvP Stats

CREATE TABLE IF NOT EXISTS combat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attacker_character_id UUID REFERENCES characters(id),
  target_character_id UUID REFERENCES characters(id),
  monster_id VARCHAR(64),
  damage INTEGER NOT NULL,
  damage_type VARCHAR(16) NOT NULL,
  is_crit BOOLEAN DEFAULT FALSE,
  ability_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_logs_attacker ON combat_logs(attacker_character_id, created_at DESC);

-- PvP statistics
CREATE TABLE IF NOT EXISTS player_pvp_stats (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_taken INTEGER DEFAULT 0,
  highest_kill_streak INTEGER DEFAULT 0,
  current_kill_streak INTEGER DEFAULT 0,
  pvp_rating INTEGER DEFAULT 1000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_pvp_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pvp stats"
  ON player_pvp_stats FOR SELECT USING (TRUE);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  level_required INTEGER DEFAULT 1,
  rewards JSONB DEFAULT '{}',
  objectives JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS character_quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL REFERENCES quests(id),
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','completed','failed')),
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(character_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_character_quests ON character_quests(character_id);
