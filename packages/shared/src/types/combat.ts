export type DamageType = 'physical' | 'magical' | 'ranged' | 'true';

export interface CombatResult {
  damage: number;
  damageType: DamageType;
  isCrit: boolean;
  blocked: boolean;
  evaded: boolean;
}

export interface StatusEffect {
  id: string;
  type: 'buff' | 'debuff';
  stat?: string;
  value?: number;
  duration: number;
  expiresAt: number;
  iconKey: string;
  name: string;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  classes: string[];
  manaCost: number;
  cooldown: number;
  range: number;
  targetType: 'self' | 'enemy' | 'ally' | 'area';
  effects: AbilityEffect[];
  iconKey: string;
  animationKey: string;
  levelRequired: number;
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'teleport' | 'stealth' | 'aoe';
  damageType?: DamageType;
  baseDamage?: number;
  scalingStat?: string;
  scalingFactor?: number;
  value?: number;
  duration?: number;
  radius?: number;
}

export interface LootEntry {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  description: string;
  level: number;
  maxHp: number;
  attack: number;
  defence: number;
  magicResistance: number;
  moveSpeed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  xpReward: number;
  goldMin: number;
  goldMax: number;
  lootTable: LootEntry[];
  spriteKey: string;
  regions: string[];
  category: 'wildlife' | 'forest' | 'undead' | 'bandit' | 'elemental' | 'boss';
}

export interface Monster {
  id: string;
  definitionId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defence: number;
  x: number;
  y: number;
  region: string;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  targetPlayerId?: string;
  lastAttack?: number;
  spawnX: number;
  spawnY: number;
}
