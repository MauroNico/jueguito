import type { Component } from '../core/Component';

export class TransformComponent implements Component {
  public readonly type = 'Transform' as const;
  public x: number;
  public y: number;
  public z: number;
  public facingX = 1;
  public facingZ = 0;
  public scale = 1;

  constructor(x = 0, y = 0, z = 0, scale = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.scale = scale;
  }
}
