
import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import { WorldGenerator } from '@etheria/world-generator';

const generator = new WorldGenerator(42);
const chunkCache = new Map<string, unknown>();

const VALID_REGIONS = new Set([
  'greenfall',
  'aurelia',
  'silverwood',
  'ashen_mountains',
  'frostmere',
  'emberlands',
  'the_void',
]);

const CHUNK_LIMIT = 100000;

export function handleWorld(
  _io: GameServer,
  socket: GameSocket,
  _gameState: GameStateManager
) {
  socket.on('world:request_chunk', ({ chunkX, chunkY, region }) => {
    // A player must authenticate before requesting world data.
    if (!socket.data.authenticated) {
      return;
    }

    // Validate coordinates.
    if (
      !Number.isSafeInteger(chunkX) ||
      !Number.isSafeInteger(chunkY) ||
      Math.abs(chunkX) > CHUNK_LIMIT ||
      Math.abs(chunkY) > CHUNK_LIMIT
    ) {
      socket.emit('server:error', {
        code: 'INVALID_CHUNK',
        message: 'Invalid world chunk coordinates.',
      });
      return;
    }

    // Validate region.
    if (!VALID_REGIONS.has(region)) {
      socket.emit('server:error', {
        code: 'INVALID_REGION',
        message: 'Unknown world region.',
      });
      return;
    }

    const key = `${region}_${chunkX}_${chunkY}`;

    let chunk = chunkCache.get(key);

    if (!chunk) {
      try {
        chunk = generator.generateChunk(chunkX, chunkY, region);
        chunkCache.set(key, chunk);

        // Prevent unlimited cache growth.
        if (chunkCache.size > 500) {
          const firstKey = chunkCache.keys().next().value;

          if (firstKey) {
            chunkCache.delete(firstKey);
          }
        }
      } catch (error) {
        console.error('[World] Chunk generation failed:', error);

        socket.emit('server:error', {
          code: 'CHUNK_GENERATION_FAILED',
          message: 'Could not generate this world area.',
        });

        return;
      }
    }

    socket.emit('world:chunk', {
      chunk: chunk as never,
    });
  });
}
