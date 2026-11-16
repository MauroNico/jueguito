import type { Component } from '../core/Component';

export class WindowSpawnComponent implements Component {
  public readonly type = 'WindowSpawn' as const;
  public phase: 'warning' | 'leaping' | 'landed' = 'warning';
  public timer = 0;
  public readonly warningDuration: number;
  public readonly leapDuration = 0.48;
  public startX: number;
  public startY: number;
  public startZ: number;
  public landX: number;
  public landZ: number;
  public side: 'top' | 'bottom';

  constructor(
    startX: number,
    startY: number,
    startZ: number,
    landX: number,
    landZ: number,
    side: 'top' | 'bottom',
    warningDuration = 1.15
  ) {
    this.startX = startX;
    this.startY = startY;
    this.startZ = startZ;
    this.landX = landX;
    this.landZ = landZ;
    this.side = side;
    this.warningDuration = warningDuration;
  }
}
