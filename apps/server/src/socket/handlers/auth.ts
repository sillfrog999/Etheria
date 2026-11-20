import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager, ServerPlayer } from '../../game/GameStateManager.js';
import type { Env } from '../../config/env.js';
import { getSupabaseAdmin } from '../../db/supabase.js';
import { BASE_SKILLS, BASE_SKILL_XP, STARTING_POSITION } from '@etheria/shared';
import { DEFAULT_HOTBAR } from '@etheria/game-data';

const RATE_LIMIT_WINDOW_MS = 10000;
const MAX_AUTH_PER_WINDOW = 3;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

export function handleAuth(
  io: GameServer,
  socket: GameSocket,
  gameState: GameStateManager,
  env: Env
) {
  socket.on('auth', async ({ token }) => {
    // Rate limit auth attempts
    const now = Date.now();
    const ip = socket.handshake.address;
    const attempts = authAttempts.get(ip) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > attempts.resetAt) {
      attempts.count = 0;
      attempts.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }
    attempts.count++;
    authAttempts.set(ip, attempts);

    if (attempts.count > MAX_AUTH_PER_WINDOW) {
      socket.emit('server:error', { code: 'RATE_LIMITED', message: 'Too many auth attempts.' });
      return;
    }

    try {
      const supabase = getSupabaseAdmin(env);

      // Verify JWT token with Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        socket.emit('server:error', { code: 'AUTH_INVALID', message: 'Invalid or expired token.' });
        return;
      }

      const accountId = user.id;

      // Load most recently logged-in character
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('account_id', accountId)
        .order('last_login', { ascending: false })
        .limit(1);

      if (charError || !characters || characters.length === 0) {
        socket.emit('server:error', { code: 'NO_CHARACTER', message: 'No character found. Create one first.' });
        return;
      }

      const char = characters[0]!;

      // Load stats
      const { data: stats } = await supabase
        .from('character_stats')
        .select('*')
        .eq('character_id', char.id)
        .single();

      // Load inventory
      const { data: inventoryRows } = await supabase
        .from('inventory_slots')
        .select('slot_number, item_instances(*)')
        .eq('character_id', char.id);

      const inventory = Array.from({ length: 28 }, (_, i) => ({ slot: i, item: null as unknown }));
      if (inventoryRows) {
        for (const row of inventoryRows) {
          if (row.slot_number < 28 && row.item_instances) {
            inventory[row.slot_number] = { slot: row.slot_number, item: row.item_instances };
          }
        }
      }

      // Load equipment
      const { data: equipRows } = await supabase
        .from('equipment_slots')
        .select('slot_name, item_instances(*)')
        .eq('character_id', char.id);

      const equipment: Record<string, unknown> = {};
      if (equipRows) {
        for (const row of equipRows) {
          if (row.item_instances) equipment[row.slot_name] = row.item_instances;
        }
      }

      // Build server player
      const player: ServerPlayer = {
        id: accountId,
        characterId: char.id,
        socketId: socket.id,
        accountId,
        name: char.name,
        class: char.class,
        modelId: char.appearance?.modelId || 'elf_male',
        level: char.level,
        x: char.pos_x,
        y: char.pos_y,
        region: char.region,
        hp: stats?.hp ?? 100,
        maxHp: stats?.max_hp ?? 100,
        mana: stats?.mana ?? 50,
        maxMana: stats?.max_mana ?? 50,
        stamina: stats?.stamina ?? 100,
        maxStamina: stats?.max_stamina ?? 100,
        gold: char.gold,
        inventory: inventory as ServerPlayer['inventory'],
        equipment: equipment as ServerPlayer['equipment'],
        lastMovement: Date.now(),
        lastAction: Date.now(),
        facing: 'south',
        animation: 'idle',
      };

      // Mark as authenticated
      socket.data.accountId = accountId;
      socket.data.characterId = char.id;
      socket.data.authenticated = true;

      gameState.addPlayer(player);

      // Greenfall needs real server-side monster instances; world chunks only
      // contain terrain and decorative objects, not combat entities.
      if (char.region === 'greenfall') {
        gameState.ensureGreenfallMonsters(char.pos_x, char.pos_y);
      }

      // Join region room
      socket.join(`region:${char.region}`);

      // Acknowledge connection
      socket.emit('connect:ack', {
        playerId: accountId,
        characterId: char.id,
        region: char.region,
        x: char.pos_x,
        y: char.pos_y,
      });

      // Broadcast the current region's monsters. Existing clients ignore
      // duplicates by monster id; the joining client receives the full set.
      for (const monster of gameState.getMonstersInRegion(char.region)) {
        io.to(`region:${char.region}`).emit('combat:monster_spawn', { monster });
      }

      // Send current inventory
      socket.emit('player:inventory_update', { slots: inventory as never });

      // Notify nearby players of this player's spawn
      const networkPlayer = {
        id: accountId,
        characterId: char.id,
        name: char.name,
        class: char.class,
        level: char.level,
        x: char.pos_x,
        y: char.pos_y,
        region: char.region,
        hp: player.hp,
        maxHp: player.maxHp,
        animation: 'idle',
        facing: 'south' as const,
      };

      socket.to(`region:${char.region}`).emit('player:spawn', { player: networkPlayer });

      // Send existing nearby players to new player
      const nearby = gameState.getNearbyPlayers(char.id, 30);
      for (const np of nearby) {
        socket.emit('player:spawn', {
          player: {
            id: np.id,
            characterId: np.characterId,
            name: np.name,
            class: np.class,
            modelId: np.modelId || 'elf_male',
            level: np.level,
            x: np.x,
            y: np.y,
            region: np.region,
            hp: np.hp,
            maxHp: np.maxHp,
            animation: np.animation,
            facing: np.facing,
          },
        });
      }

      // Update last_login
      await supabase.from('characters').update({ last_login: new Date().toISOString() }).eq('id', char.id);

      console.log(`[Auth] Player authenticated: ${char.name} (${char.id})`);
    } catch (err) {
      console.error('[Auth] Error:', err);
      socket.emit('server:error', { code: 'AUTH_ERROR', message: 'Authentication failed.' });
    }
  });
}
