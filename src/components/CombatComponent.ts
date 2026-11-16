import type { Component } from '../core/Component';

export class CombatComponent implements Component {
  public readonly type = 'Combat' as const;
  public baseDamage: number;
  public baseRange: number;
  public damageMultiplier = 1;
  public rangeMultiplier = 1;
  public comboStep = 0;
  public comboResetTimer = 0;
  public totalComboHits = 0;
  public comboDecayTimer = 0;

  constructor(baseDamage: number, baseRange: number) {
    this.baseDamage = baseDamage;
    this.baseRange = baseRange;
  }

  get effectiveDamage(): number {
    return this.baseDamage * this.damageMultiplier;
  }

  get effectiveRange(): number {
    return this.baseRange * this.rangeMultiplier;
  }
}
