import type { Component } from '../core/Component';
import type { Faction } from '../core/Types';

export class ColliderComponent implements Component {
  public readonly type = 'Collider' as const;
  public radius: number;
  public faction: Faction;
  public isSolid: boolean;

  constructor(radius: number, faction: Faction, isSolid = true) {
    this.radius = radius;
    this.faction = faction;
    this.isSolid = isSolid;
  }
}
