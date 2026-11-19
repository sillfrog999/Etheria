-- Migration 005: Trading System

-- Trade sessions
CREATE TABLE IF NOT EXISTS trade_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_character_id UUID NOT NULL REFERENCES characters(id),
  target_character_id UUID NOT NULL REFERENCES characters(id),
  state VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','accepted','active','confirming','completed','cancelled','expired','failed')),
  initiator_confirmed BOOLEAN DEFAULT FALSE,
  target_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trade_initiator ON trade_sessions(initiator_character_id);
CREATE INDEX IF NOT EXISTS idx_trade_target ON trade_sessions(target_character_id);
CREATE INDEX IF NOT EXISTS idx_trade_state ON trade_sessions(state);

-- Trade offer items
CREATE TABLE IF NOT EXISTS trade_offer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  offering_character_id UUID NOT NULL REFERENCES characters(id),
  item_instance_id UUID NOT NULL REFERENCES item_instances(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_offer_items_trade ON trade_offer_items(trade_id);

-- Trade gold offers
CREATE TABLE IF NOT EXISTS trade_gold_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  offering_character_id UUID NOT NULL REFERENCES characters(id),
  gold_amount INTEGER NOT NULL DEFAULT 0 CHECK (gold_amount >= 0),
  UNIQUE(trade_id, offering_character_id)
);

-- Immutable transaction ledger (append-only, gold audit trail)
CREATE TABLE IF NOT EXISTS currency_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id),
  amount INTEGER NOT NULL,
  reason VARCHAR(64) NOT NULL,
  reference_id UUID,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_character ON currency_ledger(character_id, created_at DESC);

ALTER TABLE currency_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own ledger"
  ON currency_ledger FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );

-- Prevent updates/deletes on the ledger
CREATE RULE no_update_ledger AS ON UPDATE TO currency_ledger DO INSTEAD NOTHING;
CREATE RULE no_delete_ledger AS ON DELETE TO currency_ledger DO INSTEAD NOTHING;
