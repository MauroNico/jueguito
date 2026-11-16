import type { CharacterId } from '../core/Types';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  weaponName: string;
  maxHp: number;
  moveSpeed: number;
  baseDamage: number;
  baseRange: number;
  colliderRadius: number;
  basicSweepArc: number;
  basicDamageScale: number;
  heavyDashDamageScale: number;
  heavyDashSpeed: number;
  heavyDashDuration: number;
  skillQBaseRadius: number;
  skillQBaseDamageScale: number;
  skillQChargedDamageScale: number;
  skillQStunDuration: number;
  dashSpeed: number;
  dashDuration: number;
  ultDuration: number;
  ultRadius: number;
  ultTickDamageScale: number;
  ultDisorientDuration: number;
}

export const CHARACTER_REGISTRY: Record<CharacterId, CharacterDefinition> = {
  barry: {
    id: 'barry',
    name: 'Barry',
    weaponName: 'Martillo Neón',
    maxHp: 220,
    moveSpeed: 7.4,
    baseDamage: 28,
    baseRange: 2.75,
    colliderRadius: 0.55,
    basicSweepArc: Math.PI * 0.85,
    basicDamageScale: 1.0,
    heavyDashDamageScale: 2.3,
    heavyDashSpeed: 21.0,
    heavyDashDuration: 0.45,
    skillQBaseRadius: 2.8,
    skillQBaseDamageScale: 1.35,
    skillQChargedDamageScale: 2.4,
    skillQStunDuration: 1.15,
    dashSpeed: 18.5,
    dashDuration: 0.22,
    ultDuration: 5.0,
    ultRadius: 3.1,
    ultTickDamageScale: 0.72,
    ultDisorientDuration: 2.2
  }
};
