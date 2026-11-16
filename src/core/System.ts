import type { World } from './World';

export abstract class System {
  public enabled = true;
  public abstract readonly priority: number;

  abstract update(world: World, dt: number): void;
}
