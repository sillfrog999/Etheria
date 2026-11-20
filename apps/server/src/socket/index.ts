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
