import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EtheriaSocket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import type { WorldChunk } from '@etheria/shared';

const CHUNK_SIZE = 32;
const TILE_SIZE = 1;
const MODEL_ROOT = '/assets/3d';

type Point = { x: number; y: number };
type Clickable = { kind: 'resource' | 'monster' | 'npc'; id: string };

export class ThreeWorld {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  private renderer: any;
  private clock = new THREE.Clock();
  private loader = new GLTFLoader();
  private natureModelCache = new Map<string, Promise<THREE.Group>>();
  private natureRoot = `${MODEL_ROOT}/imports/asset3/glTF`;
  private socket: EtheriaSocket;
  private container: HTMLElement;
  private player = new THREE.Group();
  private playerPos: Point;
  private moveVelocity = new THREE.Vector2();
  private attackAnimUntil = 0;
  private destination: Point | null = null;
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private chunks = new Set<string>();
  private resourceObjects = new Map<string, any>();
  private remotePlayers = new Map<string, any>();
  private monsters = new Map<string, any>();
  private npcs = new Map<string, THREE.Group>();
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
      if (remote) {
        const dx = x - remote.position.x;
        const dy = y - remote.position.z;
        if (Math.hypot(dx, dy) > 0.02) remote.rotation.y = Math.atan2(dx, dy);
        remote.userData.destination = new THREE.Vector3(x, 0, y);
      }
    },
    playerDespawn: ({ playerId }: any) => {
      const remote = this.remotePlayers.get(playerId);
      if (remote) this.scene.remove(remote);
      this.remotePlayers.delete(playerId);
    },
    monsterSpawn: ({ monster }: any) => this.spawnMonster(monster),
    monsterUpdate: ({ monster }: any) => {
      const mesh = this.monsters.get(monster.id);
      if (mesh) {
        mesh.userData.destination = new THREE.Vector3(monster.x, 0, monster.y);
        mesh.userData.state = monster.state;
      }
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
    statsUpdate: (stats: any) => useGameStore.getState().updateStats(stats),
    gatherStart: ({ nodeId, duration }: any) => {
      const resource = this.resourceNameFromNode(nodeId);
      this.addSystemMessage(`Đang thu thập ${resource}... (${Math.ceil((duration || 0) / 1000)} giây)`);
    },
    gatherComplete: ({ item, xp, skill }: any) => {
      this.addSystemMessage(`Đã thu thập ${item?.quantity ?? 1} ${item?.name ?? 'tài nguyên'} · +${xp ?? 0} XP ${skill ?? ''}`.trim());
    },
    gatherFail: ({ reason }: any) => this.addSystemMessage(`Thu thập thất bại: ${reason ?? 'Không thể thu thập tài nguyên.'}`),
    abilityUsed: ({ casterId, abilityId, targetId, targetX, targetY }: any) => {
      const caster = casterId === useGameStore.getState().character?.id
        ? this.player
        : this.remotePlayers.get(casterId);
      const target = targetId ? (this.monsters.get(targetId) ?? this.remotePlayers.get(targetId)) : null;
      const position = target?.position ??
        (typeof targetX === 'number' && typeof targetY === 'number'
          ? new THREE.Vector3(targetX, 0, targetY)
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
    if ((state.currentRegion || 'greenfall') === 'greenfall') this.addGreenfallVillage();
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
    this.socket.on('player:stats_update', this.handlers.statsUpdate);
    this.socket.on('gather:start', this.handlers.gatherStart);
    this.socket.on('gather:complete', this.handlers.gatherComplete);
    this.socket.on('gather:fail', this.handlers.gatherFail);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.resize();
    this.animate();
  }


  private addSystemMessage(content: string) {
    const now = Date.now();
    useGameStore.getState().addChatMessage({
      id: `system-${now}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'system',
      senderName: 'Hệ thống',
      content,
      channel: 'system',
      timestamp: now,
    } as any);
  }

  private resourceNameFromNode(nodeId: string) {
    const resourceId = String(nodeId ?? '').split('_').slice(3).join('_');
    const names: Record<string, string> = {
      wood: 'Gỗ', ancient_wood: 'Gỗ cổ đại', copper_ore: 'Quặng đồng',
      tin_ore: 'Quặng thiếc', iron_ore: 'Quặng sắt', coal: 'Than',
      silver_ore: 'Quặng bạc', gold_ore: 'Quặng vàng', mithril_ore: 'Mithril',
      crystal_shards: 'Mảnh tinh thể', herbs: 'Thảo mộc', rare_herbs: 'Thảo mộc hiếm',
      fiber: 'Sợi', fish: 'Cá', hide: 'Da thú',
    };
    return names[resourceId] ?? (resourceId.replace(/_/g, ' ') || 'tài nguyên');
  }

  private addGreenfallVillage() {
    const makeHouse = (x: number, z: number, scale = 1) => {
      const house = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x75513a, roughness: 1 });
      const plaster = new THREE.MeshStandardMaterial({ color: 0xb6a17c, roughness: 1 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x493a35, roughness: 1, flatShading: true });
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 3.6), plaster);
      base.position.y = 1.4;
      base.castShadow = true;
      base.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.8, 4), roofMat);
      roof.position.y = 3.7;
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.82;
      roof.castShadow = true;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.45, 0.12), wood);
      door.position.set(0, 0.73, 1.86);
      const windowMat = new THREE.MeshStandardMaterial({ color: 0xe4b96c, emissive: 0x5b3514, emissiveIntensity: 0.25 });
      for (const wx of [-1.25, 1.25]) {
        const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.1), windowMat);
        windowMesh.position.set(wx, 1.65, 1.86);
        house.add(windowMesh);
      }
      house.add(base, roof, door);
      house.position.set(x, 0, z);
      house.scale.setScalar(scale);
      this.scene.add(house);
    };
    makeHouse(8, 8, 1.05);
    makeHouse(22, 9, 0.9);
    makeHouse(9, 23, 0.85);
    makeHouse(27, 25, 1.1);

    const makeNpc = (id: string, name: string, x: number, z: number, coat: number) => {
      const npc = new THREE.Group();
      const modelRoot = new THREE.Group();
      modelRoot.name = 'npc-model-root';
      npc.add(modelRoot);
      this.createActor(modelRoot, coat, 0x3d342d);
      npc.position.set(x, 0, z);
      npc.userData.idlePhase = Math.random() * Math.PI * 2;
      npc.userData.clickable = { kind: 'npc', id } satisfies Clickable;
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(20, 18, 15, .82)';
        ctx.beginPath(); ctx.roundRect(8, 8, 496, 80, 16); ctx.fill();
        ctx.font = 'bold 38px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f3d9a7'; ctx.fillText(name, 256, 49, 470);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      tag.position.y = 2.15; tag.scale.set(2.2, 0.42, 1); npc.add(tag);
      this.scene.add(npc);
      this.npcs.set(id, npc);
      const modelByNpc: Record<string, string> = {
        npc_elder_aldric: `${MODEL_ROOT}/npcs/elder.glb`,
        npc_merchant_mira: `${MODEL_ROOT}/npcs/merchant.glb`,
        npc_guard_rowan: `${MODEL_ROOT}/npcs/guard.glb`,
      };
      this.loadModel(modelRoot, modelByNpc[id], id === 'npc_guard_rowan' ? 2 : 1.85);
    };
    makeNpc('npc_elder_aldric', 'Elder Aldric', 15, 10, 0x9b8060);
    makeNpc('npc_merchant_mira', 'Merchant Mira', 24, 18, 0x8a6b83);
    makeNpc('npc_guard_rowan', 'Guard Rowan', 13, 25, 0x657d72);
  }

  private showNpcDialogue(id: string) {
    const lines: Record<string, string> = {
      npc_elder_aldric: 'Welcome to Greenfall, traveler. The forest has grown restless. Keep your weapon ready.',
      npc_merchant_mira: 'I trade in useful supplies. More goods will arrive as the village grows.',
      npc_guard_rowan: 'Wolves and goblins roam beyond the village. Stay close to the roads.',
    };
    const message = lines[id] ?? 'The villager nods to you.';
    useGameStore.getState().addChatMessage({
      id: `npc-${id}-${Date.now()}`,
      senderId: id,
      senderName: id === 'npc_elder_aldric' ? 'Elder Aldric' : id === 'npc_merchant_mira' ? 'Merchant Mira' : 'Guard Rowan',
      content: message,
      channel: 'system',
      timestamp: Date.now(),
    } as any);
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

  private createActor(group: any, bodyColor: number, cloakColor: number) {
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

  private loadModel(target: any, path: string, targetHeight = 1.8) {
    this.loader.load(path, (gltf: any) => {
      if (this.disposed) return;
      const model = gltf.scene;
      model.traverse((node: any) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      const motionBones: Array<{ bone: THREE.Bone; base: THREE.Euler; kind: string; side: string }> = [];
      model.traverse((node: THREE.Object3D) => {
        if (!(node instanceof THREE.Bone)) return;
        const boneName = node.name.toLowerCase().replace(/[^a-z]/g, '');
        let kind = 'other';
        if (boneName.includes('arm') || boneName.includes('hand')) kind = 'arm';
        else if (boneName.includes('upleg') || boneName.includes('thigh') || boneName.includes('leg') || boneName.includes('foot')) kind = 'leg';
        else if (boneName.includes('spine') || boneName.includes('chest')) kind = 'torso';
        const side = boneName.includes('left') || boneName.endsWith('l') ? 'left' : boneName.includes('right') || boneName.endsWith('r') ? 'right' : 'center';
        // Quaternius character exports use a T-pose; lower upper arms into a relaxed standing pose.
        if (kind === 'arm' && (boneName.includes('upperarm') || boneName.includes('shoulder'))) {
          node.rotation.z += side === 'left' ? 1.05 : side === 'right' ? -1.05 : 0;
        }
        if (kind !== 'other') motionBones.push({ bone: node, base: node.rotation.clone(), kind, side });
      });
      model.userData.motionBones = motionBones;
      // Normalize Quaternius exports to a predictable in-game height and ground level.
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (size.y > 0) model.scale.setScalar(targetHeight / size.y);
      model.position.set(
        -center.x * model.scale.x,
        -bounds.min.y * model.scale.y,
        -center.z * model.scale.z
      );

      model.name = 'loaded-model';
      target.clear();
      target.add(model);
    }, undefined, (error: unknown) => {
      // Keep the procedural fallback if the optional model is missing or cannot be parsed.
      console.warn(`[Etheria 3D] Failed to load model: ${path}`, error);
    });
  }

  private getNatureModel(path: string): Promise<THREE.Group> {
    let cached = this.natureModelCache.get(path);

    if (!cached) {
      cached = this.loader.loadAsync(path).then((gltf) => {
        const model = gltf.scene;
        model.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        return model;
      }).catch((error) => {
        this.natureModelCache.delete(path);
        throw error;
      });

      this.natureModelCache.set(path, cached);
    }

    return cached;
  }

  private loadNatureModel(
    target: THREE.Group,
    path: string,
    targetHeight: number
  ) {
    this.getNatureModel(path).then((template) => {
      if (this.disposed) return;

      const model = template.clone(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());

      if (size.y > 0) {
        model.scale.setScalar(targetHeight / size.y);
      }

      model.position.set(
        -bounds.getCenter(new THREE.Vector3()).x * model.scale.x,
        -bounds.min.y * model.scale.y,
        -bounds.getCenter(new THREE.Vector3()).z * model.scale.z
      );

      // Dispose only the temporary fallback meshes; GLTF cache resources are shared.
      target.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });

      target.clear();
      target.add(model);
    }).catch((error) => {
      console.warn(`[Etheria Nature] Cannot load ${path}`, error);
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
    this.addGreenfallDetails(chunk);

    for (const object of chunk.objects ?? []) {
      const prop = this.createProp(String(object.type), object.id);
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


  /**
   * Adds small, deterministic low-poly details independently of the sparse
   * gameplay object list. These are decorative only and do not affect collision
   * or gathering, so Greenfall remains visually populated on every client.
   */
  private addGreenfallDetails(chunk: WorldChunk) {
    if (chunk.coord.region !== 'greenfall') return;

    const flowers = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.09, 0.2, 5),
      new THREE.MeshStandardMaterial({ color: 0xd9b64c, roughness: 0.9, flatShading: true }),
      128
    );
    const redFlowers = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.075, 0),
      new THREE.MeshStandardMaterial({ color: 0xb94c42, roughness: 0.9, flatShading: true }),
      128
    );
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0x74796f, roughness: 1, flatShading: true }),
      96
    );
    const greenCrystals = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.19, 0),
      new THREE.MeshStandardMaterial({ color: 0x9bcf83, roughness: 0.45, metalness: 0.08, flatShading: true }),
      64
    );
    const blueCrystals = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.17, 0),
      new THREE.MeshStandardMaterial({ color: 0x83c9df, roughness: 0.4, metalness: 0.1, flatShading: true }),
      64
    );

    const dummy = new THREE.Object3D();
    let flowerCount = 0;
    let redCount = 0;
    let rockCount = 0;
    let greenCount = 0;
    let blueCount = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.tiles[z]?.[x];
        if (!tile?.walkable || (tile.type !== 'grass' && tile.type !== 'dirt')) continue;

        const worldX = chunk.coord.chunkX * CHUNK_SIZE + x;
        const worldZ = chunk.coord.chunkY * CHUNK_SIZE + z;
        const hash = (Math.imul(worldX + 8191, 73856093) ^ Math.imul(worldZ - 4099, 19349663)) >>> 0;
        const y = (tile.elevation || 0) * 0.12;

        if (hash % 17 === 0 && flowerCount < 128) {
          dummy.position.set(worldX + 0.35, y + 0.1, worldZ + 0.4);
          dummy.rotation.set(0, (hash % 360) * Math.PI / 180, 0);
          dummy.scale.setScalar(0.65 + (hash % 5) * 0.12);
          dummy.updateMatrix();
          flowers.setMatrixAt(flowerCount++, dummy.matrix);
        } else if (hash % 19 === 0 && redCount < 128) {
          dummy.position.set(worldX + 0.65, y + 0.09, worldZ + 0.6);
          dummy.rotation.set(0, (hash % 360) * Math.PI / 180, 0);
          dummy.scale.setScalar(0.7 + (hash % 4) * 0.12);
          dummy.updateMatrix();
          redFlowers.setMatrixAt(redCount++, dummy.matrix);
        }

        if (hash % 67 === 0 && rockCount < 96) {
          dummy.position.set(worldX + 0.5, y + 0.13, worldZ + 0.5);
          dummy.rotation.set(0, (hash % 360) * Math.PI / 180, 0);
          dummy.scale.set(0.8 + (hash % 5) * 0.1, 0.65 + (hash % 3) * 0.15, 0.8);
          dummy.updateMatrix();
          rocks.setMatrixAt(rockCount++, dummy.matrix);
        }

        if (hash % 113 === 0 && greenCount < 64) {
          dummy.position.set(worldX + 0.5, y + 0.2, worldZ + 0.5);
          dummy.rotation.set(0, (hash % 360) * Math.PI / 180, 0);
          dummy.scale.setScalar(0.8 + (hash % 4) * 0.15);
          dummy.updateMatrix();
          greenCrystals.setMatrixAt(greenCount++, dummy.matrix);
        } else if (hash % 127 === 0 && blueCount < 64) {
          dummy.position.set(worldX + 0.5, y + 0.18, worldZ + 0.5);
          dummy.rotation.set(0, (hash % 360) * Math.PI / 180, 0);
          dummy.scale.setScalar(0.8 + (hash % 4) * 0.15);
          dummy.updateMatrix();
          blueCrystals.setMatrixAt(blueCount++, dummy.matrix);
        }
      }
    }

    const batches = [
      [flowers, flowerCount],
      [redFlowers, redCount],
      [rocks, rockCount],
      [greenCrystals, greenCount],
      [blueCrystals, blueCount],
    ] as const;

    for (const [mesh, count] of batches) {
      if (!count) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
        continue;
      }
      mesh.count = count;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }
  }

  private createProp(type: string, seed = '') {
    const group = new THREE.Group();
    const normalizedType = type.toLowerCase();
    const hash = [...seed].reduce(
      (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
      7
    );

    if (normalizedType === 'tree' || normalizedType === 'forest') {
      // Trees are rendered only from the supplied Nature MegaKit models.
      // Intentionally do not create procedural trunk/canopy fallbacks.
      const index = hash % 5 + 1;
      this.loadNatureModel(
        group,
        `${this.natureRoot}/CommonTree_${index}.gltf`,
        4
      );
    } else if (normalizedType.includes('flower')) {
      const flowers = ['Flower_3_Group.gltf', 'Flower_4_Group.gltf'];
      const file = flowers[hash % flowers.length]!;

      const fallback = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xc68b9b })
      );
      fallback.position.y = 0.2;
      group.add(fallback);

      this.loadNatureModel(group, `${this.natureRoot}/${file}`, 0.8);
    } else {
      const fallback = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: 0x62665b,
          roughness: 1,
          flatShading: true
        })
      );
      fallback.position.y = 0.38;
      fallback.castShadow = true;
      group.add(fallback);

      const index = hash % 3 + 1;
      this.loadNatureModel(
        group,
        `${this.natureRoot}/Rock_Medium_${index}.gltf`,
        0.9
      );
    }

    group.rotation.y = (hash % 360) * Math.PI / 180;
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
    const modelRoot = new THREE.Group();
    const fallback = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.58, 1),
      new THREE.MeshStandardMaterial({
        color: 0x65734b,
        roughness: 0.9,
        flatShading: true
      })
    );
    fallback.position.y = 0.62;
    fallback.castShadow = true;
    modelRoot.add(fallback);
    group.add(modelRoot);

    // A small floating nameplate makes the new combat entities easy to spot.
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(12, 15, 12, 0.82)';
      context.beginPath();
      context.roundRect(8, 8, 496, 80, 16);
      context.fill();
      context.font = 'bold 38px Georgia';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#f0dfbd';
      context.fillText(`${monster.name || 'Monster'} · Lv.${monster.level || 1}`, 256, 49, 470);
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false
    }));
    label.position.y = 2.25;
    label.scale.set(2.6, 0.49, 1);
    group.add(label);

    group.position.set(monster.x, 0, monster.y);
    group.userData.clickable = { kind: 'monster', id: monster.id } satisfies Clickable;
    this.scene.add(group);
    this.monsters.set(monster.id, group);

    const monsterKind = [
      monster.definitionId,
      monster.type,
      monster.monsterType,
      monster.templateId,
      monster.name,
    ].filter((value) => typeof value === 'string').join(' ').toLowerCase();

    const modelPath = monsterKind.includes('goblin') || monsterKind.includes('puglin')
      ? `${MODEL_ROOT}/monsters/greenfall/puglin.glb`
      : `${MODEL_ROOT}/monsters/greenfall/creature.glb`;

    this.loadModel(modelRoot, modelPath, 1.45);
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
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.3, 0));
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
    const color = key.includes('slash') ? 0xf5d6a2
      : key.includes('fire') ? 0xff793d
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
    ring.position.copy(position).add(new THREE.Vector3(0, 0.12, 0));
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
      } else if (clickable.kind === 'npc') {
        this.showNpcDialogue(clickable.id);
      } else {
        useGameStore.getState().setTarget(clickable.id, 'monster');
        const target = this.monsters.get(clickable.id);
        if (target) this.showSkillEffect(target.position, 'physical_slash');
        this.attackAnimUntil = performance.now() + 320;
        this.socket.emit('combat:attack', { targetId: clickable.id });
      }
      return;
    }
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
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

    let targetVX = 0;
    let targetVY = 0;
    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      targetVX = (dx / length) * 3.5;
      targetVY = (dy / length) * 3.5;
      this.destination = null;
    } else if (this.destination) {
      const vx = this.destination.x - this.playerPos.x;
      const vy = this.destination.y - this.playerPos.y;
      const distance = Math.hypot(vx, vy);
      if (distance < 0.1) this.destination = null;
      else {
        targetVX = (vx / distance) * Math.min(3.5, distance * 7);
        targetVY = (vy / distance) * Math.min(3.5, distance * 7);
      }
    }

    this.moveVelocity.x = THREE.MathUtils.damp(this.moveVelocity.x, targetVX, 14, delta);
    this.moveVelocity.y = THREE.MathUtils.damp(this.moveVelocity.y, targetVY, 14, delta);
    this.playerPos.x += this.moveVelocity.x * delta;
    this.playerPos.y += this.moveVelocity.y * delta;
    const isMoving = this.moveVelocity.lengthSq() > 0.015;
    const elapsed = performance.now() * 0.001;
    this.player.position.set(this.playerPos.x, 0, this.playerPos.y);
    const playerModel = this.player.children.find((child) => child.name === 'loaded-model');
    if (playerModel) {
      const gait = isMoving ? Math.sin(elapsed * 11) : 0;
      playerModel.position.y = isMoving ? Math.abs(gait) * 0.055 : 0;
      playerModel.rotation.z = THREE.MathUtils.damp(playerModel.rotation.z, isMoving ? Math.sin(elapsed * 5.5) * 0.035 : 0, 9, delta);
      const attacking = performance.now() < this.attackAnimUntil;
      playerModel.rotation.x = THREE.MathUtils.damp(playerModel.rotation.x, attacking ? -0.22 : isMoving ? 0.035 : 0, attacking ? 22 : 8, delta);
      playerModel.rotation.y = THREE.MathUtils.damp(playerModel.rotation.y, attacking ? 0.16 : 0, 18, delta);
      const bones = (playerModel.userData.motionBones ?? []) as Array<{ bone: THREE.Bone; base: THREE.Euler; kind: string; side: string }>;
      for (const entry of bones) {
        const direction = entry.side === 'left' ? 1 : entry.side === 'right' ? -1 : 0;
        if (entry.kind === 'arm') {
          const swing = isMoving ? gait * 0.42 * direction : 0;
          const slash = attacking && entry.side === 'right' ? -0.95 : 0;
          entry.bone.rotation.x = THREE.MathUtils.damp(entry.bone.rotation.x, entry.base.x + swing, 12, delta);
          entry.bone.rotation.z = THREE.MathUtils.damp(entry.bone.rotation.z, entry.base.z + slash, attacking ? 24 : 10, delta);
        } else if (entry.kind === 'leg') {
          const swing = isMoving ? gait * 0.48 * direction : 0;
          entry.bone.rotation.x = THREE.MathUtils.damp(entry.bone.rotation.x, entry.base.x + swing, 12, delta);
        } else if (entry.kind === 'torso') {
          entry.bone.rotation.z = THREE.MathUtils.damp(entry.bone.rotation.z, entry.base.z + (isMoving ? Math.sin(elapsed * 5.5) * 0.025 : 0), 8, delta);
        }
      }
    }
    // Face the actual movement direction for both keyboard and click-to-move.
    if (isMoving) {
      this.player.rotation.y = Math.atan2(this.moveVelocity.x, this.moveVelocity.y);
    }
    for (const npc of this.npcs.values()) {
      const phase = npc.userData.idlePhase as number;
      const model = npc.children.find((child) => child.name === 'npc-model-root');
      if (model) {
        model.position.y = Math.sin(elapsed * 1.7 + phase) * 0.018;
        model.rotation.z = Math.sin(elapsed * 0.85 + phase) * 0.012;
      }
    }
    const desired = new THREE.Vector3(this.playerPos.x + 9, 13, this.playerPos.y + 11);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.y);

    for (const remote of this.remotePlayers.values()) {
      const destination = remote.userData.destination as THREE.Vector3 | undefined;
      if (destination) remote.position.lerp(destination, 1 - Math.pow(0.0001, delta));
    }
    for (const monster of this.monsters.values()) {
      const destination = monster.userData.destination as THREE.Vector3 | undefined;
      if (destination) monster.position.lerp(destination, 1 - Math.pow(0.001, delta));
      if (monster.userData.state === 'attack') monster.rotation.z = Math.sin(performance.now() * 0.018) * 0.06;
      else monster.rotation.z *= 0.85;
    }

    const now = performance.now();
    if (now - this.lastMoveSent > 66) {
      this.lastMoveSent = now;
      useGameStore.getState().setPlayerPos({ x: this.playerPos.x, y: this.playerPos.y });
      if (this.socket.connected) {
        this.socket.emit('player:move', {
          x: this.playerPos.x,
          y: this.playerPos.y,
          facing: Math.abs(this.moveVelocity.x) > Math.abs(this.moveVelocity.y) ? (this.moveVelocity.x > 0 ? 'east' : 'west') : (this.moveVelocity.y > 0 ? 'south' : 'north'),
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
    this.socket.off('player:stats_update', this.handlers.statsUpdate);
    this.socket.off('gather:start', this.handlers.gatherStart);
    this.socket.off('gather:complete', this.handlers.gatherComplete);
    this.socket.off('gather:fail', this.handlers.gatherFail);
    this.scene.traverse((object: any) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material: any) => material.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
