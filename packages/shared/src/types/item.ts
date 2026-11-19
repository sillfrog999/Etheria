export type ItemCategory =
  | 'resource' | 'weapon' | 'armor' | 'accessory'
  | 'tool' | 'consumable' | 'material' | 'questItem' | 'rareItem';

export type ItemRarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface ItemStatBonus {
  hp?: number;
  maxHp?: number;
  mana?: number;
  maxMana?: number;
  attack?: number;
  strength?: number;
  defence?: number;
  magicPower?: number;
  mobility?: number;
  carryWeight?: number;
}

export interface ItemRequirements {
  level?: number;
  class?: string[];
  skills?: Partial<Record<string, number>>;
}

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  stationRequired?: string;
  skillRequired?: string;
  skillLevel?: number;
  craftingTime: number;
  ingredients: CraftingIngredient[];
  resultQuantity: number;
}

export interface ConsumeEffect {
  type: 'heal' | 'mana' | 'stamina' | 'buff' | 'antidote';
  value?: number;
  duration?: number;
  buffType?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  subcategory?: string;
  rarity: ItemRarity;
  iconKey: string;
  stackLimit: number;
  weight: number;
  baseValue: number;
  equipmentSlot?: string;
  requirements?: ItemRequirements;
  stats?: ItemStatBonus;
  maxDurability?: number;
  tradable: boolean;
  craftingRecipe?: CraftingRecipe;
  consumeEffect?: ConsumeEffect;
}

export interface ItemInstance {
  instanceId: string;
  definitionId: string;
  quantity: number;
  durability?: number;
  quality?: number;
  enchantments?: string[];
  bound?: boolean;
  locked?: boolean;
  customProperties?: Record<string, unknown>;
}

export interface InventorySlot {
  slot: number;
  item: ItemInstance | null;
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
  mythic: '#e6cc80',
};
