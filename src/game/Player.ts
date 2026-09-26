// ============================================================
//  Player — Corpo e câmera do jogador (CPU)
// ------------------------------------------------------------
//  Movimento FPS com aceleração/atrito (sensação mais "pesada" que
//  andar em grade), corrida com fôlego, água (lento) e lava (dano),
//  degraus suaves (o olho acompanha a altura do piso aos poucos),
//  balanço da cabeça ao andar, tremor de câmera (trauma) e recuo das
//  armas. Produz a VIEW MATRIX usada na GPU.
// ============================================================

import { InputManager } from "../core/InputManager";
import * as mat4 from "../core/math/mat4";
import { Cell } from "../levels/LevelData";
import type { Level } from "../world/Level";

export type KeyColor = "red" | "blue" | "yellow";

const PITCH_LIMIT = (88 * Math.PI) / 180;
const WALK = 4.4;
const SPRINT = 7.2;
const RADIUS = 0.32;
const EYE = 1.62;

export class Player {
  pos: [number, number, number] = [0, 0, 0]; // pés
  yaw = 0;
  pitch = 0;
  vel: [number, number] = [0, 0];
  eyeY = EYE;
  hp = 100;
  readonly maxHp = 100;
  stamina = 1;
  sprinting = false;
  keys = new Set<KeyColor>();
  flashlight = true;
  flashFlicker = 1; // 1 = normal; < 1 = falhando (sustos)
  sensitivity = 0.0022;
  godMode = false;

  // Efeitos de câmera
  private bob = 0;
  bobAmount = 0;
  trauma = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  hurtTimer = 0;
  lastHitAngle = 0; // direção do último dano (rad, relativa ao olhar)
  lavaTimer = 0;
  moving = false;
  inWater = false;
  distanceWalked = 0;
  private shakeT = 0;

  get alive(): boolean {
    return this.hp > 0;
  }

  get radius(): number {
    return RADIUS;
  }

  spawn(x: number, z: number, yaw: number, level: Level): void {
    this.pos = [x, level.floorAt(x, z), z];
    this.eyeY = this.pos[1] + EYE;
    this.yaw = yaw;
    this.pitch = 0;
    this.vel = [0, 0];
  }

  // Olho (com balanço e degraus suavizados).
  eye(): [number, number, number] {
    const b = this.bobAmount;
    return [
      this.pos[0] + Math.cos(this.yaw) * Math.cos(this.bob) * 0.025 * b,
      this.eyeY + Math.abs(Math.sin(this.bob)) * 0.05 * b - 0.025 * b,
      this.pos[2] + Math.sin(this.yaw) * Math.cos(this.bob) * 0.025 * b,
    ];
  }

  // Direção do olhar (inclui recuo e tremor).
  viewAngles(): [number, number] {
    const s = this.trauma * this.trauma;
    const t = this.shakeT;
    const ny = (Math.sin(t * 37.1) + Math.sin(t * 23.7 + 1.3) * 0.6) * 0.035 * s;
    const np = (Math.sin(t * 31.3 + 2.1) + Math.sin(t * 19.9) * 0.6) * 0.035 * s;
    return [this.yaw + this.recoilYaw + ny, Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + this.recoilPitch + np))];
  }

  forward(): [number, number, number] {
    const [y, p] = this.viewAngles();
    const cp = Math.cos(p);
    return [cp * Math.sin(y), Math.sin(p), -cp * Math.cos(y)];
  }

  viewMatrix(): mat4.Mat4 {
    const e = this.eye();
    const f = this.forward();
    return mat4.lookAt(e, [e[0] + f[0], e[1] + f[1], e[2] + f[2]], [0, 1, 0]);
  }

  addTrauma(t: number): void {
    this.trauma = Math.min(1, this.trauma + t);
  }

  // Aplica dano; `fromX/fromZ` alimentam o indicador de direção.
  damage(amount: number, fromX?: number, fromZ?: number): number {
    if (!this.alive || this.godMode) return 0;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtTimer = 0.35;
    this.addTrauma(Math.min(0.6, amount / 40));
    if (fromX !== undefined && fromZ !== undefined) {
      const a = Math.atan2(fromX - this.pos[0], -(fromZ - this.pos[2]));
      this.lastHitAngle = a - this.yaw;
    }
    return amount;
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  update(dt: number, input: InputManager, level: Level, allowMove: boolean): void {
    this.shakeT += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    // Recuo volta ao centro aos poucos.
    const rec = Math.min(1, dt * 7);
    this.recoilPitch -= this.recoilPitch * rec;
    this.recoilYaw -= this.recoilYaw * rec;

    // ---- Olhar ----
    const { dx, dy } = input.consumeMouse();
    if (allowMove) {
      this.yaw += dx * this.sensitivity;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - dy * this.sensitivity));
    }

    // ---- Movimento ----
    let mx = 0, mz = 0;
    if (allowMove) {
      if (input.isDown("KeyW") || input.isDown("ArrowUp")) mz += 1;
      if (input.isDown("KeyS") || input.isDown("ArrowDown")) mz -= 1;
      if (input.isDown("KeyD") || input.isDown("ArrowRight")) mx += 1;
      if (input.isDown("KeyA") || input.isDown("ArrowLeft")) mx -= 1;
    }
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = Math.sin(this.yaw);
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }
    const cellType = level.typeAt(this.pos[0], this.pos[2]);
    this.inWater = cellType === Cell.WATER;
    const inLava = cellType === Cell.LAVA;
    const wantSprint = allowMove && input.isDown("ShiftLeft") && mz > 0 && this.stamina > 0.05;
    this.sprinting = wantSprint && len > 0;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.2);
    else this.stamina = Math.min(1, this.stamina + dt * 0.14);
    let speed = this.sprinting ? SPRINT : WALK;
    if (this.inWater) speed *= 0.62;
    if (inLava) speed *= 0.55;
    const tvx = wx * speed, tvz = wz * speed;
    const acc = Math.min(1, dt * (len > 0 ? 11 : 13));
    this.vel[0] += (tvx - this.vel[0]) * acc;
    this.vel[1] += (tvz - this.vel[1]) * acc;
    const before: [number, number] = [this.pos[0], this.pos[2]];
    level.moveCircle(this.pos, this.vel[0] * dt, this.vel[1] * dt, RADIUS, 0.62);
    const moved = Math.hypot(this.pos[0] - before[0], this.pos[2] - before[1]);
    if (dt > 0) {
      // Se bateu numa parede, perde a velocidade naquela direção.
      const realV = moved / dt;
      const v = Math.hypot(this.vel[0], this.vel[1]);
      if (v > 0.01 && realV < v * 0.5) {
        this.vel[0] = (this.pos[0] - before[0]) / dt;
        this.vel[1] = (this.pos[2] - before[1]) / dt;
      }
    }
    this.distanceWalked += moved;
    this.moving = moved > dt * 0.8;

    // ---- Altura: pés no piso, olho suaviza degraus ----
    const floor = level.floorAt(this.pos[0], this.pos[2]);
    this.pos[1] = floor;
    const targetEye = floor + (this.alive ? EYE : 0.3);
    if (!this.alive) this.pitch += (0.35 - this.pitch) * Math.min(1, dt * 2);
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 12);

    // ---- Balanço da cabeça ----
    const hv = Math.hypot(this.vel[0], this.vel[1]);
    this.bob += hv * dt * 1.9;
    const targetBob = Math.min(1, hv / WALK) * (this.sprinting ? 1.5 : 1);
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, dt * 8);

    // ---- Lava queima ----
    if (inLava && this.pos[1] < floor + 0.1) {
      this.lavaTimer -= dt;
      if (this.lavaTimer <= 0) {
        this.damage(9);
        this.lavaTimer = 0.33;
      }
    } else this.lavaTimer = 0;
  }

  // Passos: devolve true quando um pé "toca o chão" (para o som).
  private lastStep = 0;
  stepped(): boolean {
    const s = Math.floor(this.bob / Math.PI);
    if (s !== this.lastStep) {
      this.lastStep = s;
      return this.bobAmount > 0.25;
    }
    return false;
  }
}
