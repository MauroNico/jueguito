import type { Component } from '../core/Component';
import type { UpgradeCategory, UpgradeDefinition } from '../core/Types';

export class UpgradeComponent implements Component {
  public readonly type = 'Upgrade' as const;
  public acquired: UpgradeDefinition[] = [];

  // Aggregated modifiers for fast combat lookups
  public militaryDamageBonus = 0; // additive multiplier e.g. +0.25
  public militaryRangeBonus = 0; // additive multiplier e.g. +0.20
  public thunderStunDuration = 0; // seconds of stun on hit (fractions of a second, stacks)
  public solarDelayedRatio = 0; // percentage of hit damage dealt after 1.0s delay
  public solarBlastRadius = 1.4;

  public addUpgrade(def: UpgradeDefinition): void {
    this.acquired.push(def);
    if (def.damageMultiplierBonus) {
      this.militaryDamageBonus += def.damageMultiplierBonus;
    }
    if (def.rangeMultiplierBonus) {
      this.militaryRangeBonus += def.rangeMultiplierBonus;
    }
    if (def.thunderStunDuration) {
      this.thunderStunDuration += def.thunderStunDuration;
    }
    if (def.solarDelayedRatio) {
      this.solarDelayedRatio += def.solarDelayedRatio;
    }
    if (def.solarBlastRadius && def.solarBlastRadius > this.solarBlastRadius) {
      this.solarBlastRadius = def.solarBlastRadius;
    }
  }

  public getActiveCategories(): UpgradeCategory[] {
    const cats = new Set<UpgradeCategory>();
    for (const u of this.acquired) {
      cats.add(u.category);
    }
    return Array.from(cats);
  }

  public hasCategory(category: UpgradeCategory): boolean {
    return this.acquired.some((u) => u.category === category);
  }
}
