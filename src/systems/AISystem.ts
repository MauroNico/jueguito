import { System } from '../core/System';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';
import type { EntityFactory } from '../factories/EntityFactory';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { HealthComponent } from '../components/HealthComponent';
import { AIComponent } from '../components/AIComponent';
import { WindowSpawnComponent } from '../components/WindowSpawnComponent';
import { StatusEffectComponent } from '../components/StatusEffectComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { applyDamage } from './CombatHelper';

export class AISystem extends System {
  public readonly priority = 30;
  private factory: EntityFactory;

  constructor(factory: EntityFactory) {
    super();
    this.factory = factory;
  }

  update(world: World, dt: number): void {
    const players = world.findByTag('player');
    const player = players[0];
    if (!player) return;

    const pt = player.requireComponent<TransformComponent>('Transform');
    const ph = player.requireComponent<HealthComponent>('Health');
    if (ph.isDead) return;

    const enemies = world.query('AI', 'Transform', 'Velocity', 'Health');
    for (const enemy of enemies) {
      const ai = enemy.requireComponent<AIComponent>('AI');
      const et = enemy.requireComponent<TransformComponent>('Transform');
      const ev = enemy.requireComponent<VelocityComponent>('Velocity');
      const eh = enemy.requireComponent<HealthComponent>('Health');
      const status = enemy.getComponent<StatusEffectComponent>('StatusEffect');

      if (eh.isDead) {
        ev.vx = 0;
        ev.vz = 0;
        continue;
      }

      // 1. Window emergence phase (gives player time to react!)
      const winSpawn = enemy.getComponent<WindowSpawnComponent>('WindowSpawn');
      if (winSpawn && winSpawn.phase !== 'landed') {
        this.updateWindowSpawn(world, enemy, winSpawn, et, ev, ai, dt);
        continue;
      }

      ai.attackCooldown = Math.max(0, ai.attackCooldown - dt);
      ai.grenadeCooldown = Math.max(0, ai.grenadeCooldown - dt);

      // 2. Stunned -> frozen completely
      if (status && status.isStunned()) {
        ev.vx = 0;
        ev.vz = 0;
        if (ai.state !== 'chase') {
          ai.state = 'chase';
          ai.stateTimer = 0;
        }
        continue;
      }

      // 3. Disoriented -> chaotic movement, unable to execute aimed attacks
      if (status && status.isDisoriented()) {
        const angle = status.disorientWanderAngle;
        ev.vx = Math.cos(angle) * ai.moveSpeed * 0.8;
        ev.vz = Math.sin(angle) * ai.moveSpeed * 0.8;
        et.facingX = ev.vx;
        et.facingZ = ev.vz;
        ai.state = 'chase';
        continue;
      }

      const dx = pt.x - et.x;
      const dz = pt.z - et.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const dirX = dx / dist;
      const dirZ = dz / dist;

      switch (ai.enemyType) {
        case 'normal':
          this.updateNormalZombie(world, enemy, player, ai, et, ev, pt, dist, dirX, dirZ, dt);
          break;
        case 'shooter':
          this.updateShooterZombie(world, enemy, ai, et, ev, dist, dirX, dirZ, dt);
          break;
        case 'tank':
          this.updateTankZombie(world, enemy, player, ai, et, ev, pt, dist, dirX, dirZ, dt);
          break;
        case 'boss':
          this.updateBossZombie(world, enemy, ai, et, ev, pt, dist, dirX, dirZ, dt);
          break;
      }
    }
  }

  private updateWindowSpawn(
    world: World,
    enemy: Entity,
    win: WindowSpawnComponent,
    et: TransformComponent,
    ev: VelocityComponent,
    ai: AIComponent,
    dt: number
  ): void {
    win.timer += dt;
    ev.vx = 0;
    ev.vz = 0;

    if (win.phase === 'warning') {
      et.x = win.startX;
      et.y = win.startY;
      et.z = win.startZ;
      if (win.timer >= win.warningDuration) {
        win.phase = 'leaping';
        win.timer = 0;
        world.events.emit('enemy:window_leap', {
          entityId: enemy.id,
          position: { x: win.startX, y: win.startY, z: win.startZ }
        });
      }
      return;
    }

    if (win.phase === 'leaping') {
      const t = Math.min(1, win.timer / win.leapDuration);
      et.x = win.startX + (win.landX - win.startX) * t;
      et.z = win.startZ + (win.landZ - win.startZ) * t;
      et.y = win.startY * (1 - t) + Math.sin(t * Math.PI) * 1.4;

      if (t >= 1) {
        et.y = 0;
        win.phase = 'landed';
        ai.state = 'chase';
        enemy.removeComponent('WindowSpawn');
      }
    }
  }

  private updateNormalZombie(
    world: World,
    enemy: Entity,
    player: Entity,
    ai: AIComponent,
    et: TransformComponent,
    ev: VelocityComponent,
    pt: TransformComponent,
    dist: number,
    dirX: number,
    dirZ: number,
    dt: number
  ): void {
    if (ai.state === 'windup_melee') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        const currentDist = Math.hypot(pt.x - et.x, pt.z - et.z);
        if (currentDist <= ai.preferredRange + 0.85) {
          applyDamage({
            world,
            attacker: enemy,
            target: player,
            rawDamage: ai.attackDamage,
            knockbackX: dirX * 4,
            knockbackZ: dirZ * 4,
            sourceCategory: 'enemy'
          });
        }
        ai.state = 'chase';
        ai.attackCooldown = 0.95;
      }
      return;
    }

    et.facingX = dirX;
    et.facingZ = dirZ;
    if (dist <= ai.preferredRange && ai.attackCooldown <= 0) {
      ai.state = 'windup_melee';
      ai.stateTimer = 0.36;
      ev.vx = 0;
      ev.vz = 0;
    } else if (dist > ai.preferredRange * 0.8) {
      ev.vx = dirX * ai.moveSpeed;
      ev.vz = dirZ * ai.moveSpeed;
    } else {
      ev.vx = 0;
      ev.vz = 0;
    }
  }

  private updateShooterZombie(
    world: World,
    enemy: Entity,
    ai: AIComponent,
    et: TransformComponent,
    ev: VelocityComponent,
    dist: number,
    dirX: number,
    dirZ: number,
    dt: number
  ): void {
    if (ai.state === 'aiming_shot') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        const bulletSpeed = 12.5;
        this.factory.createProjectile(world, {
          kind: 'bullet',
          faction: 'enemy',
          ownerId: enemy.id,
          x: et.x + ai.actionDirX * 0.6,
          y: 0.95,
          z: et.z + ai.actionDirZ * 0.6,
          vx: ai.actionDirX * bulletSpeed,
          vz: ai.actionDirZ * bulletSpeed,
          damage: ai.attackDamage,
          radius: 0.32,
          maxLifeTime: 2.2
        });
        world.events.emit('enemy:shoot_fire', {
          entityId: enemy.id,
          position: { x: et.x, y: 0.95, z: et.z },
          dirX: ai.actionDirX,
          dirZ: ai.actionDirZ,
          isBoss: false
        });
        ai.state = 'chase';
        ai.attackCooldown = 1.65;
      }
      return;
    }

    et.facingX = dirX;
    et.facingZ = dirZ;

    // Keeps spacing from Barry & telegraphs dodgeable shots
    if (dist < 4.5) {
      ev.vx = -dirX * ai.moveSpeed * 0.9;
      ev.vz = -dirZ * ai.moveSpeed * 0.9;
    } else if (dist > ai.preferredRange) {
      ev.vx = dirX * ai.moveSpeed;
      ev.vz = dirZ * ai.moveSpeed;
    } else {
      ev.vx = 0;
      ev.vz = 0;
      if (ai.attackCooldown <= 0) {
        ai.state = 'aiming_shot';
        ai.stateTimer = 0.62; // Clear dodge window
        ai.actionDirX = dirX;
        ai.actionDirZ = dirZ;
      }
    }
  }

  private updateTankZombie(
    world: World,
    enemy: Entity,
    player: Entity,
    ai: AIComponent,
    et: TransformComponent,
    ev: VelocityComponent,
    pt: TransformComponent,
    dist: number,
    dirX: number,
    dirZ: number,
    dt: number
  ): void {
    // Windup for heavy charge when far from player
    if (ai.state === 'windup_charge') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        ai.state = 'charging_dash';
        ai.stateTimer = 0.65;
      }
      return;
    }

    // Active charge rush
    if (ai.state === 'charging_dash') {
      ai.stateTimer -= dt;
      ev.vx = ai.actionDirX * 12.2;
      ev.vz = ai.actionDirZ * 12.2;
      const pc = player.requireComponent<ColliderComponent>('Collider');
      const ec = enemy.requireComponent<ColliderComponent>('Collider');
      const hitDist = Math.hypot(pt.x - et.x, pt.z - et.z);
      if (hitDist <= pc.radius + ec.radius + 0.35) {
        applyDamage({
          world,
          attacker: enemy,
          target: player,
          rawDamage: ai.attackDamage * 1.25,
          knockbackX: ai.actionDirX * 9,
          knockbackZ: ai.actionDirZ * 9,
          sourceCategory: 'enemy'
        });
        ai.state = 'chase';
        ai.attackCooldown = 1.6;
        ev.vx = 0;
        ev.vz = 0;
        return;
      }

      if (ai.stateTimer <= 0) {
        ai.state = 'chase';
        ai.attackCooldown = 1.5;
      }
      return;
    }

    // Close melee punch
    if (ai.state === 'windup_melee') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        const currentDist = Math.hypot(pt.x - et.x, pt.z - et.z);
        if (currentDist <= ai.preferredRange + 1.0) {
          applyDamage({
            world,
            attacker: enemy,
            target: player,
            rawDamage: ai.attackDamage,
            knockbackX: dirX * 6,
            knockbackZ: dirZ * 6,
            sourceCategory: 'enemy'
          });
        }
        ai.state = 'chase';
        ai.attackCooldown = 1.05;
      }
      return;
    }

    et.facingX = dirX;
    et.facingZ = dirZ;

    // Tank charges when far, normal melee hits when close
    if (dist >= 4.2 && ai.attackCooldown <= 0) {
      ai.state = 'windup_charge';
      ai.stateTimer = 0.65;
      ai.actionDirX = dirX;
      ai.actionDirZ = dirZ;
      ev.vx = 0;
      ev.vz = 0;
    } else if (dist <= ai.preferredRange + 0.35 && ai.attackCooldown <= 0) {
      ai.state = 'windup_melee';
      ai.stateTimer = 0.42;
      ev.vx = 0;
      ev.vz = 0;
    } else {
      ev.vx = dirX * ai.moveSpeed;
      ev.vz = dirZ * ai.moveSpeed;
    }
  }

  private updateBossZombie(
    world: World,
    enemy: Entity,
    ai: AIComponent,
    et: TransformComponent,
    ev: VelocityComponent,
    pt: TransformComponent,
    dist: number,
    dirX: number,
    dirZ: number,
    dt: number
  ): void {
    // Machine gun windup
    if (ai.state === 'boss_mg_windup') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        ai.state = 'boss_mg_firing';
        ai.burstRemaining = 6;
        ai.burstTimer = 0;
      }
      return;
    }

    // Machine gun burst fire
    if (ai.state === 'boss_mg_firing') {
      ev.vx = 0;
      ev.vz = 0;
      ai.burstTimer -= dt;
      if (ai.burstTimer <= 0 && ai.burstRemaining > 0) {
        ai.burstRemaining -= 1;
        ai.burstTimer = 0.14;

        // Slight spread around locked aim direction so player can flank/dodge
        const baseAngle = Math.atan2(ai.actionDirZ, ai.actionDirX);
        const spread = (Math.random() - 0.5) * 0.22;
        const fx = Math.cos(baseAngle + spread);
        const fz = Math.sin(baseAngle + spread);
        const spd = 14.5;

        this.factory.createProjectile(world, {
          kind: 'boss_bullet',
          faction: 'enemy',
          ownerId: enemy.id,
          x: et.x + fx * 0.9,
          y: 1.0,
          z: et.z + fz * 0.9,
          vx: fx * spd,
          vz: fz * spd,
          damage: 14,
          radius: 0.34,
          maxLifeTime: 2.3
        });

        world.events.emit('enemy:shoot_fire', {
          entityId: enemy.id,
          position: { x: et.x, y: 1.0, z: et.z },
          dirX: fx,
          dirZ: fz,
          isBoss: true
        });
      }

      if (ai.burstRemaining <= 0) {
        ai.state = 'chase';
        ai.attackCooldown = 1.6;
      }
      return;
    }

    // Grenade toss windup
    if (ai.state === 'boss_grenade_windup') {
      ev.vx = 0;
      ev.vz = 0;
      ai.stateTimer -= dt;
      if (ai.stateTimer <= 0) {
        const fuseTime = 1.35;
        const radius = 2.65;
        // Throw 2 grenades: one near player, one slightly offset
        for (let g = 0; g < 2; g++) {
          const offsetX = g === 0 ? 0 : (Math.random() - 0.5) * 3.8;
          const offsetZ = g === 0 ? 0 : (Math.random() - 0.5) * 3.0;
          const tx = pt.x + offsetX;
          const tz = Math.max(-5.0, Math.min(5.0, pt.z + offsetZ));

          this.factory.createProjectile(world, {
            kind: 'grenade',
            faction: 'enemy',
            ownerId: enemy.id,
            x: et.x,
            y: 1.4,
            z: et.z,
            vx: 0,
            vz: 0,
            damage: 34,
            radius: 0.35,
            maxLifeTime: fuseTime,
            isLobbed: true,
            targetX: tx,
            targetZ: tz,
            explosionRadius: radius
          });

          world.events.emit('boss:grenade_throw', {
            startPos: { x: et.x, y: 1.4, z: et.z },
            targetPos: { x: tx, y: 0, z: tz },
            radius,
            fuseTime
          });
        }
        ai.state = 'chase';
        ai.grenadeCooldown = 4.2;
        ai.attackCooldown = 1.1;
      }
      return;
    }

    et.facingX = dirX;
    et.facingZ = dirZ;

    // Strafe/position & select attack
    if (dist < 4.5) {
      ev.vx = -dirX * ai.moveSpeed;
      ev.vz = -dirZ * ai.moveSpeed;
    } else if (dist > 8.5) {
      ev.vx = dirX * ai.moveSpeed;
      ev.vz = dirZ * ai.moveSpeed;
    } else {
      ev.vx = -dirZ * ai.moveSpeed * 0.65;
      ev.vz = dirX * ai.moveSpeed * 0.65;
    }

    if (ai.grenadeCooldown <= 0) {
      ai.state = 'boss_grenade_windup';
      ai.stateTimer = 0.45;
      ai.actionDirX = dirX;
      ai.actionDirZ = dirZ;
    } else if (ai.attackCooldown <= 0) {
      ai.state = 'boss_mg_windup';
      ai.stateTimer = 0.55;
      ai.actionDirX = dirX;
      ai.actionDirZ = dirZ;
    }
  }
}
