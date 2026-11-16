import type { Component } from '../core/Component';

export class HealthComponent implements Component {
  public readonly type = 'Health' as const;
  public hp: number;
  public maxHp: number;
  public invulnerableTimer = 0;
  public invulnerableFromSkill = false;
  public isDead = false;
  public hitFlashTimer = 0;

  constructor(maxHp: number) {
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  isInvulnerable(): boolean {
    return this.invulnerableTimer > 0 || this.invulnerableFromSkill;
  }
}
