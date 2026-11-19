import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import { WorldGenerator } from '@etheria/world-generator';

const generator = new WorldGenerator(42);
const chunkCache = new Map<string, unknown>();

export function handleWorld(io: GameServer, socket: GameSocket, gameState: GameStateManager) {
  socket.on('world:request_chunk', ({ chunkX, chunkY, region }) => {
    if (!socket.data.authenticated) return;

    const key = `${region}_${chunkX}_${chunkY}`;
    let chunk = chunkCache.get(key);

    if (!chunk) {
      chunk = generator.generateChunk(chunkX, chunkY, region);
      chunkCache.set(key, chunk);
      // Limit cache size
      if (chunkCache.size > 500) {
        const firstKey = chunkCache.keys().next().value;
        if (firstKey) chunkCache.delete(firstKey);
      }
    }

    socket.emit('world:chunk', { chunk: chunk as never });
  });
}
