export const MAX_SKILL_LEVEL = 99;

export const SKILL_NAMES = [
  'mining', 'woodcutting', 'fishing', 'farming', 'hunting',
  'smithing', 'crafting', 'cooking', 'alchemy',
  'attack', 'strength', 'defence', 'magic', 'ranged',
  'agility',
] as const;

export type SkillName = typeof SKILL_NAMES[number];

function computeXpTable(): number[] {
  const table: number[] = [0, 0];
  for (let level = 2; level <= MAX_SKILL_LEVEL; level++) {
    table[level] = Math.floor(level + 300 * Math.pow(2, level / 7));
  }
  return table;
}

const XP_TABLE = computeXpTable();

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) total += XP_TABLE[l] ?? 0;
  return Math.floor(total / 4);
}

export function levelFromXP(xp: number): number {
  let level = 1;
  while (level < MAX_SKILL_LEVEL && xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function xpToNextLevel(xp: number): number {
  const current = levelFromXP(xp);
  if (current >= MAX_SKILL_LEVEL) return 0;
  return xpForLevel(current + 1) - xp;
}

export function levelProgress(xp: number): number {
  const current = levelFromXP(xp);
  if (current >= MAX_SKILL_LEVEL) return 1;
  const thisLevel = xpForLevel(current);
  const nextLevel = xpForLevel(current + 1);
  if (nextLevel === thisLevel) return 1;
  return (xp - thisLevel) / (nextLevel - thisLevel);
}

export const BASE_SKILLS: Record<SkillName, number> = {
  mining: 1, woodcutting: 1, fishing: 1, farming: 1, hunting: 1,
  smithing: 1, crafting: 1, cooking: 1, alchemy: 1,
  attack: 1, strength: 1, defence: 1, magic: 1, ranged: 1,
  agility: 1,
};

export const BASE_SKILL_XP: Record<SkillName, number> = {
  mining: 0, woodcutting: 0, fishing: 0, farming: 0, hunting: 0,
  smithing: 0, crafting: 0, cooking: 0, alchemy: 0,
  attack: 0, strength: 0, defence: 0, magic: 0, ranged: 0,
  agility: 0,
};

export const SKILL_XP_REWARDS: Record<string, Record<string, number>> = {
  mining: { copper_ore: 17, tin_ore: 17, iron_ore: 35, coal: 50, silver_ore: 40, gold_ore: 65, mithril_ore: 80, crystal_shards: 70, obsidian: 90, void_essence: 120 },
  woodcutting: { wood: 25, ancient_wood: 100 },
  fishing: { fish: 20 },
  farming: { herbs: 15, rare_herbs: 50, fiber: 10 },
  hunting: { hide: 20 },
  smithing: { copper_bar: 25, tin_bar: 20, iron_bar: 50, steel_bar: 100 },
  crafting: { leather: 30, cloth: 15, refined_wood: 15 },
  cooking: { cooked_meat: 30, cooked_fish: 40 },
  alchemy: { small_health_potion: 25, health_potion: 50, small_mana_potion: 25, mana_potion: 50, antidote: 35 },
};
