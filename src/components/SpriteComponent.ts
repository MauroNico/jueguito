import type * as THREE from 'three';
import type { Component } from '../core/Component';

export type SpriteVisualKey =
  | 'barry_idle'
  | 'barry_walk'
  | 'barry_swing'
  | 'barry_charge'
  | 'barry_spin'
  | 'barry_slam'
  | 'zombie_normal'
  | 'zombie_shooter'
  | 'zombie_tank'
  | 'zombie_boss'
  | 'bullet'
  | 'grenade';

export class SpriteComponent implements Component {
  public readonly type = 'Sprite' as const;
  public mesh: THREE.Mesh | null = null;
  public telegraphMesh: THREE.Mesh | null = null;
  public shadowBlob: THREE.Mesh | null = null;
  public spriteKey: SpriteVisualKey;
  public width: number;
  public height: number;
  public flipX = false;
  public animTime = 0;
  public baseTint = 0xffffff;

  constructor(spriteKey: SpriteVisualKey, width = 1.6, height = 1.9) {
    this.spriteKey = spriteKey;
    this.width = width;
    this.height = height;
  }
}
