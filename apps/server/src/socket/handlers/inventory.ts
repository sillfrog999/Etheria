
import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import type { Env } from '../../config/env.js';
import type { ItemInstance } from '@etheria/shared';
import { getSupabaseAdmin } from '../../db/supabase.js';

export function handleInventory(io: GameServer, socket: GameSocket, gameState: GameStateManager, env: Env) {
  // Move item between slots
  socket.on('inventory:move', async ({ fromSlot, toSlot }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;
    if (fromSlot < 0 || fromSlot >= 28 || toSlot < 0 || toSlot >= 28) return;

    const supabase = getSupabaseAdmin(env);
    const charId = socket.data.characterId;

    try {
      const { data: slots } = await supabase
        .from('inventory_slots')
        .select('*')
        .eq('character_id', charId)
        .in('slot_number', [fromSlot, toSlot]);

      if (!slots) return;

      const fromRow = slots.find((s: { slot_number: number }) => s.slot_number === fromSlot);
      const toRow = slots.find((s: { slot_number: number }) => s.slot_number === toSlot);

      if (!fromRow?.item_instance_id) return;

      await supabase.from('inventory_slots').upsert([
        { character_id: charId, slot_number: toSlot, item_instance_id: fromRow.item_instance_id },
        { character_id: charId, slot_number: fromSlot, item_instance_id: toRow?.item_instance_id ?? null },
      ], { onConflict: 'character_id,slot_number' });

      const { data: updatedSlots } = await supabase
        .from('inventory_slots')
        .select('slot_number, item_instances(*)')
        .eq('character_id', charId);

      socket.emit('player:inventory_update', {
        slots: (updatedSlots ?? []).map((s: { slot_number: number; item_instances: unknown }) => ({
          slot: s.slot_number,
          item: s.item_instances as ItemInstance | null,
        })),
      });
    } catch (err) {
      console.error('[Inventory] Move error:', err);
    }
  });

  // Use item (consumable)
  socket.on('inventory:use', async ({ slot }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const supabase = getSupabaseAdmin(env);
    const charId = socket.data.characterId;
    const player = gameState.getPlayer(charId);

    if (!player) return;

    console.log(`[Inventory] Player ${charId} used item in slot ${slot}`);
  });

  // Equip item
  socket.on('inventory:equip', async ({ slot }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const supabase = getSupabaseAdmin(env);
    const charId = socket.data.characterId;

    try {
      const { data: invSlot } = await supabase
        .from('inventory_slots')
        .select('item_instance_id, item_instances(definition_id)')
        .eq('character_id', charId)
        .eq('slot_number', slot)
        .single();

      if (!invSlot?.item_instance_id) return;

      const itemRelation = invSlot.item_instances as
        | { definition_id?: string }[]
        | { definition_id?: string }
        | null;

      const itemData = Array.isArray(itemRelation)
        ? itemRelation[0]
        : itemRelation;

      const defId = itemData?.definition_id;

      if (!defId) return;

      const { ITEM_DATABASE } = await import('@etheria/game-data');
      const def = ITEM_DATABASE[defId];

      if (!def?.equipmentSlot) return;

      const equipSlot = def.equipmentSlot;

      await supabase.from('equipment_slots').upsert({
        character_id: charId,
        slot_name: equipSlot,
        item_instance_id: invSlot.item_instance_id,
      }, { onConflict: 'character_id,slot_name' });

      await supabase.from('inventory_slots').update({ item_instance_id: null })
        .eq('character_id', charId)
        .eq('slot_number', slot);

      socket.emit('player:equipment_update', {
        equipSlot,
        item: {
          instanceId: invSlot.item_instance_id,
          definitionId: defId,
          quantity: 1,
        },
      });
    } catch (err) {
      console.error('[Inventory] Equip error:', err);
    }
  });

  // Unequip item
  socket.on('inventory:unequip', async ({ equipSlot }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const supabase = getSupabaseAdmin(env);
    const charId = socket.data.characterId;

    try {
      const { data: equipRow } = await supabase
        .from('equipment_slots')
        .select('item_instance_id')
        .eq('character_id', charId)
        .eq('slot_name', equipSlot)
        .single();

      if (!equipRow?.item_instance_id) return;

      const { data: occupied } = await supabase
        .from('inventory_slots')
        .select('slot_number')
        .eq('character_id', charId);

      const usedSlots = new Set(
        (occupied ?? []).map((r: { slot_number: number }) => r.slot_number)
      );

      let emptySlot = -1;

      for (let i = 0; i < 28; i++) {
        if (!usedSlots.has(i)) {
          emptySlot = i;
          break;
        }
      }

      if (emptySlot < 0) {
        socket.emit('server:error', {
          code: 'INVENTORY_FULL',
          message: 'Inventory is full.',
        });
        return;
      }

      await supabase.from('inventory_slots').upsert({
        character_id: charId,
        slot_number: emptySlot,
        item_instance_id: equipRow.item_instance_id,
      }, { onConflict: 'character_id,slot_number' });

      await supabase.from('equipment_slots').update({ item_instance_id: null })
        .eq('character_id', charId)
        .eq('slot_name', equipSlot);

      socket.emit('player:equipment_update', {
        equipSlot,
        item: null,
      });
    } catch (err) {
      console.error('[Inventory] Unequip error:', err);
    }
  });
}
