
import type { NetworkPlayer, Monster, InventorySlot, ItemInstance } from '@etheria/shared';
import { MONSTER_DATABASE, getMonster } from '@etheria/game-data';
import type { Env } from '../config/env.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { REGIONS } from '@etheria/shared';

export interface ServerPlayer extends NetworkPlayer {
  socketId: string;
  accountId: string;
  lastMovement: number;
  inventory: InventorySlot[];
  equipment: Partial<Record<string, ItemInstance>>;
  gold: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  activeTrade?: string;
  lastAction: number;
}

export class GameStateManager {
  private players = new Map<string, ServerPlayer>();
  private socketToCharacter = new Map<string, string>();
  private monsters = new Map<string, Monster>();
  private activeTrades = new Map<string, unknown>();
  private persistQueue = new Set<string>();
  private env?: Env;
  private monsterUpdateHandler?: (monster: Monster) => void;
  private monsterAttackHandler?: (monster: Monster, player: ServerPlayer, damage: number) => void;

  private readonly TICK_MS = 50;
  private readonly PERSIST_INTERVAL_MS = 30000;
  private tickTimer: ReturnType<typeof setInterval>;
  private persistTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.tickTimer = setInterval(() => this.tick(), this.TICK_MS);
    this.persistTimer = setInterval(() => this.persistAll(), this.PERSIST_INTERVAL_MS);
  }

  setEnv(env: Env) {
    this.env = env;
  }

  setMonsterUpdateHandler(handler: (monster: Monster) => void) {
    this.monsterUpdateHandler = handler;
  }

  setMonsterAttackHandler(handler: (monster: Monster, player: ServerPlayer, damage: number) => void) {
    this.monsterAttackHandler = handler;
  }

  addPlayer(player: ServerPlayer) {
    this.players.set(player.characterId, player);
    this.socketToCharacter.set(player.socketId, player.characterId);
    console.log(`[GameState] Player joined: ${player.name} (${player.characterId})`);
  }

  removePlayer(socketId: string): string | undefined {
    const charId = this.socketToCharacter.get(socketId);

    if (charId) {
      this.persistQueue.add(charId);
      this.players.delete(charId);
      this.socketToCharacter.delete(socketId);
      console.log(`[GameState] Player left: ${charId}`);
    }

    return charId;
  }

  getPlayer(characterId: string): ServerPlayer | undefined {
    return this.players.get(characterId);
  }

  getPlayerBySocket(socketId: string): ServerPlayer | undefined {
    const charId = this.socketToCharacter.get(socketId);
    return charId ? this.players.get(charId) : undefined;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getNearbyPlayers(characterId: string, radius = 20): ServerPlayer[] {
    const player = this.players.get(characterId);
    if (!player) return [];

    return Array.from(this.players.values()).filter(p =>
      p.characterId !== characterId &&
      p.region === player.region &&
      Math.abs(p.x - player.x) <= radius &&
      Math.abs(p.y - player.y) <= radius
    );
  }

  getAllPlayersInRegion(region: string): ServerPlayer[] {
    return Array.from(this.players.values()).filter(p => p.region === region);
  }

  updatePlayerPosition(characterId: string, x: number, y: number, facing?: string) {
    const player = this.players.get(characterId);

    if (player) {
      if (Math.abs(x - player.x) > 10 || Math.abs(y - player.y) > 10) {
        return false;
      }

      player.x = x;
      player.y = y;

      if (facing) player.facing = facing as typeof player.facing;

      player.lastMovement = Date.now();
      this.persistQueue.add(characterId);

      return true;
    }

    return false;
  }

  teleportPlayer(characterId: string, region: string, x: number, y: number) {
    const player = this.players.get(characterId);
    if (!player) return false;
    player.region = region;
    player.x = x;
    player.y = y;
    player.lastMovement = Date.now();
    this.persistQueue.add(characterId);
    return true;
  }

  updatePlayerGold(characterId: string, gold: number) {
    const player = this.players.get(characterId);

    if (player) {
      player.gold = gold;
      this.persistQueue.add(characterId);
    }
  }

  updatePlayerHp(characterId: string, hp: number) {
    const player = this.players.get(characterId);

    if (player) {
      player.hp = Math.max(0, Math.min(hp, player.maxHp));
    }
  }

  setActiveTrade(tradeId: string, trade: unknown) {
    this.activeTrades.set(tradeId, trade);
  }

  getActiveTrade(tradeId: string): unknown {
    return this.activeTrades.get(tradeId);
  }

  removeActiveTrade(tradeId: string) {
    this.activeTrades.delete(tradeId);
  }

  addMonster(monster: Monster) {
    this.monsters.set(monster.id, monster);
  }

  getMonster(id: string): Monster | undefined {
    return this.monsters.get(id);
  }

  getMonstersInRegion(region: string): Monster[] {
    return Array.from(this.monsters.values()).filter(m => m.region === region);
  }

  ensureRegionMonsters(region: string, centerX: number, centerY: number): Monster[] {
    const existing = this.getMonstersInRegion(region);
    if (existing.length > 0) return existing;

    // Only regions with hostile encounter zones receive monsters. Aurelia is a safe city.
    const spawnTable: Record<string, string[]> = {
      greenfall: [
        'forest_wolf','forest_wolf','forest_wolf','forest_wolf',
        'giant_spider','giant_spider','giant_spider','giant_spider',
        'skeleton_warrior','skeleton_warrior',
        'goblin_scout','goblin_scout','goblin_scout','goblin_scout',
        'goblin_warrior','goblin_warrior','goblin_warrior','goblin_chieftain'
      ],
      silverwood: [
        'giant_spider','giant_spider','giant_spider','giant_spider','giant_spider',
        'forest_bear','forest_bear','forest_bear','forest_bear',
        'skeleton_warrior','skeleton_warrior','skeleton_warrior',
        'skeletal_mage','skeletal_mage','skeletal_mage','giant_spider'
      ],
      ashen_mountains: [
        'mountain_troll','mountain_troll','mountain_troll',
        'goblin_warrior','goblin_warrior','goblin_warrior','goblin_warrior','goblin_warrior',
        'skeletal_mage','skeletal_mage','skeletal_mage','skeletal_mage',
        'bandit_leader','bandit_leader','bandit_leader','bandit_leader','bandit_leader','bandit_leader'
      ],
      frostmere: [
        'ice_wolf','ice_wolf','ice_wolf','ice_wolf','ice_wolf','ice_wolf','ice_wolf','ice_wolf','ice_wolf',
        'ice_elemental','ice_elemental','ice_elemental','ice_elemental','ice_elemental','ice_elemental','ice_elemental'
      ],
      emberlands: Array.from({ length: 14 }, () => 'fire_demon'),
      the_void: [
        'void_wraith','void_wraith','void_wraith','void_wraith','void_wraith','void_wraith',
        'void_wraith','void_wraith','void_wraith','void_wraith','void_titan','void_titan'
      ]
    };

    const definitionIds = spawnTable[region] ?? [];
    const regionInfo = REGIONS[region];
    if (!regionInfo || definitionIds.length === 0) return [];

    const regionLabel: Record<string, string> = {
      greenfall: 'Greenfall',
      silverwood: 'Silverwood',
      ashen_mountains: 'Ashen Mountain',
      frostmere: 'Frostmere',
      emberlands: 'Emberlands',
      the_void: 'Void'
    };
    const label = regionLabel[region] ?? 'Wild';
    const bounds = regionInfo.bounds;

    definitionIds.forEach((definitionId, index) => {
      const definition = getMonster(definitionId);
      if (!definition || !definition.regions.includes(region)) return;

      // The committed monster library currently contains Puglin and generic Creature GLBs.
      // Keep names truthful to those models instead of calling a generic model a wolf, bear, etc.
      const displayName = definitionId.startsWith('goblin_')
        ? definition.name
        : `${label} Creature`;

      const angle = index * 2.399963229728653;
      const radius = 7 + (index % 5) * 2.2;
      const x = Math.max(bounds.minX + 3, Math.min(bounds.maxX - 3, centerX + Math.cos(angle) * radius));
      const y = Math.max(bounds.minY + 3, Math.min(bounds.maxY - 3, centerY + Math.sin(angle) * radius));
      const monster: Monster = {
        id: `${region}_${definition.id}_${index}_${Math.round(x)}_${Math.round(y)}`,
        definitionId: definition.id,
        name: displayName,
        level: definition.level,
        hp: definition.maxHp,
        maxHp: definition.maxHp,
        attack: definition.attack,
        defence: definition.defence,
        x,
        y,
        region,
        state: 'idle',
        spawnX: x,
        spawnY: y,
      };
      this.addMonster(monster);
    });

    return this.getMonstersInRegion(region);
  }

  ensureGreenfallMonsters(centerX: number, centerY: number): Monster[] {
    return this.ensureRegionMonsters('greenfall', centerX, centerY);
  }

  private tick() {
    for (const monster of this.monsters.values()) {
      if (monster.state === 'dead') continue;

      const definition = MONSTER_DATABASE[monster.definitionId];

      if (!definition) continue;

      const nearbyPlayer = Array.from(this.players.values()).find(p =>
        p.region === monster.region && p.hp > 0 &&
        Math.sqrt(
          Math.pow(p.x - monster.x, 2) +
          Math.pow(p.y - monster.y, 2)
        ) <= definition.aggroRange
      );

      if (nearbyPlayer && monster.state === 'idle') {
        monster.state = 'chase';
        monster.targetPlayerId = nearbyPlayer.characterId;
      } else if (!nearbyPlayer && monster.state === 'chase') {
        monster.state = 'idle';
        monster.targetPlayerId = undefined;
      }

      if ((monster.state === 'chase' || monster.state === 'attack') && monster.targetPlayerId) {
        const target = this.players.get(monster.targetPlayerId);

        if (target && target.hp > 0) {
          const dist = Math.sqrt(
            Math.pow(target.x - monster.x, 2) +
            Math.pow(target.y - monster.y, 2)
          );

          if (dist <= definition.attackRange) {
            monster.state = 'attack';
            const attackCooldown = Math.max(700, definition.attackCooldown * 1000);
            if (Date.now() - (monster.lastAttack ?? 0) >= attackCooldown) {
              monster.lastAttack = Date.now();
              const damage = Math.max(1, Math.floor(monster.attack * (0.9 + Math.random() * 0.2)));
              this.monsterAttackHandler?.(monster, target, damage);
            }
            this.monsterUpdateHandler?.(monster);
          } else if (dist > 0) {
            monster.state = 'chase';
            const dx = (target.x - monster.x) / dist;
            const dy = (target.y - monster.y) / dist;

            monster.x += dx * definition.moveSpeed * (this.TICK_MS / 1000);
            monster.y += dy * definition.moveSpeed * (this.TICK_MS / 1000);
            this.monsterUpdateHandler?.(monster);
          }
        } else {
          monster.state = 'idle';
          monster.targetPlayerId = undefined;
        }
      }

      const distFromSpawn = Math.sqrt(
        Math.pow(monster.x - monster.spawnX, 2) +
        Math.pow(monster.y - monster.spawnY, 2)
      );

      if (distFromSpawn > 20 && !monster.targetPlayerId) {
        monster.x += (monster.spawnX - monster.x) * 0.05;
        monster.y += (monster.spawnY - monster.y) * 0.05;
      }
    }
  }

  async persistPlayer(characterId: string): Promise<boolean> {
    const player = this.players.get(characterId);
    if (!player || !this.env) {
      console.error('[GameState] Cannot persist player: player or Supabase environment is missing.');
      return false;
    }

    try {
      const supabase = getSupabaseAdmin(this.env);
      const { data, error } = await supabase
        .from('characters')
        .update({
          pos_x: player.x,
          pos_y: player.y,
          region: player.region,
          gold: player.gold,
        })
        .eq('id', characterId)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        console.error(`[GameState] Failed to persist player ${characterId}:`, error ?? 'Character row was not updated.');
        return false;
      }

      this.persistQueue.delete(characterId);
      console.log(`[GameState] Persisted player ${characterId} in region ${player.region}`);
      return true;
    } catch (err) {
      console.error(`[GameState] Failed to persist player ${characterId}:`, err);
      return false;
    }
  }

  async persistAll(): Promise<void> {
    if (this.persistQueue.size === 0 || !this.env) return;

    const toSave = Array.from(this.persistQueue);

    for (const charId of toSave) {
      const saved = await this.persistPlayer(charId);
      if (!saved) {
        // Keep failed writes queued so the periodic persistence task can retry.
        this.persistQueue.add(charId);
      }
    }
  }

  destroy() {
    clearInterval(this.tickTimer);
    clearInterval(this.persistTimer);
  }
}
