import { Entity } from './Entity';
import { EventBus } from './EventBus';
import { System } from './System';
import type { ComponentType, EntityId } from './Types';

export class World {
  private nextEntityId: EntityId = 1;
  private entities = new Map<EntityId, Entity>();
  private systems: System[] = [];
  private toDestroy = new Set<EntityId>();
  public readonly events = new EventBus();
  public elapsedTime = 0;

  createEntity(): Entity {
    const id = this.nextEntityId++;
    const entity = new Entity(id);
    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  destroyEntity(id: EntityId): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.active = false;
      this.toDestroy.add(id);
    }
  }

  flushDestroyed(): Entity[] {
    const removed: Entity[] = [];
    for (const id of this.toDestroy) {
      const entity = this.entities.get(id);
      if (entity) {
        removed.push(entity);
        this.entities.delete(id);
      }
    }
    this.toDestroy.clear();
    return removed;
  }

  query(...types: ComponentType[]): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.active && entity.hasComponents(types)) {
        result.push(entity);
      }
    }
    return result;
  }

  findByTag(tag: string): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.active && entity.hasTag(tag)) {
        result.push(entity);
      }
    }
    return result;
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  addSystem(system: System): this {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    return this;
  }

  update(dt: number): void {
    this.elapsedTime += dt;
    for (const system of this.systems) {
      if (system.enabled) {
        system.update(this, dt);
      }
    }
    this.flushDestroyed();
  }

  clearEntities(): void {
    this.entities.clear();
    this.toDestroy.clear();
    this.nextEntityId = 1;
    this.elapsedTime = 0;
  }
}
