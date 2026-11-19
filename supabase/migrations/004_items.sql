-- Migration 004: Items, Inventory, Equipment, Bank

-- Item instances (actual owned items)
CREATE TABLE IF NOT EXISTS item_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id VARCHAR(64) NOT NULL,
  owner_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  durability INTEGER,
  quality INTEGER DEFAULT 100,
  enchantments JSONB DEFAULT '[]',
  bound BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  custom_properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_quantity CHECK (quantity >= 0),
  CONSTRAINT valid_quality CHECK (quality >= 0 AND quality <= 100)
);

CREATE INDEX IF NOT EXISTS idx_item_instances_owner ON item_instances(owner_character_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_def ON item_instances(definition_id);

ALTER TABLE item_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own item instances"
  ON item_instances FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = owner_character_id AND c.account_id = auth.uid())
  );

-- Inventory slots (28 per character)
CREATE TABLE IF NOT EXISTS inventory_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number >= 0 AND slot_number < 28),
  item_instance_id UUID REFERENCES item_instances(id) ON DELETE SET NULL,
  UNIQUE(character_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory_slots(character_id);

ALTER TABLE inventory_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own inventory"
  ON inventory_slots FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );

-- Equipment slots
CREATE TABLE IF NOT EXISTS equipment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_name VARCHAR(32) NOT NULL CHECK (slot_name IN ('head','chest','legs','boots','gloves','mainHand','offHand','accessory1','accessory2')),
  item_instance_id UUID REFERENCES item_instances(id) ON DELETE SET NULL,
  UNIQUE(character_id, slot_name)
);

CREATE INDEX IF NOT EXISTS idx_equipment_character ON equipment_slots(character_id);

ALTER TABLE equipment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own equipment"
  ON equipment_slots FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );

-- Bank storage (up to 100 slots)
CREATE TABLE IF NOT EXISTS bank_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number >= 0 AND slot_number < 100),
  item_instance_id UUID REFERENCES item_instances(id) ON DELETE SET NULL,
  UNIQUE(character_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_character ON bank_items(character_id);

ALTER TABLE bank_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bank"
  ON bank_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM characters c WHERE c.id = character_id AND c.account_id = auth.uid())
  );
