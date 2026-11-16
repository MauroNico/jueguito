import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { UpgradeCategory, Vec3 } from '../core/Types';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  scaleDecay: boolean;
}

interface ExpandingRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

export class ParticleSystem {
  private group = new THREE.Group();
  private particles: Particle[] = [];
  private rings: ExpandingRing[] = [];
  private boxGeom = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  private ringGeom = new THREE.RingGeometry(0.72, 1.0, 24);
  private materials = new Map<number, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene) {
    this.ringGeom.rotateX(-Math.PI / 2);
    scene.add(this.group);
  }

  private getMaterial(color: number): THREE.MeshBasicMaterial {
    let mat = this.materials.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      this.materials.set(color, mat);
    }
    return mat;
  }

  public bindEvents(events: EventBus): () => void {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      events.on('player:attack_swing', (e) => {
        const cx = e.origin.x + e.dirX * (e.range * 0.65);
        const cz = e.origin.z + e.dirZ * (e.range * 0.65);
        this.emitBurst(cx, 0.7, cz, 0x00f5d4, 10, 4.5, 0.28);
        this.emitBurst(cx, 0.5, cz, 0xff2e93, 6, 3.8, 0.25);
        this.emitUpgradeBurst(cx, 0.7, cz, e.categories, e.range * 0.5);
      }),

      events.on('player:heavy_dash_start', (e) => {
        this.emitBurst(e.origin.x, 0.8, e.origin.z, 0xffffff, 16, 7.0, 0.35);
        this.emitRing(e.origin.x, 0.08, e.origin.z, 0x00f5d4, 0.5, 2.6, 0.3);
      }),

      events.on('player:channel_interrupted', (e) => {
        this.emitBurst(e.position.x, 1.0, e.position.z, 0xff003c, 18, 6.0, 0.4);
        this.emitRing(e.position.x, 0.1, e.position.z, 0xff003c, 0.3, 1.8, 0.25);
      }),

      events.on('player:skill_q_slam', (e) => {
        const count = e.isCharged ? 30 : 16;
        const baseColor = e.isCharged ? 0xffbe0b : 0x00f5d4;
        this.emitRing(e.origin.x, 0.09, e.origin.z, baseColor, 0.5, e.radius, 0.38);
        this.emitRing(e.origin.x, 0.1, e.origin.z, 0xff2e93, 0.3, e.radius * 0.75, 0.3);
        this.emitBurst(e.origin.x, 0.4, e.origin.z, baseColor, count, e.isCharged ? 9 : 6, 0.45);
        this.emitBurst(e.origin.x, 0.2, e.origin.z, 0x8d99ae, 10, 4, 0.38);
        this.emitUpgradeBurst(e.origin.x, 0.6, e.origin.z, e.categories, e.radius);
      }),

      events.on('player:ult_spin_tick', (e) => {
        this.emitRing(e.origin.x, 0.1, e.origin.z, 0xff2e93, 1.2, e.radius, 0.22);
        this.emitBurst(e.origin.x, 0.9, e.origin.z, 0x00f5d4, 8, 6.5, 0.22);
        this.emitUpgradeBurst(e.origin.x, 0.8, e.origin.z, e.categories, e.radius * 0.8);
      }),

      events.on('player:dash_space', (e) => {
        this.emitBurst(e.origin.x, 0.2, e.origin.z, 0xadb5bd, 8, 3.0, 0.25);
        this.emitBurst(e.origin.x, 0.6, e.origin.z, 0x00f5d4, 6, 3.5, 0.22);
      }),

      events.on('damage:dealt', (e) => {
        const color =
          e.sourceCategory === 'military'
            ? 0xff4d4d
            : e.sourceCategory === 'thunder'
              ? 0x38bdf8
              : e.sourceCategory === 'solar'
                ? 0xffb703
                : e.sourceCategory === 'enemy'
                  ? 0xff0054
                  : 0x70e000;
        this.emitBurst(e.position.x, 0.8, e.position.z, color, 8, 4.5, 0.3);
      }),

      events.on('status:applied', (e) => {
        if (e.effect === 'stunned') {
          this.emitLightningArcs(e.position, 6);
        } else if (e.effect === 'disoriented') {
          this.emitBurst(e.position.x, 1.9, e.position.z, 0xffe600, 6, 2.2, 0.45);
        } else if (e.effect === 'solar_marked') {
          this.emitBurst(e.position.x, 1.0, e.position.z, 0xff9e00, 6, 2.0, 0.85);
        }
      }),

      events.on('status:solar_detonate', (e) => {
        this.emitRing(e.position.x, 0.12, e.position.z, 0xffaa00, 0.3, e.radius, 0.36);
        this.emitBurst(e.position.x, 0.9, e.position.z, 0xffd60a, 20, 7.5, 0.48);
        this.emitBurst(e.position.x, 0.7, e.position.z, 0xff5400, 12, 5.5, 0.42);
      }),

      events.on('enemy:window_warning', (e) => {
        this.emitBurst(e.position.x, e.position.y, e.position.z, 0xff0054, 10, 2.5, 0.55);
      }),

      events.on('enemy:window_leap', (e) => {
        // Shattered window glass shards
        this.emitBurst(e.position.x, 2.2, e.position.z, 0x90e0ef, 18, 5.5, 0.55);
      }),

      events.on('enemy:shoot_fire', (e) => {
        const color = e.isBoss ? 0xff9f1c : 0xffea00;
        this.emitBurst(
          e.position.x + e.dirX * 0.6,
          1.0,
          e.position.z + e.dirZ * 0.6,
          color,
          6,
          3.2,
          0.16
        );
      }),

      events.on('boss:grenade_explode', (e) => {
        this.emitRing(e.position.x, 0.12, e.position.z, 0xff2a00, 0.4, e.radius, 0.42);
        this.emitBurst(e.position.x, 0.6, e.position.z, 0xff5400, 28, 9.0, 0.52);
        this.emitBurst(e.position.x, 0.9, e.position.z, 0xffd166, 16, 7.0, 0.45);
      }),

      events.on('entity:died', (e) => {
        const color = e.faction === 'enemy' ? 0x55a630 : 0xff2e93;
        this.emitBurst(e.position.x, 0.9, e.position.z, color, 20, 6.2, 0.5);
      })
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }

  private emitUpgradeBurst(
    x: number,
    y: number,
    z: number,
    categories: UpgradeCategory[],
    radius: number
  ): void {
    for (const cat of categories) {
      if (cat === 'military') {
        this.emitBurst(x, y, z, 0xff3b30, 8, 5.5, 0.3);
        this.emitRing(x, 0.11, z, 0xff3b30, 0.4, radius, 0.25);
      } else if (cat === 'thunder') {
        this.emitLightningArcs({ x, y, z }, 8);
      } else if (cat === 'solar') {
        this.emitBurst(x, y + 0.2, z, 0xffb703, 9, 4.2, 0.45);
      }
    }
  }

  private emitLightningArcs(pos: Vec3, count: number): void {
    for (let i = 0; i < count; i++) {
      const mat = this.getMaterial(i % 2 === 0 ? 0x00f5d4 : 0x90e0ef).clone();
      const mesh = new THREE.Mesh(this.boxGeom, mat);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      mesh.position.set(
        pos.x + Math.cos(angle) * 0.35,
        pos.y + 0.8 + Math.random() * 0.9,
        pos.z + Math.sin(angle) * 0.35
      );
      mesh.scale.set(0.6, 2.4, 0.6);
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * 3.5,
        vy: 2.0 + Math.random() * 2.5,
        vz: Math.sin(angle) * 3.5,
        life: 0.24,
        maxLife: 0.24,
        gravity: 2.0,
        scaleDecay: true
      });
    }
  }

  public emitBurst(
    x: number,
    y: number,
    z: number,
    color: number,
    count: number,
    speed: number,
    life: number
  ): void {
    const baseMat = this.getMaterial(color);
    for (let i = 0; i < count; i++) {
      const mat = baseMat.clone();
      const mesh = new THREE.Mesh(this.boxGeom, mat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.7);
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * spd,
        vy: 1.5 + Math.random() * speed * 0.7,
        vz: Math.sin(angle) * spd,
        life,
        maxLife: life,
        gravity: 14,
        scaleDecay: true
      });
    }
  }

  public emitRing(
    x: number,
    y: number,
    z: number,
    color: number,
    startScale: number,
    endScale: number,
    life: number
  ): void {
    const mat = this.getMaterial(color).clone();
    const mesh = new THREE.Mesh(this.ringGeom, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(startScale);
    this.group.add(mesh);
    this.rings.push({
      mesh,
      life,
      maxLife: life,
      startScale,
      endScale
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      const t = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      if (p.scaleDecay) {
        p.mesh.scale.setScalar(0.4 + t * 0.8);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const scale = r.startScale + (r.endScale - r.startScale) * progress;
      r.mesh.scale.setScalar(scale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
    }
  }

  public clear(): void {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    for (const r of this.rings) {
      this.group.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    this.rings = [];
  }
}
