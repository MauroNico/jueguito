import { Entity } from '../core/Entity';
import type { World } from '../core/World';
import type { CharacterId, EnemyType, Faction } from '../core/Types';
import { CHARACTER_REGISTRY } from '../config/CharacterConfig';
import { ENEMY_REGISTRY } from '../config/EnemyConfig';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { ColliderComponent } from '../components/ColliderComponent';
import { HealthComponent } from '../components/HealthComponent';
import { CombatComponent } from '../components/CombatComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { AIComponent } from '../components/AIComponent';
import { WindowSpawnComponent } from '../components/WindowSpawnComponent';
import { StatusEffectComponent } from '../components/StatusEffectComponent';
import { UpgradeComponent } from '../components/UpgradeComponent';
import { ProjectileComponent, type ProjectileKind } from '../components/ProjectileComponent';
import { SpriteComponent } from '../components/SpriteComponent';

export interface EntityVisualHook {
  attachVisual(entity: Entity): void;
}

export class EntityFactory {
  private visualHook?: EntityVisualHook;

  constructor(visualHook?: EntityVisualHook) {
    this.visualHook = visualHook;
  }

  public setVisualHook(hook: EntityVisualHook): void {
    this.visualHook = hook;
  }

  public createPlayer(world: World, characterId: CharacterId, x: number, z: number): Entity {
    const def = CHARACTER_REGISTRY[characterId];
    const entity = world.createEntity();
    entity
      .addTag('player')
      .addComponent(new TransformComponent(x, 0, z))
      .addComponent(new VelocityComponent(def.moveSpeed))
      .addComponent(new ColliderComponent(def.colliderRadius, 'player', true))
      .addComponent(new HealthComponent(def.maxHp))
      .addComponent(new CombatComponent(def.baseDamage, def.baseRange))
      .addComponent(new PlayerControlComponent(characterId))
      .addComponent(new StatusEffectComponent())
      .addComponent(new UpgradeComponent())
      .addComponent(new SpriteComponent('barry_idle', 1.85, 2.1));

    this.visualHook?.attachVisual(entity);
    return entity;
  }

  public createEnemy(
    world: World,
    enemyType: EnemyType,
    x: number,
    z: number,
    windowSpawn?: {
      startX: number;
      startY: number;
      startZ: number;
      landX: number;
      landZ: number;
      side: 'top' | 'bottom';
      warningDuration?: number;
    }
  ): Entity {
    const def = ENEMY_REGISTRY[enemyType];
    const entity = world.createEntity();
    const spawnX = windowSpawn ? windowSpawn.startX : x;
    const spawnY = windowSpawn ? windowSpawn.startY : 0;
    const spawnZ = windowSpawn ? windowSpawn.startZ : z;

    entity
      .addTag('enemy')
      .addTag(`enemy_${enemyType}`)
      .addComponent(new TransformComponent(spawnX, spawnY, spawnZ))
      .addComponent(new VelocityComponent(def.moveSpeed))
      .addComponent(new ColliderComponent(def.colliderRadius, 'enemy', true))
      .addComponent(new HealthComponent(def.maxHp))
      .addComponent(new AIComponent(enemyType, def.preferredRange, def.damage, def.moveSpeed))
      .addComponent(new StatusEffectComponent())
      .addComponent(new SpriteComponent(def.spriteKey, def.spriteWidth, def.spriteHeight));

    if (windowSpawn) {
      const ai = entity.requireComponent<AIComponent>('AI');
      ai.state = 'spawning_window';
      entity.addComponent(
        new WindowSpawnComponent(
          windowSpawn.startX,
          windowSpawn.startY,
          windowSpawn.startZ,
          windowSpawn.landX,
          windowSpawn.landZ,
          windowSpawn.side,
          windowSpawn.warningDuration ?? 1.15
        )
      );
    }

    this.visualHook?.attachVisual(entity);
    return entity;
  }

  public createProjectile(
    world: World,
    options: {
      kind: ProjectileKind;
      faction: Faction;
      ownerId: number;
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      damage: number;
      radius: number;
      maxLifeTime: number;
      isLobbed?: boolean;
      targetX?: number;
      targetZ?: number;
      explosionRadius?: number;
    }
  ): Entity {
    const entity = world.createEntity();
    const vel = new VelocityComponent(Math.hypot(options.vx, options.vz));
    vel.vx = options.vx;
    vel.vz = options.vz;

    const proj = new ProjectileComponent(
      options.kind,
      options.faction,
      options.ownerId,
      options.damage,
      options.maxLifeTime,
      options.isLobbed ?? false
    );
    proj.startX = options.x;
    proj.startZ = options.z;
    proj.targetX = options.targetX ?? options.x;
    proj.targetZ = options.targetZ ?? options.z;
    proj.explosionRadius = options.explosionRadius ?? 2.5;

    entity
      .addTag('projectile')
      .addComponent(new TransformComponent(options.x, options.y, options.z))
      .addComponent(vel)
      .addComponent(new ColliderComponent(options.radius, options.faction, false))
      .addComponent(proj)
      .addComponent(
        new SpriteComponent(
          options.kind === 'grenade' ? 'grenade' : 'bullet',
          options.kind === 'grenade' ? 0.65 : 0.45,
          options.kind === 'grenade' ? 0.65 : 0.45
        )
      );

    this.visualHook?.attachVisual(entity);
    return entity;
  }
}
