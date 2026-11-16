import type { Component } from '../core/Component';
import type { EntityId, Faction } from '../core/Types';

export type ProjectileKind = 'bullet' | 'boss_bullet' | 'grenade';

export class ProjectileComponent implements Component {
  public readonly type = 'Projectile' as const;
  public kind: ProjectileKind;
  public faction: Faction;
  public ownerId: EntityId;
  public damage: number;
  public lifeTime: number;
  public maxLifeTime: number;

  // Grenade parabolic arc fields
  public isLobbed: boolean;
  public startX = 0;
  public startZ = 0;
  public targetX = 0;
  public targetZ = 0;
  public explosionRadius = 2.4;

  constructor(
    kind: ProjectileKind,
    faction: Faction,
    ownerId: EntityId,
    damage: number,
    maxLifeTime = 2.4,
    isLobbed = false
  ) {
    this.kind = kind;
    this.faction = faction;
    this.ownerId = ownerId;
    this.damage = damage;
    this.lifeTime = 0;
    this.maxLifeTime = maxLifeTime;
    this.isLobbed = isLobbed;
  }
}
