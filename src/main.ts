import './style.css';
import { World } from './core/World';
import { InputManager } from './core/InputManager';
import type { TimeMode } from './core/Types';
import { SceneBuilder } from './graphics/SceneBuilder';
import { ParticleSystem } from './graphics/ParticleSystem';
import { EntityFactory } from './factories/EntityFactory';
import { StatusEffectSystem } from './systems/StatusEffectSystem';
import { PlayerSystem } from './systems/PlayerSystem';
import { AISystem } from './systems/AISystem';
import { MovementCollisionSystem } from './systems/MovementCollisionSystem';
import { RoomSystem } from './systems/RoomSystem';
import { TransformComponent } from './components/TransformComponent';
import { UIManager } from './ui/UIManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const sceneBuilder = new SceneBuilder(canvas);
const particles = new ParticleSystem(sceneBuilder.scene);
const world = new World();
const factory = new EntityFactory(sceneBuilder);
const inputManager = new InputManager();

let paused = true;

const roomSystem = new RoomSystem(factory, sceneBuilder);
const statusSystem = new StatusEffectSystem((dmg) => roomSystem.addDamageStat(dmg));
const playerSystem = new PlayerSystem(
  (px, pz) => inputManager.sample(px, pz),
  (dmg) => roomSystem.addDamageStat(dmg)
);
const aiSystem = new AISystem(factory);
const movementSystem = new MovementCollisionSystem(
  () => roomSystem.getBounds(),
  sceneBuilder.obstacles
);

world
  .addSystem(statusSystem)
  .addSystem(playerSystem)
  .addSystem(aiSystem)
  .addSystem(movementSystem)
  .addSystem(roomSystem);

function cycleTimeMode(): void {
  const order: TimeMode[] = ['night', 'day', 'cycle'];
  const idx = order.indexOf(sceneBuilder.timeMode);
  const next = order[(idx + 1) % order.length];
  sceneBuilder.setTimeMode(next);
  ui.updateTimeModeLabel(next);
}

const ui = new UIManager({
  onStartRun(mode) {
    startNewRun(mode);
  },
  onSelectUpgrade(upgradeId) {
    roomSystem.applyUpgradeChoice(world, upgradeId);
    inputManager.resetInputs();
    paused = false;
  },
  onToggleTimeMode() {
    cycleTimeMode();
  }
});

let eventUnsubs: Array<() => void> = [];

function startNewRun(mode: TimeMode): void {
  for (const unsub of eventUnsubs) unsub();
  eventUnsubs = [];

  world.clearEntities();
  world.events.clear();
  sceneBuilder.clearEntityVisuals();
  particles.clear();
  inputManager.resetInputs();

  sceneBuilder.setTimeMode(mode);
  ui.updateTimeModeLabel(mode);

  eventUnsubs.push(particles.bindEvents(world.events));
  eventUnsubs.push(
    world.events.on('upgrade:offer', (e) => {
      paused = true;
      inputManager.resetInputs();
      ui.showUpgradeModal(e.options);
    })
  );
  eventUnsubs.push(
    world.events.on('game:over', (e) => {
      paused = true;
      inputManager.resetInputs();
      ui.showEndModal(e.victory, e.stats);
    })
  );

  // Spawn Barry at the start of the street
  factory.createPlayer(world, 'barry', 4, 0);
  roomSystem.initForRun(world);
  sceneBuilder.updateCameraPosition(8, 0, true);
  paused = false;
}

inputManager.attach(canvas, sceneBuilder.camera, () => cycleTimeMode());
window.addEventListener('resize', () => sceneBuilder.handleResize());

// Initial modal on startup
ui.showStartModal();

let lastTime = performance.now();

function gameLoop(now: number): void {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  if (!paused) {
    world.update(dt);
    particles.update(dt);
  }

  sceneBuilder.applyLightingMode(paused ? 0 : dt);
  sceneBuilder.syncEntities(world.getAllEntities(), dt);

  const player = world.findByTag('player')[0];
  if (player) {
    const pt = player.requireComponent<TransformComponent>('Transform');
    const bounds = roomSystem.getBounds();
    const clampedCamX = Math.max(bounds.minX + 8, Math.min(bounds.maxX - 8, pt.x + 2));
    sceneBuilder.updateCameraPosition(clampedCamX, pt.z, false);
  }

  ui.updateHUD(
    player,
    world.findByTag('enemy'),
    roomSystem.currentRoom,
    roomSystem.enemiesRemaining,
    roomSystem.phase
  );

  sceneBuilder.render();
}

requestAnimationFrame(gameLoop);
