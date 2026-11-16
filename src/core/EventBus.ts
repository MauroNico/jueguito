import type { EnemyType, EntityId, UpgradeCategory, Vec3, RunStats } from './Types';

export interface GameEventMap {
  'damage:dealt': {
    attackerId: EntityId | null;
    targetId: EntityId;
    amount: number;
    position: Vec3;
    isCrit?: boolean;
    sourceCategory?: UpgradeCategory | 'base' | 'enemy';
    isSolarDelayed?: boolean;
  };
  'entity:died': {
    entityId: EntityId;
    faction: 'player' | 'enemy' | 'neutral';
    enemyType?: EnemyType;
    position: Vec3;
  };
  'player:channel_interrupted': {
    entityId: EntityId;
    position: Vec3;
  };
  'player:attack_swing': {
    entityId: EntityId;
    origin: Vec3;
    dirX: number;
    dirZ: number;
    range: number;
    arcRadians: number;
    comboStep: number;
    categories: UpgradeCategory[];
  };
  'player:heavy_dash_start': {
    entityId: EntityId;
    origin: Vec3;
    dirX: number;
    dirZ: number;
  };
  'player:skill_q_slam': {
    entityId: EntityId;
    origin: Vec3;
    radius: number;
    isCharged: boolean;
    categories: UpgradeCategory[];
  };
  'player:ult_spin_tick': {
    entityId: EntityId;
    origin: Vec3;
    radius: number;
    categories: UpgradeCategory[];
  };
  'player:dash_space': {
    entityId: EntityId;
    origin: Vec3;
    dirX: number;
    dirZ: number;
  };
  'enemy:window_warning': {
    position: Vec3;
    side: 'top' | 'bottom';
    duration: number;
  };
  'enemy:window_leap': {
    entityId: EntityId;
    position: Vec3;
  };
  'enemy:shoot_fire': {
    entityId: EntityId;
    position: Vec3;
    dirX: number;
    dirZ: number;
    isBoss: boolean;
  };
  'boss:grenade_throw': {
    startPos: Vec3;
    targetPos: Vec3;
    radius: number;
    fuseTime: number;
  };
  'boss:grenade_explode': {
    position: Vec3;
    radius: number;
  };
  'status:applied': {
    targetId: EntityId;
    effect: 'stunned' | 'disoriented' | 'solar_marked';
    position: Vec3;
    duration: number;
  };
  'status:solar_detonate': {
    targetId: EntityId;
    position: Vec3;
    damage: number;
    radius: number;
  };
  'room:started': {
    roomNumber: number;
    totalEnemies: number;
  };
  'room:cleared': {
    roomNumber: number;
  };
  'upgrade:offer': {
    roomNumber: number;
    options: string[];
  };
  'upgrade:selected': {
    upgradeId: string;
  };
  'game:over': {
    victory: boolean;
    stats: RunStats;
  };
}

type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<never>);
    }
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<GameEventMap[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
