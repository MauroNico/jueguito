import * as THREE from 'three';

export interface InputSnapshot {
  moveX: number;
  moveZ: number;
  aimDirX: number;
  aimDirZ: number;
  aimWorldX: number;
  aimWorldZ: number;
  basicAttackPressed: boolean; // Click Derecho (just pressed or held)
  heavyAttackHeld: boolean; // Click Izquierdo (held to channel 2s)
  heavyAttackJustReleased: boolean;
  skillQHeld: boolean; // Q held
  skillQJustPressed: boolean;
  skillQJustReleased: boolean;
  dashSpaceJustPressed: boolean; // Spacebar
  ultEJustPressed: boolean; // E
}

export class InputManager {
  private keys = new Set<string>();
  private rightMouseDown = false;
  private leftMouseDown = false;
  private leftMouseJustReleased = false;
  private qJustPressed = false;
  private qJustReleased = false;
  private spaceJustPressed = false;
  private eJustPressed = false;

  private pointerNdc = new THREE.Vector2(0, 0);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hitPoint = new THREE.Vector3();

  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private boundHandlers: Array<() => void> = [];
  private onTimeToggle?: () => void;

  public attach(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    onTimeToggle?: () => void
  ): void {
    this.canvas = canvas;
    this.camera = camera;
    this.onTimeToggle = onTimeToggle;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
        if (document.activeElement?.tagName !== 'BUTTON') {
          e.preventDefault();
        }
      }
      const wasDown = this.keys.has(e.code);
      this.keys.add(e.code);

      if (!wasDown) {
        if (e.code === 'KeyQ') this.qJustPressed = true;
        if (e.code === 'Space') this.spaceJustPressed = true;
        if (e.code === 'KeyE') this.eJustPressed = true;
        if (e.code === 'KeyT' && this.onTimeToggle) this.onTimeToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const wasDown = this.keys.has(e.code);
      this.keys.delete(e.code);
      if (wasDown && e.code === 'KeyQ') {
        this.qJustReleased = true;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        this.rightMouseDown = true;
      } else if (e.button === 0) {
        this.leftMouseDown = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        this.rightMouseDown = false;
      } else if (e.button === 0) {
        if (this.leftMouseDown) {
          this.leftMouseJustReleased = true;
        }
        this.leftMouseDown = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBlur = () => {
      this.keys.clear();
      this.rightMouseDown = false;
      this.leftMouseDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);

    this.boundHandlers = [
      () => window.removeEventListener('keydown', handleKeyDown),
      () => window.removeEventListener('keyup', handleKeyUp),
      () => canvas.removeEventListener('mousedown', handleMouseDown),
      () => window.removeEventListener('mouseup', handleMouseUp),
      () => window.removeEventListener('mousemove', handleMouseMove),
      () => canvas.removeEventListener('contextmenu', handleContextMenu),
      () => window.removeEventListener('blur', handleBlur)
    ];
  }

  public detach(): void {
    for (const unbind of this.boundHandlers) unbind();
    this.boundHandlers = [];
  }

  public resetInputs(): void {
    this.keys.clear();
    this.rightMouseDown = false;
    this.leftMouseDown = false;
    this.leftMouseJustReleased = false;
    this.qJustPressed = false;
    this.qJustReleased = false;
    this.spaceJustPressed = false;
    this.eJustPressed = false;
  }

  public sample(playerX: number, playerZ: number): InputSnapshot {
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ += 1;

    if (moveX !== 0 && moveZ !== 0) {
      const inv = Math.SQRT1_2;
      moveX *= inv;
      moveZ *= inv;
    }

    let aimWorldX = playerX + 1;
    let aimWorldZ = playerZ;

    if (this.camera) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint);
      if (hit) {
        aimWorldX = hit.x;
        aimWorldZ = hit.z;
      }
    }

    let aimDirX = aimWorldX - playerX;
    let aimDirZ = aimWorldZ - playerZ;
    const len = Math.hypot(aimDirX, aimDirZ);
    if (len > 0.001) {
      aimDirX /= len;
      aimDirZ /= len;
    } else {
      aimDirX = 1;
      aimDirZ = 0;
    }

    const snapshot: InputSnapshot = {
      moveX,
      moveZ,
      aimDirX,
      aimDirZ,
      aimWorldX,
      aimWorldZ,
      basicAttackPressed: this.rightMouseDown,
      heavyAttackHeld: this.leftMouseDown,
      heavyAttackJustReleased: this.leftMouseJustReleased,
      skillQHeld: this.keys.has('KeyQ'),
      skillQJustPressed: this.qJustPressed,
      skillQJustReleased: this.qJustReleased,
      dashSpaceJustPressed: this.spaceJustPressed,
      ultEJustPressed: this.eJustPressed
    };

    // Consume edge triggers
    this.leftMouseJustReleased = false;
    this.qJustPressed = false;
    this.qJustReleased = false;
    this.spaceJustPressed = false;
    this.eJustPressed = false;

    return snapshot;
  }
}
