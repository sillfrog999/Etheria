
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // Ground tiles
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
    this.createIsometricTile('tile_deep_water', 0x1565c0, 0x0d47a1);
    this.createIsometricTile('tile_ice', 0xb3e5fc, 0x4fc3f7);
    this.createIsometricTile('tile_volcanic_rock', 0x4e342e, 0x212121);

    // Player characters
    this.createPlayerSprite('player_mage', 0x4fc3f7, 0x263b80, 0xffffff);
    this.createPlayerSprite('player_fighter', 0xe57373, 0x7f1d1d, 0xffd180);
    this.createPlayerSprite('player_assassin', 0xba68c8, 0x311b50, 0xe1bee7);
    this.createPlayerSprite('player_ranger', 0x81c784, 0x1b5e20, 0xffe0b2);

    // Monsters
    this.createMonsterSprite('monster_wolf', 0x795548);
    this.createMonsterSprite('monster_goblin', 0x4caf50);
    this.createMonsterSprite('monster_spider', 0x212121);
    this.createMonsterSprite('monster_skeleton', 0xe0e0e0);
    this.createMonsterSprite('monster_troll', 0x3e2723);

    // Resource sprites
    this.createResourceSprite('res_tree', 0x2e7d32, 0x5d4037);
    this.createResourceSprite('res_ore_copper', 0xb87333, 0x757575);
    this.createResourceSprite('res_ore_tin', 0xdcdcdc, 0x757575);
    this.createResourceSprite('res_ore_iron', 0x78909c, 0x455a64);
    this.createResourceSprite('res_ore_silver', 0xe0e0e0, 0x9e9e9e);
    this.createResourceSprite('res_ore_gold', 0xffd700, 0xb8860b);
    this.createResourceSprite('res_herb', 0x00e676, 0x1b5e20);

    // World objects
    this.createWorldObjectSprite('object_tree', 0x2e7d32, 0x5d4037, 'tree');
    this.createWorldObjectSprite('object_ancient_tree', 0x1b5e20, 0x4e342e, 'tree');
    this.createWorldObjectSprite('object_frozen_tree', 0xb3e5fc, 0x78909c, 'tree');

    this.createWorldObjectSprite('object_rock', 0x9e9e9e, 0x616161, 'rock');
    this.createWorldObjectSprite('object_boulder', 0x757575, 0x424242, 'rock');
    this.createWorldObjectSprite('object_cliff', 0x616161, 0x212121, 'rock');
    this.createWorldObjectSprite('object_stone_pillar', 0xbdbdbd, 0x616161, 'pillar');

    this.createWorldObjectSprite('object_flower', 0xff80ab, 0x2e7d32, 'flower');
    this.createWorldObjectSprite('object_lamp', 0xffd54f, 0x5d4037, 'lamp');
    this.createWorldObjectSprite('object_fountain', 0x4fc3f7, 0x78909c, 'rock');
    this.createWorldObjectSprite('object_stall', 0xffcc80, 0x5d4037, 'stall');
    this.createWorldObjectSprite('object_ruin', 0x9e9e9e, 0x424242, 'rock');
    this.createWorldObjectSprite('object_ice_crystal', 0x80deea, 0x4fc3f7, 'crystal');
    this.createWorldObjectSprite('object_lava_pool', 0xff5722, 0xbf360c, 'rock');
    this.createWorldObjectSprite('object_ash_pile', 0x616161, 0x212121, 'rock');
    this.createWorldObjectSprite('object_void_crystal', 0x7e57c2, 0x311b92, 'crystal');
    this.createWorldObjectSprite('object_rift', 0x7c4dff, 0x311b92, 'crystal');

    // Fallback object texture
    if (!this.textures.exists('object_rock')) {
      this.createWorldObjectSprite('object_rock', 0x9e9e9e, 0x616161, 'rock');
    }

    // Effects
    this.createParticleSprite('fx_spark', 0xffd700);
    this.createParticleSprite('fx_fire', 0xff3d00);
    this.createParticleSprite('fx_heal', 0x00e676);
  }

  create() {
    this.scene.start('GameScene');
  }

  private createIsometricTile(
    key: string,
    fillColor: number,
    strokeColor: number
  ) {
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

  private createPlayerSprite(
    key: string,
    robeColor: number,
    darkColor: number,
    accentColor: number
  ) {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // Ground shadow
    gfx.fillStyle(0x000000, 0.28);
    gfx.fillEllipse(24, 53, 27, 8);

    // Legs
    gfx.fillStyle(0x292929, 1);
    gfx.fillRect(15, 39, 7, 11);
    gfx.fillRect(26, 39, 7, 11);

    // Boots
    gfx.fillStyle(0x3e2723, 1);
    gfx.fillRect(13, 47, 10, 5);
    gfx.fillRect(25, 47, 10, 5);

    // Arms
    gfx.fillStyle(darkColor, 1);
    gfx.fillRect(8, 23, 8, 17);
    gfx.fillRect(32, 23, 8, 17);

    // Hands
    gfx.fillStyle(0xffd7b5, 1);
    gfx.fillCircle(12, 41, 4);
    gfx.fillCircle(36, 41, 4);

    // Main robe / armor
    gfx.fillStyle(robeColor, 1);
    gfx.fillPoints([
      { x: 15, y: 19 },
      { x: 33, y: 19 },
      { x: 38, y: 43 },
      { x: 10, y: 43 },
    ], true);

    // Chest detail
    gfx.fillStyle(accentColor, 1);
    gfx.fillRect(21, 23, 6, 13);

    // Belt
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(13, 37, 22, 4);

    // Head
    gfx.fillStyle(0xffd7b5, 1);
    gfx.fillCircle(24, 13, 10);

    // Hair
    gfx.fillStyle(darkColor, 1);
    gfx.fillRect(15, 5, 18, 5);
    gfx.fillRect(14, 8, 4, 8);
    gfx.fillRect(30, 8, 4, 7);

    // Eyes
    gfx.fillStyle(0x212121, 1);
    gfx.fillCircle(20, 14, 1.2);
    gfx.fillCircle(28, 14, 1.2);

    // Class-specific accessory
    if (key === 'player_mage') {
      // Mage hat
      gfx.fillStyle(darkColor, 1);
      gfx.fillTriangle(24, -3, 12, 10, 36, 10);
      gfx.fillStyle(accentColor, 1);
      gfx.fillRect(16, 8, 16, 3);
    } else if (key === 'player_fighter') {
      // Fighter shoulder armor
      gfx.fillStyle(accentColor, 1);
      gfx.fillRect(8, 20, 9, 7);
      gfx.fillRect(31, 20, 9, 7);
    } else if (key === 'player_assassin') {
      // Assassin hood
      gfx.fillStyle(darkColor, 1);
      gfx.fillTriangle(24, 0, 11, 17, 37, 17);
      gfx.fillStyle(accentColor, 1);
      gfx.fillRect(17, 15, 14, 3);
    } else if (key === 'player_ranger') {
      // Ranger hood and shoulder strap
      gfx.fillStyle(darkColor, 1);
      gfx.fillTriangle(24, 1, 13, 13, 35, 13);
      gfx.lineStyle(3, accentColor, 1);
      gfx.lineBetween(16, 23, 31, 38);
    }

    gfx.generateTexture(key, 48, 58);
    gfx.destroy();
  }

  private createMonsterSprite(key: string, color: number) {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(16, 29, 25, 7);

    gfx.fillStyle(color, 1);
    gfx.fillRect(6, 8, 20, 19);

    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(11, 15, 2);
    gfx.fillCircle(21, 15, 2);

    gfx.lineStyle(2, 0x212121, 1);
    gfx.strokeRect(6, 8, 20, 19);

    gfx.generateTexture(key, 32, 36);
    gfx.destroy();
  }

  private createResourceSprite(
    key: string,
    topColor: number,
    baseColor: number
  ) {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    gfx.fillStyle(baseColor, 1);
    gfx.fillRect(12, 18, 8, 14);

    gfx.fillStyle(topColor, 1);
    gfx.fillCircle(16, 12, 12);

    gfx.generateTexture(key, 32, 32);
    gfx.destroy();
  }

  private createWorldObjectSprite(
    key: string,
    topColor: number,
    baseColor: number,
    shape: string
  ) {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(24, 43, 35, 9);

    if (shape === 'tree') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillRect(19, 23, 10, 22);

      gfx.fillStyle(topColor, 1);
      gfx.fillCircle(24, 18, 16);
      gfx.fillCircle(14, 24, 10);
      gfx.fillCircle(34, 24, 10);
    } else if (shape === 'flower') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillRect(23, 24, 3, 18);

      gfx.fillStyle(topColor, 1);
      gfx.fillCircle(24, 19, 7);
      gfx.fillCircle(17, 19, 4);
      gfx.fillCircle(31, 19, 4);

      gfx.fillStyle(0xffeb3b, 1);
      gfx.fillCircle(24, 19, 3);
    } else if (shape === 'pillar') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillRect(15, 10, 18, 32);

      gfx.fillStyle(topColor, 1);
      gfx.fillRect(12, 8, 24, 6);
      gfx.fillRect(12, 39, 24, 5);
    } else if (shape === 'lamp') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillRect(21, 15, 6, 29);

      gfx.fillStyle(topColor, 1);
      gfx.fillCircle(24, 12, 8);
    } else if (shape === 'stall') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillRect(8, 22, 32, 20);

      gfx.fillStyle(topColor, 1);
      gfx.fillTriangle(5, 23, 24, 5, 43, 23);
    } else if (shape === 'crystal') {
      gfx.fillStyle(baseColor, 1);
      gfx.fillTriangle(24, 2, 9, 38, 39, 38);

      gfx.fillStyle(topColor, 0.9);
      gfx.fillTriangle(24, 2, 24, 38, 39, 38);
    } else {
      gfx.fillStyle(baseColor, 1);
      gfx.fillCircle(24, 27, 16);

      gfx.fillStyle(topColor, 1);
      gfx.fillCircle(18, 19, 8);
      gfx.fillCircle(30, 22, 7);
    }

    gfx.generateTexture(key, 48, 48);
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
