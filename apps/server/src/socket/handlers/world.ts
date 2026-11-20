
import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import { WorldGenerator } from '@etheria/world-generator';
import { REGIONS } from '@etheria/shared';

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
  io: GameServer,
  socket: GameSocket,
  gameState: GameStateManager
) {

  socket.on('player:teleport_request', async ({ region }) => {
    if (!socket.data.authenticated) return;
    const player = gameState.getPlayerBySocket(socket.id);
    const destination = REGIONS[region];
    if (!player || !destination || region === player.region) {
      socket.emit('server:error', { code: 'INVALID_TELEPORT', message: 'This destination is unavailable.' });
      return;
    }
    if (player.level < destination.minLevel) {
      socket.emit('server:error', {
        code: 'LEVEL_REQUIREMENT',
        message: `You need level ${destination.minLevel} to enter ${destination.name}.`,
      });
      return;
    }
    const oldRegion = player.region;
    const oldX = player.x;
    const oldY = player.y;
    const { x, y } = destination.spawnPoint;
    if (!gameState.teleportPlayer(player.characterId, region, x, y)) return;

    // Do not tell the client to reload until Supabase confirms the new region.
    const saved = await gameState.persistPlayer(player.characterId);
    if (!saved) {
      gameState.teleportPlayer(player.characterId, oldRegion, oldX, oldY);
      socket.emit('server:error', {
        code: 'TELEPORT_SAVE_FAILED',
        message: 'Travel could not be saved. Please try again.',
      });
      return;
    }

    socket.leave(`region:${oldRegion}`);
    socket.join(`region:${region}`);
    socket.to(`region:${oldRegion}`).emit('player:despawn', { playerId: player.characterId });
    socket.to(`region:${region}`).emit('player:spawn', {
      player: {
        id: player.id, characterId: player.characterId, name: player.name,
        class: player.class, level: player.level, x, y, region,
        hp: player.hp, maxHp: player.maxHp, animation: 'idle', facing: 'south',
      },
    });
    socket.emit('region:teleported', { region, x, y, name: destination.name });
  });

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
