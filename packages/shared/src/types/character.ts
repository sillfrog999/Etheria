export type CharacterClass = 'mage' | 'fighter' | 'assassin' | 'ranger';

export type CharacterModelId = 'elf_female' | 'elf_male' | 'orc_female' | 'orc_male';

export type EquipmentSlot =
  | 'head' | 'chest' | 'legs' | 'boots' | 'gloves'
  | 'mainHand' | 'offHand' | 'accessory1' | 'accessory2';

export interface CharacterStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  attack: number;
  strength: number;
  defence: number;
  magicPower: number;
  mobility: number;
  carryWeight: number;
  maxCarryWeight: number;
}

export interface CharacterSkills {
  mining: number;
  woodcutting: number;
  fishing: number;
  farming: number;
  hunting: number;
  smithing: number;
  crafting: number;
  cooking: number;
  alchemy: number;
  attack: number;
  strength: number;
  defence: number;
  magic: number;
  ranged: number;
  agility: number;
}

export interface SkillXP {
  mining: number;
  woodcutting: number;
  fishing: number;
  farming: number;
  hunting: number;
  smithing: number;
  crafting: number;
  cooking: number;
  alchemy: number;
  attack: number;
  strength: number;
  defence: number;
  magic: number;
  ranged: number;
  agility: number;
}

export interface CharacterAppearance {
  modelId: CharacterModelId;
  bodyType: number;
  hairStyle: number;
  hairColor: string;
  skinTone: string;
  faceStyle: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z?: number;
  region: string;
}

export interface Character {
  id: string;
  accountId: string;
  name: string;
  class: CharacterClass;
  level: number;
  experience: number;
  stats: CharacterStats;
  skills: CharacterSkills;
  skillXP: SkillXP;
  gold: number;
  position: WorldPosition;
  region: string;
  appearance: CharacterAppearance;
  createdAt: string;
  lastLogin: string;
}
