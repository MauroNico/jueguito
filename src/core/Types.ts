export type EntityId = number;

export type ComponentType =
  | 'Transform'
  | 'Velocity'
  | 'Collider'
  | 'Health'
  | 'Combat'
  | 'PlayerControl'
  | 'AI'
  | 'WindowSpawn'
  | 'StatusEffect'
  | 'Upgrade'
  | 'Projectile'
  | 'Sprite';

export type Faction = 'player' | 'enemy' | 'neutral';

export type EnemyType = 'normal' | 'shooter' | 'tank' | 'boss';

export type CharacterId = 'barry';

export type UpgradeCategory = 'military' | 'thunder' | 'solar';

export type TimeMode = 'night' | 'day' | 'cycle';

export type PlayerActionState =
  | 'idle'
  | 'moving'
  | 'basic_attack'
  | 'charging_heavy'
  | 'heavy_dash'
  | 'charging_skill_q'
  | 'skill_q_slam'
  | 'dashing_space'
  | 'ultimate_spinning';

export type AIState =
  | 'spawning_window'
  | 'chase'
  | 'windup_melee'
  | 'aiming_shot'
  | 'windup_charge'
  | 'charging_dash'
  | 'boss_strafe'
  | 'boss_mg_windup'
  | 'boss_mg_firing'
  | 'boss_grenade_windup'
  | 'cooldown';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  category: UpgradeCategory;
  tier: number;
  description: string;
  damageMultiplierBonus?: number;
  rangeMultiplierBonus?: number;
  thunderStunDuration?: number;
  solarDelayedRatio?: number;
  solarBlastRadius?: number;
}

export interface RunStats {
  roomsCleared: number;
  enemiesDefeated: number;
  damageDealt: number;
  upgradesPicked: number;
  elapsedSeconds: number;
}
