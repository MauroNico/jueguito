import { System } from '../core/System';
import type { World } from '../core/World';
import { STREET_MAX_Z, STREET_MIN_Z } from '../config/GameConstants';
import type { StreetObstacle } from '../graphics/SceneBuilder';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { ProjectileComponent } from '../components/ProjectileComponent';
import { WindowSpawnComponent } from '../components/WindowSpawnComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { applyDamage } from './CombatHelper';

export interface CorridorBounds {
  minX: number;
  maxX: number;
}

export class MovementCollisionSystem extends System {
  public readonly priority = 40;
  private getBounds: () => CorridorBounds;
  private obstacles: StreetObstacle[];

  constructor(getBounds: () => CorridorBounds, obstacles: StreetObstacle[] = []) {
    super();
    this.getBounds = getBounds;
    this.obstacles = obstacles;
  }

  public setObstacles(obstacles: StreetObstacle[]): void {
    this.obstacles = obstacles;
  }

  update(world: World, dt: number): void {
    const bounds = this.getBounds();

    // 1. Update Projectiles
    const projectiles = world.query('Projectile', 'Transform', 'Velocity', 'Collider');
    const players = world.findByTag('player');
    const player = players[0];

    for (const projEntity of projectiles) {
      const proj = projEntity.requireComponent<ProjectileComponent>('Projectile');
      const pt = projEntity.requireComponent<TransformComponent>('Transform');
      const pv = projEntity.requireComponent<VelocityComponent>('Velocity');
      const pc = projEntity.requireComponent<ColliderComponent>('Collider');

      proj.lifeTime += dt;

      if (proj.isLobbed) {
        // Parabolic grenade trajectory
        const t = Math.min(1, proj.lifeTime / proj.maxLifeTime);
        pt.x = proj.startX + (proj.targetX - proj.startX) * t;
        pt.z = proj.startZ + (proj.targetZ - proj.startZ) * t;
        pt.y = (1 - t) * 1.4 + Math.sin(t * Math.PI) * 3.8;

        if (proj.lifeTime >= proj.maxLifeTime) {
          world.events.emit('boss:grenade_explode', {
            position: { x: proj.targetX, y: 0, z: proj.targetZ },
            radius: proj.explosionRadius
          });

          if (player && player.active) {
            const pTrans = player.requireComponent<TransformComponent>('Transform');
            const pCol = player.requireComponent<ColliderComponent>('Collider');
            const dist = Math.hypot(pTrans.x - proj.targetX, pTrans.z - proj.targetZ);
            if (dist <= proj.explosionRadius + pCol.radius) {
              applyDamage({
                world,
                attacker: null,
                target: player,
                rawDamage: proj.damage,
                knockbackX: (pTrans.x - proj.targetX) * 3,
                knockbackZ: (pTrans.z - proj.targetZ) * 3,
                sourceCategory: 'enemy'
              });
            }
          }
          world.destroyEntity(projEntity.id);
        }
        continue;
      }

      // Linear projectile movement
      pt.x += pv.vx * dt;
      pt.z += pv.vz * dt;

      if (
        proj.lifeTime >= proj.maxLifeTime ||
        pt.z < STREET_MIN_Z - 1 ||
        pt.z > STREET_MAX_Z + 1
      ) {
        world.destroyEntity(projEntity.id);
        continue;
      }

      // Check hit against player
      if (proj.faction === 'enemy' && player && player.active) {
        const pTrans = player.requireComponent<TransformComponent>('Transform');
        const pCol = player.requireComponent<ColliderComponent>('Collider');
        const dist = Math.hypot(pTrans.x - pt.x, pTrans.z - pt.z);
        if (dist <= pc.radius + pCol.radius) {
          const hit = applyDamage({
            world,
            attacker: null,
            target: player,
            rawDamage: proj.damage,
            knockbackX: pv.vx * 0.25,
            knockbackZ: pv.vz * 0.25,
            sourceCategory: 'enemy'
          });
          if (hit) {
            world.destroyEntity(projEntity.id);
            continue;
          }
        }
      }
    }

    // 2. Move Characters & Enemies
    const movers = world.query('Transform', 'Velocity', 'Collider');
    for (const entity of movers) {
      if (entity.hasTag('projectile')) continue;
      if (entity.hasComponent('WindowSpawn')) {
        const ws = entity.requireComponent<WindowSpawnComponent>('WindowSpawn');
        if (ws.phase !== 'landed') continue;
      }

      const t = entity.requireComponent<TransformComponent>('Transform');
      const v = entity.requireComponent<VelocityComponent>('Velocity');
      const c = entity.requireComponent<ColliderComponent>('Collider');

      t.x += (v.vx + v.knockbackVx) * dt;
      t.z += (v.vz + v.knockbackVz) * dt;

      // Exponential knockback damping
      const damp = Math.exp(-10 * dt);
      v.knockbackVx *= damp;
      v.knockbackVz *= damp;
      if (Math.abs(v.knockbackVx) < 0.05) v.knockbackVx = 0;
      if (Math.abs(v.knockbackVz) < 0.05) v.knockbackVz = 0;

      // Keep inside building street boundaries (Z)
      const minZ = STREET_MIN_Z + c.radius;
      const maxZ = STREET_MAX_Z - c.radius;
      if (t.z < minZ) t.z = minZ;
      if (t.z > maxZ) t.z = maxZ;

      // Keep player & enemies inside unlocked street corridor bounds (X)
      const minX = bounds.minX + c.radius;
      const maxX = bounds.maxX - c.radius;
      if (t.x < minX) t.x = minX;
      if (t.x > maxX) t.x = maxX;

      // Resolve collisions with street obstacles (skip during jumping/dashing over low props? keep solid for fair cover!)
      for (const obs of this.obstacles) {
        const dx = t.x - obs.x;
        const dz = t.z - obs.z;
        const dist = Math.hypot(dx, dz);
        const minDist = c.radius + obs.radius;
        if (dist < minDist && dist > 0.001) {
          const push = minDist - dist;
          t.x += (dx / dist) * push;
          t.z += (dz / dist) * push;
        }
      }
    }

    // 3. Soft separation between overlapping ground units (unless Barry is dashing through!)
    const actors = movers.filter(
      (e) => !e.hasTag('projectile') && !e.hasComponent('WindowSpawn')
    );
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      const at = a.requireComponent<TransformComponent>('Transform');
      const ac = a.requireComponent<ColliderComponent>('Collider');
      const aPlayer = a.getComponent<PlayerControlComponent>('PlayerControl');
      const aPhasing =
        aPlayer && (aPlayer.state === 'heavy_dash' || aPlayer.state === 'dashing_space');

      for (let j = i + 1; j < actors.length; j++) {
        const b = actors[j];
        const bt = b.requireComponent<TransformComponent>('Transform');
        const bc = b.requireComponent<ColliderComponent>('Collider');
        const bPlayer = b.getComponent<PlayerControlComponent>('PlayerControl');
        const bPhasing =
          bPlayer && (bPlayer.state === 'heavy_dash' || bPlayer.state === 'dashing_space');

        if (aPhasing || bPhasing) continue;

        const dx = bt.x - at.x;
        const dz = bt.z - at.z;
        const dist = Math.hypot(dx, dz);
        const minDist = ac.radius + bc.radius;
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          at.x -= nx * overlap;
          at.z -= nz * overlap;
          bt.x += nx * overlap;
          bt.z += nz * overlap;
        }
      }
    }
  }
}
