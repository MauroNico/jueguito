import * as THREE from 'three';
import {
  BUILDING_Z_OFFSET,
  CAMERA_ELEVATION_RAD,
  ROOM_LENGTH,
  STREET_MAX_Z,
  STREET_MIN_Z,
  TOTAL_ROOMS
} from '../config/GameConstants';
import type { Entity } from '../core/Entity';
import type { TimeMode, Vec3 } from '../core/Types';
import type { EntityVisualHook } from '../factories/EntityFactory';
import type { SpriteComponent, SpriteVisualKey } from '../components/SpriteComponent';
import { TransformComponent } from '../components/TransformComponent';
import { HealthComponent } from '../components/HealthComponent';
import { StatusEffectComponent } from '../components/StatusEffectComponent';
import { AIComponent } from '../components/AIComponent';
import { ProjectileComponent } from '../components/ProjectileComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { PixelArtGenerator } from './PixelArtGenerator';

export interface BuildingWindowSlot {
  roomNumber: number;
  side: 'top' | 'bottom';
  x: number;
  y: number;
  z: number;
  mesh: THREE.Mesh;
  warnTimer: number;
  broken: boolean;
}

export interface StreetObstacle {
  x: number;
  z: number;
  radius: number;
}

interface StreetLamp {
  x: number;
  z: number;
  bulbMesh: THREE.Mesh;
  baseColor: number;
}

export class SceneBuilder implements EntityVisualHook {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.OrthographicCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly art: PixelArtGenerator;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private pooledLampLights: THREE.PointLight[] = [];
  private streetLamps: StreetLamp[] = [];
  private windows: BuildingWindowSlot[] = [];
  public readonly obstacles: StreetObstacle[] = [];

  private entityMeshes = new Map<number, THREE.Group>();
  private standaloneTelegraphs = new Map<number, THREE.Mesh>();
  private entitySpriteKey = new Map<number, SpriteVisualKey>();
  private roomBarrierMesh: THREE.Mesh;
  private spriteGeoCache = new Map<string, THREE.PlaneGeometry>();
  private ringWarningGeo = new THREE.RingGeometry(0.85, 1.0, 24);
  private aimLineGeo = new THREE.PlaneGeometry(1, 0.14);

  public timeMode: TimeMode = 'night';
  private cycleClock = 0; // radians for day/night cycle
  private camFrustumHeight = 15.5;
  private currentCamX = 10;

  constructor(canvas: HTMLCanvasElement) {
    this.art = new PixelArtGenerator();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070812);
    this.scene.fog = new THREE.Fog(0x070812, 28, 70);

    // Pixel-perfect WebGL renderer (no antialiasing, soft shadows)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Orthographic camera tilted at 40 degrees
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const halfH = this.camFrustumHeight / 2;
    const halfW = halfH * aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.5, 120);
    this.updateCameraPosition(10, 0, true);

    // Lighting setup
    this.hemiLight = new THREE.HemisphereLight(0x4b6cb7, 0x181c2b, 0.28);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d0, 0.1);
    this.sunLight.position.set(18, 22, 14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 70;
    const d = 22;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Pool of 4 dynamic shadow-casting streetlamp PointLights
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xffb703, 18, 22, 1.5);
      pl.castShadow = true;
      pl.shadow.mapSize.set(512, 512);
      pl.shadow.bias = -0.002;
      pl.shadow.camera.near = 0.4;
      pl.shadow.camera.far = 22;
      this.scene.add(pl);
      this.pooledLampLights.push(pl);
    }

    this.ringWarningGeo.rotateX(-Math.PI / 2);
    this.aimLineGeo.rotateX(-Math.PI / 2);

    this.buildStreetCorridor();

    // Glowing neon barrier showing active room boundary
    const barrierGeo = new THREE.BoxGeometry(0.18, 0.25, STREET_MAX_Z - STREET_MIN_Z + 0.5);
    const barrierMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.45
    });
    this.roomBarrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
    this.roomBarrierMesh.position.set(ROOM_LENGTH, 0.15, 0);
    this.scene.add(this.roomBarrierMesh);

    this.applyLightingMode(0);
  }

  private buildStreetCorridor(): void {
    const totalLength = TOTAL_ROOMS * ROOM_LENGTH + 24;
    const centerX = (TOTAL_ROOMS * ROOM_LENGTH) / 2;

    // Road asphalt
    const roadGeo = new THREE.PlaneGeometry(totalLength, STREET_MAX_Z - STREET_MIN_Z + 1.4);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.art.getWorldTexture('asphalt'),
      roughness: 0.9,
      metalness: 0.05
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(centerX - 6, 0, 0);
    road.receiveShadow = true;
    this.scene.add(road);

    // North & South Sidewalks
    const swGeo = new THREE.BoxGeometry(totalLength, 0.22, 2.2);
    const swMat = new THREE.MeshStandardMaterial({
      map: this.art.getWorldTexture('sidewalk'),
      roughness: 0.88
    });
    const northSw = new THREE.Mesh(swGeo, swMat);
    northSw.position.set(centerX - 6, 0.11, STREET_MIN_Z - 1.0);
    northSw.receiveShadow = true;
    this.scene.add(northSw);

    const southSw = new THREE.Mesh(swGeo, swMat);
    southSw.position.set(centerX - 6, 0.11, STREET_MAX_Z + 1.0);
    southSw.receiveShadow = true;
    this.scene.add(southSw);

    // Buildings & Windows along all 10 rooms
    const buildingMat = new THREE.MeshStandardMaterial({
      map: this.art.getWorldTexture('building'),
      roughness: 0.92
    });
    const northBuildingGeo = new THREE.BoxGeometry(8, 7.6, 4.2);
    const southParapetGeo = new THREE.BoxGeometry(8, 1.85, 3.0);
    const winGeo = new THREE.PlaneGeometry(1.75, 2.3);

    const totalBlocks = Math.ceil(totalLength / 8);
    for (let i = -1; i < totalBlocks; i++) {
      const bx = i * 8 + 4;
      const roomNum = Math.min(TOTAL_ROOMS, Math.max(1, Math.floor(bx / ROOM_LENGTH) + 1));

      // Tall North building
      const nb = new THREE.Mesh(northBuildingGeo, buildingMat);
      nb.position.set(bx, 3.8, -BUILDING_Z_OFFSET - 2.1);
      nb.castShadow = true;
      nb.receiveShadow = true;
      this.scene.add(nb);

      // North building neon sign accent every 3 blocks
      if (i % 3 === 1) {
        const neonColor = i % 2 === 0 ? 0xff2e93 : 0x00f5d4;
        const signMesh = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.45, 0.2),
          new THREE.MeshBasicMaterial({ color: neonColor })
        );
        signMesh.position.set(bx, 4.9, -BUILDING_Z_OFFSET + 0.08);
        this.scene.add(signMesh);
      }

      // North window on facade (rooms 4-10 actively use these, all buildings show windows)
      if (bx > 0 && bx < TOTAL_ROOMS * ROOM_LENGTH) {
        const winMat = new THREE.MeshStandardMaterial({
          map: this.art.getWorldTexture('window_lit'),
          emissive: new THREE.Color(0x00b4d8),
          emissiveIntensity: 0.45,
          roughness: 0.4
        });
        const winMesh = new THREE.Mesh(winGeo, winMat);
        winMesh.position.set(bx, 2.5, -BUILDING_Z_OFFSET + 0.06);
        this.scene.add(winMesh);

        this.windows.push({
          roomNumber: roomNum,
          side: 'top',
          x: bx,
          y: 2.5,
          z: -BUILDING_Z_OFFSET + 0.2,
          mesh: winMesh,
          warnTimer: 0,
          broken: false
        });
      }

      // Low South building parapet (keeps street visibly open to the 40° camera)
      const sb = new THREE.Mesh(southParapetGeo, buildingMat);
      sb.position.set(bx, 0.92, BUILDING_Z_OFFSET + 1.5);
      sb.castShadow = true;
      sb.receiveShadow = true;
      this.scene.add(sb);

      if (bx > 0 && bx < TOTAL_ROOMS * ROOM_LENGTH && i % 2 === 0) {
        const sWinMat = new THREE.MeshStandardMaterial({
          map: this.art.getWorldTexture('window_lit'),
          emissive: new THREE.Color(0xff2e93),
          emissiveIntensity: 0.4,
          roughness: 0.4
        });
        const sWinMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), sWinMat);
        sWinMesh.rotation.y = Math.PI;
        sWinMesh.position.set(bx, 1.15, BUILDING_Z_OFFSET - 0.04);
        this.scene.add(sWinMesh);

        this.windows.push({
          roomNumber: roomNum,
          side: 'bottom',
          x: bx,
          y: 1.15,
          z: BUILDING_Z_OFFSET - 0.2,
          mesh: sWinMesh,
          warnTimer: 0,
          broken: false
        });
      }
    }

    // Streetlamps every 12 units alternating top/bottom sidewalks
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6, metalness: 0.4 });
    const poleGeo = new THREE.BoxGeometry(0.22, 4.4, 0.22);
    const armGeo = new THREE.BoxGeometry(0.22, 0.18, 1.1);
    const bulbGeo = new THREE.BoxGeometry(0.45, 0.3, 0.45);

    for (let x = 6; x <= TOTAL_ROOMS * ROOM_LENGTH; x += 12) {
      const isNorth = (x / 12) % 2 === 1;
      const zPole = isNorth ? STREET_MIN_Z - 0.7 : STREET_MAX_Z + 0.7;
      const armDir = isNorth ? 1 : -1;

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.2, zPole);
      pole.castShadow = true;
      this.scene.add(pole);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(x, 4.3, zPole + armDir * 0.45);
      this.scene.add(arm);

      const baseColor = isNorth ? 0xffb703 : 0x00f5d4;
      const bulbMat = new THREE.MeshBasicMaterial({ color: baseColor });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, 4.15, zPole + armDir * 0.9);
      this.scene.add(bulb);

      this.streetLamps.push({
        x,
        z: zPole + armDir * 0.9,
        bulbMesh: bulb,
        baseColor
      });
    }

    // Street props / obstacles (concrete barricades and hazard barrels)
    const barricadeMat = new THREE.MeshStandardMaterial({
      map: this.art.getWorldTexture('barricade'),
      roughness: 0.85
    });
    const barrelMat = new THREE.MeshStandardMaterial({
      map: this.art.getWorldTexture('barrel'),
      roughness: 0.7
    });
    const barricadeGeo = new THREE.BoxGeometry(1.4, 0.9, 0.7);
    const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.05, 8);

    for (let r = 1; r <= TOTAL_ROOMS; r++) {
      const rx = (r - 1) * ROOM_LENGTH + 11;
      // Place 2 tactical obstacles per room leaving wide fighting lanes
      const obs1Z = r % 2 === 0 ? -2.8 : 2.8;
      const bMesh = new THREE.Mesh(barricadeGeo, barricadeMat);
      bMesh.position.set(rx, 0.45, obs1Z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.scene.add(bMesh);
      this.obstacles.push({ x: rx, z: obs1Z, radius: 0.82 });

      const barrelX = rx + 6;
      const barrelZ = r % 2 === 0 ? 3.2 : -3.1;
      const barMesh = new THREE.Mesh(barrelGeo, barrelMat);
      barMesh.position.set(barrelX, 0.52, barrelZ);
      barMesh.castShadow = true;
      barMesh.receiveShadow = true;
      this.scene.add(barMesh);
      this.obstacles.push({ x: barrelX, z: barrelZ, radius: 0.52 });
    }
  }

  public getWindowsForRoom(roomNumber: number): BuildingWindowSlot[] {
    return this.windows.filter((w) => w.roomNumber === roomNumber);
  }

  public triggerWindowWarning(x: number, z: number, duration: number): void {
    let best: BuildingWindowSlot | null = null;
    let bestDist = Infinity;
    for (const w of this.windows) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    if (best && bestDist < 4) {
      best.warnTimer = duration;
      const mat = best.mesh.material as THREE.MeshStandardMaterial;
      mat.map = this.art.getWorldTexture('window_warn');
      mat.emissive.setHex(0xff0054);
      mat.emissiveIntensity = 1.4;
      mat.needsUpdate = true;
    }
  }

  public markWindowBroken(x: number, z: number): void {
    let best: BuildingWindowSlot | null = null;
    let bestDist = Infinity;
    for (const w of this.windows) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    if (best && bestDist < 4) {
      best.broken = true;
      best.warnTimer = 0;
      const mat = best.mesh.material as THREE.MeshStandardMaterial;
      mat.map = this.art.getWorldTexture('window_broken');
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mat.needsUpdate = true;
    }
  }

  public setRoomBarrier(x: number, visible: boolean): void {
    this.roomBarrierMesh.position.x = x;
    this.roomBarrierMesh.visible = visible;
  }

  public setTimeMode(mode: TimeMode): void {
    this.timeMode = mode;
    if (mode === 'day') this.cycleClock = Math.PI * 0.5;
    if (mode === 'night') this.cycleClock = Math.PI * 1.5;
    this.applyLightingMode(0);
  }

  public applyLightingMode(dt: number): void {
    let dayFactor = 0; // 0 = full night, 1 = full day

    if (this.timeMode === 'day') {
      dayFactor = 1;
    } else if (this.timeMode === 'night') {
      dayFactor = 0;
    } else {
      // Smooth Day/Night cycle (~36 seconds full revolution)
      this.cycleClock += dt * ((Math.PI * 2) / 36);
      dayFactor = Math.max(0, Math.min(1, (Math.sin(this.cycleClock) + 1) * 0.5));
    }

    // Background & fog interpolation
    const nightBg = new THREE.Color(0x070914);
    const dayBg = new THREE.Color(0x7cc6fe);
    const bgColor = nightBg.clone().lerp(dayBg, dayFactor);
    this.scene.background = bgColor;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(bgColor);
    }

    // Sun DirectionalLight
    this.sunLight.intensity = 0.08 + dayFactor * 2.15;
    this.sunLight.color.setHex(dayFactor > 0.35 ? 0xfff5db : 0x5c7cfa);
    this.sunLight.position.set(this.currentCamX + 10, 18 + dayFactor * 8, 12);
    this.sunLight.target.position.set(this.currentCamX, 0, 0);
    this.sunLight.target.updateMatrixWorld();

    // Hemisphere ambient bounce
    this.hemiLight.intensity = 0.2 + dayFactor * 0.65;
    this.hemiLight.color.setHex(dayFactor > 0.4 ? 0xa9def9 : 0x2b3a67);

    // Streetlamps turn ON dynamically at night and OFF during day
    const lampStrength = Math.max(0, 1 - dayFactor * 1.15);
    const sortedLamps = [...this.streetLamps].sort(
      (a, b) => Math.abs(a.x - this.currentCamX) - Math.abs(b.x - this.currentCamX)
    );

    for (let i = 0; i < this.pooledLampLights.length; i++) {
      const pl = this.pooledLampLights[i];
      const lamp = sortedLamps[i];
      if (lamp && lampStrength > 0.02) {
        pl.position.set(lamp.x, 4.0, lamp.z);
        pl.color.setHex(lamp.baseColor);
        pl.intensity = 22 * lampStrength;
      } else {
        pl.intensity = 0;
      }
    }

    for (const lamp of this.streetLamps) {
      const mat = lamp.bulbMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(lampStrength > 0.2 ? lamp.baseColor : 0x495057);
    }
  }

  public updateCameraPosition(targetX: number, targetZ: number, immediate = false): void {
    const smooth = immediate ? 1 : 0.12;
    this.currentCamX += (targetX - this.currentCamX) * smooth;
    const dist = 28;
    const offsetY = Math.sin(CAMERA_ELEVATION_RAD) * dist;
    const offsetZ = Math.cos(CAMERA_ELEVATION_RAD) * dist;
    const lookZ = targetZ * 0.22;

    this.camera.position.set(this.currentCamX, offsetY, lookZ + offsetZ);
    this.camera.lookAt(this.currentCamX, 0.7, lookZ);
  }

  public handleResize(): void {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    const halfH = this.camFrustumHeight / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private getSpriteGeometry(width: number, height: number): THREE.PlaneGeometry {
    const key = `${width}x${height}`;
    let geo = this.spriteGeoCache.get(key);
    if (!geo) {
      geo = new THREE.PlaneGeometry(width, height);
      // Tilt normals slightly upward so 2D sprites receive dynamic PointLights from any horizontal angle
      const normalAttr = geo.attributes.normal;
      const n = new THREE.Vector3(0, 0.92, 0.39).normalize();
      for (let i = 0; i < normalAttr.count; i++) {
        normalAttr.setXYZ(i, n.x, n.y, n.z);
      }
      normalAttr.needsUpdate = true;
      this.spriteGeoCache.set(key, geo);
    }
    return geo;
  }

  public attachVisual(entity: Entity): void {
    const sprite = entity.getComponent<SpriteComponent>('Sprite');
    const transform = entity.getComponent<TransformComponent>('Transform');
    if (!sprite || !transform) return;

    const container = new THREE.Group();
    container.position.set(transform.x, transform.y, transform.z);

    const texture = this.art.getSpriteTexture(sprite.spriteKey);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.08
    });

    const geo = this.getSpriteGeometry(sprite.width, sprite.height);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = sprite.height * 0.5;
    mesh.rotation.x = -0.28; // Subtle HD-2D tilt toward 40 deg camera
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Alpha-tested depth material so real 3D shadows follow the exact pixel-art silhouette
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: texture,
      alphaTest: 0.5
    });

    container.add(mesh);
    sprite.mesh = mesh;
    this.entitySpriteKey.set(entity.id, sprite.spriteKey);

    // Optional ground telegraph mesh (used by grenade targets, shooter laser, tank charge)
    if (entity.hasTag('enemy') || entity.hasTag('projectile')) {
      const teleMat = new THREE.MeshBasicMaterial({
        color: 0xff003c,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const isProjectile = entity.hasTag('projectile');
      const teleMesh = new THREE.Mesh(isProjectile ? this.ringWarningGeo : this.aimLineGeo, teleMat);
      teleMesh.visible = false;
      teleMesh.position.y = 0.06;
      if (isProjectile) {
        this.scene.add(teleMesh); // Ground target marker stays fixed on landing spot
        this.standaloneTelegraphs.set(entity.id, teleMesh);
      } else {
        container.add(teleMesh);
      }
      sprite.telegraphMesh = teleMesh;
    }

    this.scene.add(container);
    this.entityMeshes.set(entity.id, container);
  }

  public syncEntities(entities: Entity[], dt: number): void {
    // Update window warning flashes
    for (const w of this.windows) {
      if (w.warnTimer > 0) {
        w.warnTimer -= dt;
        const pulse = 0.8 + Math.sin(performance.now() * 0.025) * 0.6;
        (w.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
      }
    }

    const activeIds = new Set<number>();

    for (const entity of entities) {
      if (!entity.active) continue;
      const transform = entity.getComponent<TransformComponent>('Transform');
      const sprite = entity.getComponent<SpriteComponent>('Sprite');
      if (!transform || !sprite || !sprite.mesh) continue;

      activeIds.add(entity.id);
      const group = this.entityMeshes.get(entity.id);
      if (!group) continue;

      group.position.set(transform.x, transform.y, transform.z);

      // Update Barry pose dynamically
      const playerCtrl = entity.getComponent<PlayerControlComponent>('PlayerControl');
      if (playerCtrl) {
        let nextKey: SpriteVisualKey = 'barry_idle';
        if (playerCtrl.state === 'basic_attack') nextKey = 'barry_swing';
        else if (playerCtrl.state === 'charging_heavy' || playerCtrl.state === 'heavy_dash')
          nextKey = 'barry_charge';
        else if (playerCtrl.state === 'ultimate_spinning') nextKey = 'barry_spin';
        else if (playerCtrl.state === 'charging_skill_q' || playerCtrl.state === 'skill_q_slam')
          nextKey = 'barry_slam';
        else if (playerCtrl.state === 'moving') nextKey = 'barry_walk';
        sprite.spriteKey = nextKey;
      }

      // Swap texture if spriteKey changed
      const prevKey = this.entitySpriteKey.get(entity.id);
      if (prevKey !== sprite.spriteKey) {
        const tex = this.art.getSpriteTexture(sprite.spriteKey);
        const mat = sprite.mesh.material as THREE.MeshStandardMaterial;
        mat.map = tex;
        mat.needsUpdate = true;
        if (sprite.mesh.customDepthMaterial instanceof THREE.MeshDepthMaterial) {
          sprite.mesh.customDepthMaterial.map = tex;
          sprite.mesh.customDepthMaterial.needsUpdate = true;
        }
        this.entitySpriteKey.set(entity.id, sprite.spriteKey);
      }

      // Flip sprite horizontally based on facing X (or spin during ultimate)
      if (playerCtrl && playerCtrl.state === 'ultimate_spinning') {
        sprite.mesh.scale.x = Math.cos(playerCtrl.ultAngle * 3) >= 0 ? 1 : -1;
      } else {
        sprite.mesh.scale.x = transform.facingX < -0.05 ? -1 : 1;
      }

      // Subtle walking bob
      sprite.animTime += dt;
      const health = entity.getComponent<HealthComponent>('Health');
      const status = entity.getComponent<StatusEffectComponent>('StatusEffect');
      const mat = sprite.mesh.material as THREE.MeshStandardMaterial;

      if (health && health.hitFlashTimer > 0) {
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = 0.85;
      } else if (health && health.invulnerableFromSkill) {
        mat.emissive.setHex(0x00f5d4);
        mat.emissiveIntensity = 0.65;
      } else if (status && status.isStunned()) {
        mat.emissive.setHex(0x38bdf8);
        mat.emissiveIntensity = 0.55;
      } else if (status && status.isDisoriented()) {
        mat.emissive.setHex(0xffbe0b);
        mat.emissiveIntensity = 0.45;
      } else if (status && status.solarPending.length > 0) {
        mat.emissive.setHex(0xff7b00);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }

      // Telegraph visuals for enemies and grenades
      if (sprite.telegraphMesh) {
        const ai = entity.getComponent<AIComponent>('AI');
        const proj = entity.getComponent<ProjectileComponent>('Projectile');

        if (ai && (ai.state === 'aiming_shot' || ai.state === 'windup_charge' || ai.state === 'boss_mg_windup')) {
          sprite.telegraphMesh.visible = true;
          const length = ai.state === 'windup_charge' ? 8 : 11;
          sprite.telegraphMesh.scale.set(length, 1, ai.state === 'windup_charge' ? 3.2 : 1);
          const angle = Math.atan2(ai.actionDirZ, ai.actionDirX);
          sprite.telegraphMesh.rotation.y = -angle;
          sprite.telegraphMesh.position.set(
            ai.actionDirX * (length * 0.5),
            0.07,
            ai.actionDirZ * (length * 0.5)
          );
        } else if (proj && proj.isLobbed) {
          sprite.telegraphMesh.visible = true;
          sprite.telegraphMesh.position.set(proj.targetX, 0.08, proj.targetZ);
          sprite.telegraphMesh.scale.setScalar(proj.explosionRadius);
        } else {
          sprite.telegraphMesh.visible = false;
        }
      }
    }

    // Remove visuals for destroyed entities
    for (const [id, group] of this.entityMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        for (const child of group.children) {
          if (child instanceof THREE.Mesh) {
            (child.material as THREE.Material).dispose();
          }
        }
        this.entityMeshes.delete(id);
        this.entitySpriteKey.delete(id);
        const tele = this.standaloneTelegraphs.get(id);
        if (tele) {
          this.scene.remove(tele);
          (tele.material as THREE.Material).dispose();
          this.standaloneTelegraphs.delete(id);
        }
      }
    }
  }

  public clearEntityVisuals(): void {
    for (const group of this.entityMeshes.values()) {
      this.scene.remove(group);
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).dispose();
        }
      }
    }
    this.entityMeshes.clear();
    this.entitySpriteKey.clear();

    for (const tele of this.standaloneTelegraphs.values()) {
      this.scene.remove(tele);
      (tele.material as THREE.Material).dispose();
    }
    this.standaloneTelegraphs.clear();

    for (const w of this.windows) {
      w.broken = false;
      w.warnTimer = 0;
      const mat = w.mesh.material as THREE.MeshStandardMaterial;
      mat.map = this.art.getWorldTexture('window_lit');
      mat.emissive.setHex(w.side === 'top' ? 0x00b4d8 : 0xff2e93);
      mat.emissiveIntensity = 0.45;
      mat.needsUpdate = true;
    }
  }

  public getEntityWorldPos(entity: Entity): Vec3 {
    const t = entity.requireComponent<TransformComponent>('Transform');
    return { x: t.x, y: t.y, z: t.z };
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
