import type { WorldChunk, Tile, TileType, ResourceNode, WorldObject, RegionId } from '@etheria/shared';
import { CHUNK_SIZE } from '@etheria/shared';
import { fbm, hash2d, mulberry32 } from './noise.js';

export const WORLD_SEED = 42;

interface ResourceDef {
  type: 'ore' | 'tree' | 'fish' | 'herb' | 'crop';
  resourceId: string;
  density: number;
  requiredLevel?: number;
  requiredTool?: string;
}

interface RegionRules {
  primaryTile: TileType;
  secondaryTile: TileType;
  waterTile: TileType;
  waterThreshold: number;
  elevationScale: number;
  resourceTypes: ResourceDef[];
  objectTypes: string[];
}

const REGION_RULES: Record<string, RegionRules> = {
  greenfall: {
    primaryTile: 'grass', secondaryTile: 'dirt', waterTile: 'water',
    waterThreshold: 0.25, elevationScale: 0.4,
    resourceTypes: [
      { type: 'ore', resourceId: 'copper_ore', density: 0.04, requiredLevel: 1, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'tin_ore', density: 0.03, requiredLevel: 1, requiredTool: 'pickaxe' },
      { type: 'tree', resourceId: 'wood', density: 0.08, requiredLevel: 1, requiredTool: 'axe' },
      { type: 'herb', resourceId: 'herbs', density: 0.03, requiredLevel: 1 },
    ],
    objectTypes: ['tree', 'rock', 'flower'],
  },
  aurelia: {
    primaryTile: 'cobblestone', secondaryTile: 'wood_floor', waterTile: 'water',
    waterThreshold: 0.1, elevationScale: 0.1,
    resourceTypes: [],
    objectTypes: ['lamp', 'fountain', 'stall'],
  },
  silverwood: {
    primaryTile: 'grass', secondaryTile: 'dirt', waterTile: 'water',
    waterThreshold: 0.2, elevationScale: 0.3,
    resourceTypes: [
      { type: 'tree', resourceId: 'ancient_wood', density: 0.1, requiredLevel: 30, requiredTool: 'axe' },
      { type: 'herb', resourceId: 'rare_herbs', density: 0.05, requiredLevel: 20 },
    ],
    objectTypes: ['ancient_tree', 'ruin', 'stone_pillar'],
  },
  ashen_mountains: {
    primaryTile: 'stone', secondaryTile: 'dirt', waterTile: 'water',
    waterThreshold: 0.1, elevationScale: 0.7,
    resourceTypes: [
      { type: 'ore', resourceId: 'iron_ore', density: 0.07, requiredLevel: 15, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'coal', density: 0.06, requiredLevel: 10, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'mithril_ore', density: 0.015, requiredLevel: 50, requiredTool: 'pickaxe' },
    ],
    objectTypes: ['boulder', 'cliff'],
  },
  frostmere: {
    primaryTile: 'snow', secondaryTile: 'ice', waterTile: 'deep_water',
    waterThreshold: 0.2, elevationScale: 0.5,
    resourceTypes: [
      { type: 'ore', resourceId: 'silver_ore', density: 0.05, requiredLevel: 30, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'crystal_shards', density: 0.02, requiredLevel: 40, requiredTool: 'pickaxe' },
    ],
    objectTypes: ['ice_crystal', 'frozen_tree'],
  },
  emberlands: {
    primaryTile: 'volcanic_rock', secondaryTile: 'stone', waterTile: 'lava',
    waterThreshold: 0.3, elevationScale: 0.6,
    resourceTypes: [
      { type: 'ore', resourceId: 'obsidian', density: 0.06, requiredLevel: 60, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'void_essence', density: 0.01, requiredLevel: 70, requiredTool: 'pickaxe' },
    ],
    objectTypes: ['lava_pool', 'ash_pile'],
  },
  the_void: {
    primaryTile: 'void', secondaryTile: 'stone', waterTile: 'void',
    waterThreshold: 0.4, elevationScale: 0.8,
    resourceTypes: [
      { type: 'ore', resourceId: 'void_essence', density: 0.08, requiredLevel: 70, requiredTool: 'pickaxe' },
      { type: 'ore', resourceId: 'arcane_dust', density: 0.05, requiredLevel: 60 },
    ],
    objectTypes: ['void_crystal', 'rift'],
  },
};

export class WorldGenerator {
  private seed: number;

  constructor(seed: number = WORLD_SEED) {
    this.seed = seed;
  }

  generateChunk(chunkX: number, chunkY: number, region: string): WorldChunk {
    const rules = REGION_RULES[region] ?? REGION_RULES['greenfall']!;
    const tiles: Tile[][] = [];
    const resourceNodes: ResourceNode[] = [];
    const objects: WorldObject[] = [];
    const rng = mulberry32(this.seed ^ (chunkX * 73856093) ^ (chunkY * 19349663));

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      tiles[ty] = [];
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const worldX = chunkX * CHUNK_SIZE + tx;
        const worldY = chunkY * CHUNK_SIZE + ty;

        const noiseVal = fbm(worldX / 40, worldY / 40, this.seed, 4);
        const elevNoise = fbm(worldX / 80, worldY / 80, this.seed + 9999, 3);
        const elevation = elevNoise * rules.elevationScale;

        let tileType: TileType;
        let walkable = true;

        if (noiseVal < rules.waterThreshold) {
          tileType = rules.waterTile;
          walkable = false;
        } else if (noiseVal < rules.waterThreshold + 0.1) {
          tileType = rules.secondaryTile;
        } else {
          tileType = rules.primaryTile;
        }

        tiles[ty]![tx] = { type: tileType, walkable, elevation };

        if (walkable) {
          for (const res of rules.resourceTypes) {
            const resNoise = hash2d(worldX + 100000, worldY, this.seed + res.resourceId.length);
            if (resNoise < res.density) {
              const nodeId = `${region}_${worldX}_${worldY}_${res.resourceId}`;
              resourceNodes.push({
                id: nodeId, type: res.type, resourceId: res.resourceId,
                x: worldX, y: worldY, depleted: false,
                requiredLevel: res.requiredLevel, requiredTool: res.requiredTool,
              });
              break;
            }
          }

          // Decorative props use their own world-coordinate hash so their
          // distribution stays stable when resource generation changes.
          // A 7% density makes rocks and flowers visible around the player,
          // instead of leaving Greenfall looking like an almost empty field.
          const objectRoll = hash2d(worldX + 200000, worldY, this.seed + 777);
          if (objectRoll < 0.07 && rules.objectTypes.length > 0) {
            const typeRoll = hash2d(worldX, worldY + 300000, this.seed + 333);
            const index = Math.floor(typeRoll * rules.objectTypes.length);
            const objType = rules.objectTypes[index];
            if (objType) {
              objects.push({
                id: `obj_${region}_${worldX}_${worldY}`,
                type: objType, x: worldX, y: worldY,
                walkable: true, interactable: false,
              });
            }
          }
        }
      }
    }

    return {
      coord: { chunkX, chunkY, region: region as RegionId },
      tiles, objects, resourceNodes, seed: this.seed,
    };
  }

  getChunkCoord(worldX: number, worldY: number): { chunkX: number; chunkY: number } {
    return {
      chunkX: Math.floor(worldX / CHUNK_SIZE),
      chunkY: Math.floor(worldY / CHUNK_SIZE),
    };
  }
}
