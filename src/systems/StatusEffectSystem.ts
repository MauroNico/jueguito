import { System } from '../core/System';
import type { World } from '../core/World';
import { StatusEffectComponent } from '../components/StatusEffectComponent';
import { TransformComponent } from '../components/TransformComponent';
import { HealthComponent } from '../components/HealthComponent';
import { applyDamage } from './CombatHelper';

export class StatusEffectSystem extends System {
  public readonly priority = 10;
  private onDamageTracked?: (amount: number) => void;

  constructor(onDamageTracked?: (amount: number) => void) {
    super();
    this.onDamageTracked = onDamageTracked;
  }

  update(world: World, dt: number): void {
    const entities = world.query('StatusEffect', 'Transform', 'Health');

    for (const entity of entities) {
      const status = entity.requireComponent<StatusEffectComponent>('StatusEffect');
      const transform = entity.requireComponent<TransformComponent>('Transform');
      const health = entity.requireComponent<HealthComponent>('Health');

      if (health.hitFlashTimer > 0) {
        health.hitFlashTimer = Math.max(0, health.hitFlashTimer - dt);
      }
      if (health.invulnerableTimer > 0) {
        health.invulnerableTimer = Math.max(0, health.invulnerableTimer - dt);
      }

      if (status.stunTimer > 0) {
        status.stunTimer = Math.max(0, status.stunTimer - dt);
      }

      if (status.disorientedTimer > 0) {
        status.disorientedTimer = Math.max(0, status.disorientedTimer - dt);
        status.disorientChangeTimer -= dt;
        if (status.disorientChangeTimer <= 0) {
          status.disorientWanderAngle = Math.random() * Math.PI * 2;
          status.disorientChangeTimer = 0.25;
        }
      }

      // Process Solar delayed impacts (detonate after 1.0s delay)
      for (let i = status.solarPending.length - 1; i >= 0; i--) {
        const pending = status.solarPending[i];
        pending.remainingDelay -= dt;
        if (pending.remainingDelay <= 0) {
          status.solarPending.splice(i, 1);

          const attacker = pending.attackerId !== null ? world.getEntity(pending.attackerId) ?? null : null;
          world.events.emit('status:solar_detonate', {
            targetId: entity.id,
            position: { x: transform.x, y: transform.y, z: transform.z },
            damage: pending.damage,
            radius: pending.radius
          });

          // Apply solar explosion damage to the marked target and nearby enemies
          const targets = world.query('Transform', 'Health');
          for (const other of targets) {
            if (!other.hasTag('enemy') || !other.active) continue;
            const ot = other.requireComponent<TransformComponent>('Transform');
            const dist = Math.hypot(ot.x - transform.x, ot.z - transform.z);
            if (other.id === entity.id || dist <= pending.radius) {
              applyDamage({
                world,
                attacker,
                target: other,
                rawDamage: other.id === entity.id ? pending.damage : Math.round(pending.damage * 0.65),
                sourceCategory: 'solar',
                isSolarDelayed: true,
                onDamageTracked: this.onDamageTracked
              });
            }
          }
        }
      }
    }
  }
}
