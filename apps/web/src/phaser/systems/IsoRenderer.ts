export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/**
 * Screen X = (worldX - worldY) * (TILE_WIDTH / 2)
 * Screen Y = (worldX + worldY) * (TILE_HEIGHT / 2)
 */
export function worldToScreen(worldX: number, worldY: number, elevation: number = 0): { x: number; y: number } {
  return {
    x: (worldX - worldY) * (TILE_WIDTH / 2),
    y: (worldX + worldY) * (TILE_HEIGHT / 2) - elevation * 16,
  };
}

/**
 * Inverse isometric projection
 */
export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const x = (screenX / halfW + screenY / halfH) / 2;
  const y = (screenY / halfH - screenX / halfW) / 2;
  return {
    x: Math.floor(x),
    y: Math.floor(y),
  };
}
