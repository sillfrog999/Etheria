-- Migration 003: Character Stats & Skills

CREATE TABLE IF NOT EXISTS character_stats (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  mana INTEGER NOT NULL DEFAULT 50,
  max_mana INTEGER NOT NULL DEFAULT 50,
  stamina INTEGER NOT NULL DEFAULT 100,
  max_stamina INTEGER NOT NULL DEFAULT 100,
  attack INTEGER NOT NULL DEFAULT 5,
  strength INTEGER NOT NULL DEFAULT 5,
  defence INTEGER NOT NULL DEFAULT 5,
  magic_power INTEGER NOT NULL DEFAULT 5,
  mobility INTEGER NOT NULL DEFAULT 5,
  carry_weight INTEGER NOT NULL DEFAULT 0,
  max_carry_weight INTEGER NOT NULL DEFAULT 100
);

ALTER TABLE character_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats"
  ON character_stats FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );

-- Skills table (one row per skill per character)
CREATE TABLE IF NOT EXISTS character_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_name VARCHAR(32) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  UNIQUE(character_id, skill_name),
  CONSTRAINT valid_skill_level CHECK (level >= 1 AND level <= 99),
  CONSTRAINT valid_xp CHECK (xp >= 0)
);

CREATE INDEX IF NOT EXISTS idx_skills_character ON character_skills(character_id);

ALTER TABLE character_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skills"
  ON character_skills FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );

-- Character ability loadouts
CREATE TABLE IF NOT EXISTS character_ability_loadouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL CHECK (slot_index >= 0 AND slot_index < 12),
  ability_id VARCHAR(64),
  UNIQUE(character_id, slot_index)
);

ALTER TABLE character_ability_loadouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own loadouts"
  ON character_ability_loadouts FOR ALL USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );
