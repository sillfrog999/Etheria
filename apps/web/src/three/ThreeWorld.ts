import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EtheriaSocket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import type { WorldChunk } from '@etheria/shared';

const CHUNK_SIZE = 32;
const TILE_SIZE = 1;
const MODEL_ROOT = '/assets/3d';

const CHARACTER_MODEL_FILES: Record<string, string> = {
  elf_female: 'Elf_Female.glb',
  elf_male: 'Elf_Male.glb',
  orc_female: 'Orc_Female.glb',
  orc_male: 'Orc_Male.glb'
};

function getCharacterModelPath(modelId?: string) {
  const file = CHARACTER_MODEL_FILES[modelId || ''] || 'Elf_Male.glb';
  return `${MODEL_ROOT}/characters/selectable/${file}`;
}

type Point = { x: number; y: number };
type Clickable = { kind: 'resource' | 'monster' | 'npc'; id: string } | { kind: 'portal'; id: string; region: string };

export class ThreeWorld {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  private renderer: any;
  private clock = new THREE.Clock();
  private loader = new GLTFLoader();
  private soilTexture = new THREE.TextureLoader().load('/assets/textures/greenfall-soil.webp');
  private greenfallGroundTexture: THREE.Texture | null = null;
  private natureModelCache = new Map<string, Promise<THREE.Group>>();
  private natureRoot = `${MODEL_ROOT}/imports/asset3/glTF`;
  private socket: EtheriaSocket;
  private container: HTMLElement;
  private player = new THREE.Group();
  private playerPos: Point;
  private moveVelocity = new THREE.Vector2();
  private verticalVelocity = 0;
  private grounded = true;
  private groundHeights = new Map<string, number>();
  private blockedTiles = new Set<string>();
  private colliders: Array<{ x: number; z: number; radius: number }> = [];
  private attackAnimUntil = 0;
  private destination: Point | null = null;
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private cameraZoom = 1;
  private chunks = new Set<string>();
  private resourceObjects = new Map<string, any>();
  private remotePlayers = new Map<string, any>();
  private monsters = new Map<string, any>();
  private npcs = new Map<string, THREE.Group>();
  private lastMoveSent = 0;
  private frame = 0;
  private disposed = false;
  private teleportPending = false;
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      if (!event.repeat && this.grounded) {
        this.verticalVelocity = 6.2;
        this.grounded = false;
      }
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
    }
  };
  private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
  private onPointerDown = (event: PointerEvent) => this.handlePointer(event);
  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.cameraZoom = THREE.MathUtils.clamp(
      this.cameraZoom * Math.exp(event.deltaY * 0.001),
      0.55,
      2.2
    );
  };
  private onResize = () => this.resize();

  private handlers = {
    ack: () => this.requestChunks(),
    regionTeleported: ({ region, x, y, name }: any) => {
      this.teleportPending = false;
      useGameStore.setState({ currentRegion: region, playerPos: { x, y }, targetId: null, targetType: null });
      this.addChatNotice(`You have arrived in ${name}.`);
      // The region scene is rebuilt from the character's saved location after reload.
      window.location.reload();
    },
    serverError: ({ message, code }: any) => {
      if (this.teleportPending) this.teleportPending = false;
      this.addChatNotice(message || code || 'The request could not be completed.');
    },
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
    abilityUsed: ({ casterId, abilityId, targetId, targetX, targetY }: any) => {
      const caster = casterId === useGameStore.getState().character?.id
        ? this.player
        : this.remotePlayers.get(casterId);
      const target = targetId ? (this.monsters.get(targetId) ?? this.remotePlayers.get(targetId)) : null;
      const position = target?.position ??
        (typeof targetX === 'number' && typeof targetY === 'number'
          ? new THREE.Vector3(targetX, 0, targetY)
          : caster?.position);
      if (caster) {
        const id = String(abilityId).toLowerCase();
        const action = id.includes('heal') ? 'heal'
          : id.includes('shield') || id.includes('buff') ? 'buff'
          : id.includes('blink') || id.includes('shadow_step') || id.includes('teleport') ? 'teleport'
          : ['arcane_bolt', 'fireball', 'ice_nova', 'meteor', 'smoke_veil'].includes(id) ? 'cast'
          : null;
        if (action) this.playCharacterAction(caster, action);
      }
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

    this.soilTexture.colorSpace = THREE.SRGBColorSpace;
    this.soilTexture.wrapS = THREE.RepeatWrapping;
    this.soilTexture.wrapT = THREE.RepeatWrapping;
    this.soilTexture.anisotropy = 8;
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
    this.loadRegionEnvironment();
    this.addRegionPortals();
    this.createActor(this.player, 0x8e9c78, 0x252b27);
    this.player.position.set(this.playerPos.x, 0, this.playerPos.y);
    this.scene.add(this.player);
    this.loadModel(this.player, getCharacterModelPath(state.character?.appearance?.modelId));

    this.socket.on('connect:ack', this.handlers.ack);
    this.socket.on('region:teleported', this.handlers.regionTeleported);
    this.socket.on('server:error', this.handlers.serverError);
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

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.resize();
    this.animate();
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
      this.colliders.push({ x, z, radius: 2.35 * scale });
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
      this.colliders.push({ x, z, radius: 0.62 });
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
      if (modelByNpc[id]) this.loadModel(modelRoot, modelByNpc[id], id === 'npc_guard_rowan' ? 2 : 1.85);
    };
    makeNpc('npc_elder_aldric', 'Elder Aldric', 15, 10, 0x9b8060);
    makeNpc('npc_merchant_mira', 'Merchant Mira', 24, 18, 0x8a6b83);
    makeNpc('npc_guard_rowan', 'Guard Rowan', 13, 25, 0x657d72);
    makeNpc('npc_blacksmith_bram', 'Blacksmith Bram', 19, 7, 0x72594b);
    makeNpc('npc_trainer_elowen', 'Trainer Elowen', 7, 17, 0x637c9b);
    makeNpc('npc_innkeeper_tomas', 'Innkeeper Tomas', 28, 14, 0x9b7650);
    makeNpc('npc_alchemist_syl', 'Alchemist Syl', 20, 27, 0x718b70);
    makeNpc('npc_quartermaster_ren', 'Quartermaster Ren', 5, 26, 0x7d718f);
    makeNpc('npc_scout_lyra', 'Scout Lyra', 30, 24, 0x788b68);
  }


  private addChatNotice(content: string) {
    useGameStore.getState().addChatMessage({
      id: `world-${Date.now()}`, channel: 'system', content, timestamp: Date.now(),
    } as any);
  }

  private addRegionPortals() {
    const currentRegion = useGameStore.getState().currentRegion || 'greenfall';
    const destinations = [
      { id: 'greenfall', name: 'Greenfall', x: currentRegion === 'aurelia' ? 8 : 5, z: currentRegion === 'aurelia' ? 12 : 6, color: 0x75c878 },
      { id: 'aurelia', name: 'Aurelia', x: 36, z: 8, color: 0xe5bd62 },
      { id: 'silverwood', name: 'Silverwood', x: 40, z: 20, color: 0x65c98b },
      { id: 'ashen_mountains', name: 'Ashen Mountains', x: 36, z: 32, color: 0xb5a18a },
      { id: 'frostmere', name: 'Frostmere', x: 4, z: 38, color: 0x83dfff },
      { id: 'emberlands', name: 'Emberlands', x: 18, z: 40, color: 0xff7045 },
      { id: 'the_void', name: 'The Void', x: 30, z: 40, color: 0xb18aff },
    ];
    for (const destination of destinations) {
      if (destination.id === currentRegion) continue;
      const portal = new THREE.Group();
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.13, 12, 36),
        new THREE.MeshStandardMaterial({ color: destination.color, emissive: destination.color, emissiveIntensity: 1.5, metalness: 0.35, roughness: 0.25 })
      );
      glow.position.y = 1.45;
      portal.add(glow);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(0.82, 32),
        new THREE.MeshBasicMaterial({ color: destination.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      inner.position.y = 1.45;
      portal.add(inner);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x665642, metalness: 0.65, roughness: 0.45 });
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.6, 8), pillarMat);
        pillar.position.set(side * 1.05, 1.3, 0);
        portal.add(pillar);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 0.32), pillarMat);
      top.position.y = 2.68;
      portal.add(top);
      portal.position.set(destination.x, 0, destination.z);
      portal.userData.clickable = { kind: 'portal', id: destination.id, region: destination.id } satisfies Clickable;
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(16, 14, 12, .86)';
        ctx.beginPath(); ctx.roundRect(8, 8, 496, 80, 14); ctx.fill();
        ctx.font = 'bold 34px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f4dfb7'; ctx.fillText('Enter', 256, 49, 470);
      }
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
      tag.position.set(0, 3.15, 0); tag.scale.set(2.5, 0.48, 1); portal.add(tag);
      this.scene.add(portal);
    }
  }

  private loadRegionEnvironment() {
    const region = useGameStore.getState().currentRegion || 'greenfall';
    if (region === 'greenfall') return;

    fetch(`${MODEL_ROOT}/region-models.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((assets: Array<{ region: string; url: string; name: string; category: string }>) => {
        if (this.disposed || !Array.isArray(assets)) return;
        const regionAssets = assets
          .filter((asset) => asset.region === region)
          .slice(0, 36);
        let buildingIndex = 0;

        regionAssets.forEach((asset, index) => {
          const group = new THREE.Group();
          const hash = [...asset.name].reduce(
            (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
            7
          );

          let x = 5 + ((index * 17 + hash) % 54);
          let z = 5 + ((index * 29 + (hash >>> 4)) % 54);
          let targetHeight = 1.6;

          if (asset.category === 'building') {
            const slot = buildingIndex++;
            x = 9 + (slot % 3) * 21;
            z = 9 + Math.floor(slot / 3) * 21;
            targetHeight = 5;
          } else if (asset.category === 'vegetation') {
            targetHeight = 4;
          } else if (asset.category === 'rock') {
            targetHeight = 1.5;
          } else if (asset.category === 'landscape') {
            x = 32;
            z = 32;
            targetHeight = 12;
          }

          group.position.set(x, 0, z);
          if (asset.category === 'building') this.colliders.push({ x, z, radius: 2.2 });
          else if (asset.category === 'rock') this.colliders.push({ x, z, radius: 0.75 });
          else if (asset.category === 'vegetation') this.colliders.push({ x, z, radius: 0.48 });
          else if (asset.category === 'landscape') this.colliders.push({ x, z, radius: 3.5 });
          group.rotation.y = (hash % 360) * Math.PI / 180;
          group.name = `region-asset-${asset.name}`;
          this.scene.add(group);
          this.loadNatureModel(group, asset.url, targetHeight);
        });
      })
      .catch((error) => {
        console.warn(`[Etheria Region] Cannot load assets for ${region}`, error);
      });
  }

  private showNpcDialogue(id: string) {
    const lines: Record<string, string> = {
      npc_elder_aldric: 'Welcome to Greenfall, traveler. The forest has grown restless. I can tell you about the regions and local threats.',
      npc_merchant_mira: 'Welcome! Browse the village market for supplies and useful goods.',
      npc_guard_rowan: 'Wolves and Puglins roam beyond the village. Stay close to the roads.',
      npc_blacksmith_bram: 'I maintain the village stock of equipment. Visit the market to browse available gear.',
      npc_trainer_elowen: 'Training makes the difference between a novice and an adventurer. Review your abilities here.',
      npc_innkeeper_tomas: 'Rest your feet, traveler. Greenfall is safer inside the village walls.',
      npc_alchemist_syl: 'Potions and reagents are my trade. Check the market for available supplies.',
      npc_quartermaster_ren: 'Keep your pack in order. Open your inventory and check what you are carrying.',
      npc_scout_lyra: 'I map the trails around Greenfall. The forest paths grow more dangerous farther from town.',
    };
    const names: Record<string, string> = {
      npc_elder_aldric: 'Elder Aldric',
      npc_merchant_mira: 'Merchant Mira',
      npc_guard_rowan: 'Guard Rowan',
      npc_blacksmith_bram: 'Blacksmith Bram',
      npc_trainer_elowen: 'Trainer Elowen',
      npc_innkeeper_tomas: 'Innkeeper Tomas',
      npc_alchemist_syl: 'Alchemist Syl',
      npc_quartermaster_ren: 'Quartermaster Ren',
      npc_scout_lyra: 'Scout Lyra',
    };
    const services: Record<string, 'marketplace' | 'skills' | 'inventory'> = {
      npc_merchant_mira: 'marketplace',
      npc_blacksmith_bram: 'marketplace',
      npc_alchemist_syl: 'marketplace',
      npc_trainer_elowen: 'skills',
      npc_quartermaster_ren: 'inventory',
    };
    const state = useGameStore.getState();
    const service = services[id];
    if (service) {
      if (!state.windows[service]) state.toggleWindow(service);
    }
    state.addChatMessage({
      id: `npc-${id}-${Date.now()}`,
      senderId: id,
      senderName: names[id] ?? 'Villager',
      content: lines[id] ?? 'The villager nods to you.',
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

  private createGreenfallGroundTexture() {
    if (this.greenfallGroundTexture) return this.greenfallGroundTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return this.soilTexture;

    ctx.fillStyle = '#766044';
    ctx.fillRect(0, 0, 512, 512);

    let seed = 739391;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Irregular, subtle grass growth mixed into the brown soil, not a solid green tile.
    for (let i = 0; i < 1900; i++) {
      const x = random() * 512;
      const y = random() * 512;
      const radius = 1.5 + random() * 8;
      const green = random() > 0.48;
      ctx.fillStyle = green
        ? `rgba(${48 + Math.floor(random() * 35)}, ${78 + Math.floor(random() * 45)}, ${37 + Math.floor(random() * 24)}, ${0.12 + random() * 0.2})`
        : `rgba(48, 34, 22, ${0.05 + random() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (0.7 + random()), radius * (0.35 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 8;
    this.greenfallGroundTexture = texture;
    return texture;
  }

  private addGroundBase() {
    const baseTexture = this.soilTexture.clone();
    baseTexture.needsUpdate = true;
    baseTexture.repeat.set(96, 96);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ map: baseTexture, color: 0xaaa18b, roughness: 1 })
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
    body.name = 'fallback-actor-body';
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.72, 6),
      new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 0.95 })
    );
    cloak.position.set(0, 0.66, 0.12);
    cloak.rotation.x = Math.PI;
    cloak.castShadow = true;
    cloak.name = 'fallback-actor-cloak';
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc9a98a, roughness: 0.9 })
    );
    head.position.y = 1.28;
    head.castShadow = true;
    head.name = 'fallback-actor-head';
    group.add(body, cloak, head);
  }

  private loadModel(target: any, path: string, targetHeight = 1.8) {
    this.loader.load(path, (gltf: any) => {
      if (this.disposed) return;
      const model = gltf.scene;
      // Remove the primitive placeholder actor once the real character GLB is
      // ready. In particular, the placeholder cone cloak sat over the model's
      // torso/shoulders and could visually cover its upper arms.
      for (const placeholder of [...target.children]) {
        if (typeof placeholder.name === 'string' && placeholder.name.startsWith('fallback-actor-')) {
          target.remove(placeholder);
          placeholder.traverse((node: any) => {
            if (node instanceof THREE.Mesh) {
              node.geometry.dispose();
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach((material: any) => material.dispose());
            }
          });
        }
      }
      model.traverse((node: any) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      // Keep the model's authored bind/rest pose. The previous forced world-space
      // shoulder/elbow rotations depended on guessed rig axes and could twist or
      // hide limbs on models with a different skeleton orientation.
      const allBones: THREE.Bone[] = [];
      model.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Bone) allBones.push(node);
      });

      const motionBones: Array<{ bone: THREE.Bone; base: THREE.Euler; kind: string; side: string }> = [];
      for (const node of allBones) {
        const boneName = node.name.toLowerCase().replace(/[^a-z]/g, '');
        let kind = 'other';
        if (boneName.includes('hand') || boneName.includes('finger')) kind = 'hand';
        else if (boneName.includes('arm')) kind = 'arm';
        else if (boneName.includes('upleg') || boneName.includes('thigh') || boneName.includes('leg') || boneName.includes('foot')) kind = 'leg';
        else if (boneName.includes('spine') || boneName.includes('chest')) kind = 'torso';
        const side = boneName.includes('left') || boneName.endsWith('l') ? 'left' : boneName.includes('right') || boneName.endsWith('r') ? 'right' : 'center';

        // Keep the GLB-authored bind/rest pose. Do not guess local arm axes:
        // a fixed +/- Z rotation can lift the arms on rigs with different bone
        // orientations. Animation offsets below are applied relative to this pose.
        if (kind !== 'other') motionBones.push({ bone: node, base: node.rotation.clone(), kind, side });
      }
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

      // Lower both upper arms into a relaxed A-pose using the actual rig
      // hierarchy. Align upperarm -> lowerarm toward a downward/outward
      // direction in model space; this avoids guessing a local X/Y/Z axis.
      model.updateMatrixWorld(true);
      const modelWorldQ = model.getWorldQuaternion(new THREE.Quaternion());
      const inverseModelWorldQ = modelWorldQ.clone().invert();
      for (const side of ['l', 'r']) {
        const upperArm = allBones.find((bone) =>
          bone.name.toLowerCase().replace(/[^a-z]/g, '') === `upperarm${side}`
        );
        const lowerArm = allBones.find((bone) =>
          bone.name.toLowerCase().replace(/[^a-z]/g, '') === `lowerarm${side}`
        );
        if (!upperArm || !lowerArm || !upperArm.parent) continue;

        const shoulderModelPos = model.worldToLocal(
          upperArm.getWorldPosition(new THREE.Vector3())
        );
        const sideSign = Math.abs(shoulderModelPos.x) > 0.001
          ? Math.sign(shoulderModelPos.x)
          : side === 'l' ? 1 : -1;
        const targetModelDir = new THREE.Vector3(
          sideSign * Math.sin(THREE.MathUtils.degToRad(7)),
          -Math.cos(THREE.MathUtils.degToRad(7)),
          0
        ).normalize();

        const parentWorldQ = upperArm.parent.getWorldQuaternion(new THREE.Quaternion());
        const parentRelativeQ = inverseModelWorldQ.clone().multiply(parentWorldQ);
        const targetParentDir = targetModelDir
          .applyQuaternion(parentRelativeQ.invert())
          .normalize();
        const baseQuaternion = upperArm.quaternion.clone();
        const currentParentDir = lowerArm.position.clone()
          .applyQuaternion(baseQuaternion)
          .normalize();
        const correction = new THREE.Quaternion().setFromUnitVectors(
          currentParentDir,
          targetParentDir
        );
        upperArm.quaternion.copy(correction.multiply(baseQuaternion));
      }

      // Animation starts from the corrected rest pose, not the original raised pose.
      for (const entry of motionBones) {
        if (entry.kind === 'arm') entry.base.copy(entry.bone.rotation);
      }

      model.name = 'loaded-model';
      model.userData.baseY = model.position.y;
      if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations as THREE.AnimationClip[];
        const idleClip = clips.find((clip) => /idle|stand|breath/i.test(clip.name)) ?? clips[0];
        const walkClip = clips.find((clip) => /walk|run|locomotion/i.test(clip.name));
        const attackClip = clips.find((clip) => /attack|slash|strike/i.test(clip.name));
        const castClip = clips.find((clip) => /cast|spell|magic/i.test(clip.name));
        const healClip = clips.find((clip) => /heal|healing|restore/i.test(clip.name));
        const buffClip = clips.find((clip) => /buff|bless|shield|enchant/i.test(clip.name));
        const teleportClip = clips.find((clip) => /teleport|blink|warp/i.test(clip.name));
        model.userData.animationMixer = mixer;
        model.userData.animationActions = {
          idle: idleClip ? mixer.clipAction(idleClip) : undefined,
          walk: walkClip ? mixer.clipAction(walkClip) : undefined,
          attack: attackClip ? mixer.clipAction(attackClip) : undefined,
          cast: castClip ? mixer.clipAction(castClip) : undefined,
          heal: healClip ? mixer.clipAction(healClip) : undefined,
          buff: buffClip ? mixer.clipAction(buffClip) : undefined,
          teleport: teleportClip ? mixer.clipAction(teleportClip) : undefined
        };
        model.userData.activeAnimation = null;
      }
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
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertex = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = chunk.tiles[z]?.[x];
        if (!tile) continue;
        const wx = chunkX * CHUNK_SIZE + x;
        const wz = chunkY * CHUNK_SIZE + z;
        const y = (tile.elevation || 0) * 0.12;
        this.groundHeights.set(`${wx},${wz}`, y);
        if (!tile.walkable) this.blockedTiles.add(`${wx},${wz}`);
        const color = new THREE.Color(chunk.coord.region === 'greenfall' && String(tile.type) === 'grass' ? 0x81916a : this.tileColor(String(tile.type)));
        positions.push(
          wx, y, wz,
          wx + TILE_SIZE, y, wz,
          wx + TILE_SIZE, y, wz + TILE_SIZE,
          wx, y, wz + TILE_SIZE
        );
        for (let i = 0; i < 4; i++) colors.push(color.r, color.g, color.b);
        const uvScale = 0.085;
        uvs.push(
          wx * uvScale, wz * uvScale,
          (wx + TILE_SIZE) * uvScale, wz * uvScale,
          (wx + TILE_SIZE) * uvScale, (wz + TILE_SIZE) * uvScale,
          wx * uvScale, (wz + TILE_SIZE) * uvScale
        );
        indices.push(vertex, vertex + 2, vertex + 1, vertex, vertex + 3, vertex + 2);
        vertex += 4;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ map: (chunk.coord.region === 'greenfall' ? this.createGreenfallGroundTexture() : this.soilTexture), vertexColors: true, roughness: 1 })
    );
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    for (const object of chunk.objects ?? []) {
      const prop = this.createProp(String(object.type), object.id);
      prop.position.set(object.x, (object.z || 0) * 0.12, object.y);
      if (!object.walkable) {
        const type = String(object.type).toLowerCase();
        const radius = type.includes('tree') ? 0.9 : type.includes('building') ? 2 : 0.65;
        this.colliders.push({ x: object.x, z: object.y, radius });
      }
      this.scene.add(prop);
    }

    for (const node of chunk.resourceNodes ?? []) {
      if (node.depleted) continue;
      const prop = this.createResource(String(node.resourceId));
      prop.position.set(node.x, 0, node.y);
      this.colliders.push({ x: node.x, z: node.y, radius: 0.58 });
      prop.userData.clickable = { kind: 'resource', id: node.id } satisfies Clickable;
      this.resourceObjects.set(node.id, prop);
      this.scene.add(prop);
    }
  }


  private createProp(type: string, seed = '') {
    const group = new THREE.Group();
    const normalizedType = type.toLowerCase();
    const hash = [...seed].reduce(
      (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
      7
    );

    if (normalizedType.includes('tree') || normalizedType === 'forest') {
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

      this.loadNatureModel(group, `${this.natureRoot}/${file}`, 0.8);
    } else {
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
    group.userData.animationPhase = Math.random() * Math.PI * 2;
    group.userData.previousPosition = group.position.clone();
    this.scene.add(group);
    this.remotePlayers.set(player.characterId, group);
    this.loadModel(group, getCharacterModelPath(player.modelId));
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
    group.userData.animationPhase = Math.random() * Math.PI * 2;
    group.userData.previousPosition = group.position.clone();
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
      } else if (clickable.kind === 'portal') {
        if (this.teleportPending) return;
        this.teleportPending = true;
        this.socket.emit('player:teleport_request', { region: clickable.region });
        this.addChatNotice(`Traveling to ${clickable.id.replace(/_/g, ' ')}...`);
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

  private getGroundHeight(x: number, z: number) {
    return this.groundHeights.get(`${Math.floor(x)},${Math.floor(z)}`) ?? 0;
  }

  private canOccupy(x: number, z: number) {
    if (this.blockedTiles.has(`${Math.floor(x)},${Math.floor(z)}`)) return false;
    const playerRadius = 0.34;
    for (const collider of this.colliders) {
      if (Math.hypot(x - collider.x, z - collider.z) < playerRadius + collider.radius) return false;
    }
    for (const npc of this.npcs.values()) {
      if (Math.hypot(x - npc.position.x, z - npc.position.z) < 0.78) return false;
    }
    for (const monster of this.monsters.values()) {
      if (Math.hypot(x - monster.position.x, z - monster.position.z) < 0.82) return false;
    }
    for (const remote of this.remotePlayers.values()) {
      if (Math.hypot(x - remote.position.x, z - remote.position.z) < 0.72) return false;
    }
    return true;
  }

  private playCharacterAction(target: THREE.Object3D, action: 'cast' | 'heal' | 'buff' | 'teleport') {
    target.userData.actionAnimation = action;
    target.userData.actionAnimationUntil = performance.now() + 1100;
  }

  private animateCharacter(
    target: THREE.Object3D,
    elapsed: number,
    delta: number,
    speed: number,
    phase: number,
    attacking = false,
    monster = false
  ) {
    const model = target.getObjectByName('loaded-model') as THREE.Group | undefined;
    if (!model) return;

    const mixer = model.userData.animationMixer as THREE.AnimationMixer | undefined;
    if (mixer) {
      const actions = model.userData.animationActions as {
        idle?: THREE.AnimationAction;
        walk?: THREE.AnimationAction;
        attack?: THREE.AnimationAction;
        cast?: THREE.AnimationAction;
        heal?: THREE.AnimationAction;
        buff?: THREE.AnimationAction;
        teleport?: THREE.AnimationAction;
      };
      const actionName = target.userData.actionAnimationUntil > performance.now()
        ? target.userData.actionAnimation as 'cast' | 'heal' | 'buff' | 'teleport' | undefined
        : undefined;
      const action = actionName ? actions[actionName] : undefined;
      const next = action ?? (attacking && actions.attack
        ? actions.attack
        : speed > 0.18 && actions.walk
          ? actions.walk
          : actions.idle ?? actions.walk);
      const active = model.userData.activeAnimation as THREE.AnimationAction | null;
      if (next && next !== active) {
        next.reset();
        if (action && next === action) {
          next.setLoop(THREE.LoopOnce, 1);
          next.clampWhenFinished = true;
        } else {
          next.setLoop(THREE.LoopRepeat, Infinity);
          next.clampWhenFinished = false;
        }
        next.fadeIn(0.18).play();
        active?.fadeOut(0.18);
        model.userData.activeAnimation = next;
      }
      mixer.update(delta);
      return;
    }

    const blend = THREE.MathUtils.clamp(speed / (monster ? 1.8 : 2.8), 0, 1);
    const stride = elapsed * (monster ? 8 : 10.5) + phase;
    const gait = Math.sin(stride);
    const idleBreath = Math.sin(elapsed * 2.1 + phase) * 0.008;
    const baseY = Number(model.userData.baseY ?? model.position.y);

    model.position.y = THREE.MathUtils.damp(
      model.position.y,
      baseY + Math.abs(gait) * 0.026 * blend + idleBreath * (1 - blend),
      12,
      delta
    );
    model.rotation.x = THREE.MathUtils.damp(
      model.rotation.x,
      (monster ? -0.018 : 0) - blend * 0.025 - (attacking ? 0.075 : 0),
      9,
      delta
    );
    model.rotation.z = THREE.MathUtils.damp(
      model.rotation.z,
      Math.sin(stride * 0.5) * 0.018 * blend,
      9,
      delta
    );

    const bones = (model.userData.motionBones ?? []) as Array<{
      bone: THREE.Bone;
      base: THREE.Euler;
      kind: string;
      side: string;
    }>;

    for (const entry of bones) {
      const side = entry.side === 'left' ? 1 : entry.side === 'right' ? -1 : 0;
      const name = entry.bone.name.toLowerCase();
      const isForearm = name.includes('lower') || name.includes('forearm');
      const armScale = isForearm ? 0.065 : 0.105;
      const armSwing = -gait * armScale * side * blend;
      const legSwing = gait * 0.34 * side * blend;

      if (entry.kind === 'arm') {
        const attackOffset = attacking && entry.side === 'right' && !isForearm
          ? -0.32
          : 0;
        entry.bone.rotation.x = THREE.MathUtils.damp(
          entry.bone.rotation.x,
          entry.base.x + armSwing,
          13,
          delta
        );
        entry.bone.rotation.z = THREE.MathUtils.damp(
          entry.bone.rotation.z,
          entry.base.z + attackOffset,
          attacking ? 18 : 12,
          delta
        );
      } else if (entry.kind === 'hand') {
        entry.bone.rotation.x = THREE.MathUtils.damp(
          entry.bone.rotation.x,
          entry.base.x - gait * 0.035 * side * blend,
          12,
          delta
        );
      } else if (entry.kind === 'leg') {
        entry.bone.rotation.x = THREE.MathUtils.damp(
          entry.bone.rotation.x,
          entry.base.x + legSwing,
          12,
          delta
        );
      } else if (entry.kind === 'torso') {
        entry.bone.rotation.z = THREE.MathUtils.damp(
          entry.bone.rotation.z,
          entry.base.z + Math.sin(stride * 0.5) * 0.018 * blend,
          9,
          delta
        );
        entry.bone.rotation.x = THREE.MathUtils.damp(
          entry.bone.rotation.x,
          entry.base.x - blend * 0.018 - (attacking ? 0.045 : 0),
          9,
          delta
        );
      }
    }
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
    const nextX = this.playerPos.x + this.moveVelocity.x * delta;
    const nextZ = this.playerPos.y + this.moveVelocity.y * delta;
    if (this.canOccupy(nextX, this.playerPos.y)) this.playerPos.x = nextX;
    else this.moveVelocity.x = 0;
    if (this.canOccupy(this.playerPos.x, nextZ)) this.playerPos.y = nextZ;
    else this.moveVelocity.y = 0;

    this.verticalVelocity -= 18 * delta;
    let playerHeight = this.player.position.y + this.verticalVelocity * delta;
    const groundHeight = this.getGroundHeight(this.playerPos.x, this.playerPos.y);
    if (playerHeight <= groundHeight) {
      playerHeight = groundHeight;
      this.verticalVelocity = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const isMoving = this.moveVelocity.lengthSq() > 0.015;
    const elapsed = performance.now() * 0.001;
    this.player.position.set(this.playerPos.x, playerHeight, this.playerPos.y);
    this.animateCharacter(
      this.player,
      elapsed,
      delta,
      this.moveVelocity.length(),
      0,
      performance.now() < this.attackAnimUntil
    );
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
    const desired = new THREE.Vector3(
      this.playerPos.x + 9 * this.cameraZoom,
      13 * this.cameraZoom,
      this.playerPos.y + 11 * this.cameraZoom
    );
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    this.camera.lookAt(this.playerPos.x, 0, this.playerPos.y);

    for (const remote of this.remotePlayers.values()) {
      const destination = remote.userData.destination as THREE.Vector3 | undefined;
      if (destination) remote.position.lerp(destination, 1 - Math.pow(0.0001, delta));
      const previous = remote.userData.previousPosition as THREE.Vector3 | undefined;
      const speed = previous ? remote.position.distanceTo(previous) / Math.max(delta, 0.001) : 0;
      remote.userData.previousPosition = remote.position.clone();
      this.animateCharacter(
        remote,
        elapsed,
        delta,
        speed,
        Number(remote.userData.animationPhase ?? 0)
      );
    }
    for (const monster of this.monsters.values()) {
      const destination = monster.userData.destination as THREE.Vector3 | undefined;
      if (destination) monster.position.lerp(destination, 1 - Math.pow(0.001, delta));
      const previous = monster.userData.previousPosition as THREE.Vector3 | undefined;
      const speed = previous ? monster.position.distanceTo(previous) / Math.max(delta, 0.001) : 0;
      monster.userData.previousPosition = monster.position.clone();
      const attacking = monster.userData.state === 'attack';
      this.animateCharacter(
        monster,
        elapsed,
        delta,
        speed,
        Number(monster.userData.animationPhase ?? 0),
        attacking,
        true
      );
      monster.rotation.z = THREE.MathUtils.damp(
        monster.rotation.z,
        attacking ? -0.035 : 0,
        8,
        delta
      );
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
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.socket.off('connect:ack', this.handlers.ack);
    this.socket.off('region:teleported', this.handlers.regionTeleported);
    this.socket.off('server:error', this.handlers.serverError);
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
