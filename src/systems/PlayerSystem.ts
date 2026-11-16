import { System } from '../core/System';
import type { World } from '../core/World';
import type { InputSnapshot } from '../core/InputManager';
import type { Entity } from '../core/Entity';
import { CHARACTER_REGISTRY } from '../config/CharacterConfig';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { HealthComponent } from '../components/HealthComponent';
import { CombatComponent } from '../components/CombatComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { UpgradeComponent } from '../components/UpgradeComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { applyDamage } from './CombatHelper';

export type InputProvider = (playerX: number, playerZ: number) => InputSnapshot;

export class PlayerSystem extends System {
  public readonly priority = 20;
  private getInput: InputProvider;
  private onDamageTracked?: (amount: number) => void;

  constructor(getInput: InputProvider, onDamageTracked?: (amount: number) => void) {
    super();
    this.getInput = getInput;
    this.onDamageTracked = onDamageTracked;
  }

  public setInputProvider(provider: InputProvider): void {
    this.getInput = provider;
  }

  update(world: World, dt: number): void {
    const players = world.query('PlayerControl', 'Transform', 'Velocity', 'Health', 'Combat');

    for (const player of players) {
      const ctrl = player.requireComponent<PlayerControlComponent>('PlayerControl');
      const transform = player.requireComponent<TransformComponent>('Transform');
      const vel = player.requireComponent<VelocityComponent>('Velocity');
      const health = player.requireComponent<HealthComponent>('Health');
      const combat = player.requireComponent<CombatComponent>('Combat');
      const upgrade = player.getComponent<UpgradeComponent>('Upgrade');
      const def = CHARACTER_REGISTRY[ctrl.characterId];

      if (health.isDead) {
        vel.vx = 0;
        vel.vz = 0;
        continue;
      }

      // Sync military range & damage multipliers
      const rangeMult = 1 + (upgrade?.militaryRangeBonus ?? 0);
      combat.rangeMultiplier = rangeMult;

      // Cooldowns & combo decay
      ctrl.basicCooldown = Math.max(0, ctrl.basicCooldown - dt);
      ctrl.heavyCooldown = Math.max(0, ctrl.heavyCooldown - dt);
      ctrl.skillQCooldown = Math.max(0, ctrl.skillQCooldown - dt);
      ctrl.dashCooldown = Math.max(0, ctrl.dashCooldown - dt);
      ctrl.ultCooldown = Math.max(0, ctrl.ultCooldown - dt);

      if (combat.comboResetTimer > 0) {
        combat.comboResetTimer = Math.max(0, combat.comboResetTimer - dt);
        if (combat.comboResetTimer === 0) combat.comboStep = 0;
      }
      if (combat.comboDecayTimer > 0) {
        combat.comboDecayTimer = Math.max(0, combat.comboDecayTimer - dt);
        if (combat.comboDecayTimer === 0) combat.totalComboHits = 0;
      }

      const input = this.getInput(transform.x, transform.z);
      const categories = upgrade ? upgrade.getActiveCategories() : [];

      // Reset skill invulnerability by default unless actively dashing
      health.invulnerableFromSkill =
        ctrl.state === 'heavy_dash' || ctrl.state === 'dashing_space';

      switch (ctrl.state) {
        case 'idle':
        case 'moving': {
          // Allow Space dash immediately
          if (input.dashSpaceJustPressed && ctrl.dashCooldown <= 0) {
            this.startSpaceDash(world, ctrl, transform, health, input);
            break;
          }
          // Allow Ultimate E
          if (input.ultEJustPressed && ctrl.ultCooldown <= 0) {
            this.startUltimate(ctrl, def.ultDuration);
            break;
          }
          // Allow Skill Q
          if (input.skillQJustPressed && ctrl.skillQCooldown <= 0) {
            ctrl.state = 'charging_skill_q';
            ctrl.skillQChargeTime = 0;
            ctrl.skillQOriginX = transform.x;
            ctrl.skillQOriginZ = transform.z;
            transform.facingX = input.aimDirX;
            transform.facingZ = input.aimDirZ;
            vel.vx = 0;
            vel.vz = 0;
            break;
          }
          // Allow Heavy Attack Channel (2 seconds, Left Click)
          if (input.heavyAttackHeld && ctrl.heavyCooldown <= 0) {
            ctrl.state = 'charging_heavy';
            ctrl.heavyChannelTime = 0;
            transform.facingX = input.aimDirX;
            transform.facingZ = input.aimDirZ;
            vel.vx = 0;
            vel.vz = 0;
            break;
          }
          // Allow Basic Attack (Right Click)
          if (input.basicAttackPressed && ctrl.basicCooldown <= 0) {
            ctrl.state = 'basic_attack';
            ctrl.stateTimer = 0.4;
            ctrl.basicHitFired = false;
            ctrl.basicDirX = input.aimDirX;
            ctrl.basicDirZ = input.aimDirZ;
            transform.facingX = input.aimDirX;
            transform.facingZ = input.aimDirZ;
            ctrl.basicCooldown = 0.46;
            vel.vx = input.aimDirX * 2.2;
            vel.vz = input.aimDirZ * 2.2;
            break;
          }

          // 8-directional WASD movement
          if (Math.abs(input.moveX) > 0.01 || Math.abs(input.moveZ) > 0.01) {
            ctrl.state = 'moving';
            vel.vx = input.moveX * vel.baseSpeed * vel.speedMultiplier;
            vel.vz = input.moveZ * vel.baseSpeed * vel.speedMultiplier;
            transform.facingX = input.moveX;
            transform.facingZ = input.moveZ;
          } else {
            ctrl.state = 'idle';
            vel.vx = 0;
            vel.vz = 0;
          }
          break;
        }

        case 'basic_attack': {
          ctrl.stateTimer -= dt;
          vel.vx *= 0.85;
          vel.vz *= 0.85;

          // Deliver sweeping hammer hit at 0.26s remaining (0.14s windup)
          if (!ctrl.basicHitFired && ctrl.stateTimer <= 0.26) {
            ctrl.basicHitFired = true;
            combat.comboStep = (combat.comboStep % 3) + 1;
            combat.comboResetTimer = 1.25;

            const stepScale = combat.comboStep === 3 ? 1.35 : 1.0;
            const range = combat.effectiveRange;
            const damage = def.baseDamage * def.basicDamageScale * stepScale;

            world.events.emit('player:attack_swing', {
              entityId: player.id,
              origin: { x: transform.x, y: transform.y, z: transform.z },
              dirX: ctrl.basicDirX,
              dirZ: ctrl.basicDirZ,
              range,
              arcRadians: def.basicSweepArc,
              comboStep: combat.comboStep,
              categories
            });

            this.hitEnemiesInArc(
              world,
              player,
              transform,
              ctrl.basicDirX,
              ctrl.basicDirZ,
              range,
              def.basicSweepArc,
              damage,
              combat.comboStep === 3 ? 8.5 : 5.0
            );
          }

          if (ctrl.stateTimer <= 0) {
            ctrl.state = 'idle';
          }
          break;
        }

        case 'charging_heavy': {
          // Barry channels for 2.0 seconds; can adjust aim direction slowly
          vel.vx = input.moveX * vel.baseSpeed * 0.22;
          vel.vz = input.moveZ * vel.baseSpeed * 0.22;
          transform.facingX = input.aimDirX;
          transform.facingZ = input.aimDirZ;

          if (!input.heavyAttackHeld || input.heavyAttackJustReleased) {
            // Released before completing 2s channel -> cancel
            if (ctrl.heavyChannelTime < ctrl.heavyChannelRequired) {
              ctrl.state = 'idle';
              ctrl.heavyChannelTime = 0;
              break;
            }
          }

          ctrl.heavyChannelTime += dt;
          if (ctrl.heavyChannelTime >= ctrl.heavyChannelRequired - 1e-5) {
            // Complete 2s channel -> execute invulnerable hammer dash
            ctrl.state = 'heavy_dash';
            ctrl.stateTimer = def.heavyDashDuration;
            ctrl.heavyChannelTime = 0;
            ctrl.heavyCooldown = 2.6;
            ctrl.heavyDashDirX = input.aimDirX;
            ctrl.heavyDashDirZ = input.aimDirZ;
            ctrl.heavyDashHitIds.clear();
            health.invulnerableFromSkill = true;

            world.events.emit('player:heavy_dash_start', {
              entityId: player.id,
              origin: { x: transform.x, y: transform.y, z: transform.z },
              dirX: ctrl.heavyDashDirX,
              dirZ: ctrl.heavyDashDirZ
            });
          }
          break;
        }

        case 'heavy_dash': {
          ctrl.stateTimer -= dt;
          health.invulnerableFromSkill = true;
          vel.vx = ctrl.heavyDashDirX * def.heavyDashSpeed;
          vel.vz = ctrl.heavyDashDirZ * def.heavyDashSpeed;

          const hitRadius = 1.9 * rangeMult;
          const damage = def.baseDamage * def.heavyDashDamageScale;
          const enemies = world.query('Transform', 'Health', 'Collider');
          for (const enemy of enemies) {
            if (!enemy.hasTag('enemy') || !enemy.active) continue;
            if (ctrl.heavyDashHitIds.has(enemy.id)) continue;

            const et = enemy.requireComponent<TransformComponent>('Transform');
            const ec = enemy.requireComponent<ColliderComponent>('Collider');
            const dist = Math.hypot(et.x - transform.x, et.z - transform.z);
            if (dist <= hitRadius + ec.radius) {
              ctrl.heavyDashHitIds.add(enemy.id);
              applyDamage({
                world,
                attacker: player,
                target: enemy,
                rawDamage: damage,
                knockbackX: ctrl.heavyDashDirX * 10,
                knockbackZ: ctrl.heavyDashDirZ * 10,
                onDamageTracked: this.onDamageTracked
              });
            }
          }

          if (ctrl.stateTimer <= 0) {
            health.invulnerableFromSkill = false;
            ctrl.state = 'idle';
            vel.vx = 0;
            vel.vz = 0;
          }
          break;
        }

        case 'charging_skill_q': {
          vel.vx = 0;
          vel.vz = 0;
          if (input.skillQHeld) {
            ctrl.skillQChargeTime = Math.min(
              ctrl.skillQChargeRequired,
              ctrl.skillQChargeTime + dt
            );
          }

          if (input.skillQJustReleased || !input.skillQHeld) {
            const isCharged = ctrl.skillQChargeTime >= ctrl.skillQChargeRequired - 1e-5;
            ctrl.state = 'skill_q_slam';
            ctrl.stateTimer = 0.26;
            ctrl.skillQIsCharged = isCharged;
            ctrl.skillQHasLanded = false;
            ctrl.skillQCooldown = 3.2;
          }
          break;
        }

        case 'skill_q_slam': {
          ctrl.stateTimer -= dt;
          const progress = 1 - Math.max(0, ctrl.stateTimer) / 0.26;
          transform.y = Math.sin(progress * Math.PI) * 1.9;
          vel.vx = transform.facingX * 4.5;
          vel.vz = transform.facingZ * 4.5;

          if (!ctrl.skillQHasLanded && ctrl.stateTimer <= 0.04) {
            ctrl.skillQHasLanded = true;
            transform.y = 0;
            const radius =
              def.skillQBaseRadius * (ctrl.skillQIsCharged ? 2.0 : 1.0) * rangeMult;
            const dmgScale = ctrl.skillQIsCharged
              ? def.skillQChargedDamageScale
              : def.skillQBaseDamageScale;
            const damage = def.baseDamage * dmgScale;
            const stunDur = def.skillQStunDuration * (ctrl.skillQIsCharged ? 1.45 : 1.0);

            world.events.emit('player:skill_q_slam', {
              entityId: player.id,
              origin: { x: transform.x, y: 0, z: transform.z },
              radius,
              isCharged: ctrl.skillQIsCharged,
              categories
            });

            const enemies = world.query('Transform', 'Health', 'Collider');
            for (const enemy of enemies) {
              if (!enemy.hasTag('enemy') || !enemy.active) continue;
              const et = enemy.requireComponent<TransformComponent>('Transform');
              const ec = enemy.requireComponent<ColliderComponent>('Collider');
              const dx = et.x - transform.x;
              const dz = et.z - transform.z;
              const dist = Math.hypot(dx, dz);
              if (dist <= radius + ec.radius) {
                const nx = dist > 0.01 ? dx / dist : 1;
                const nz = dist > 0.01 ? dz / dist : 0;
                applyDamage({
                  world,
                  attacker: player,
                  target: enemy,
                  rawDamage: damage,
                  knockbackX: nx * 7.5,
                  knockbackZ: nz * 7.5,
                  stunDuration: stunDur,
                  onDamageTracked: this.onDamageTracked
                });
              }
            }
          }

          if (ctrl.stateTimer <= 0) {
            transform.y = 0;
            ctrl.state = 'idle';
          }
          break;
        }

        case 'dashing_space': {
          ctrl.stateTimer -= dt;
          health.invulnerableFromSkill = true;
          vel.vx = ctrl.dashDirX * def.dashSpeed;
          vel.vz = ctrl.dashDirZ * def.dashSpeed;

          if (ctrl.stateTimer <= 0) {
            health.invulnerableFromSkill = false;
            ctrl.state = 'idle';
          }
          break;
        }

        case 'ultimate_spinning': {
          // 5 seconds continuous hammer cyclone, movable with WASD, damages & disorients enemies
          ctrl.stateTimer -= dt;
          ctrl.ultSpinTickTimer -= dt;
          ctrl.ultAngle += dt * 16;

          vel.vx = input.moveX * vel.baseSpeed * 1.05;
          vel.vz = input.moveZ * vel.baseSpeed * 1.05;

          if (ctrl.ultSpinTickTimer <= 0) {
            ctrl.ultSpinTickTimer = 0.28;
            const radius = def.ultRadius * rangeMult;
            const damage = def.baseDamage * def.ultTickDamageScale;

            world.events.emit('player:ult_spin_tick', {
              entityId: player.id,
              origin: { x: transform.x, y: transform.y, z: transform.z },
              radius,
              categories
            });

            const enemies = world.query('Transform', 'Health', 'Collider');
            for (const enemy of enemies) {
              if (!enemy.hasTag('enemy') || !enemy.active) continue;
              const et = enemy.requireComponent<TransformComponent>('Transform');
              const ec = enemy.requireComponent<ColliderComponent>('Collider');
              const dx = et.x - transform.x;
              const dz = et.z - transform.z;
              const dist = Math.hypot(dx, dz);
              if (dist <= radius + ec.radius) {
                const nx = dist > 0.01 ? dx / dist : 1;
                const nz = dist > 0.01 ? dz / dist : 0;
                applyDamage({
                  world,
                  attacker: player,
                  target: enemy,
                  rawDamage: damage,
                  knockbackX: nx * 4.5,
                  knockbackZ: nz * 4.5,
                  disorientDuration: def.ultDisorientDuration,
                  onDamageTracked: this.onDamageTracked
                });
              }
            }
          }

          if (ctrl.stateTimer <= 1e-5) {
            ctrl.state = 'idle';
          }
          break;
        }
      }
    }
  }

  private startSpaceDash(
    world: World,
    ctrl: PlayerControlComponent,
    transform: TransformComponent,
    health: HealthComponent,
    input: InputSnapshot
  ): void {
    const def = CHARACTER_REGISTRY[ctrl.characterId];
    let dx = input.moveX;
    let dz = input.moveZ;
    if (Math.hypot(dx, dz) < 0.05) {
      dx = input.aimDirX;
      dz = input.aimDirZ;
    }
    const len = Math.hypot(dx, dz) || 1;
    ctrl.dashDirX = dx / len;
    ctrl.dashDirZ = dz / len;
    ctrl.state = 'dashing_space';
    ctrl.stateTimer = def.dashDuration;
    ctrl.dashCooldown = 0.85;
    health.invulnerableFromSkill = true;
    transform.facingX = ctrl.dashDirX;
    transform.facingZ = ctrl.dashDirZ;

    world.events.emit('player:dash_space', {
      entityId: 1,
      origin: { x: transform.x, y: transform.y, z: transform.z },
      dirX: ctrl.dashDirX,
      dirZ: ctrl.dashDirZ
    });
  }

  private startUltimate(ctrl: PlayerControlComponent, duration: number): void {
    ctrl.state = 'ultimate_spinning';
    ctrl.stateTimer = duration;
    ctrl.ultSpinTickTimer = 0;
    ctrl.ultCooldown = 14.0;
  }

  private hitEnemiesInArc(
    world: World,
    player: Entity,
    origin: TransformComponent,
    dirX: number,
    dirZ: number,
    range: number,
    arcRadians: number,
    damage: number,
    knockbackStrength: number
  ): void {
    const halfCos = Math.cos(arcRadians * 0.5);
    const enemies = world.query('Transform', 'Health', 'Collider');

    for (const enemy of enemies) {
      if (!enemy.hasTag('enemy') || !enemy.active) continue;
      const et = enemy.requireComponent<TransformComponent>('Transform');
      const ec = enemy.requireComponent<ColliderComponent>('Collider');
      const dx = et.x - origin.x;
      const dz = et.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + ec.radius) continue;

      if (dist > 0.25) {
        const dot = (dx / dist) * dirX + (dz / dist) * dirZ;
        if (dot < halfCos) continue;
      }

      const nx = dist > 0.01 ? dx / dist : dirX;
      const nz = dist > 0.01 ? dz / dist : dirZ;
      applyDamage({
        world,
        attacker: player,
        target: enemy,
        rawDamage: damage,
        knockbackX: nx * knockbackStrength,
        knockbackZ: nz * knockbackStrength,
        onDamageTracked: this.onDamageTracked
      });
    }
  }
}
