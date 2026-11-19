import { create } from 'zustand';
import type {
  Character,
  InventorySlot,
  ItemInstance,
  NetworkPlayer,
  Monster,
  ChatMessage,
  TradeSession,
  StatusEffect
} from '@etheria/shared';

export interface GameState {
  // Session & Character
  token: string | null;
  character: Character | null;
  
  // Realtime World State
  nearbyPlayers: Map<string, NetworkPlayer>;
  monsters: Map<string, Monster>;
  currentRegion: string;
  playerPos: { x: number; y: number };
  
  // Player Stats & Vitals
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  gold: number;
  buffs: StatusEffect[];

  // Inventory & Equipment
  inventory: Array<{ slot: number; item: ItemInstance | null }>;
  equipment: Record<string, ItemInstance | null>;

  // Combat & Targeting
  targetId: string | null;
  targetType: 'player' | 'monster' | null;

  // Social & Trade
  chatMessages: ChatMessage[];
  activeTrade: TradeSession | null;
  tradeInvite: { tradeId: string; fromId: string; fromName: string } | null;

  // Gathering & Actions
  gatheringState: { nodeId: string; duration: number; startTime: number } | null;

  // UI Windows Open / Closed
  windows: {
    inventory: boolean;
    character: boolean;
    skills: boolean;
    spellbook: boolean;
    trade: boolean;
    marketplace: boolean;
    map: boolean;
    chat: boolean;
  };

  // Actions
  setToken: (token: string | null) => void;
  setCharacter: (char: Character | null) => void;
  updateStats: (stats: Partial<{ hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number; gold: number }>) => void;
  setPlayerPos: (pos: { x: number; y: number }) => void;
  setNearbyPlayer: (player: NetworkPlayer) => void;
  removeNearbyPlayer: (playerId: string) => void;
  setMonster: (monster: Monster) => void;
  removeMonster: (monsterId: string) => void;
  updateInventory: (slots: Array<{ slot: number; item: ItemInstance | null }>) => void;
  updateEquipment: (slotName: string, item: ItemInstance | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setTarget: (targetId: string | null, targetType?: 'player' | 'monster' | null) => void;
  setActiveTrade: (trade: TradeSession | null) => void;
  setTradeInvite: (invite: { tradeId: string; fromId: string; fromName: string } | null) => void;
  setGatheringState: (state: { nodeId: string; duration: number; startTime: number } | null) => void;
  toggleWindow: (windowName: keyof GameState['windows']) => void;
  closeWindow: (windowName: keyof GameState['windows']) => void;
}

export const useGameStore = create<GameState>((set) => ({
  token: null,
  character: null,

  nearbyPlayers: new Map(),
  monsters: new Map(),
  currentRegion: 'greenfall',
  playerPos: { x: 16, y: 16 },

  hp: 100,
  maxHp: 100,
  mana: 50,
  maxMana: 50,
  stamina: 100,
  maxStamina: 100,
  gold: 100,
  buffs: [],

  inventory: Array.from({ length: 28 }, (_, i) => ({ slot: i, item: null })),
  equipment: {
    head: null,
    chest: null,
    legs: null,
    boots: null,
    gloves: null,
    mainHand: null,
    offHand: null,
    accessory1: null,
    accessory2: null,
  },

  targetId: null,
  targetType: null,

  chatMessages: [],
  activeTrade: null,
  tradeInvite: null,
  gatheringState: null,

  windows: {
    inventory: false,
    character: false,
    skills: false,
    spellbook: false,
    trade: false,
    marketplace: false,
    map: false,
    chat: true,
  },

  setToken: (token) => set({ token }),
  setCharacter: (character) => {
    if (!character) {
      set({ character: null });
      return;
    }
    set({
      character,
      hp: character.stats.hp,
      maxHp: character.stats.maxHp,
      mana: character.stats.mana,
      maxMana: character.stats.maxMana,
      stamina: character.stats.stamina,
      maxStamina: character.stats.maxStamina,
      gold: character.gold,
      playerPos: { x: character.position.x, y: character.position.y },
      currentRegion: character.region,
    });
  },

  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
  setPlayerPos: (playerPos) => set({ playerPos }),

  setNearbyPlayer: (player) => set((state) => {
    const map = new Map(state.nearbyPlayers);
    map.set(player.characterId, player);
    return { nearbyPlayers: map };
  }),

  removeNearbyPlayer: (playerId) => set((state) => {
    const map = new Map(state.nearbyPlayers);
    map.delete(playerId);
    return { nearbyPlayers: map };
  }),

  setMonster: (monster) => set((state) => {
    const map = new Map(state.monsters);
    map.set(monster.id, monster);
    return { monsters: map };
  }),

  removeMonster: (monsterId) => set((state) => {
    const map = new Map(state.monsters);
    map.delete(monsterId);
    return { monsters: map };
  }),

  updateInventory: (slots) => set((state) => {
    const newInv = [...state.inventory];
    for (const s of slots) {
      if (s.slot >= 0 && s.slot < 28) {
        newInv[s.slot] = s;
      }
    }
    return { inventory: newInv };
  }),

  updateEquipment: (slotName, item) => set((state) => ({
    equipment: { ...state.equipment, [slotName]: item }
  })),

  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-100), msg]
  })),

  setTarget: (targetId, targetType = null) => set({ targetId, targetType }),
  setActiveTrade: (activeTrade) => set({
    activeTrade,
    windows: activeTrade ? { ...useGameStore.getState().windows, trade: true } : useGameStore.getState().windows
  }),
  setTradeInvite: (tradeInvite) => set({ tradeInvite }),
  setGatheringState: (gatheringState) => set({ gatheringState }),

  toggleWindow: (windowName) => set((state) => ({
    windows: { ...state.windows, [windowName]: !state.windows[windowName] }
  })),

  closeWindow: (windowName) => set((state) => ({
    windows: { ...state.windows, [windowName]: false }
  })),
}));
