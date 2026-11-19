
import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { worldToScreen, screenToWorld } from '../systems/IsoRenderer';
import type { WorldChunk } from '@etheria/shared';

const CHUNK_SIZE = 32;

export class GameScene extends Phaser.Scene {
  private localPlayerSprite!: Phaser.GameObjects.Container;
  private playerPos = { x: 16, y: 16 };
  private targetWorldPos: { x: number; y: number } | null = null;
  private moveSpeed = 3.5;

  private loadedChunks = new Map<string, WorldChunk>();
  private tileSprites = new Map<string, Phaser.GameObjects.Image>();
  private resourceSprites = new Map<string, Phaser.GameObjects.Container>();
  private objectSprites = new Map<string, Phaser.GameObjects.Container>();

  private remotePlayerSprites = new Map<string, Phaser.GameObjects.Container>();
  private monsterSprites = new Map<string, Phaser.GameObjects.Container>();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private lastEmitTime = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const socket = getSocket();
    const store = useGameStore.getState();

    this.playerPos = {
      x: store.playerPos?.x ?? store.character?.position?.x ?? 16,
      y: store.playerPos?.y ?? store.character?.position?.y ?? 16,
    };

    const startScreen = worldToScreen(this.playerPos.x, this.playerPos.y);
    this.cameras.main.centerOn(startScreen.x, startScreen.y);
    this.cameras.main.setZoom(1.2);

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      const currentZoom = this.cameras.main.zoom;
      const newZoom = Phaser.Math.Clamp(currentZoom - deltaY * 0.001, 0.6, 2);
      this.cameras.main.setZoom(newZoom);
    });

    this.createLocalPlayer(
      store.character?.class || 'fighter',
      store.character?.name || 'Adventurer'
    );

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as any;
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const targetGrid = screenToWorld(worldPoint.x, worldPoint.y);

      const clickedResource = this.findResourceAt(targetGrid.x, targetGrid.y);
      if (clickedResource) {
        socket.emit('gather:start', { nodeId: clickedResource.id });
        return;
      }

      const clickedMonster = this.findMonsterAt(targetGrid.x, targetGrid.y);
      if (clickedMonster) {
        useGameStore.getState().setTarget(clickedMonster.id, 'monster');
        socket.emit('combat:attack', { targetId: clickedMonster.id });
        return;
      }

      this.targetWorldPos = targetGrid;
    });

    // Register all event listeners before connecting/authenticating.
    this.setupSocketEvents();

    // Authenticate only after GameScene has registered its listeners.
    const token = useGameStore.getState().token;

    if (token) {
      if (socket.connected) {
        socket.emit('auth', { token });
      } else {
        socket.once('connect', () => {
          socket.emit('auth', { token });
        });
        socket.connect();
      }
    }
  }

  private createLocalPlayer(charClass: string, name: string) {
    this.localPlayerSprite = this.add.container(0, 0);

    const spriteKey = `player_${charClass}`;
    const key = this.textures.exists(spriteKey) ? spriteKey : 'player_fighter';

    const body = this.add.image(0, -24, key);
    const nameTag = this.add.text(0, -53, name, {
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.localPlayerSprite.add([body, nameTag]);
    this.updateSpritePosition(
      this.localPlayerSprite,
      this.playerPos.x,
      this.playerPos.y
    );
  }

  private updateSpritePosition(
    container: Phaser.GameObjects.Container,
    worldX: number,
    worldY: number,
    elevation: number = 0
  ) {
    const screen = worldToScreen(worldX, worldY, elevation);
    container.setPosition(screen.x, screen.y);
    container.setDepth(worldX + worldY + 10);
  }

  private setupSocketEvents() {
    const socket = getSocket();

    // Only request chunks after the server confirms authentication.
    socket.on('connect:ack', () => {
      this.requestSurroundingChunks();
    });

    socket.on('server:error', (data) => {
      console.error('[Etheria Socket]', data);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: data.message || 'Server connection error.',
        timestamp: Date.now()
      });
    });

    socket.on('world:chunk', ({ chunk }) => {
      if (!chunk || !chunk.coord || !Array.isArray(chunk.tiles)) return;

      const key = `${chunk.coord.region}_${chunk.coord.chunkX}_${chunk.coord.chunkY}`;

      if (!this.loadedChunks.has(key)) {
        this.loadedChunks.set(key, chunk);
        this.renderChunk(chunk);
      }
    });

    socket.on('player:move', ({ playerId, x, y }) => {
      const remote = this.remotePlayerSprites.get(playerId);
      if (!remote) return;

      const screen = worldToScreen(x, y);

      this.tweens.add({
        targets: remote,
        x: screen.x,
        y: screen.y,
        duration: 100,
        ease: 'Linear',
      });

      remote.setDepth(x + y + 10);
    });

    socket.on('player:spawn', ({ player }) => {
      useGameStore.getState().setNearbyPlayer(player);

      if (!this.remotePlayerSprites.has(player.characterId)) {
        this.createRemotePlayer(player);
      }
    });

    socket.on('player:despawn', ({ playerId }) => {
      useGameStore.getState().removeNearbyPlayer(playerId);

      const sprite = this.remotePlayerSprites.get(playerId);
      if (sprite) {
        sprite.destroy();
        this.remotePlayerSprites.delete(playerId);
      }
    });

    socket.on('combat:damage', ({ targetId, damage, isCrit }) => {
      const monster = this.monsterSprites.get(targetId);

      if (monster) {
        this.showDamageText(monster.x, monster.y - 30, damage, isCrit);
      } else if (targetId === useGameStore.getState().character?.id) {
        this.showDamageText(
          this.localPlayerSprite.x,
          this.localPlayerSprite.y - 30,
          damage,
          isCrit,
          '#ff4444'
        );
      }
    });

    socket.on('combat:monster_spawn', ({ monster }) => {
      useGameStore.getState().setMonster(monster);
      this.createMonsterSprite(monster);
    });

    socket.on('combat:monster_update', ({ monster }) => {
      useGameStore.getState().setMonster(monster);

      const sprite = this.monsterSprites.get(monster.id);
      if (sprite) {
        this.updateSpritePosition(sprite, monster.x, monster.y);
      }
    });

    socket.on('combat:monster_death', ({ monsterId }) => {
      useGameStore.getState().removeMonster(monsterId);

      const sprite = this.monsterSprites.get(monsterId);
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            sprite.destroy();
            this.monsterSprites.delete(monsterId);
          }
        });
      }
    });
  }

  private renderChunk(chunk: WorldChunk) {
    const { chunkX, chunkY } = chunk.coord;
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;

    // Render ground tiles.
    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tile = chunk.tiles[ty]?.[tx];
        if (!tile) continue;

        const wx = startX + tx;
        const wy = startY + ty;
        const tileKey = `tile_${tile.type}`;
        const textureKey = this.textures.exists(tileKey) ? tileKey : 'tile_grass';
        const screen = worldToScreen(wx, wy, tile.elevation || 0);

        const img = this.add.image(screen.x, screen.y + 16, textureKey);
        img.setDepth(wx + wy);
        this.tileSprites.set(`${wx}_${wy}`, img);
      }
    }

    // Render world objects such as trees, rocks and flowers.
    for (const object of chunk.objects || []) {
      const objectKey = `object_${object.type}`;
      const textureKey = this.textures.exists(objectKey)
        ? objectKey
        : 'object_rock';

      const screen = worldToScreen(object.x, object.y, object.z || 0);
      const container = this.add.container(screen.x, screen.y);

      const img = this.add.image(0, -15, textureKey);
      container.add(img);
      container.setDepth(object.x + object.y + 3);

      this.objectSprites.set(object.id, container);
    }

    // Render resource nodes.
    for (const node of chunk.resourceNodes || []) {
      if (node.depleted) continue;

      let resKey = 'res_tree';

      if (node.resourceId.includes('copper')) resKey = 'res_ore_copper';
      else if (node.resourceId.includes('tin')) resKey = 'res_ore_tin';
      else if (node.resourceId.includes('iron')) resKey = 'res_ore_iron';
      else if (node.resourceId.includes('silver')) resKey = 'res_ore_silver';
      else if (node.resourceId.includes('gold')) resKey = 'res_ore_gold';
      else if (node.resourceId.includes('herb')) resKey = 'res_herb';

      const screen = worldToScreen(node.x, node.y);
      const container = this.add.container(screen.x, screen.y);
      const img = this.add.image(0, -12, resKey);

      container.add(img);
      container.setDepth(node.x + node.y + 4);

      this.resourceSprites.set(node.id, container);
    }
  }

  private createRemotePlayer(player: any) {
    const container = this.add.container(0, 0);

    const spriteKey = `player_${player.class}`;
    const key = this.textures.exists(spriteKey) ? spriteKey : 'player_fighter';

    const body = this.add.image(0, -24, key);
    const nameTag = this.add.text(0, -53, player.name, {
      fontSize: '11px',
      color: '#e0e0e0',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    container.add([body, nameTag]);
    this.updateSpritePosition(container, player.x, player.y);
    this.remotePlayerSprites.set(player.characterId, container);
  }

  private createMonsterSprite(monster: any) {
    if (this.monsterSprites.has(monster.id)) return;

    const container = this.add.container(0, 0);
    const body = this.add.image(0, -12, 'monster_goblin');

    const nameTag = this.add.text(
      0,
      -28,
      `Lv.${monster.level} ${monster.name}`,
      {
        fontSize: '10px',
        color: '#ff8888',
        stroke: '#000',
        strokeThickness: 2
      }
    ).setOrigin(0.5);

    container.add([body, nameTag]);
    this.updateSpritePosition(container, monster.x, monster.y);
    this.monsterSprites.set(monster.id, container);
  }

  private showDamageText(
    x: number,
    y: number,
    damage: number,
    isCrit: boolean,
    color: string = '#ffd700'
  ) {
    const text = this.add.text(
      x,
      y,
      `${isCrit ? 'CRIT! ' : ''}${damage}`,
      {
        fontSize: isCrit ? '16px' : '13px',
        color: isCrit ? '#ff3300' : color,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3
      }
    ).setOrigin(0.5);

    text.setDepth(9999);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private findResourceAt(x: number, y: number) {
    for (const chunk of this.loadedChunks.values()) {
      for (const node of chunk.resourceNodes || []) {
        if (!node.depleted && node.x === x && node.y === y) {
          return node;
        }
      }
    }

    return null;
  }

  private findMonsterAt(x: number, y: number) {
    const monsters = useGameStore.getState().monsters;

    for (const monster of monsters.values()) {
      if (
        Math.round(monster.x) === x &&
        Math.round(monster.y) === y &&
        monster.state !== 'dead'
      ) {
        return monster;
      }
    }

    return null;
  }

  private requestSurroundingChunks() {
    const socket = getSocket();

    if (!socket.connected) return;

    const curChunkX = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const curChunkY = Math.floor(this.playerPos.y / CHUNK_SIZE);
    const region = useGameStore.getState().currentRegion || 'greenfall';

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        socket.emit('world:request_chunk', {
          chunkX: curChunkX + dx,
          chunkY: curChunkY + dy,
          region
        });
      }
    }
  }

  update(_time: number, delta: number) {
    if (!this.localPlayerSprite || !this.localPlayerSprite.active) return;

    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;

    if (this.wasdKeys) {
      if (this.wasdKeys.up?.isDown || this.cursors?.up?.isDown) dy -= 1;
      if (this.wasdKeys.down?.isDown || this.cursors?.down?.isDown) dy += 1;
      if (this.wasdKeys.left?.isDown || this.cursors?.left?.isDown) dx -= 1;
      if (this.wasdKeys.right?.isDown || this.cursors?.right?.isDown) dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;

      this.playerPos.x += dx * this.moveSpeed * dt;
      this.playerPos.y += dy * this.moveSpeed * dt;
      this.targetWorldPos = null;
    } else if (this.targetWorldPos) {
      const dist = Phaser.Math.Distance.Between(
        this.playerPos.x,
        this.playerPos.y,
        this.targetWorldPos.x,
        this.targetWorldPos.y
      );

      if (dist < 0.15) {
        this.targetWorldPos = null;
      } else {
        const step = this.moveSpeed * dt;
        this.playerPos.x += ((this.targetWorldPos.x - this.playerPos.x) / dist) * step;
        this.playerPos.y += ((this.targetWorldPos.y - this.playerPos.y) / dist) * step;
      }
    }

    this.updateSpritePosition(
      this.localPlayerSprite,
      this.playerPos.x,
      this.playerPos.y
    );

    this.cameras.main.startFollow(
      this.localPlayerSprite,
      true,
      0.08,
      0.08
    );

    const now = Date.now();

    if (now - this.lastEmitTime > 66) {
      this.lastEmitTime = now;

      useGameStore.getState().setPlayerPos({
        x: this.playerPos.x,
        y: this.playerPos.y
      });

      const socket = getSocket();

      if (socket.connected) {
        socket.emit('player:move', {
          x: this.playerPos.x,
          y: this.playerPos.y,
          facing: dx > 0
            ? 'east'
            : dx < 0
              ? 'west'
              : dy > 0
                ? 'south'
                : 'north',
        });
      }
    }
  }
}
