import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EtheriaSocket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import type { WorldChunk } from '@etheria/shared';

const CHUNK_SIZE = 32;
const TILE_SIZE = 1;
const MODEL_ROOT = '/assets/3d';

type Point = { x: number; y: number };
type Clickable = { kind: 'resource' | 'monster'; id: string };

export class ThreeWorld {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private loader = new GLTFLoader();
  private socket: EtheriaSocket;
  private container: HTMLElement;
  private player = new THREE.Group();
  private playerPos: Point;
  private destination: Point | null = null;
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private chunks = new Set<string>();
  private resourceObjects = new Map<string, any>();
  private remotePlayers = new Map<string, THREE.Group>();
  private monsters = new Map<string, THREE.Group>();
  private lastMoveSent = 0;
  private frame = 0;
  private disposed = false;
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
    }
  };
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
  private onPointerDown = (event: PointerEvent) => this.handlePointer(event);
  private onResize = () => this.resize();

  private handlers = {
    ack: () => this.requestChunks(),
    chunk: ({ chunk }: any) => this.renderChunk(chunk as WorldChunk),
    playerSpawn: ({ player }: any) => this.spawnRemotePlayer(player),
    playerMove: ({ playerId, x, y }: any) => {
      const remote = this.remotePlayers.get(playerId);
      if (remote) remote.position.set(x, 0, y);
    },
    playerDespawn: ({ playerId }: any) => {
      const remote = this.remotePlayers.get(playerId);
      if (remote) this.scene.remove(remote);
      this.remotePlayers.delete(playerId);
    },
    monsterSpawn: ({ monster }: any) => this.spawnMonster(monster),
    monsterUpdate: ({ monster }: any) => {
      const mesh = this.monsters.get(monster.id);
      if (mesh) mesh.position.set(monster.x, 0, monster.y);
    },
    monsterDeath: ({ monsterId }: any) => {
      const mesh = this.monsters.get(monsterId);
      if (mesh) this.scene.remove(mesh);
      this.monsters.delete(monsterId);
    },
    damage: ({ targetId, damage, isCrit }: any) => {
      const target = this.monsters.get(targetId) ??
        (targetId === useGameStore.getState().character?.id ? this.player : null);
      if (target) {
        this.showDamage(target.position, damage, Boolean(isCrit));
        this.showSkillEffect(target.position, isCrit ? 'arcane' : 'impact');
      }
    },
    abilityUsed: ({ casterId, abilityId, targetId, targetX, targetY }: any) => {
      const caster = casterId === useGameStore.getState().character?.id
        ? this.player
        : this.remotePlayers.get(casterId);
      const target = targetId ? (this.monsters.get(targetId) ?? this.remotePlayers.get(targetId)) : null;
      const position = target?.position ??
        (typeof targetX === 'number' && typeof targetY === 'number'
          ? new any(targetX, 0, targetY)
          : caster?.position);
      if (position) this.showSkillEffect(position, String(abilityId));
    },
  };

  constructor(container: HTMLElement, socket: EtheriaSocket) {
    this.container = container;
    this.socket = socket;
    const state = useGameStore.getState();
    this.playerPos = {
      x: state.playerPos?.x ?? state.character?.position?.x ?? 16,
      y: state.playerPos?.y ?? state.character?.position?.y ?? 16,
    };

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x101713, 1);
    this.container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x101713);
    this.scene.fog = new THREE.FogExp2(0x18231d, 0.012);
    this.camera.position.set(this.playerPos.x + 10, 15, this.playerPos.y + 13);
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.y);

    this.addLighting();
    this.addGroundBase();
    this.createActor(this.player, 0x8e9c78, 0x252b27);
    this.player.position.set(this.playerPos.x, 0, this.playerPos.y);
    this.scene.add(this.player);
    this.loadModel(this.player, `${MODEL_ROOT}/characters/player.glb`);

    this.socket.on('connect:ack', this.handlers.ack);
    this.socket.on('world:chunk', this.handlers.chunk);
    this.socket.on('player:spawn', this.handlers.playerSpawn);
    this.socket.on('player:move', this.handlers.playerMove);
    this.socket.on('player:despawn', this.handlers.playerDespawn);
    this.socket.on('combat:monster_spawn', this.handlers.monsterSpawn);
    this.socket.on('combat:monster_update', this.handlers.monsterUpdate);
    this.socket.on('combat:monster_death', this.handlers.monsterDeath);
    this.socket.on('combat:damage', this.handlers.damage);
    this.socket.on('combat:ability_used', this.handlers.abilityUsed);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.resize();
    this.animate();
  }

  private addLighting() {
    this.scene.add(new THREE.HemisphereLight(0xb9d6c1, 0x25251e, 1.8));
    const sun = new THREE.DirectionalLight(0xffdfb0, 2.2);
    sun.position.set(-35, 65, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8aa7c8, 0.45);
    fill.position.set(30, 20, -35);
    this.scene.add(fill);
  }

  private addGroundBase() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x263d2d, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    ground.name = 'greenfall-ground';
    this.scene.add(ground);
  }

  private createActor(group: THREE.Group, bodyColor: number, cloakColor: number) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.62, 4, 8),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.82 })
    );
    body.position.y = 0.72;
    body.castShadow = true;
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.72, 6),
      new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 0.95 })
    );
    cloak.position.set(0, 0.66, 0.12);
    cloak.rotation.x = Math.PI;
    cloak.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9a98a, roughness: 0.9 })
    );
    head.position.y = 1.28;
    head.castShadow = true;
    group.add(body, cloak, head);
  }

  private loadModel(target: THREE.Group, path: string) {
    this.loader.load(path, (gltf) => {
      if (this.disposed) return;
      const model = gltf.scene;
      model.scale.setScalar(1);
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      target.clear();
      target.add(model);
    }, undefined, () => {
      // Keep the procedural actor when optional Quaternius files have not been installed.
    });
  }

  private tileColor(type: string) {
    const colors: Record<string, number> = {
      grass: 0x496b43, forest_grass: 0x344f35, dirt: 0x66513b,
      stone: 0x686c64, water: 0x315d67, sand: 0x9b875b,
      cobblestone: 0x65635a, wood_floor: 0x765a3e,
    };
    return colors[type] ?? 0x496b43;
  }

  private renderChunk(chunk: WorldChunk) {
    if (!chunk?.coord || !Array.isArray(chunk.tiles)) return;
    const { chunkX, chunkY } = chunk.coord;
    const chunkKey = `${chunk.coord.region}_${chunkX}_${chunkY}`;
    if (this.chunks.has(chunkKey)) return;
    this.chunks.add(chunkKey);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertex = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.tiles[z]?.[x];
        if (!tile) continue;
        const wx = chunkX * CHUNK_SIZE + x;
        const wz = chunkY * CHUNK_SIZE + z;
        const y = (tile.elevation || 0) * 0.12;
        const color = new THREE.Color(this.tileColor(String(tile.type)));
        positions.push(
          wx, y, wz,
          wx + TILE_SIZE, y, wz,
          wx + TILE_SIZE, y, wz + TILE_SIZE,
          wx, y, wz + TILE_SIZE
        );
        for (let i = 0; i < 4; i++) colors.push(color.r, color.g, color.b);
        indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
        vertex += 4;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    );
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    for (const object of chunk.objects ?? []) {
      const prop = this.createProp(String(object.type));
      prop.position.set(object.x, (object.z || 0) * 0.12, object.y);
      this.scene.add(prop);
    }

    for (const node of chunk.resourceNodes ?? []) {
      if (node.depleted) continue;
      const prop = this.createResource(String(node.resourceId));
      prop.position.set(node.x, 0, node.y);
      prop.userData.clickable = { kind: 'resource', id: node.id } satisfies Clickable;
      this.resourceObjects.set(node.id, prop);
      this.scene.add(prop);
    }
  }

  private createProp(type: string) {
    const group = new THREE.Group();
    if (type.includes('tree') || type.includes('forest')) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x55402e })
      );
      trunk.position.y = 0.8;
      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05, 1),
        new THREE.MeshStandardMaterial({ color: 0x355b3d, roughness: 0.95, flatShading: true })
      );
      canopy.position.y = 2;
      canopy.scale.set(1, 1.1, 0.9);
      canopy.castShadow = true;
      group.add(trunk, canopy);
      this.loadModel(group, `${MODEL_ROOT}/environment/tree.glb`);
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: 0x62665b, roughness: 1, flatShading: true })
      );
      rock.position.y = 0.38;
      rock.castShadow = true;
      group.add(rock);
    }
    return group;
  }

  private createResource(resourceId: string) {
    const group = new THREE.Group();
    const isOre = /ore|copper|tin|iron|silver|gold/i.test(resourceId);
    const color = isOre ? 0x91a2a0 : 0x74a65d;
    const mesh = new THREE.Mesh(
      isOre ? new THREE.OctahedronGeometry(0.42, 0) : new THREE.IcosahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({ color, emissive: isOre ? 0x142a2b : 0x10220d, flatShading: true })
    );
    mesh.position.y = 0.45;
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }

  private spawnRemotePlayer(player: any) {
    if (!player?.characterId || this.remotePlayers.has(player.characterId)) return;
    const group = new THREE.Group();
    this.createActor(group, 0x9b8e70, 0x333b36);
    group.position.set(player.x, 0, player.y);
    this.scene.add(group);
    this.remotePlayers.set(player.characterId, group);
    this.loadModel(group, `${MODEL_ROOT}/characters/player.glb`);
  }

  private spawnMonster(monster: any) {
    if (!monster?.id || this.monsters.has(monster.id)) return;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.58, 1),
      new THREE.MeshStandardMaterial({ color: 0x65734b, roughness: 0.9, flatShading: true })
    );
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);
    group.position.set(monster.x, 0, monster.y);
    group.userData.clickable = { kind: 'monster', id: monster.id } satisfies Clickable;
    this.scene.add(group);
    this.monsters.set(monster.id, group);
    this.loadModel(group, `${MODEL_ROOT}/monsters/greenfall/creature.glb`);
  }

  private showDamage(position: any, damage: number, critical: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = 'bold 48px Georgia';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#17130f';
    ctx.fillStyle = critical ? '#ffb05a' : '#f0dfbd';
    const label = `${critical ? 'CRIT ' : ''}${damage}`;
    ctx.strokeText(label, 128, 62);
    ctx.fillText(label, 128, 62);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.copy(position).add(new any(0, 2.3, 0));
    sprite.scale.set(2.2, 0.82, 1);
    this.scene.add(sprite);
    const start = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const t = (performance.now() - start) / 800;
      sprite.position.y += 0.012;
      sprite.material.opacity = Math.max(0, 1 - t);
      if (t >= 1) {
        this.scene.remove(sprite);
        texture.dispose();
        sprite.material.dispose();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private showSkillEffect(position: any, abilityId: string) {
    const key = abilityId.toLowerCase();
    const color = key.includes('fire') ? 0xff793d
      : key.includes('ice') || key.includes('frost') ? 0x82dfff
      : key.includes('heal') || key.includes('light') ? 0x8ee6a5
      : key.includes('shadow') || key.includes('void') ? 0x9b79e8
      : 0xc9a7ff;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 32), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(position).add(new any(0, 0.12, 0));
    this.scene.add(ring);

    const particles: any[] = [];
    const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < 12; i++) {
      const particle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), particleMaterial);
      particle.position.copy(ring.position);
      particles.push(particle);
      this.scene.add(particle);
    }

    const start = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const progress = Math.min(1, (performance.now() - start) / 520);
      ring.scale.setScalar(1 + progress * 5);
      ringMaterial.opacity = 0.9 * (1 - progress);
      particles.forEach((particle, index) => {
        const angle = (index / particles.length) * Math.PI * 2;
        const radius = 0.35 + progress * 1.35;
        particle.position.x = position.x + Math.cos(angle) * radius;
        particle.position.z = position.z + Math.sin(angle) * radius;
        particle.position.y = position.y + 0.2 + progress * (0.6 + (index % 3) * 0.12);
        particle.scale.setScalar(1 - progress);
      });
      if (progress >= 1) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        ringMaterial.dispose();
        particles.forEach((particle) => {
          this.scene.remove(particle);
          particle.geometry.dispose();
        });
        particleMaterial.dispose();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private requestChunks() {
    if (!this.socket.connected) return;
    const cx = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const cy = Math.floor(this.playerPos.y / CHUNK_SIZE);
    const region = useGameStore.getState().currentRegion || 'greenfall';
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        this.socket.emit('world:request_chunk', { chunkX: cx + dx, chunkY: cy + dy, region });
      }
    }
  }

  private handlePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      let node: any | null = hit.object;
      while (node && !node.userData.clickable) node = node.parent;
      const clickable = node?.userData.clickable as Clickable | undefined;
      if (!clickable) continue;
      if (clickable.kind === 'resource') {
        this.socket.emit('gather:start', { nodeId: clickable.id });
      } else {
        useGameStore.getState().setTarget(clickable.id, 'monster');
        this.socket.emit('combat:attack', { targetId: clickable.id });
      }
      return;
    }
    const ground = new THREE.Plane(new any(0, 1, 0), 0);
    const point = new any();
    if (this.raycaster.ray.intersectPlane(ground, point)) {
      this.destination = { x: point.x, y: point.z };
    }
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      this.playerPos.x += (dx / length) * 3.5 * delta;
      this.playerPos.y += (dy / length) * 3.5 * delta;
      this.destination = null;
    } else if (this.destination) {
      const vx = this.destination.x - this.playerPos.x;
      const vy = this.destination.y - this.playerPos.y;
      const distance = Math.hypot(vx, vy);
      if (distance < 0.12) this.destination = null;
      else {
        const step = Math.min(distance, 3.5 * delta);
        this.playerPos.x += (vx / distance) * step;
        this.playerPos.y += (vy / distance) * step;
      }
    }

    this.player.position.set(this.playerPos.x, 0, this.playerPos.y);
    const desired = new any(this.playerPos.x + 9, 13, this.playerPos.y + 11);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.y);

    const now = performance.now();
    if (now - this.lastMoveSent > 66) {
      this.lastMoveSent = now;
      useGameStore.getState().setPlayerPos({ x: this.playerPos.x, y: this.playerPos.y });
      if (this.socket.connected) {
        this.socket.emit('player:move', {
          x: this.playerPos.x,
          y: this.playerPos.y,
          facing: dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north',
        });
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.socket.off('connect:ack', this.handlers.ack);
    this.socket.off('world:chunk', this.handlers.chunk);
    this.socket.off('player:spawn', this.handlers.playerSpawn);
    this.socket.off('player:move', this.handlers.playerMove);
    this.socket.off('player:despawn', this.handlers.playerDespawn);
    this.socket.off('combat:monster_spawn', this.handlers.monsterSpawn);
    this.socket.off('combat:monster_update', this.handlers.monsterUpdate);
    this.socket.off('combat:monster_death', this.handlers.monsterDeath);
    this.socket.off('combat:damage', this.handlers.damage);
    this.socket.off('combat:ability_used', this.handlers.abilityUsed);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
