-- Migration 006: Marketplace & Economy

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_character_id UUID NOT NULL REFERENCES characters(id),
  item_instance_id UUID NOT NULL REFERENCES item_instances(id),
  definition_id VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit INTEGER NOT NULL CHECK (price_per_unit > 0),
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','sold','cancelled','expired')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_listings(status, definition_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON marketplace_listings(seller_character_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_expires ON marketplace_listings(expires_at) WHERE status = 'active';

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON marketplace_listings FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can view own listings"
  ON marketplace_listings FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = seller_character_id AND c.account_id = auth.uid())
  );

-- Economy transactions log
CREATE TABLE IF NOT EXISTS economy_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_type VARCHAR(32) NOT NULL CHECK (transaction_type IN ('trade','marketplace_sale','marketplace_purchase','npc_purchase','npc_sale','loot','quest_reward')),
  buyer_character_id UUID REFERENCES characters(id),
  seller_character_id UUID REFERENCES characters(id),
  item_definition_id VARCHAR(64),
  quantity INTEGER,
  gold_amount INTEGER NOT NULL DEFAULT 0,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_transactions_buyer ON economy_transactions(buyer_character_id);
CREATE INDEX IF NOT EXISTS idx_economy_transactions_seller ON economy_transactions(seller_character_id);
