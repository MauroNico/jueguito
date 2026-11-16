import type { Component } from '../core/Component';

export class VelocityComponent implements Component {
  public readonly type = 'Velocity' as const;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public baseSpeed: number;
  public speedMultiplier = 1;
  public knockbackVx = 0;
  public knockbackVz = 0;

  constructor(baseSpeed = 7) {
    this.baseSpeed = baseSpeed;
  }
}
