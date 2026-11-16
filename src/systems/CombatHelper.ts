import type { Entity } from '../core/Entity';
import type { World } from '../core/World';
import type { UpgradeCategory } from '../core/Types';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { HealthComponent } from '../components/HealthComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { StatusEffectComponent } from '../components/StatusEffectComponent';
import { UpgradeComponent } from '../components/UpgradeComponent';
import { AIComponent } from '../components/AIComponent';
import { CombatComponent } from '../components/CombatComponent';

export interface DamageOptions {
  world: World;
  attacker: Entity | null;
  target: Entity;
  rawDamage: number;
  knockbackX?: number;
  knockbackZ?: number;
  stunDuration?: number;
  disorientDuration?: number;
  sourceCategory?: UpgradeCategory | 'base' | 'enemy';
  isSolarDelayed?: boolean;
  onDamageTracked?: (amount: number) => void;
}

export function applyDamage(opts: DamageOptions): boolean {
  const { world, attacker, target } = opts;
  if (!target.active) return false;

  const health = target.getComponent<HealthComponent>('Health');
  const transform = target.getComponent<TransformComponent>('Transform');
  if (!health || !transform || health.isDead) return false;

  if (health.isInvulnerable()) {
    return false;
  }

  let finalDamage = opts.rawDamage;
  let dominantCategory: UpgradeCategory | 'base' | 'enemy' = opts.sourceCategory ?? 'base';

  // If attacker is player with upgrades, apply upgrade effects
  const upgrade = attacker?.getComponent<UpgradeComponent>('Upgrade');
  if (attacker && upgrade && !opts.isSolarDelayed) {
    if (upgrade.militaryDamageBonus > 0) {
      finalDamage *= 1 + upgrade.militaryDamageBonus;
      if (dominantCategory === 'base') dominantCategory = 'military';
    }
  }

  finalDamage = Math.max(1, Math.round(finalDamage));
  health.hp = Math.max(0, health.hp - finalDamage);
  health.hitFlashTimer = 0.14;

  // Player brief i-frames on hit + INTERRUPT 2s heavy channeling if hit while charging!
  const playerCtrl = target.getComponent<PlayerControlComponent>('PlayerControl');
  if (playerCtrl) {
    health.invulnerableTimer = 0.32;
    if (playerCtrl.state === 'charging_heavy') {
      playerCtrl.state = 'idle';
      playerCtrl.heavyChannelTime = 0;
      playerCtrl.heavyCooldown = 0.5;
      world.events.emit('player:channel_interrupted', {
        entityId: target.id,
        position: { x: transform.x, y: transform.y, z: transform.z }
      });
    }
  }

  // Knockback
  const vel = target.getComponent<VelocityComponent>('Velocity');
  if (vel && (opts.knockbackX || opts.knockbackZ)) {
    vel.knockbackVx += opts.knockbackX ?? 0;
    vel.knockbackVz += opts.knockbackZ ?? 0;
  }

  // Apply explicit status effects (from Barry's Q or E)
  const status = target.getComponent<StatusEffectComponent>('StatusEffect');
  if (status) {
    if (opts.stunDuration && opts.stunDuration > 0) {
      status.applyStun(opts.stunDuration);
      world.events.emit('status:applied', {
        targetId: target.id,
        effect: 'stunned',
        position: { x: transform.x, y: transform.y, z: transform.z },
        duration: opts.stunDuration
      });
    }

    if (opts.disorientDuration && opts.disorientDuration > 0) {
      status.applyDisoriented(opts.disorientDuration);
      world.events.emit('status:applied', {
        targetId: target.id,
        effect: 'disoriented',
        position: { x: transform.x, y: transform.y, z: transform.z },
        duration: opts.disorientDuration
      });
    }

    // Apply Upgrade-driven status effects when player hits an enemy
    if (attacker && upgrade && !opts.isSolarDelayed) {
      // Dios del Rayo: stun for fractions of a second
      if (upgrade.thunderStunDuration > 0) {
        status.applyStun(upgrade.thunderStunDuration);
        dominantCategory = 'thunder';
        world.events.emit('status:applied', {
          targetId: target.id,
          effect: 'stunned',
          position: { x: transform.x, y: transform.y, z: transform.z },
          duration: upgrade.thunderStunDuration
        });
      }

      // Solar: delayed additional damage after exactly 1.0 second
      if (upgrade.solarDelayedRatio > 0) {
        const delayedDmg = Math.max(1, Math.round(finalDamage * upgrade.solarDelayedRatio));
        status.addSolarDelayedHit(delayedDmg, upgrade.solarBlastRadius, attacker.id, 1.0);
        if (dominantCategory === 'base') dominantCategory = 'solar';
        world.events.emit('status:applied', {
          targetId: target.id,
          effect: 'solar_marked',
          position: { x: transform.x, y: transform.y, z: transform.z },
          duration: 1.0
        });
      }
    }
  }

  // Update player combo counter if attacker is player
  const attackerCombat = attacker?.getComponent<CombatComponent>('Combat');
  if (attackerCombat) {
    attackerCombat.totalComboHits += 1;
    attackerCombat.comboDecayTimer = 3.2;
  }

  if (opts.onDamageTracked && attacker?.hasTag('player')) {
    opts.onDamageTracked(finalDamage);
  }

  world.events.emit('damage:dealt', {
    attackerId: attacker ? attacker.id : null,
    targetId: target.id,
    amount: finalDamage,
    position: { x: transform.x, y: transform.y, z: transform.z },
    sourceCategory: dominantCategory,
    isSolarDelayed: opts.isSolarDelayed
  });

  if (health.hp <= 0) {
    health.isDead = true;
    const ai = target.getComponent<AIComponent>('AI');
    world.events.emit('entity:died', {
      entityId: target.id,
      faction: target.hasTag('player') ? 'player' : 'enemy',
      enemyType: ai?.enemyType,
      position: { x: transform.x, y: transform.y, z: transform.z }
    });
    if (!target.hasTag('player')) {
      world.destroyEntity(target.id);
    }
  }

  return true;
}
