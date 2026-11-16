import { System } from '../core/System';
import type { World } from '../core/World';
import type { EnemyType } from '../core/Types';
import {
  BUILDING_Z_OFFSET,
  ROOM_LENGTH,
  STREET_MAX_Z,
  STREET_MIN_Z,
  TOTAL_ROOMS
} from '../config/GameConstants';
import { ROOM_CONFIGS } from '../config/RoomConfig';
import type { EntityFactory } from '../factories/EntityFactory';
import type { BuildingWindowSlot } from '../graphics/SceneBuilder';
import { TransformComponent } from '../components/TransformComponent';
import { HealthComponent } from '../components/HealthComponent';
import { UpgradeComponent } from '../components/UpgradeComponent';
import { getUpgradeById, rollUpgradeChoices } from '../config/UpgradeConfig';
import type { CorridorBounds } from './MovementCollisionSystem';

export type RoomPhase = 'waiting_entry' | 'combat' | 'awaiting_upgrade' | 'finished';

interface PendingWindowSpawn {
  enemyType: EnemyType;
  windowX: number;
  windowY: number;
  windowZ: number;
  side: 'top' | 'bottom';
  landX: number;
  landZ: number;
  fallbackTimer: number;
}

export interface RoomVisualHooks {
  getWindowsForRoom(roomNumber: number): BuildingWindowSlot[];
  triggerWindowWarning(x: number, z: number, duration: number): void;
  markWindowBroken(x: number, z: number): void;
  setRoomBarrier(x: number, visible: boolean): void;
}

export class RoomSystem extends System {
  public readonly priority = 60;

  public currentRoom = 1;
  public phase: RoomPhase = 'waiting_entry';
  public enemiesRemaining = 0;
  public totalRooms = TOTAL_ROOMS;

  private factory: EntityFactory;
  private visualHooks?: RoomVisualHooks;
  private pendingWindowSpawns: PendingWindowSpawn[] = [];
  private activeBounds: CorridorBounds = { minX: 0, maxX: ROOM_LENGTH };
  private runStats = {
    roomsCleared: 0,
    enemiesDefeated: 0,
    damageDealt: 0,
    upgradesPicked: 0,
    elapsedSeconds: 0
  };
  private runUnsubs: Array<() => void> = [];

  constructor(factory: EntityFactory, visualHooks?: RoomVisualHooks) {
    super();
    this.factory = factory;
    this.visualHooks = visualHooks;
  }

  public initForRun(world: World): void {
    this.currentRoom = 1;
    this.phase = 'waiting_entry';
    this.pendingWindowSpawns = [];
    this.activeBounds = { minX: 0, maxX: ROOM_LENGTH };
    this.runStats = {
      roomsCleared: 0,
      enemiesDefeated: 0,
      damageDealt: 0,
      upgradesPicked: 0,
      elapsedSeconds: 0
    };

    for (const unsub of this.runUnsubs) unsub();
    this.runUnsubs = [];

    this.runUnsubs.push(
      world.events.on('entity:died', (e) => {
        if (e.faction === 'enemy') {
          this.runStats.enemiesDefeated += 1;
        } else if (e.faction === 'player') {
          this.phase = 'finished';
          world.events.emit('game:over', {
            victory: false,
            stats: { ...this.runStats }
          });
        }
      }),
      world.events.on('enemy:window_leap', (e) => {
        this.visualHooks?.markWindowBroken(e.position.x, e.position.z);
      })
    );

    this.visualHooks?.setRoomBarrier(ROOM_LENGTH, true);
    this.startRoom(world, 1);
  }

  public addDamageStat(amount: number): void {
    this.runStats.damageDealt += amount;
  }

  public getBounds(): CorridorBounds {
    return this.activeBounds;
  }

  public getStats() {
    return { ...this.runStats };
  }

  public startRoom(world: World, roomNumber: number): void {
    const spec = ROOM_CONFIGS.find((r) => r.roomNumber === roomNumber);
    if (!spec) return;

    this.currentRoom = roomNumber;
    this.phase = 'combat';
    const roomMinX = (roomNumber - 1) * ROOM_LENGTH;
    const roomMaxX = roomNumber * ROOM_LENGTH;

    // Allow player to move from previous cleared space up to current room's end barrier
    this.activeBounds = {
      minX: Math.max(0, roomMinX - 4),
      maxX: roomMaxX
    };
    this.visualHooks?.setRoomBarrier(roomMaxX, true);

    // Spawn street enemies immediately inside the room ahead of entry
    let totalCount = 0;
    for (const group of spec.streetEnemies) {
      for (let i = 0; i < group.count; i++) {
        totalCount++;
        const x =
          group.type === 'boss'
            ? roomMinX + ROOM_LENGTH * 0.72
            : roomMinX + 8 + ((i * 3.7 + totalCount * 1.9) % (ROOM_LENGTH - 10));
        const z =
          group.type === 'boss'
            ? 0
            : STREET_MIN_Z + 1.1 + (((i * 2.9 + totalCount * 1.7) % 10) / 10) * (STREET_MAX_Z - STREET_MIN_Z - 2.2);

        this.factory.createEnemy(world, group.type, x, z);
      }
    }

    // Queue window enemies (Rooms 4 to 10): spawn when player approaches or after brief stagger
    this.pendingWindowSpawns = [];
    const roomWindows = this.visualHooks?.getWindowsForRoom(roomNumber) ?? [];
    let winIndex = 0;

    for (const group of spec.windowEnemies) {
      for (let i = 0; i < group.count; i++) {
        totalCount++;
        const slot = roomWindows[winIndex % Math.max(1, roomWindows.length)];
        winIndex++;

        const side: 'top' | 'bottom' = slot ? slot.side : i % 2 === 0 ? 'top' : 'bottom';
        const windowX = slot
          ? slot.x
          : roomMinX + 6 + ((winIndex * 4.5) % (ROOM_LENGTH - 8));
        const windowY = slot ? slot.y : side === 'top' ? 2.5 : 1.15;
        const windowZ = slot
          ? slot.z
          : side === 'top'
            ? -BUILDING_Z_OFFSET + 0.2
            : BUILDING_Z_OFFSET - 0.2;

        const landX = windowX + (Math.random() - 0.5) * 2.0;
        const landZ = side === 'top' ? STREET_MIN_Z + 1.2 : STREET_MAX_Z - 1.2;

        this.pendingWindowSpawns.push({
          enemyType: group.type,
          windowX,
          windowY,
          windowZ,
          side,
          landX,
          landZ,
          fallbackTimer: 2.0 + i * 1.1
        });
      }
    }

    this.enemiesRemaining = totalCount;
    world.events.emit('room:started', {
      roomNumber,
      totalEnemies: totalCount
    });
  }

  public applyUpgradeChoice(world: World, upgradeId: string): void {
    if (this.phase !== 'awaiting_upgrade') return;
    const def = getUpgradeById(upgradeId);
    const player = world.findByTag('player')[0];
    if (def && player) {
      const upgradeComp = player.getComponent<UpgradeComponent>('Upgrade');
      upgradeComp?.addUpgrade(def);
      this.runStats.upgradesPicked += 1;
    }

    world.events.emit('upgrade:selected', { upgradeId });

    // Unlock forward passage to the next invisible room!
    const nextRoom = this.currentRoom + 1;
    this.currentRoom = nextRoom;
    this.phase = 'waiting_entry';
    this.activeBounds = {
      minX: Math.max(0, (nextRoom - 1) * ROOM_LENGTH - 6),
      maxX: nextRoom * ROOM_LENGTH
    };
    this.visualHooks?.setRoomBarrier(nextRoom * ROOM_LENGTH, true);
  }

  update(world: World, dt: number): void {
    if (this.phase === 'finished') return;

    this.runStats.elapsedSeconds += dt;
    const player = world.findByTag('player')[0];
    if (!player) return;

    const pt = player.requireComponent<TransformComponent>('Transform');
    const ph = player.requireComponent<HealthComponent>('Health');
    if (ph.isDead) return;

    // Trigger next room automatically when player walks into its street corridor
    if (this.phase === 'waiting_entry') {
      const entryX = (this.currentRoom - 1) * ROOM_LENGTH + 1.2;
      if (pt.x >= entryX) {
        this.startRoom(world, this.currentRoom);
      }
      return;
    }

    if (this.phase !== 'combat') return;

    // Trigger window spawns when Barry approaches the building window (or fallback timer)
    for (let i = this.pendingWindowSpawns.length - 1; i >= 0; i--) {
      const pending = this.pendingWindowSpawns[i];
      pending.fallbackTimer -= dt;
      const distX = Math.abs(pt.x - pending.windowX);
      if (distX <= 9.5 || pending.fallbackTimer <= 0) {
        this.pendingWindowSpawns.splice(i, 1);

        const warningDuration = 1.15;
        this.visualHooks?.triggerWindowWarning(pending.windowX, pending.windowZ, warningDuration);
        world.events.emit('enemy:window_warning', {
          position: { x: pending.windowX, y: pending.windowY, z: pending.windowZ },
          side: pending.side,
          duration: warningDuration
        });

        this.factory.createEnemy(world, pending.enemyType, pending.landX, pending.landZ, {
          startX: pending.windowX,
          startY: pending.windowY,
          startZ: pending.windowZ,
          landX: pending.landX,
          landZ: pending.landZ,
          side: pending.side,
          warningDuration
        });
      }
    }

    // Count active enemies + pending window ambushers
    const activeEnemies = world.findByTag('enemy').filter((e) => {
      const eh = e.getComponent<HealthComponent>('Health');
      return eh && !eh.isDead;
    }).length;

    this.enemiesRemaining = activeEnemies + this.pendingWindowSpawns.length;

    if (this.enemiesRemaining === 0) {
      this.runStats.roomsCleared = this.currentRoom;
      world.events.emit('room:cleared', { roomNumber: this.currentRoom });

      if (this.currentRoom >= this.totalRooms) {
        this.phase = 'finished';
        world.events.emit('game:over', {
          victory: true,
          stats: { ...this.runStats }
        });
      } else {
        this.phase = 'awaiting_upgrade';
        const choices = rollUpgradeChoices(3);
        world.events.emit('upgrade:offer', {
          roomNumber: this.currentRoom,
          options: choices.map((c) => c.id)
        });
      }
    }
  }
}
