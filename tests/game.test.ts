import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/World';
import type { InputSnapshot } from '../src/core/InputManager';
import { EntityFactory } from '../src/factories/EntityFactory';
import { StatusEffectSystem } from '../src/systems/StatusEffectSystem';
import { PlayerSystem } from '../src/systems/PlayerSystem';
import { AISystem } from '../src/systems/AISystem';
import { MovementCollisionSystem } from '../src/systems/MovementCollisionSystem';
import { RoomSystem } from '../src/systems/RoomSystem';
import { TransformComponent } from '../src/components/TransformComponent';
import { HealthComponent } from '../src/components/HealthComponent';
import { PlayerControlComponent } from '../src/components/PlayerControlComponent';
import { StatusEffectComponent } from '../src/components/StatusEffectComponent';
import { UpgradeComponent } from '../src/components/UpgradeComponent';
import { AIComponent } from '../src/components/AIComponent';
import { applyDamage } from '../src/systems/CombatHelper';
import { getUpgradeById } from '../src/config/UpgradeConfig';
import { CHARACTER_REGISTRY } from '../src/config/CharacterConfig';

function idleInput(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    moveX: 0,
    moveZ: 0,
    aimDirX: 1,
    aimDirZ: 0,
    aimWorldX: 10,
    aimWorldZ: 0,
    basicAttackPressed: false,
    heavyAttackHeld: false,
    heavyAttackJustReleased: false,
    skillQHeld: false,
    skillQJustPressed: false,
    skillQJustReleased: false,
    dashSpaceJustPressed: false,
    ultEJustPressed: false,
    ...overrides
  };
}

describe('Neon Hammer ECS & Mechanics', () => {
  let world: World;
  let factory: EntityFactory;
  let currentInput: InputSnapshot;
  let roomSystem: RoomSystem;
  let aiSystem: AISystem;

  beforeEach(() => {
    world = new World();
    factory = new EntityFactory();
    currentInput = idleInput();

    roomSystem = new RoomSystem(factory);
    aiSystem = new AISystem(factory);
    world
      .addSystem(new StatusEffectSystem())
      .addSystem(new PlayerSystem(() => currentInput))
      .addSystem(aiSystem)
      .addSystem(new MovementCollisionSystem(() => roomSystem.getBounds()))
      .addSystem(roomSystem);
  });

  it('supports 8-directional WASD movement and basic RMB sweep attack', () => {
    const barry = factory.createPlayer(world, 'barry', 5, 0);
    const enemy = factory.createEnemy(world, 'normal', 7.2, 0);
    const initialHp = enemy.requireComponent<HealthComponent>('Health').hp;

    // Move diagonally (8 directions)
    currentInput = idleInput({ moveX: Math.SQRT1_2, moveZ: Math.SQRT1_2 });
    world.update(0.1);
    const pt = barry.requireComponent<TransformComponent>('Transform');
    expect(pt.x).toBeGreaterThan(5);
    expect(pt.z).toBeGreaterThan(0);

    // Trigger Right-Click basic sweep attack
    currentInput = idleInput({ basicAttackPressed: true, aimDirX: 1, aimDirZ: 0 });
    world.update(0.05);
    currentInput = idleInput();
    world.update(0.15);

    const afterHp = enemy.requireComponent<HealthComponent>('Health').hp;
    expect(afterHp).toBeLessThan(initialHp);
  });

  it('channels LMB for 2s into invulnerable heavy dash, and interrupts if hit during channel', () => {
    aiSystem.enabled = false;
    const barry = factory.createPlayer(world, 'barry', 4, 0);
    const enemy = factory.createEnemy(world, 'tank', 9, 0);
    const ctrl = barry.requireComponent<PlayerControlComponent>('PlayerControl');
    const health = barry.requireComponent<HealthComponent>('Health');

    // Start channeling LMB
    currentInput = idleInput({ heavyAttackHeld: true });
    world.update(0.5);
    expect(ctrl.state).toBe('charging_heavy');

    // Getting hit during channel interrupts it
    let interrupted = false;
    world.events.on('player:channel_interrupted', () => {
      interrupted = true;
    });
    applyDamage({ world, attacker: enemy, target: barry, rawDamage: 10 });
    expect(interrupted).toBe(true);
    expect(ctrl.state).toBe('idle');

    // Wait out brief cooldown & i-frames, then channel full 2.0s
    currentInput = idleInput();
    world.update(0.6);

    currentInput = idleInput({ heavyAttackHeld: true, aimDirX: 1, aimDirZ: 0 });
    for (let i = 0; i < 22; i++) {
      world.update(0.1);
    }

    expect(ctrl.state).toBe('heavy_dash');
    expect(health.invulnerableFromSkill).toBe(true);

    // Dashing through enemy damages it while Barry remains invulnerable
    const tankHpBefore = enemy.requireComponent<HealthComponent>('Health').hp;
    for (let i = 0; i < 4; i++) {
      world.update(0.08);
    }
    expect(enemy.requireComponent<HealthComponent>('Health').hp).toBeLessThan(tankHpBefore);
  });

  it('Q tap stuns in base radius, while Q held full charge doubles radius and deals extra damage', () => {
    aiSystem.enabled = false;
    const barry = factory.createPlayer(world, 'barry', 5, 0);
    const baseRadius = CHARACTER_REGISTRY.barry.skillQBaseRadius;

    // Enemy inside 2x charged radius (~4.1u from landing), outside base radius (2.8 + 0.72)
    const farEnemy = factory.createEnemy(world, 'tank', 5 + baseRadius + 2.5, 0);
    const closeEnemy = factory.createEnemy(world, 'tank', 6.5, 0);

    // 1) Quick tap Q: hits closeEnemy and stuns, misses farEnemy
    currentInput = idleInput({ skillQJustPressed: true, skillQHeld: true });
    world.update(0.05);
    currentInput = idleInput({ skillQJustReleased: true, skillQHeld: false });
    world.update(0.15);
    world.update(0.15);
    world.update(0.15);

    expect(closeEnemy.requireComponent<StatusEffectComponent>('StatusEffect').isStunned()).toBe(true);
    expect(farEnemy.requireComponent<HealthComponent>('Health').hp).toBe(
      farEnemy.requireComponent<HealthComponent>('Health').maxHp
    );

    // Reset position & cooldown, then test full held charge of Q
    barry.requireComponent<TransformComponent>('Transform').x = 5;
    const ctrl = barry.requireComponent<PlayerControlComponent>('PlayerControl');
    ctrl.skillQCooldown = 0;
    ctrl.state = 'idle';

    currentInput = idleInput({ skillQJustPressed: true, skillQHeld: true });
    world.update(0.05);
    currentInput = idleInput({ skillQHeld: true });
    for (let i = 0; i < 10; i++) {
      world.update(0.1); // > 0.85s full charge
    }
    currentInput = idleInput({ skillQJustReleased: true, skillQHeld: false });
    world.update(0.15);
    world.update(0.15);
    world.update(0.15);

    // Far enemy inside 2x area MUST now be hit and stunned!
    expect(farEnemy.requireComponent<HealthComponent>('Health').hp).toBeLessThan(
      farEnemy.requireComponent<HealthComponent>('Health').maxHp
    );
    expect(farEnemy.requireComponent<StatusEffectComponent>('StatusEffect').isStunned()).toBe(true);
  });

  it('Ultimate E spins for 5 seconds, damages and disorients enemies', () => {
    const barry = factory.createPlayer(world, 'barry', 5, 0);
    const enemy = factory.createEnemy(world, 'tank', 6.5, 0);
    const ctrl = barry.requireComponent<PlayerControlComponent>('PlayerControl');

    currentInput = idleInput({ ultEJustPressed: true });
    world.update(0.1);
    expect(ctrl.state).toBe('ultimate_spinning');
    expect(ctrl.stateTimer).toBe(5.0);

    currentInput = idleInput();
    world.update(0.2);

    const status = enemy.requireComponent<StatusEffectComponent>('StatusEffect');
    expect(status.isDisoriented()).toBe(true);
    expect(enemy.requireComponent<HealthComponent>('Health').hp).toBeLessThan(
      enemy.requireComponent<HealthComponent>('Health').maxHp
    );

    // Advance remainder of 5s duration
    for (let i = 0; i < 48; i++) {
      world.update(0.1);
    }
    expect(ctrl.state).toBe('idle');
  });

  it('applies Military (+dmg/+range), Thunder (micro-stun), and Solar (+damage after 1s delay)', () => {
    const barry = factory.createPlayer(world, 'barry', 5, 0);
    const enemy = factory.createEnemy(world, 'tank', 6.5, 0);
    const upg = barry.requireComponent<UpgradeComponent>('Upgrade');

    upg.addUpgrade(getUpgradeById('mil_calibre_pesado')!);
    upg.addUpgrade(getUpgradeById('rayo_chispa_divina')!);
    upg.addUpgrade(getUpgradeById('solar_brasa_latente')!);

    expect(upg.militaryDamageBonus).toBeCloseTo(0.25);
    expect(upg.militaryRangeBonus).toBeCloseTo(0.2);

    applyDamage({ world, attacker: barry, target: enemy, rawDamage: 20 });

    const eh = enemy.requireComponent<HealthComponent>('Health');
    const es = enemy.requireComponent<StatusEffectComponent>('StatusEffect');

    // Immediate hit: 20 * 1.25 = 25 damage, Thunder stunned for 0.35s, Solar queued for 1.0s
    expect(eh.hp).toBe(eh.maxHp - 25);
    expect(es.isStunned()).toBe(true);
    expect(es.solarPending.length).toBe(1);

    // At 0.5s, Solar explosion has NOT detonated yet
    world.update(0.5);
    expect(eh.hp).toBe(eh.maxHp - 25);

    // After full 1.0s delay passes, Solar detonates additional damage!
    world.update(0.55);
    expect(eh.hp).toBeLessThan(eh.maxHp - 25);
  });

  it('enforces room 1-10 enemy composition, window spawns from room 4, and boss at room 10', () => {
    factory.createPlayer(world, 'barry', 4, 0);
    roomSystem.initForRun(world);

    // Room 1: only normal zombies
    const r1Enemies = world.findByTag('enemy').map((e) => e.requireComponent<AIComponent>('AI').enemyType);
    expect(r1Enemies.length).toBe(4);
    expect(r1Enemies.every((t) => t === 'normal')).toBe(true);

    // Clear Room 1 and start Room 2 -> normal + shooter
    for (const e of world.findByTag('enemy')) world.destroyEntity(e.id);
    world.flushDestroyed();
    roomSystem.startRoom(world, 2);
    const r2Types = new Set(
      world.findByTag('enemy').map((e) => e.requireComponent<AIComponent>('AI').enemyType)
    );
    expect(r2Types.has('normal')).toBe(true);
    expect(r2Types.has('shooter')).toBe(true);
    expect(r2Types.has('tank')).toBe(false);

    // Clear Room 2 and start Room 3 -> normal + shooter + tank
    for (const e of world.findByTag('enemy')) world.destroyEntity(e.id);
    world.flushDestroyed();
    roomSystem.startRoom(world, 3);
    const r3Types = new Set(
      world.findByTag('enemy').map((e) => e.requireComponent<AIComponent>('AI').enemyType)
    );
    expect(r3Types.has('tank')).toBe(true);

    // Room 4: triggers window spawns (WindowSpawnComponent) when player approaches
    for (const e of world.findByTag('enemy')) world.destroyEntity(e.id);
    world.flushDestroyed();
    const player = world.findByTag('player')[0];
    player.requireComponent<TransformComponent>('Transform').x = 3 * 24 + 8;
    roomSystem.startRoom(world, 4);
    world.update(0.1);
    const windowSpawners = world.query('WindowSpawn');
    expect(windowSpawners.length).toBeGreaterThan(0);

    // Room 10: Boss room
    for (const e of world.findByTag('enemy')) world.destroyEntity(e.id);
    world.flushDestroyed();
    roomSystem.startRoom(world, 10);
    const r10Types = world
      .findByTag('enemy')
      .map((e) => e.requireComponent<AIComponent>('AI').enemyType);
    expect(r10Types).toContain('boss');
  });
});
