
import type { NetworkPlayer, Monster, InventorySlot, ItemInstance } from '@etheria/shared';
import { MONSTER_DATABASE, getMonster } from '@etheria/game-data';
import type { Env } from '../config/env.js';
import { getSupabaseAdmin } from '../db/supabase.js';

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

  ensureGreenfallMonsters(centerX: number, centerY: number): Monster[] {
    const region = 'greenfall';
    const existing = this.getMonstersInRegion(region);
    if (existing.length > 0) return existing;

    const spawnPoints = [
      { definitionId: 'forest_wolf', dx: 7, dy: 3 },
      { definitionId: 'goblin_scout', dx: -6, dy: 5 },
      { definitionId: 'giant_spider', dx: 3, dy: -8 },
      { definitionId: 'forest_wolf', dx: -9, dy: -4 },
    ];

    for (const point of spawnPoints) {
      const definition = getMonster(point.definitionId);
      if (!definition || !definition.regions.includes(region)) continue;

      const x = centerX + point.dx;
      const y = centerY + point.dy;
      const monster: Monster = {
        id: `greenfall_${point.definitionId}_${Math.round(x)}_${Math.round(y)}`,
        definitionId: definition.id,
        name: definition.name,
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
    }

    return this.getMonstersInRegion(region);
  }

  private tick() {
    for (const monster of this.monsters.values()) {
      if (monster.state === 'dead') continue;

      const definition = MONSTER_DATABASE[monster.definitionId];

      if (!definition) continue;

      const nearbyPlayer = Array.from(this.players.values()).find(p =>
        p.region === monster.region &&
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

      if (monster.state === 'chase' && monster.targetPlayerId) {
        const target = this.players.get(monster.targetPlayerId);

        if (target) {
          const dist = Math.sqrt(
            Math.pow(target.x - monster.x, 2) +
            Math.pow(target.y - monster.y, 2)
          );

          if (dist <= definition.attackRange) {
            monster.state = 'attack';
          } else if (dist > 0) {
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

  async persistAll(): Promise<void> {
    if (this.persistQueue.size === 0 || !this.env) return;

    const toSave = Array.from(this.persistQueue);
    this.persistQueue.clear();

    const supabase = getSupabaseAdmin(this.env);

    for (const charId of toSave) {
      const player = this.players.get(charId);
      if (!player) continue;

      try {
        await supabase.from('characters').update({
          pos_x: player.x,
          pos_y: player.y,
          region: player.region,
          gold: player.gold,
        }).eq('id', charId);
      } catch (err) {
        console.error(`[GameState] Failed to persist player ${charId}:`, err);
      }
    }

    if (toSave.length > 0) {
      console.log(`[GameState] Persisted ${toSave.length} players`);
    }
  }

  destroy() {
    clearInterval(this.tickTimer);
    clearInterval(this.persistTimer);
  }
}
