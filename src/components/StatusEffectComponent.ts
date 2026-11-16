import type { Component } from '../core/Component';
import type { EntityId } from '../core/Types';

export interface SolarPendingHit {
  remainingDelay: number;
  damage: number;
  radius: number;
  attackerId: EntityId | null;
}

export class StatusEffectComponent implements Component {
  public readonly type = 'StatusEffect' as const;
  public stunTimer = 0;
  public disorientedTimer = 0;
  public disorientWanderAngle = 0;
  public disorientChangeTimer = 0;
  public solarPending: SolarPendingHit[] = [];

  public isStunned(): boolean {
    return this.stunTimer > 0;
  }

  public isDisoriented(): boolean {
    return this.disorientedTimer > 0;
  }

  public applyStun(duration: number): void {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  public applyDisoriented(duration: number): void {
    this.disorientedTimer = Math.max(this.disorientedTimer, duration);
  }

  public addSolarDelayedHit(
    damage: number,
    radius: number,
    attackerId: EntityId | null,
    delay = 1.0
  ): void {
    this.solarPending.push({
      remainingDelay: delay,
      damage,
      radius,
      attackerId
    });
  }
}
