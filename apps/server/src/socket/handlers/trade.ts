import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import type { Env } from '../../config/env.js';
import { getSupabaseAdmin } from '../../db/supabase.js';
import type { TradeSession, TradeOffer } from '@etheria/shared';
import { randomUUID } from 'node:crypto';

const TRADE_REQUEST_TIMEOUT_MS = 30000;
const TRADE_SESSION_TIMEOUT_MS = 300000;
const MAX_TRADE_RANGE = 5;

export function handleTrade(io: GameServer, socket: GameSocket, gameState: GameStateManager, env: Env) {
  // ===== Trade Request =====
  socket.on('trade:request', async ({ targetCharacterId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const initiator = gameState.getPlayer(socket.data.characterId);
    const target = gameState.getPlayer(targetCharacterId);

    if (!initiator || !target) {
      socket.emit('server:error', { code: 'PLAYER_NOT_FOUND', message: 'Player is not online.' });
      return;
    }

    if (initiator.region !== target.region) {
      socket.emit('server:error', { code: 'DIFFERENT_REGION', message: 'Player is in a different region.' });
      return;
    }

    const dist = Math.sqrt(Math.pow(initiator.x - target.x, 2) + Math.pow(initiator.y - target.y, 2));
    if (dist > MAX_TRADE_RANGE) {
      socket.emit('server:error', { code: 'OUT_OF_RANGE', message: 'Player is too far away.' });
      return;
    }

    if (initiator.activeTrade) {
      socket.emit('server:error', { code: 'ALREADY_TRADING', message: 'You are already in a trade.' });
      return;
    }

    const tradeId = randomUUID();

    const trade: TradeSession = {
      id: tradeId,
      initiatorId: initiator.characterId,
      initiatorName: initiator.name,
      targetId: target.characterId,
      targetName: target.name,
      state: 'pending',
      initiatorOffer: { items: [], gold: 0 },
      targetOffer: { items: [], gold: 0 },
      initiatorConfirmed: false,
      targetConfirmed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    gameState.setActiveTrade(tradeId, trade);

    // Notify target player
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit('trade:request', {
        tradeId,
        fromId: initiator.characterId,
        fromName: initiator.name,
      });
    }

    // Auto-expire request
    setTimeout(() => {
      const existing = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
      if (existing && existing.state === 'pending') {
        existing.state = 'expired';
        gameState.removeActiveTrade(tradeId);
        socket.emit('trade:cancelled', { tradeId, reason: 'Trade request expired.' });
      }
    }, TRADE_REQUEST_TIMEOUT_MS);
  });

  // ===== Accept Trade =====
  socket.on('trade:accept', async ({ tradeId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const trade = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
    if (!trade || trade.state !== 'pending') {
      socket.emit('server:error', { code: 'TRADE_NOT_FOUND', message: 'Trade request not found.' });
      return;
    }

    if (trade.targetId !== socket.data.characterId) {
      socket.emit('server:error', { code: 'NOT_YOUR_TRADE', message: 'This trade is not for you.' });
      return;
    }

    trade.state = 'active';
    trade.updatedAt = Date.now();
    gameState.setActiveTrade(tradeId, trade);

    // Notify both players
    const initiator = gameState.getPlayer(trade.initiatorId);
    if (initiator) {
      const initSocket = io.sockets.sockets.get(initiator.socketId);
      initSocket?.emit('trade:update', { trade });
    }
    socket.emit('trade:update', { trade });
  });

  // ===== Decline Trade =====
  socket.on('trade:decline', async ({ tradeId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const trade = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
    if (!trade) return;

    trade.state = 'cancelled';
    gameState.removeActiveTrade(tradeId);

    // Notify initiator
    const initiator = gameState.getPlayer(trade.initiatorId);
    if (initiator) {
      const initSocket = io.sockets.sockets.get(initiator.socketId);
      initSocket?.emit('trade:cancelled', { tradeId, reason: 'Trade was declined.' });
    }
  });

  // ===== Offer Update =====
  socket.on('trade:offer_update', ({ tradeId, offer }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const trade = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
    if (!trade || !['active', 'confirming'].includes(trade.state)) return;

    const isInitiator = trade.initiatorId === socket.data.characterId;
    const isTarget = trade.targetId === socket.data.characterId;
    if (!isInitiator && !isTarget) return;

    // Validate gold amount
    const player = gameState.getPlayer(socket.data.characterId);
    if (!player) return;
    if (offer.gold < 0 || offer.gold > player.gold) {
      socket.emit('server:error', { code: 'INVALID_GOLD', message: 'Invalid gold amount.' });
      return;
    }

    // Update offer — reset both confirmations (two-phase)
    if (isInitiator) trade.initiatorOffer = offer;
    else trade.targetOffer = offer;

    trade.initiatorConfirmed = false;
    trade.targetConfirmed = false;
    trade.state = 'active';
    trade.updatedAt = Date.now();

    gameState.setActiveTrade(tradeId, trade);

    // Broadcast updated trade to both players
    const otherCharId = isInitiator ? trade.targetId : trade.initiatorId;
    const otherPlayer = gameState.getPlayer(otherCharId);
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.socketId);
      otherSocket?.emit('trade:update', { trade });
    }
    socket.emit('trade:update', { trade });
  });

  // ===== Confirm Trade =====
  socket.on('trade:confirm', async ({ tradeId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const trade = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
    if (!trade || !['active', 'confirming'].includes(trade.state)) return;

    const isInitiator = trade.initiatorId === socket.data.characterId;
    const isTarget = trade.targetId === socket.data.characterId;
    if (!isInitiator && !isTarget) return;

    if (isInitiator) trade.initiatorConfirmed = true;
    else trade.targetConfirmed = true;

    trade.state = 'confirming';
    trade.updatedAt = Date.now();

    // Broadcast confirmation state
    const otherCharId = isInitiator ? trade.targetId : trade.initiatorId;
    const otherPlayer = gameState.getPlayer(otherCharId);
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.socketId);
      otherSocket?.emit('trade:update', { trade });
    }
    socket.emit('trade:update', { trade });

    // Both confirmed — execute trade atomically
    if (trade.initiatorConfirmed && trade.targetConfirmed) {
      await executeTrade(io, socket, gameState, env, trade);
    }
  });

  // ===== Cancel Trade =====
  socket.on('trade:cancel', ({ tradeId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const trade = gameState.getActiveTrade(tradeId) as TradeSession | undefined;
    if (!trade) return;

    trade.state = 'cancelled';
    gameState.removeActiveTrade(tradeId);

    const initiator = gameState.getPlayer(trade.initiatorId);
    const target = gameState.getPlayer(trade.targetId);

    if (initiator) {
      io.sockets.sockets.get(initiator.socketId)?.emit('trade:cancelled', { tradeId, reason: 'Trade was cancelled.' });
    }
    if (target) {
      io.sockets.sockets.get(target.socketId)?.emit('trade:cancelled', { tradeId, reason: 'Trade was cancelled.' });
    }
  });
}

async function executeTrade(
  io: GameServer,
  socket: GameSocket,
  gameState: GameStateManager,
  env: Env,
  trade: TradeSession
) {
  const supabase = getSupabaseAdmin(env);
  trade.state = 'completed';

  try {
    // === Validate both players are still online ===
    const initiator = gameState.getPlayer(trade.initiatorId);
    const target = gameState.getPlayer(trade.targetId);

    if (!initiator || !target) {
      trade.state = 'failed';
      gameState.removeActiveTrade(trade.id);
      socket.emit('server:error', { code: 'TRADE_FAILED', message: 'A player disconnected.' });
      return;
    }

    // === Validate gold ===
    if (initiator.gold < trade.initiatorOffer.gold || target.gold < trade.targetOffer.gold) {
      trade.state = 'failed';
      gameState.removeActiveTrade(trade.id);
      socket.emit('server:error', { code: 'INSUFFICIENT_GOLD', message: 'Insufficient gold.' });
      return;
    }

    // === Execute as DB transaction ===
    // Transfer gold
    const newInitiatorGold = initiator.gold - trade.initiatorOffer.gold + trade.targetOffer.gold;
    const newTargetGold = target.gold - trade.targetOffer.gold + trade.initiatorOffer.gold;

    if (newInitiatorGold < 0 || newTargetGold < 0) {
      trade.state = 'failed';
      gameState.removeActiveTrade(trade.id);
      socket.emit('server:error', { code: 'TRADE_FAILED', message: 'Invalid gold amounts.' });
      return;
    }

    // Update character gold in DB
    await supabase.from('characters').update({ gold: newInitiatorGold }).eq('id', trade.initiatorId);
    await supabase.from('characters').update({ gold: newTargetGold }).eq('id', trade.targetId);

    // Log to currency ledger
    if (trade.initiatorOffer.gold > 0 || trade.targetOffer.gold > 0) {
      await supabase.from('currency_ledger').insert([
        { character_id: trade.initiatorId, amount: trade.targetOffer.gold - trade.initiatorOffer.gold, reason: 'trade', reference_id: trade.id, balance_after: newInitiatorGold },
        { character_id: trade.targetId, amount: trade.initiatorOffer.gold - trade.targetOffer.gold, reason: 'trade', reference_id: trade.id, balance_after: newTargetGold },
      ]);
    }

    // Transfer items (initiator's items → target, target's items → initiator)
    for (const tradeItem of trade.initiatorOffer.items) {
      await supabase.from('item_instances').update({ owner_character_id: trade.targetId }).eq('id', tradeItem.instanceId);
    }
    for (const tradeItem of trade.targetOffer.items) {
      await supabase.from('item_instances').update({ owner_character_id: trade.initiatorId }).eq('id', tradeItem.instanceId);
    }

    // Update in-memory state
    gameState.updatePlayerGold(trade.initiatorId, newInitiatorGold);
    gameState.updatePlayerGold(trade.targetId, newTargetGold);

    // Record trade in DB
    await supabase.from('trade_sessions').insert({
      id: trade.id,
      initiator_character_id: trade.initiatorId,
      target_character_id: trade.targetId,
      state: 'completed',
      initiator_confirmed: true,
      target_confirmed: true,
      completed_at: new Date().toISOString(),
    });

    gameState.removeActiveTrade(trade.id);

    // Notify both players
    const initSocket = io.sockets.sockets.get(initiator.socketId);
    const targetSocket = io.sockets.sockets.get(target.socketId);

    initSocket?.emit('trade:complete', { tradeId: trade.id, message: 'Trade completed successfully!' });
    targetSocket?.emit('trade:complete', { tradeId: trade.id, message: 'Trade completed successfully!' });
    initSocket?.emit('player:gold_update', { gold: newInitiatorGold });
    targetSocket?.emit('player:gold_update', { gold: newTargetGold });

    console.log(`[Trade] Completed: ${trade.initiatorId} ↔ ${trade.targetId}`);

  } catch (err) {
    console.error('[Trade] Error executing trade:', err);
    trade.state = 'failed';
    gameState.removeActiveTrade(trade.id);
    socket.emit('server:error', { code: 'TRADE_FAILED', message: 'Trade failed due to a server error.' });
  }
}
