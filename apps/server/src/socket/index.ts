import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from '@etheria/protocol';
import type { GameStateManager } from '../game/GameStateManager.js';
import type { Env } from '../config/env.js';
import { handleAuth } from './handlers/auth.js';
import { handleMovement } from './handlers/movement.js';
import { handleGathering } from './handlers/gathering.js';
import { handleCombat } from './handlers/combat.js';
import { handleTrade } from './handlers/trade.js';
import { handleChat } from './handlers/chat.js';
import { handleInventory } from './handlers/inventory.js';
import { handleWorld } from './handlers/world.js';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupSocketHandlers(io: GameServer, gameState: GameStateManager, env: Env) {
  gameState.setEnv(env);
  gameState.setMonsterUpdateHandler((monster) => {
    io.to(`region:${monster.region}`).emit('combat:monster_update', { monster });
  });
  gameState.setMonsterAttackHandler((monster, player, damage) => {
    player.hp = Math.max(0, player.hp - damage);
    io.to(`region:${player.region}`).emit('combat:damage', {
      attackerId: monster.id,
      targetId: player.characterId,
      damage,
      isCrit: false,
      damageType: 'physical',
    });
    io.to(player.socketId).emit('player:stats_update', {
      hp: player.hp, maxHp: player.maxHp,
      mana: player.mana, maxMana: player.maxMana,
      stamina: player.stamina, maxStamina: player.maxStamina,
    });
    if (player.hp <= 0) {
      io.to(`region:${player.region}`).emit('combat:player_death', { playerId: player.characterId });
    }
  });

  io.on('connection', (socket: GameSocket) => {
    console.log(`[Socket] Connection: ${socket.id}`);

    // Set up all handlers
    handleAuth(io, socket, gameState, env);
    handleMovement(io, socket, gameState);
    handleGathering(io, socket, gameState, env);
    handleCombat(io, socket, gameState);
    handleTrade(io, socket, gameState, env);
    handleChat(io, socket, gameState, env);
    handleInventory(io, socket, gameState, env);
    handleWorld(io, socket, gameState);

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Disconnect: ${socket.id} (${reason})`);
      const charId = gameState.removePlayer(socket.id);
      if (charId) {
        io.emit('player:despawn', { playerId: charId });
      }
    });

    socket.on('error', (err) => {
      console.error(`[Socket] Error on ${socket.id}:`, err);
    });
  });
}
