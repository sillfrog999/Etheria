import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import type { Env } from '../../config/env.js';
import { getSupabaseAdmin } from '../../db/supabase.js';
import { ITEM_DATABASE } from '@etheria/game-data';
import { levelFromXP, SKILL_XP_REWARDS } from '@etheria/shared';

const GATHER_COOLDOWN_MS = 500;
const lastGather = new Map<string, number>();

// Gather times in ms per resource
const GATHER_TIMES: Record<string, number> = {
  wood: 3000, ancient_wood: 5000,
  copper_ore: 4000, tin_ore: 4000, iron_ore: 5000, coal: 5000,
  silver_ore: 6000, gold_ore: 7000, mithril_ore: 8000, crystal_shards: 7000,
  obsidian: 9000, void_essence: 10000,
  herbs: 2000, rare_herbs: 3000, fiber: 2000,
  fish: 8000,
  hide: 3000,
};

// Tool requirements
const TOOL_REQUIRED: Record<string, string> = {
  copper_ore: 'pickaxe', tin_ore: 'pickaxe', iron_ore: 'pickaxe',
  coal: 'pickaxe', silver_ore: 'pickaxe', gold_ore: 'pickaxe',
  mithril_ore: 'pickaxe', crystal_shards: 'pickaxe', obsidian: 'pickaxe',
  void_essence: 'pickaxe', arcane_dust: 'pickaxe',
  wood: 'axe', ancient_wood: 'axe',
  fish: 'fishing_rod',
};

const activeGathers = new Map<string, NodeJS.Timeout>();

export function handleGathering(io: GameServer, socket: GameSocket, gameState: GameStateManager, env: Env) {
  socket.on('gather:start', async ({ nodeId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const player = gameState.getPlayer(socket.data.characterId);
    if (!player) return;

    // Rate limit
    const now = Date.now();
    const last = lastGather.get(socket.data.characterId) ?? 0;
    if (now - last < GATHER_COOLDOWN_MS) return;
    lastGather.set(socket.data.characterId, now);

    // Cancel any existing gather
    const existing = activeGathers.get(socket.data.characterId);
    if (existing) {
      clearTimeout(existing);
      activeGathers.delete(socket.data.characterId);
    }

    // Parse node ID to get resource info
    // nodeId format: region_worldX_worldY_resourceId
    const parts = nodeId.split('_');
    if (parts.length < 4) return;
    const resourceId = parts.slice(3).join('_');

    const itemDef = ITEM_DATABASE[resourceId];
    if (!itemDef) {
      socket.emit('gather:fail', { nodeId, reason: 'Unknown resource.' });
      return;
    }

    // Check skill requirement
    const reqSkillEntry = itemDef.requirements?.skills;
    if (reqSkillEntry) {
      const [skillName, reqLevel] = Object.entries(reqSkillEntry)[0] ?? [];
      if (skillName && reqLevel) {
        const supabase = getSupabaseAdmin(env);
        const { data: skillRow } = await supabase
          .from('character_skills')
          .select('level')
          .eq('character_id', socket.data.characterId)
          .eq('skill_name', skillName)
          .single();
        const playerLevel = skillRow?.level ?? 1;
        if (playerLevel < reqLevel) {
          socket.emit('gather:fail', { nodeId, reason: `Requires ${skillName} level ${reqLevel}.` });
          return;
        }
      }
    }

    const gatherTime = GATHER_TIMES[resourceId] ?? 4000;

    socket.emit('gather:start', { nodeId, duration: gatherTime });

    // Server-side timer for gather completion
    const timer = setTimeout(async () => {
      activeGathers.delete(socket.data.characterId!);

      try {
        const supabase = getSupabaseAdmin(env);
        const charId = socket.data.characterId!;

        // Determine skill and XP
        let skillName = 'mining';
        if (['wood', 'ancient_wood'].includes(resourceId)) skillName = 'woodcutting';
        else if (resourceId === 'fish') skillName = 'fishing';
        else if (['herbs', 'rare_herbs', 'fiber'].includes(resourceId)) skillName = 'farming';
        else if (resourceId === 'hide') skillName = 'hunting';

        const xpRewards = SKILL_XP_REWARDS[skillName] ?? {};
        const xpGained = xpRewards[resourceId] ?? 10;

        // Get current skill XP
        const { data: skillRow } = await supabase
          .from('character_skills')
          .select('xp, level')
          .eq('character_id', charId)
          .eq('skill_name', skillName)
          .single();

        const currentXP = skillRow?.xp ?? 0;
        const newXP = currentXP + xpGained;
        const newLevel = levelFromXP(newXP);

        // Upsert skill
        await supabase.from('character_skills').upsert({
          character_id: charId,
          skill_name: skillName,
          xp: newXP,
          level: newLevel,
        }, { onConflict: 'character_id,skill_name' });

        // Add item to inventory
        const quantity = 1;
        const { data: newInstance } = await supabase
          .from('item_instances')
          .insert({ definition_id: resourceId, owner_character_id: charId, quantity })
          .select()
          .single();

        if (newInstance) {
          // Find first empty inventory slot
          const { data: occupied } = await supabase
            .from('inventory_slots')
            .select('slot_number')
            .eq('character_id', charId);

          const usedSlots = new Set((occupied ?? []).map((r: { slot_number: number }) => r.slot_number));
          let emptySlot = -1;
          for (let i = 0; i < 28; i++) {
            if (!usedSlots.has(i)) { emptySlot = i; break; }
          }

          if (emptySlot >= 0) {
            await supabase.from('inventory_slots').upsert({
              character_id: charId,
              slot_number: emptySlot,
              item_instance_id: newInstance.id,
            }, { onConflict: 'character_id,slot_number' });
          }
        }

        // Mark node as depleted
        const respawnMs = 60000 + Math.random() * 60000; // 1-2 min respawn
        await supabase.from('resource_node_state').upsert({
          id: nodeId,
          region: parts[0] ?? 'greenfall',
          depleted: true,
          respawn_at: new Date(Date.now() + respawnMs).toISOString(),
        }, { onConflict: 'id' });

        // Notify client
        socket.emit('gather:complete', {
          nodeId,
          item: { definitionId: resourceId, quantity, name: itemDef.name },
          xp: xpGained,
          skill: skillName,
        });

        socket.emit('player:xp_gain', {
          skill: skillName,
          xp: xpGained,
          newTotal: newXP,
          newLevel: newLevel !== (skillRow?.level ?? 1) ? newLevel : undefined,
        });

        // Notify all nearby players that node is depleted
        io.to(`region:${player.region}`).emit('world:resource_update', {
          nodeId,
          depleted: true,
          respawnAt: Date.now() + respawnMs,
        });

      } catch (err) {
        console.error('[Gather] Error completing gather:', err);
        socket.emit('gather:fail', { nodeId, reason: 'Server error.' });
      }
    }, gatherTime);

    activeGathers.set(socket.data.characterId, timer);
  });

  socket.on('gather:cancel', ({ nodeId }) => {
    const timer = activeGathers.get(socket.data.characterId ?? '');
    if (timer) {
      clearTimeout(timer);
      activeGathers.delete(socket.data.characterId ?? '');
    }
  });
}
