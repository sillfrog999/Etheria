import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // Generate all placeholder isometric textures programmatically so no external assets can fail
    this.createIsometricTile('tile_grass', 0x4caf50, 0x388e3c);
    this.createIsometricTile('tile_dirt', 0x8d6e63, 0x5d4037);
    this.createIsometricTile('tile_stone', 0x9e9e9e, 0x616161);
    this.createIsometricTile('tile_water', 0x29b6f6, 0x0288d1);
    this.createIsometricTile('tile_sand', 0xffe082, 0xffca28);
    this.createIsometricTile('tile_cobblestone', 0x757575, 0x424242);
    this.createIsometricTile('tile_wood_floor', 0xa1887f, 0x6d4c41);
    this.createIsometricTile('tile_snow', 0xe0f7fa, 0xb2ebf2);
    this.createIsometricTile('tile_lava', 0xff5722, 0xd84315);
    this.createIsometricTile('tile_void', 0x311b92, 0x1a237e);

    // Entities
    this.createCircleSprite('player_mage', 0x4fc3f7, 0xffffff);
    this.createCircleSprite('player_fighter', 0xe57373, 0xffffff);
    this.createCircleSprite('player_assassin', 0xba68c8, 0xffffff);
    this.createCircleSprite('player_ranger', 0x81c784, 0xffffff);

    // Monsters
    this.createMonsterSprite('monster_wolf', 0x795548);
    this.createMonsterSprite('monster_goblin', 0x4caf50);
    this.createMonsterSprite('monster_spider', 0x212121);
    this.createMonsterSprite('monster_skeleton', 0xe0e0e0);
    this.createMonsterSprite('monster_troll', 0x3e2723);

    // Resources
    this.createResourceSprite('res_tree', 0x2e7d32, 0x5d4037);
    this.createResourceSprite('res_ore_copper', 0xb87333, 0x757575);
    this.createResourceSprite('res_ore_tin', 0xdcdcdc, 0x757575);
    this.createResourceSprite('res_ore_iron', 0x78909c, 0x455a64);
    this.createResourceSprite('res_ore_silver', 0xe0e0e0, 0x9e9e9e);
    this.createResourceSprite('res_ore_gold', 0xffd700, 0xb8860b);
    this.createResourceSprite('res_herb', 0x00e676, 0x1b5e20);

    // Visual effect particles
    this.createParticleSprite('fx_spark', 0xffd700);
    this.createParticleSprite('fx_fire', 0xff3d00);
    this.createParticleSprite('fx_heal', 0x00e676);
  }

  create() {
    this.scene.start('GameScene');
  }

  private createIsometricTile(key: string, fillColor: number, strokeColor: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    const hw = 32;
    const hh = 16;

    gfx.fillStyle(fillColor, 1);
    gfx.lineStyle(1, strokeColor, 0.8);
    gfx.beginPath();
    gfx.moveTo(hw, 0);
    gfx.lineTo(hw * 2, hh);
    gfx.lineTo(hw, hh * 2);
    gfx.lineTo(0, hh);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();

    gfx.generateTexture(key, 64, 32);
    gfx.destroy();
  }

  private createCircleSprite(key: string, color: number, borderColor: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(color, 1);
    gfx.fillCircle(16, 16, 12);
    gfx.lineStyle(2, borderColor, 1);
    gfx.strokeCircle(16, 16, 12);

    // Facing indicator dot
    gfx.fillStyle(0x000000, 0.8);
    gfx.fillCircle(16, 8, 3);

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createMonsterSprite(key: string, color: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(color, 1);
    gfx.fillRect(6, 6, 20, 20);
    gfx.lineStyle(2, 0xff0000, 0.9);
    gfx.strokeRect(6, 6, 20, 20);

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createResourceSprite(key: string, topColor: number, baseColor: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Base/trunk
    gfx.fillStyle(baseColor, 1);
    gfx.fillRect(12, 18, 8, 14);
    // Top
    gfx.fillStyle(topColor, 1);
    gfx.fillCircle(16, 12, 12);

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createParticleSprite(key: string, color: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(color, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture(key, 8, 8);
    gfx.destroy();
  }
}
