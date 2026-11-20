import type {
  NetworkPlayer,
  WorldChunk,
  TradeSession,
  TradeOffer,
  Monster,
  ItemInstance,
  ChatMessage,
  StatusEffect,
} from '@etheria/shared';

// ============================================================
// SERVER → CLIENT EVENTS
// ============================================================
export interface ServerToClientEvents {
  'connect:ack': (data: {
    playerId: string;
    characterId: string;
    region: string;
    x: number;
    y: number;
  }) => void;

  'server:error': (data: { code: string; message: string }) => void;

  'world:chunk': (data: { chunk: WorldChunk }) => void;
  'region:teleported': (data: { region: string; x: number; y: number; name: string }) => void;
  'world:resource_update': (data: {
    nodeId: string;
    depleted: boolean;
    respawnAt?: number;
  }) => void;

  'player:spawn': (data: { player: NetworkPlayer }) => void;
  'player:move': (data: {
    playerId: string;
    x: number;
    y: number;
    animation?: string;
    facing?: string;
  }) => void;
  'player:despawn': (data: { playerId: string }) => void;
  'player:stats_update': (data: {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    stamina: number;
    maxStamina: number;
    gold?: number;
  }) => void;
  'player:xp_gain': (data: {
    skill: string;
    xp: number;
    newTotal: number;
    newLevel?: number;
  }) => void;
  'player:level_up': (data: { skill: string; level: number }) => void;
  'player:gold_update': (data: { gold: number }) => void;
  'player:inventory_update': (data: {
    slots: Array<{ slot: number; item: ItemInstance | null }>;
  }) => void;
  'player:equipment_update': (data: {
    equipSlot: string;
    item: ItemInstance | null;
  }) => void;
  'player:buff_update': (data: { buffs: StatusEffect[] }) => void;

  'gather:start': (data: { nodeId: string; duration: number }) => void;
  'gather:complete': (data: {
    nodeId: string;
    item: { definitionId: string; quantity: number; name: string };
    xp: number;
    skill: string;
  }) => void;
  'gather:fail': (data: { nodeId: string; reason: string }) => void;

  'combat:damage': (data: {
    attackerId: string;
    targetId: string;
    damage: number;
    isCrit: boolean;
    damageType: string;
  }) => void;
  'combat:monster_spawn': (data: { monster: Monster }) => void;
  'combat:monster_update': (data: { monster: Monster }) => void;
  'combat:monster_death': (data: {
    monsterId: string;
    loot?: Array<{ definitionId: string; quantity: number; name: string }>;
  }) => void;
  'combat:player_death': (data: { playerId: string }) => void;
  'combat:ability_used': (data: {
    casterId: string;
    abilityId: string;
    targetId?: string;
    targetX?: number;
    targetY?: number;
  }) => void;

  'chat:message': (data: ChatMessage) => void;

  'trade:request': (data: {
    tradeId: string;
    fromId: string;
    fromName: string;
  }) => void;
  'trade:update': (data: { trade: TradeSession }) => void;
  'trade:complete': (data: { tradeId: string; message: string }) => void;
  'trade:cancelled': (data: { tradeId: string; reason?: string }) => void;

  'marketplace:listing_added': (data: { listingId: string }) => void;
  'marketplace:listing_sold': (data: { listingId: string }) => void;

  'craft:complete': (data: {
    recipeId: string;
    item: { definitionId: string; quantity: number; name: string };
    xp: number;
  }) => void;
  'craft:fail': (data: { recipeId: string; reason: string }) => void;
}

// ============================================================
// CLIENT → SERVER EVENTS
// ============================================================
export interface ClientToServerEvents {
  auth: (data: { token: string }) => void;

  'world:request_chunk': (data: {
    chunkX: number;
    chunkY: number;
    region: string;
  }) => void;

  'player:move': (data: {
    x: number;
    y: number;
    facing?: string;
    animation?: string;
  }) => void;
  'player:teleport_request': (data: { region: string }) => void;

  'gather:start': (data: { nodeId: string }) => void;
  'gather:cancel': (data: { nodeId: string }) => void;

  'combat:attack': (data: { targetId: string; abilityId?: string }) => void;
  'combat:use_ability': (data: {
    abilityId: string;
    targetId?: string;
    targetX?: number;
    targetY?: number;
  }) => void;
  'combat:set_target': (data: { targetId: string | null }) => void;

  'inventory:move': (data: { fromSlot: number; toSlot: number }) => void;
  'inventory:use': (data: { slot: number }) => void;
  'inventory:drop': (data: { slot: number; quantity: number }) => void;
  'inventory:equip': (data: { slot: number }) => void;
  'inventory:unequip': (data: { equipSlot: string }) => void;
  'inventory:split': (data: {
    fromSlot: number;
    toSlot: number;
    quantity: number;
  }) => void;
  'inventory:lock': (data: { slot: number; locked: boolean }) => void;

  'trade:request': (data: { targetCharacterId: string }) => void;
  'trade:accept': (data: { tradeId: string }) => void;
  'trade:decline': (data: { tradeId: string }) => void;
  'trade:offer_update': (data: {
    tradeId: string;
    offer: TradeOffer;
  }) => void;
  'trade:confirm': (data: { tradeId: string }) => void;
  'trade:cancel': (data: { tradeId: string }) => void;

  'chat:send': (data: {
    channel: string;
    content: string;
    recipientId?: string;
  }) => void;

  'craft:start': (data: { recipeId: string; quantity: number }) => void;
  'craft:cancel': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  accountId: string;
  characterId: string;
  authenticated: boolean;
}
