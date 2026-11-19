export type TileType =
  | 'grass' | 'dirt' | 'stone' | 'water' | 'sand'
  | 'snow' | 'lava' | 'void' | 'wood_floor' | 'cobblestone'
  | 'deep_water' | 'ice' | 'volcanic_rock';

export type RegionId =
  | 'greenfall' | 'aurelia' | 'silverwood'
  | 'ashen_mountains' | 'frostmere' | 'emberlands' | 'the_void';

export type PvpZoneType = 'safe' | 'normal' | 'dangerous' | 'full_pvp';

export interface WorldRegion {
  id: RegionId;
  name: string;
  description: string;
  pvpZone: PvpZoneType;
  minLevel: number;
  spawnPoint: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ambientColor?: string;
}

export interface ChunkCoord {
  chunkX: number;
  chunkY: number;
  region: RegionId;
}

export interface Tile {
  type: TileType;
  walkable: boolean;
  elevation: number;
  metadata?: Record<string, unknown>;
}

export interface WorldObject {
  id: string;
  type: string;
  x: number;
  y: number;
  z?: number;
  walkable: boolean;
  interactable: boolean;
  metadata?: Record<string, unknown>;
}

export interface ResourceNode {
  id: string;
  type: 'ore' | 'tree' | 'fish' | 'herb' | 'crop';
  resourceId: string;
  x: number;
  y: number;
  depleted: boolean;
  respawnAt?: number;
  requiredLevel?: number;
  requiredTool?: string;
}

export interface WorldChunk {
  coord: ChunkCoord;
  tiles: Tile[][];
  objects: WorldObject[];
  resourceNodes: ResourceNode[];
  seed: number;
}

export const CHUNK_SIZE = 32;
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
