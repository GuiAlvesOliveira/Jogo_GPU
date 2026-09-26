// ============================================================
//  Effects.ts — Partículas, marcas, cápsulas e luzes rápidas (CPU)
// ------------------------------------------------------------
//  Simulação simples na CPU (posição += velocidade, gravidade,
//  arrasto, vida). A cada frame vira uma lista de SPRITES (ou
//  instâncias de malha, no caso das cápsulas de munição) que a GPU
//  desenha em poucas chamadas instanciadas.
//
//  Também guarda as LUZES DINÂMICAS do frame (clarão de tiro,
//  faíscas, raios), que vão para o shader como uma lista curta.
// ============================================================

import type { RenderQueue } from "../../render/Renderer";
import type { GPUModel } from "../../render/ModelGPU";
import { LIGHT_FLOATS, MAX_DYN_LIGHTS } from "../../render/Renderer";
import type { Level } from "../../world/Level";
import * as mat4 from "../../core/math/mat4";

// Células do atlas (4x4 de 256 px). Linhas 2 e 3 = faixas de raio.
export const FX = { GLOW: 0, FLASH: 1, SMOKE: 2, BLOOD: 3, POOL: 4, HOLE: 5, FLAME: 6, DUST: 7 };
function uvOf(cell: number): [number, number, number, number] {
  const x = (cell % 4) / 4, y = Math.floor(cell / 4) / 4;
  return [x + 0.004, y + 0.004, x + 0.25 - 0.004, y + 0.25 - 0.004];
}
export const UV = Array.from({ length: 8 }, (_, i) => uvOf(i));
export const UV_BOLT: [number, number, number, number][] = [
  [0, 0.505, 1, 0.745],
  [0, 0.755, 1, 0.995],
];

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; size1: number;
  r: number; g: number; b: number; a: number;
  cell: number;
  add: boolean;
  grav: number;
  drag: number;
  rot: number; rotV: number;
  lit: boolean;
  blood: boolean; // ao tocar o chão vira marca
}

interface Decal {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  size: number; cell: number; rot: number;
  r: number; g: number; b: number; a: number;
  floor: boolean;
  age: number;
}

interface Shell {
  model: GPUModel;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number; spin: number;
  life: number;
  rest: boolean;
  bounced: boolean;
}

interface Tracer {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  life: number;
}

interface DynLight {
  x: number; y: number; z: number;
  r: number; g: number; b: number;
  range: number; intensity: number;
  life: number; max: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Effects {
  private parts: Particle[] = [];
  private decals: Decal[] = [];
  private shells: Shell[] = [];
  private tracers: Tracer[] = [];
  private lights: DynLight[] = [];
  readonly lightData: Float32Array<ArrayBuffer> = new Float32Array(MAX_DYN_LIGHTS * LIGHT_FLOATS);
  lightCount = 0;
  onShellLand: ((x: number, y: number, z: number) => void) | null = null;
  private readonly m = new Float32Array(16);

  clear(): void {
    this.parts = [];
    this.decals = [];
    this.shells = [];
    this.tracers = [];
    this.lights = [];
  }

  private spawn(p: Partial<Particle> & { x: number; y: number; z: number }): void {
    if (this.parts.length > 1800) this.parts.shift();
    this.parts.push({
      vx: 0, vy: 0, vz: 0, life: 1, max: 1, size: 0.2, size1: 0.2,
      r: 1, g: 1, b: 1, a: 1, cell: FX.GLOW, add: true, grav: 0, drag: 0, rot: rand(0, 6.28), rotV: 0,
      lit: false, blood: false, ...p,
    } as Particle);
    const q = this.parts[this.parts.length - 1];
    q.max = q.life;
  }

  light(x: number, y: number, z: number, r: number, g: number, b: number, range: number, intensity: number, life: number): void {
    if (this.lights.length > 24) this.lights.shift();
    this.lights.push({ x, y, z, r, g, b, range, intensity, life, max: life });
  }

  // ---------------------------------------------------------- efeitos
  muzzle(x: number, y: number, z: number): void {
    this.light(x, y, z, 1.0, 0.72, 0.4, 9, 3.2, 0.06);
    for (let i = 0; i < 3; i++) {
      this.spawn({ x, y, z, vx: rand(-0.3, 0.3), vy: rand(0.2, 0.6), vz: rand(-0.3, 0.3), life: rand(0.4, 0.8), size: 0.06, size1: 0.3, r: 0.5, g: 0.5, b: 0.5, a: 0.25, cell: FX.SMOKE, add: false, drag: 1.5, lit: true });
    }
  }

  impact(x: number, y: number, z: number, nx: number, ny: number, nz: number, surface: string): void {
    if (surface === "water") {
      for (let i = 0; i < 8; i++) this.spawn({ x, y: y + 0.02, z, vx: rand(-1, 1), vy: rand(1.5, 3.5), vz: rand(-1, 1), life: rand(0.3, 0.6), size: 0.05, size1: 0.02, r: 0.5, g: 0.6, b: 0.7, a: 0.7, cell: FX.GLOW, add: false, grav: 9.8, lit: true });
      return;
    }
    if (surface === "lava") {
      for (let i = 0; i < 10; i++) this.spawn({ x, y, z, vx: rand(-1.5, 1.5), vy: rand(2, 4), vz: rand(-1.5, 1.5), life: rand(0.4, 0.9), size: 0.05, size1: 0.01, r: 1.0, g: 0.5, b: 0.1, cell: FX.GLOW, grav: 9.8 });
      return;
    }
    // Faíscas + poeira + marca de bala.
    for (let i = 0; i < 6; i++) {
      this.spawn({ x, y, z, vx: nx * rand(1, 4) + rand(-2, 2), vy: ny * rand(1, 4) + rand(0, 3), vz: nz * rand(1, 4) + rand(-2, 2), life: rand(0.15, 0.35), size: 0.035, size1: 0.01, r: 1.0, g: 0.75, b: 0.35, cell: FX.GLOW, grav: 12 });
    }
    for (let i = 0; i < 2; i++) {
      this.spawn({ x: x + nx * 0.05, y: y + ny * 0.05, z: z + nz * 0.05, vx: nx * rand(0.3, 1), vy: rand(0.1, 0.5), vz: nz * rand(0.3, 1), life: rand(0.5, 1.0), size: 0.08, size1: 0.35, r: 0.55, g: 0.5, b: 0.45, a: 0.45, cell: FX.SMOKE, add: false, drag: 2, lit: true });
    }
    this.spawn({ x, y, z, vx: nx, vy: 1, vz: nz, life: 0.5, size: 0.12, size1: 0.12, r: 0.6, g: 0.55, b: 0.5, a: 0.8, cell: FX.DUST, add: false, grav: 9, lit: true });
    if (surface !== "ceil") this.decal(x, y, z, nx, ny, nz, rand(0.05, 0.07), FX.HOLE, 0.9, 0.9, 0.9, 0.95);
  }

  blood(x: number, y: number, z: number, dx: number, dz: number, amount: number, dark = false): void {
    const [r, g, b] = dark ? [0.08, 0.06, 0.1] : [0.55, 0.02, 0.02];
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x, y, z, vx: dx * rand(0.5, 3) + rand(-1.2, 1.2), vy: rand(0.2, 2.8), vz: dz * rand(0.5, 3) + rand(-1.2, 1.2),
        life: rand(0.35, 0.8), size: rand(0.05, 0.12), size1: rand(0.12, 0.25), r, g, b, a: 0.95, cell: FX.BLOOD, add: false, grav: 9.8, drag: 0.5, lit: true, blood: !dark,
      });
    }
    // Névoa.
    this.spawn({ x, y, z, vx: dx * 0.6, vy: 0.2, vz: dz * 0.6, life: 0.35, size: 0.15, size1: 0.5, r, g, b, a: 0.5, cell: FX.SMOKE, add: false, drag: 3, lit: true });
  }

  pool(x: number, y: number, z: number, size: number, dark = false): void {
    const c = dark ? [0.06, 0.05, 0.08] : [0.35, 0.02, 0.02];
    this.decal(x, y, z, 0, 1, 0, size, FX.POOL, c[0] * 2.5, c[1] * 2.5, c[2] * 2.5, 0.9, true);
  }

  dust(x: number, y: number, z: number, n: number, spread = 1.5): void {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rand(-spread, spread), y: y + 0.1, z: z + rand(-spread, spread), vx: rand(-1, 1), vy: rand(0.2, 1.2), vz: rand(-1, 1), life: rand(0.8, 1.6), size: 0.3, size1: 1.1, r: 0.45, g: 0.4, b: 0.35, a: 0.4, cell: FX.SMOKE, add: false, drag: 1.2, lit: true });
    }
  }

  smokePuff(x: number, y: number, z: number, n: number, dark = true): void {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rand(-0.4, 0.4), y: y + rand(0, 1.8), z: z + rand(-0.4, 0.4), vx: rand(-0.6, 0.6), vy: rand(0.2, 1.0), vz: rand(-0.6, 0.6), life: rand(0.7, 1.4), size: 0.4, size1: 1.2, r: dark ? 0.05 : 0.5, g: dark ? 0.04 : 0.5, b: dark ? 0.08 : 0.5, a: 0.7, cell: FX.SMOKE, add: false, drag: 1, lit: false });
    }
  }

  sparksBlue(x: number, y: number, z: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.spawn({ x, y, z, vx: rand(-3, 3), vy: rand(-1, 3), vz: rand(-3, 3), life: rand(0.15, 0.4), size: 0.05, size1: 0.01, r: 0.5, g: 0.8, b: 1.0, cell: FX.GLOW, grav: 6 });
    }
    this.light(x, y, z, 0.4, 0.7, 1.0, 7, 2.5, 0.2);
  }

  embers(x: number, y: number, z: number): void {
    this.spawn({ x, y, z, vx: rand(-0.3, 0.3), vy: rand(0.6, 1.6), vz: rand(-0.3, 0.3), life: rand(1.2, 2.5), size: 0.03, size1: 0.005, r: 1.0, g: 0.45, b: 0.1, cell: FX.GLOW, drag: 0.3 });
  }

  tracer(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    if (this.tracers.length > 30) this.tracers.shift();
    this.tracers.push({ x0, y0, z0, x1, y1, z1, life: 0.05 });
  }

  shell(model: GPUModel, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    if (this.shells.length > 70) this.shells.shift();
    this.shells.push({ model, x, y, z, vx, vy, vz, yaw: rand(0, 6.28), pitch: rand(0, 6.28), spin: rand(8, 18), life: 9, rest: false, bounced: false });
  }

  decal(x: number, y: number, z: number, nx: number, ny: number, nz: number, size: number, cell: number, r: number, g: number, b: number, a: number, floor = false): void {
    if (this.decals.length > 220) this.decals.shift();
    this.decals.push({ x, y, z, nx, ny, nz, size, cell, rot: rand(0, 6.28), r, g, b, a, floor: floor || ny > 0.9, age: 0 });
  }

  // ------------------------------------------------------- simulação
  update(dt: number, level: Level): void {
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.grav * dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.rotV * dt;
      if (p.grav > 0) {
        const fl = level.floorAt(p.x, p.z);
        if (p.y < fl + 0.01) {
          if (p.blood && Math.random() < 0.45) this.decal(p.x, fl, p.z, 0, 1, 0, rand(0.08, 0.22), FX.POOL, 0.9, 0.08, 0.08, 0.85, true);
          if (p.blood) continue;
          p.y = fl + 0.01;
          p.vy *= -0.3;
          p.vx *= 0.6;
          p.vz *= 0.6;
        }
      }
      keep.push(p);
    }
    this.parts = keep;
    for (const d of this.decals) d.age += dt;
    for (const s of this.shells) {
      s.life -= dt;
      if (s.rest) continue;
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.yaw += s.spin * dt;
      s.pitch += s.spin * 0.7 * dt;
      const fl = level.floorAt(s.x, s.z);
      if (s.y < fl + 0.012) {
        s.y = fl + 0.012;
        if (!s.bounced) this.onShellLand?.(s.x, s.y, s.z);
        s.bounced = true;
        if (Math.abs(s.vy) < 0.8) {
          s.rest = true;
          s.pitch = Math.PI / 2;
        } else {
          s.vy *= -0.35;
          s.vx *= 0.5;
          s.vz *= 0.5;
          s.spin *= 0.6;
        }
      }
    }
    this.shells = this.shells.filter((s) => s.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter((l) => l.life > 0);
  }

  // Luzes dinâmicas do frame (+ extras fornecidos pelo jogo).
  packLights(extra: { x: number; y: number; z: number; r: number; g: number; b: number; range: number; intensity: number }[], cam: [number, number, number]): void {
    const all = [
      ...this.lights.map((l) => ({ ...l, intensity: l.intensity * Math.min(1, (l.life / l.max) * 1.5) })),
      ...extra,
    ];
    all.sort((a, b) => Math.hypot(a.x - cam[0], a.z - cam[2]) - Math.hypot(b.x - cam[0], b.z - cam[2]));
    this.lightCount = Math.min(MAX_DYN_LIGHTS, all.length);
    for (let i = 0; i < this.lightCount; i++) {
      const l = all[i];
      this.lightData.set([l.x, l.y, l.z, l.range, l.r, l.g, l.b, l.intensity, 0, 0, 0, 0], i * LIGHT_FLOATS);
    }
  }

  // Envia tudo para a fila de desenho.
  submit(q: RenderQueue, cam: [number, number, number]): void {
    for (const d of this.decals) {
      const dx = d.x - cam[0], dz = d.z - cam[2];
      if (dx * dx + dz * dz > 45 * 45) continue;
      const uv = UV[d.cell];
      const fade = d.cell === FX.HOLE ? Math.min(1, Math.max(0, 1 - (d.age - 40) / 10)) : 1;
      if (d.floor) q.sprite(false, d.x, d.y, d.z, d.size, d.r, d.g, d.b, d.a * fade, uv[0], uv[1], uv[2], uv[3], 1, 0, 0, 0, d.rot, 1, 1);
      else q.sprite(false, d.x, d.y, d.z, d.size, d.r, d.g, d.b, d.a * fade, uv[0], uv[1], uv[2], uv[3], 4, d.nx, d.ny, d.nz, d.rot, 1, 1);
    }
    for (const p of this.parts) {
      const t = 1 - p.life / p.max;
      const size = p.size + (p.size1 - p.size) * t;
      const a = p.a * (p.add ? 1 - t : Math.min(1, (1 - t) * 1.6));
      const uv = UV[p.cell];
      q.sprite(p.add, p.x, p.y, p.z, size, p.r, p.g, p.b, a, uv[0], uv[1], uv[2], uv[3], 0, 0, 0, 0, p.rot, 1, p.lit ? 1 : 0);
    }
    for (const t of this.tracers) {
      const uv = UV[FX.GLOW];
      q.sprite(true, t.x0, t.y0, t.z0, 0.012, 1.0, 0.8, 0.5, 0.7, uv[0] + 0.1, uv[1] + 0.1, uv[2] - 0.1, uv[3] - 0.1, 2, t.x1, t.y1, t.z1);
    }
    for (const s of this.shells) {
      const { d, o } = q.mesh(s.model);
      const m = this.m;
      mat4.fromYawInto(m, 0, s.x, s.y, s.z, s.yaw, 1);
      const r = mat4.multiply(m as mat4.Mat4, mat4.rotationX(s.pitch));
      d.set(r, o);
      d.set([1, 1, 1, 1, 0, 0, 0, -1], o + 16);
    }
  }
}
