import * as THREE from 'three';
import type { SpriteVisualKey } from '../components/SpriteComponent';

function createPixelCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function toPixelTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export class PixelArtGenerator {
  private spriteTextures = new Map<SpriteVisualKey, THREE.CanvasTexture>();
  private worldTextures = new Map<string, THREE.CanvasTexture>();

  public getSpriteTexture(key: SpriteVisualKey): THREE.CanvasTexture {
    let tex = this.spriteTextures.get(key);
    if (!tex) {
      tex = this.generateSprite(key);
      this.spriteTextures.set(key, tex);
    }
    return tex;
  }

  public getWorldTexture(
    key: 'asphalt' | 'sidewalk' | 'building' | 'window_lit' | 'window_warn' | 'window_broken' | 'barricade' | 'barrel'
  ): THREE.CanvasTexture {
    let tex = this.worldTextures.get(key);
    if (!tex) {
      tex = this.generateWorldTexture(key);
      this.worldTextures.set(key, tex);
    }
    return tex;
  }

  private generateSprite(key: SpriteVisualKey): THREE.CanvasTexture {
    switch (key) {
      case 'barry_idle':
      case 'barry_walk':
      case 'barry_swing':
      case 'barry_charge':
      case 'barry_spin':
      case 'barry_slam':
        return this.drawBarry(key);
      case 'zombie_normal':
        return this.drawZombieNormal();
      case 'zombie_shooter':
        return this.drawZombieShooter();
      case 'zombie_tank':
        return this.drawZombieTank();
      case 'zombie_boss':
        return this.drawZombieBoss();
      case 'bullet':
        return this.drawBullet();
      case 'grenade':
        return this.drawGrenade();
    }
  }

  private drawBarry(pose: SpriteVisualKey): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(36, 40);

    // Outline dark shadow at feet? No, real 3D shadows handle ground shadows!
    const bob = pose === 'barry_walk' ? -1 : pose === 'barry_charge' ? 2 : pose === 'barry_slam' ? -2 : 0;

    // Boots (urban rebel heavy boots)
    const legSpread = pose === 'barry_walk' ? 3 : pose === 'barry_spin' ? 4 : 1;
    px(ctx, 11 - legSpread, 33, 5, 6, '#1b1d2b');
    px(ctx, 20 + legSpread, 33, 5, 6, '#1b1d2b');
    px(ctx, 11 - legSpread, 37, 6, 2, '#ff2e93'); // neon sole trim
    px(ctx, 20 + legSpread, 37, 6, 2, '#ff2e93');

    // Dark jeans
    px(ctx, 12 - legSpread / 2, 26 + bob, 5, 8, '#283149');
    px(ctx, 19 + legSpread / 2, 26 + bob, 5, 8, '#283149');

    // Rebel Neon Jacket
    px(ctx, 10, 14 + bob, 16, 13, '#171a2b'); // Jacket dark core
    px(ctx, 11, 15 + bob, 14, 11, '#262b44');
    // Cyan & Magenta street stripes
    px(ctx, 10, 15 + bob, 2, 11, '#00f5d4');
    px(ctx, 24, 15 + bob, 2, 11, '#ff2e93');
    // Hoodie/Shirt inner
    px(ctx, 15, 15 + bob, 6, 10, '#f72585');
    px(ctx, 16, 17 + bob, 4, 2, '#00f5d4');

    // Head + Punk Visor + Spiky Hair
    px(ctx, 13, 6 + bob, 10, 9, '#f1c27d'); // skin
    px(ctx, 12, 3 + bob, 12, 4, '#2b193d'); // dark hair
    px(ctx, 14, 1 + bob, 3, 3, '#ff2e93'); // neon hair streak
    px(ctx, 18, 2 + bob, 4, 2, '#2b193d');
    // Neon rebel shades / visor
    px(ctx, 14, 9 + bob, 9, 3, '#0b0d17');
    px(ctx, 15, 10 + bob, 7, 1, '#00f5d4');

    // Arms + Hammer according to pose
    if (pose === 'barry_swing') {
      // Extended swinging hammer right
      px(ctx, 24, 16, 6, 4, '#262b44');
      px(ctx, 28, 17, 3, 3, '#f1c27d');
      // Hammer handle horizontal + head
      px(ctx, 18, 14, 14, 2, '#8d99ae');
      px(ctx, 27, 8, 8, 12, '#3a405a');
      px(ctx, 28, 9, 6, 10, '#6c757d');
      px(ctx, 33, 9, 2, 10, '#00f5d4'); // neon edge
      px(ctx, 27, 13, 2, 2, '#ff2e93');
    } else if (pose === 'barry_charge') {
      // Crouched channeling pose with glowing hammer overhead/back
      px(ctx, 7, 15, 4, 5, '#262b44');
      px(ctx, 4, 10, 14, 2, '#adb5bd');
      px(ctx, 1, 5, 8, 10, '#ffbe0b'); // golden/neon charged head
      px(ctx, 2, 6, 6, 8, '#00f5d4');
    } else if (pose === 'barry_spin') {
      // Spinning cyclone arms + hammer wide out
      px(ctx, 4, 16, 28, 3, '#adb5bd');
      px(ctx, 0, 12, 7, 10, '#3a405a');
      px(ctx, 0, 13, 2, 8, '#00f5d4');
      px(ctx, 29, 12, 7, 10, '#3a405a');
      px(ctx, 34, 13, 2, 8, '#ff2e93');
    } else if (pose === 'barry_slam') {
      // Jumping slam overhead hammer
      px(ctx, 14, 1, 8, 2, '#adb5bd');
      px(ctx, 10, 0, 16, 6, '#3a405a');
      px(ctx, 11, 1, 14, 4, '#00f5d4');
      px(ctx, 9, 12, 4, 6, '#262b44');
      px(ctx, 23, 12, 4, 6, '#262b44');
    } else {
      // Idle / Walk: Hammer held ready diagonally
      px(ctx, 24, 16 + bob, 4, 5, '#262b44');
      px(ctx, 25, 20 + bob, 3, 3, '#f1c27d');
      px(ctx, 8, 16 + bob, 3, 5, '#262b44');
      // Hammer shaft diagonal
      for (let i = 0; i < 12; i++) {
        px(ctx, 20 + i * 0.7, 22 + bob - i, 2, 2, '#9ba4b5');
      }
      // Big neon hammer head
      px(ctx, 24, 6 + bob, 9, 9, '#2b2d42');
      px(ctx, 25, 7 + bob, 7, 7, '#5c677d');
      px(ctx, 31, 7 + bob, 2, 7, '#00f5d4'); // neon cyan impact face
      px(ctx, 24, 7 + bob, 2, 7, '#ff2e93'); // neon pink back face
    }

    return toPixelTexture(canvas);
  }

  private drawZombieNormal(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(32, 36);
    // Legs
    px(ctx, 10, 25, 4, 9, '#3d314a');
    px(ctx, 18, 25, 4, 9, '#3d314a');
    px(ctx, 9, 33, 5, 2, '#1f1a24');
    px(ctx, 18, 33, 5, 2, '#1f1a24');
    // Tattered hoodie
    px(ctx, 9, 13, 14, 13, '#4a5759');
    px(ctx, 11, 15, 10, 9, '#6b705c');
    px(ctx, 13, 18, 4, 4, '#9b2226'); // blood stain
    // Head (greenish skin)
    px(ctx, 11, 4, 10, 9, '#7fb069');
    px(ctx, 11, 3, 10, 3, '#2d3a3a');
    // Glowing infected eyes
    px(ctx, 13, 7, 2, 2, '#ff0054');
    px(ctx, 18, 7, 2, 2, '#ff0054');
    // Outstretched arms
    px(ctx, 21, 14, 7, 3, '#7fb069');
    px(ctx, 5, 15, 5, 3, '#7fb069');
    return toPixelTexture(canvas);
  }

  private drawZombieShooter(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(32, 36);
    // Police trousers
    px(ctx, 10, 25, 4, 9, '#1d3557');
    px(ctx, 18, 25, 4, 9, '#1d3557');
    px(ctx, 10, 33, 4, 2, '#0d1321');
    px(ctx, 18, 33, 4, 2, '#0d1321');
    // Police uniform shirt + gold badge
    px(ctx, 9, 13, 14, 12, '#274c77');
    px(ctx, 10, 14, 12, 10, '#3a6ea5');
    px(ctx, 19, 15, 2, 2, '#ffd166'); // badge
    px(ctx, 9, 23, 14, 2, '#111111'); // utility belt
    // Police cap + zombie head
    px(ctx, 11, 5, 10, 8, '#84a98c');
    px(ctx, 10, 2, 12, 4, '#1d3557');
    px(ctx, 14, 3, 4, 2, '#ffd166'); // cap emblem
    px(ctx, 13, 8, 2, 2, '#ffbe0b');
    px(ctx, 17, 8, 2, 2, '#ffbe0b');
    // Aimed handgun
    px(ctx, 21, 15, 6, 3, '#84a98c');
    px(ctx, 26, 13, 5, 3, '#2b2d42');
    px(ctx, 26, 15, 2, 3, '#111111');
    return toPixelTexture(canvas);
  }

  private drawZombieTank(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(42, 44);
    // Heavy legs
    px(ctx, 10, 31, 8, 11, '#2b2d42');
    px(ctx, 24, 31, 8, 11, '#2b2d42');
    px(ctx, 9, 40, 9, 3, '#11131a');
    px(ctx, 24, 40, 9, 3, '#11131a');
    // Massive torso + riot armor plates
    px(ctx, 6, 12, 30, 20, '#3d405b');
    px(ctx, 8, 14, 26, 16, '#4f5d75');
    px(ctx, 10, 15, 22, 6, '#6d597a'); // bruised mutant muscle
    px(ctx, 14, 20, 14, 8, '#2b2d42'); // chest plate
    px(ctx, 18, 22, 6, 4, '#ef233c'); // danger core
    // Shoulder pads
    px(ctx, 3, 12, 7, 8, '#2b2d42');
    px(ctx, 32, 12, 7, 8, '#2b2d42');
    // Huge arms
    px(ctx, 2, 20, 7, 13, '#6b8f71');
    px(ctx, 33, 20, 7, 13, '#6b8f71');
    // Small sunk heavy head
    px(ctx, 15, 4, 12, 9, '#6b8f71');
    px(ctx, 17, 7, 3, 2, '#ff003c');
    px(ctx, 22, 7, 3, 2, '#ff003c');
    return toPixelTexture(canvas);
  }

  private drawZombieBoss(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(48, 52);
    // Military combat boots & camo pants
    px(ctx, 12, 36, 9, 13, '#384d34');
    px(ctx, 27, 36, 9, 13, '#384d34');
    px(ctx, 11, 47, 10, 4, '#1a1c19');
    px(ctx, 27, 47, 10, 4, '#1a1c19');
    // Camo tactical armor torso
    px(ctx, 9, 14, 30, 23, '#2f3e2e');
    px(ctx, 11, 16, 26, 19, '#4a5d3f');
    px(ctx, 14, 18, 6, 4, '#242f20'); // camo spots
    px(ctx, 26, 22, 7, 5, '#242f20');
    px(ctx, 12, 15, 24, 4, '#7f4f24'); // tactical harness
    px(ctx, 20, 20, 8, 8, '#9b2226'); // glowing boss reactor
    // Head + Red Military Beret + Scars
    px(ctx, 17, 5, 14, 10, '#789461');
    px(ctx, 16, 2, 16, 5, '#9b2226'); // red beret
    px(ctx, 19, 9, 3, 2, '#ffbe0b');
    px(ctx, 26, 9, 3, 2, '#ffbe0b');
    // Heavy Machine Gun
    px(ctx, 6, 22, 7, 6, '#789461');
    px(ctx, 35, 22, 7, 6, '#789461');
    px(ctx, 18, 25, 26, 6, '#2b2d42');
    px(ctx, 22, 26, 20, 3, '#495057');
    px(ctx, 42, 26, 5, 4, '#ffb703'); // muzzle tip
    px(ctx, 24, 31, 8, 6, '#ffd166'); // ammo belt
    return toPixelTexture(canvas);
  }

  private drawBullet(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(12, 12);
    px(ctx, 2, 4, 8, 4, '#ff0054');
    px(ctx, 4, 5, 5, 2, '#ffea00');
    return toPixelTexture(canvas);
  }

  private drawGrenade(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(16, 16);
    px(ctx, 4, 4, 8, 9, '#2f3e2e');
    px(ctx, 5, 5, 6, 7, '#4f6d48');
    px(ctx, 6, 2, 4, 2, '#adb5bd');
    px(ctx, 6, 7, 4, 2, '#ff003c'); // blinking warning LED
    return toPixelTexture(canvas);
  }

  private generateWorldTexture(key: string): THREE.CanvasTexture {
    if (key === 'asphalt') {
      const { canvas, ctx } = createPixelCanvas(64, 64);
      px(ctx, 0, 0, 64, 64, '#1b1d29');
      // Subtle pixel asphalt speckles
      for (let i = 0; i < 90; i++) {
        const x = (i * 17) % 64;
        const y = (i * 29) % 64;
        px(ctx, x, y, 2, 2, i % 2 === 0 ? '#232636' : '#151722');
      }
      // Dashed center yellow/neon road line
      px(ctx, 4, 30, 22, 4, '#ffd166');
      px(ctx, 38, 30, 22, 4, '#ffd166');
      return toPixelTexture(canvas, 28, 2);
    }

    if (key === 'sidewalk') {
      const { canvas, ctx } = createPixelCanvas(32, 32);
      px(ctx, 0, 0, 32, 32, '#343a4d');
      px(ctx, 0, 0, 32, 2, '#4c546e');
      px(ctx, 0, 15, 32, 1, '#252938');
      px(ctx, 15, 0, 1, 32, '#252938');
      return toPixelTexture(canvas, 32, 1);
    }

    if (key === 'building') {
      const { canvas, ctx } = createPixelCanvas(64, 64);
      px(ctx, 0, 0, 64, 64, '#1b1b2f');
      // Brick rows
      for (let y = 0; y < 64; y += 8) {
        px(ctx, 0, y, 64, 1, '#121222');
        const offset = (y / 8) % 2 === 0 ? 0 : 8;
        for (let x = offset; x < 64; x += 16) {
          px(ctx, x, y, 1, 8, '#121222');
        }
      }
      // Neon graffiti accent stripe
      px(ctx, 0, 52, 64, 3, '#ff2e93');
      px(ctx, 0, 56, 64, 2, '#00f5d4');
      return toPixelTexture(canvas, 1, 1);
    }

    if (key === 'window_lit' || key === 'window_warn' || key === 'window_broken') {
      const { canvas, ctx } = createPixelCanvas(24, 32);
      px(ctx, 0, 0, 24, 32, '#111420'); // frame
      px(ctx, 2, 2, 20, 28, key === 'window_warn' ? '#ff0054' : key === 'window_broken' ? '#090a10' : '#00b4d8');
      if (key === 'window_lit') {
        px(ctx, 4, 4, 16, 24, '#48cae4');
        px(ctx, 11, 2, 2, 28, '#111420');
        px(ctx, 2, 15, 20, 2, '#111420');
      } else if (key === 'window_warn') {
        px(ctx, 4, 4, 16, 24, '#ff4d6d');
        px(ctx, 10, 7, 4, 12, '#fff');
        px(ctx, 10, 22, 4, 4, '#fff');
      } else {
        // Shattered glass shards
        px(ctx, 3, 3, 5, 4, '#48cae4');
        px(ctx, 15, 24, 6, 4, '#48cae4');
      }
      return toPixelTexture(canvas);
    }

    if (key === 'barricade') {
      const { canvas, ctx } = createPixelCanvas(32, 24);
      px(ctx, 2, 4, 28, 16, '#495057');
      px(ctx, 4, 6, 6, 12, '#ffbe0b');
      px(ctx, 14, 6, 6, 12, '#ffbe0b');
      px(ctx, 24, 6, 4, 12, '#ffbe0b');
      px(ctx, 0, 18, 32, 4, '#2b2d42');
      return toPixelTexture(canvas);
    }

    // barrel
    const { canvas, ctx } = createPixelCanvas(24, 28);
    px(ctx, 4, 2, 16, 24, '#e63946');
    px(ctx, 4, 6, 16, 3, '#ffbe0b');
    px(ctx, 4, 19, 16, 3, '#ffbe0b');
    px(ctx, 6, 11, 12, 6, '#1d3557');
    return toPixelTexture(canvas);
  }
}
