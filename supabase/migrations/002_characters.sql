-- Migration 002: Characters

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(24) UNIQUE NOT NULL,
  class VARCHAR(16) NOT NULL CHECK (class IN ('mage','fighter','assassin','ranger')),
  level INTEGER NOT NULL DEFAULT 1,
  experience INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 100,
  region VARCHAR(32) NOT NULL DEFAULT 'greenfall',
  pos_x FLOAT NOT NULL DEFAULT 16,
  pos_y FLOAT NOT NULL DEFAULT 16,
  appearance JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 999),
  CONSTRAINT valid_gold CHECK (gold >= 0),
  CONSTRAINT valid_name CHECK (name ~ '^[A-Za-z][A-Za-z0-9_]{2,23}$')
);

CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id);
CREATE INDEX IF NOT EXISTS idx_characters_region ON characters(region);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own characters"
  ON characters FOR SELECT USING (auth.uid() = account_id);

CREATE POLICY "Users can insert own characters"
  ON characters FOR INSERT WITH CHECK (auth.uid() = account_id);

CREATE POLICY "Users can update own characters"
  ON characters FOR UPDATE USING (auth.uid() = account_id);
