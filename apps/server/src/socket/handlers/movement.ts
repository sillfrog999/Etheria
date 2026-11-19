import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';

const MOVE_RATE_LIMIT_MS = 50; // Max 1 move per 50ms (20/sec)
const MAX_MOVE_DISTANCE = 2.0; // Max tiles per tick

export function handleMovement(io: GameServer, socket: GameSocket, gameState: GameStateManager) {
  socket.on('player:move', ({ x, y, facing, animation }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const player = gameState.getPlayer(socket.data.characterId);
    if (!player) return;

    const now = Date.now();
    if (now - player.lastMovement < MOVE_RATE_LIMIT_MS) return;

    // Validate movement distance
    const dist = Math.sqrt(Math.pow(x - player.x, 2) + Math.pow(y - player.y, 2));
    if (dist > MAX_MOVE_DISTANCE * 2) {
      // Too large — reject
      socket.emit('connect:ack', {
        playerId: player.id,
        characterId: player.characterId,
        region: player.region,
        x: player.x,
        y: player.y,
      });
      return;
    }

    const moved = gameState.updatePlayerPosition(socket.data.characterId, x, y, facing);
    if (!moved) return;

    if (animation) player.animation = animation;

    // Broadcast to nearby players in region
    socket.to(`region:${player.region}`).emit('player:move', {
      playerId: player.characterId,
      x,
      y,
      animation: animation ?? 'walk',
      facing: facing ?? player.facing,
    });
  });
}
