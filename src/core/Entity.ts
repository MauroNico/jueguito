import type { Component } from './Component';
import type { ComponentType, EntityId } from './Types';

export class Entity {
  public readonly id: EntityId;
  private components = new Map<ComponentType, Component>();
  public tags = new Set<string>();
  public active = true;

  constructor(id: EntityId) {
    this.id = id;
  }

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  getComponent<T extends Component>(type: ComponentType): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  requireComponent<T extends Component>(type: ComponentType): T {
    const comp = this.components.get(type);
    if (!comp) {
      throw new Error(`Entity ${this.id} missing required component: ${type}`);
    }
    return comp as T;
  }

  hasComponent(type: ComponentType): boolean {
    return this.components.has(type);
  }

  hasComponents(types: ComponentType[]): boolean {
    for (const t of types) {
      if (!this.components.has(t)) return false;
    }
    return true;
  }

  removeComponent(type: ComponentType): boolean {
    return this.components.delete(type);
  }

  addTag(tag: string): this {
    this.tags.add(tag);
    return this;
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }
}
