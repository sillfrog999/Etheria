import { Router, type Request, type Response } from 'express';
import type { GameStateManager } from '../game/GameStateManager.js';
import type { Env } from '../config/env.js';
import { getSupabaseAdmin } from '../db/supabase.js';

export function createMarketplaceRouter(gameState: GameStateManager, env: Env): Router {
  const router = Router();

  const authenticate = async (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const supabase = getSupabaseAdmin(env);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).user = user;
    next();
  };

  // Get active listings
  router.get('/listings', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabaseAdmin(env);
      const { category, search, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          seller:characters!seller_character_id (name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (search) {
        query = query.ilike('definition_id', `%${search}%`);
      }

      const { data: listings, error } = await query;
      if (error) throw error;

      return res.json({ listings });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create listing
  router.post('/listings', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { characterId, itemInstanceId, pricePerUnit } = req.body;

      if (!characterId || !itemInstanceId || !pricePerUnit || pricePerUnit <= 0) {
        return res.status(400).json({ error: 'Invalid listing parameters' });
      }

      const supabase = getSupabaseAdmin(env);

      // Verify character belongs to user
      const { data: char } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('account_id', user.id)
        .single();

      if (!char) return res.status(403).json({ error: 'Character not owned by user' });

      // Verify item instance belongs to character
      const { data: item } = await supabase
        .from('item_instances')
        .select('*')
        .eq('id', itemInstanceId)
        .eq('owner_character_id', characterId)
        .single();

      if (!item) return res.status(404).json({ error: 'Item not found in inventory' });
      if (item.bound || item.locked) return res.status(400).json({ error: 'Item cannot be traded or sold' });

      // Create listing
      const { data: listing, error: listErr } = await supabase
        .from('marketplace_listings')
        .insert({
          seller_character_id: characterId,
          item_instance_id: itemInstanceId,
          definition_id: item.definition_id,
          quantity: item.quantity,
          price_per_unit: pricePerUnit,
          status: 'active'
        })
        .select()
        .single();

      if (listErr) throw listErr;

      // Remove from inventory slot (item is in escrow)
      await supabase
        .from('inventory_slots')
        .update({ item_instance_id: null })
        .eq('character_id', characterId)
        .eq('item_instance_id', itemInstanceId);

      return res.status(201).json({ listing });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Purchase listing
  router.post('/listings/:id/buy', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { buyerCharacterId } = req.body;

      if (!buyerCharacterId) return res.status(400).json({ error: 'Buyer character ID required' });

      const supabase = getSupabaseAdmin(env);

      // Verify buyer
      const { data: buyer } = await supabase
        .from('characters')
        .select('*')
        .eq('id', buyerCharacterId)
        .eq('account_id', user.id)
        .single();

      if (!buyer) return res.status(403).json({ error: 'Buyer not owned by user' });

      // Lock listing check
      const { data: listing, error: listErr } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single();

      if (listErr || !listing) return res.status(404).json({ error: 'Listing not found or no longer active' });
      if (listing.seller_character_id === buyerCharacterId) {
        return res.status(400).json({ error: 'Cannot purchase your own listing' });
      }

      const totalCost = listing.price_per_unit * listing.quantity;
      if (buyer.gold < totalCost) {
        return res.status(400).json({ error: 'Insufficient gold' });
      }

      // Check buyer inventory space
      const { data: occupied } = await supabase
        .from('inventory_slots')
        .select('slot_number')
        .eq('character_id', buyerCharacterId);

      const usedSlots = new Set((occupied ?? []).map((r: any) => r.slot_number));
      let emptySlot = -1;
      for (let i = 0; i < 28; i++) {
        if (!usedSlots.has(i)) { emptySlot = i; break; }
      }
      if (emptySlot === -1) {
        return res.status(400).json({ error: 'Buyer inventory is full' });
      }

      // Fetch seller
      const { data: seller } = await supabase
        .from('characters')
        .select('gold')
        .eq('id', listing.seller_character_id)
        .single();

      // Execute transaction updates
      // 1. Mark listing sold
      await supabase.from('marketplace_listings').update({ status: 'sold' }).eq('id', listing.id);

      // 2. Transfer gold
      const buyerNewGold = buyer.gold - totalCost;
      const sellerNewGold = (seller?.gold ?? 0) + totalCost;

      await supabase.from('characters').update({ gold: buyerNewGold }).eq('id', buyerCharacterId);
      await supabase.from('characters').update({ gold: sellerNewGold }).eq('id', listing.seller_character_id);

      // 3. Transfer item ownership & assign slot
      await supabase.from('item_instances').update({ owner_character_id: buyerCharacterId }).eq('id', listing.item_instance_id);
      await supabase.from('inventory_slots').upsert({
        character_id: buyerCharacterId,
        slot_number: emptySlot,
        item_instance_id: listing.item_instance_id
      }, { onConflict: 'character_id,slot_number' });

      // 4. Log transactions
      await supabase.from('currency_ledger').insert([
        { character_id: buyerCharacterId, amount: -totalCost, reason: 'marketplace_purchase', reference_id: listing.id, balance_after: buyerNewGold },
        { character_id: listing.seller_character_id, amount: totalCost, reason: 'marketplace_sale', reference_id: listing.id, balance_after: sellerNewGold }
      ]);

      await supabase.from('economy_transactions').insert({
        transaction_type: 'marketplace_sale',
        buyer_character_id: buyerCharacterId,
        seller_character_id: listing.seller_character_id,
        item_definition_id: listing.definition_id,
        quantity: listing.quantity,
        gold_amount: totalCost,
        reference_id: listing.id
      });

      // Update in-memory player state if online
      gameState.updatePlayerGold(buyerCharacterId, buyerNewGold);
      gameState.updatePlayerGold(listing.seller_character_id, sellerNewGold);

      return res.json({ success: true, message: 'Purchase successful' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
