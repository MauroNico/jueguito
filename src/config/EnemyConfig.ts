import type { EnemyType } from '../core/Types';
import type { SpriteVisualKey } from '../components/SpriteComponent';

export interface EnemyDefinition {
  type: EnemyType;
  label: string;
  maxHp: number;
  moveSpeed: number;
  damage: number;
  preferredRange: number;
  colliderRadius: number;
  spriteKey: SpriteVisualKey;
  spriteWidth: number;
  spriteHeight: number;
}

export const ENEMY_REGISTRY: Record<EnemyType, EnemyDefinition> = {
  normal: {
    type: 'normal',
    label: 'Zombie Urbano',
    maxHp: 65,
    moveSpeed: 3.1,
    damage: 14,
    preferredRange: 1.25,
    colliderRadius: 0.48,
    spriteKey: 'zombie_normal',
    spriteWidth: 1.45,
    spriteHeight: 1.8
  },
  shooter: {
    type: 'shooter',
    label: 'Zombie Policía',
    maxHp: 58,
    moveSpeed: 2.8,
    damage: 18,
    preferredRange: 8.5,
    colliderRadius: 0.48,
    spriteKey: 'zombie_shooter',
    spriteWidth: 1.5,
    spriteHeight: 1.85
  },
  tank: {
    type: 'tank',
    label: 'Zombie Tanque',
    maxHp: 210,
    moveSpeed: 2.35,
    damage: 26,
    preferredRange: 1.45,
    colliderRadius: 0.72,
    spriteKey: 'zombie_tank',
    spriteWidth: 2.0,
    spriteHeight: 2.3
  },
  boss: {
    type: 'boss',
    label: 'General Corrupto',
    maxHp: 950,
    moveSpeed: 2.6,
    damage: 20,
    preferredRange: 9.0,
    colliderRadius: 0.95,
    spriteKey: 'zombie_boss',
    spriteWidth: 2.6,
    spriteHeight: 3.0
  }
};
