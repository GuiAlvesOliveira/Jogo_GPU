// ============================================================
//  Enemies.ts — Inimigos: tipos, IA e animação (CPU)
// ------------------------------------------------------------
//  Cada inimigo é uma máquina de estados:
//    SLEEP    → parado até ver/ouvir o jogador;
//    LURE     → (abissal) imóvel no escuro com a "isca" acesa;
//    PLAYDEAD → (zumbi caído) finge estar morto até você chegar perto;
//    RISE     → levantando (animação de morte tocada ao contrário);
//    ALERT    → percebeu você: grita/encara por um instante;
//    CHASE    → persegue: vai direto se te vê, senão desce o campo
//               de caminhos (Dijkstra) calculado a partir do jogador;
//    ATTACK   → golpe corpo a corpo sincronizado com a animação;
//    CAST     → (sombra) lança um raio;
//    HURT     → cambaleia ao levar dano;
//    DEAD     → cadáver (a sombra se desfaz no chão).
//
//  A animação usa os clipes do GLB (idle/walk/run/attack/hit/death)
//  com crossfade; só os inimigos VISÍVEIS calculam ossos.
// ============================================================

import { AnimState, SkeletonDef } from "../../render/Animator";
import type { GPUModel } from "../../render/ModelGPU";
import type { RenderQueue } from "../../render/Renderer";
import * as mat4 from "../../core/math/mat4";
import type { Level } from "../../world/Level";
import { rayBox } from "../../world/Level";
import { CELL } from "../../levels/LevelData";
import type { Player } from "../Player";
import type { AudioManager } from "../../audio/AudioManager";
import type { Effects } from "../effects/Effects";

export type EnemyKind = "zombie" | "runner" | "corpse" | "rat" | "angler" | "shade" | "troll" | "king";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  model: string;
  skin?: string;
  scale: number;
  hp: number;
  speed: number;
  moveAnim: string;
  animRate: number; // velocidade da animação de andar por m/s
  damage: number;
  range: number;
  hitTime: number;
  cooldown: number;
  radius: number;
  height: number;
  sight: number;
  pain: number;
  score: number;
  ranged?: { range: number; damage: number; speed: number; cooldown: number };
  darkBlood?: boolean;
  soundKind: string;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  zombie: { kind: "zombie", name: "Zumbi", model: "e_zombie", scale: 1, hp: 70, speed: 1.3, moveAnim: "walk", animRate: 0.85, damage: 13, range: 1.6, hitTime: 0.46, cooldown: 0.6, radius: 0.36, height: 1.8, sight: 18, pain: 0.5, score: 100, soundKind: "zombie" },
  runner: { kind: "runner", name: "Zumbi Corredor", model: "e_zombie", skin: "female", scale: 0.97, hp: 50, speed: 4.2, moveAnim: "run", animRate: 0.33, damage: 10, range: 1.5, hitTime: 0.46, cooldown: 0.5, radius: 0.34, height: 1.75, sight: 22, pain: 0.45, score: 150, soundKind: "runner" },
  corpse: { kind: "corpse", name: "Zumbi", model: "e_zombie", scale: 1.02, hp: 60, speed: 1.6, moveAnim: "walk", animRate: 0.85, damage: 14, range: 1.6, hitTime: 0.46, cooldown: 0.6, radius: 0.36, height: 1.8, sight: 18, pain: 0.5, score: 120, soundKind: "corpse" },
  rat: { kind: "rat", name: "Ratazana", model: "e_rat", scale: 1, hp: 24, speed: 5.2, moveAnim: "run", animRate: 0.3, damage: 6, range: 1.35, hitTime: 0.5, cooldown: 0.35, radius: 0.3, height: 0.62, sight: 16, pain: 0.3, score: 40, soundKind: "rat" },
  angler: { kind: "angler", name: "Abissal", model: "e_angler", scale: 1, hp: 170, speed: 5.0, moveAnim: "walk", animRate: 0.55, damage: 27, range: 2.4, hitTime: 0.5, cooldown: 0.9, radius: 0.55, height: 1.75, sight: 7, pain: 0.15, score: 400, soundKind: "angler" },
  shade: { kind: "shade", name: "Sombra", model: "e_shade", scale: 1, hp: 95, speed: 2.7, moveAnim: "walk", animRate: 0.55, damage: 12, range: 1.7, hitTime: 0.47, cooldown: 0.8, radius: 0.42, height: 2.05, sight: 24, pain: 0.25, score: 250, ranged: { range: 20, damage: 14, speed: 13, cooldown: 2.6 }, darkBlood: true, soundKind: "shade" },
  troll: { kind: "troll", name: "Troll", model: "e_troll", scale: 1, hp: 520, speed: 2.1, moveAnim: "walk", animRate: 0.55, damage: 32, range: 2.9, hitTime: 0.5, cooldown: 1.3, radius: 0.8, height: 2.7, sight: 20, pain: 0.05, score: 1000, soundKind: "troll" },
  king: { kind: "king", name: "Rei Troll", model: "e_troll", scale: 1.35, hp: 1700, speed: 2.4, moveAnim: "walk", animRate: 0.45, damage: 42, range: 3.6, hitTime: 0.5, cooldown: 1.1, radius: 1.05, height: 3.65, sight: 40, pain: 0.0, score: 5000, soundKind: "king" },
};

export const KIND_BY_CHAR: Record<string, EnemyKind> = { z: "zombie", Z: "runner", p: "corpse", r: "rat", a: "angler", d: "shade", T: "troll", K: "king" };

export enum St { SLEEP, LURE, PLAYDEAD, RISE, ALERT, CHASE, ATTACK, CAST, HURT, DEAD }

export interface EnemyAsset {
  model: GPUModel;
  skel: SkeletonDef;
  female?: GPUModel;
}

export class Enemy {
  readonly def: EnemyDef;
  readonly anim: AnimState;
  pos: [number, number, number];
  yaw: number;
  readonly spawnPos: [number, number, number];
  readonly spawnYaw: number;
  hp: number;
  maxHp: number;
  state = St.SLEEP;
  stateTime = 0;
  cooldown = 0;
  castCooldown = 1.5;
  flash = 0;
  attackDone = false;
  sinking = 0;
  seeTimer = 0;
  canSee = false;
  soundTimer = Math.random() * 6 + 2;
  zig = Math.random() * 10;
  stuck = 0;
  lastPos: [number, number] = [0, 0];
  boss = false;
  summoned = 0;
  enraged = false;
  dmgMul = 1;
  corpseAge = 0;
  readonly initialState: St;
  id: number;

  constructor(def: EnemyDef, skel: SkeletonDef, x: number, z: number, y: number, yaw: number, state: St, hpMul: number, dmgMul: number, id: number) {
    this.def = def;
    this.anim = new AnimState(skel);
    this.pos = [x, y, z];
    this.spawnPos = [x, y, z];
    this.yaw = yaw;
    this.spawnYaw = yaw;
    this.maxHp = this.hp = Math.round(def.hp * hpMul);
    this.dmgMul = dmgMul;
    this.state = state;
    this.initialState = state;
    this.boss = def.kind === "king";
    this.id = id;
    if (state === St.PLAYDEAD) this.anim.play("death", { loop: false, fade: 0, startAt: 1 });
    else this.anim.play("idle", { fade: 0, startAt: Math.random() });
  }

  get alive(): boolean {
    return this.state !== St.DEAD;
  }

  get awake(): boolean {
    return this.state >= St.ALERT && this.state !== St.DEAD;
  }

  setState(s: St): void {
    this.state = s;
    this.stateTime = 0;
  }
}

export interface Projectile {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  damage: number;
}

export interface EnemyEvents {
  onAttackHit(e: Enemy, dmg: number): void;
  onDeath(e: Enemy): void;
  openDoorAt(cx: number, cz: number, byEnemy: boolean): void;
  spawnBossAdds(e: Enemy): void;
}

const TAU = Math.PI * 2;
function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export class EnemyManager {
  list: Enemy[] = [];
  projectiles: Projectile[] = [];
  private nextId = 1;
  kills = 0;
  total = 0;
  hpMul = 1;
  dmgMul = 1;
  private readonly model = new Float32Array(16);

  constructor(private readonly assets: Record<string, EnemyAsset>) {}

  clear(): void {
    this.list = [];
    this.projectiles = [];
    this.kills = 0;
    this.total = 0;
  }

  spawn(kind: EnemyKind, x: number, z: number, level: Level, state?: St, yaw?: number, countTotal = true): Enemy {
    const def = ENEMY_DEFS[kind];
    const asset = this.assets[def.model];
    const st = state ?? (kind === "angler" ? St.LURE : kind === "corpse" ? St.PLAYDEAD : St.SLEEP);
    const e = new Enemy(def, asset.skel, x, z, level.floorAt(x, z), yaw ?? Math.random() * TAU, st, this.hpMul, this.dmgMul, this.nextId++);
    this.list.push(e);
    if (countTotal) this.total++;
    return e;
  }

  get aliveCount(): number {
    let n = 0;
    for (const e of this.list) if (e.alive) n++;
    return n;
  }

  // Quantos estão caçando o jogador (para a trilha de tensão).
  get hunting(): number {
    let n = 0;
    for (const e of this.list) if (e.awake) n++;
    return n;
  }

  wake(e: Enemy, audio: AudioManager, scream = true): void {
    if (!e.alive || e.awake) return;
    if (e.state === St.PLAYDEAD) {
      e.setState(St.RISE);
      e.anim.play("death", { loop: false, speed: -1.3, fade: 0, restart: true, startAt: 1 });
      audio.enemy(e.def.soundKind, "alert", e.pos[0], e.pos[1] + 1, e.pos[2]);
      return;
    }
    e.setState(St.ALERT);
    if (scream) audio.enemy(e.def.soundKind, "alert", e.pos[0], e.pos[1] + e.def.height * 0.8, e.pos[2]);
  }

  // Barulho (tiro): acorda quem estiver perto pelo CAMINHO.
  noise(field: Float32Array, level: Level, radiusCells: number, audio: AudioManager): void {
    for (const e of this.list) {
      if (!e.alive || e.awake) continue;
      const i = level.cellIndexAt(e.pos[0], e.pos[2]);
      if (i < 0) continue;
      const lim = e.state === St.LURE || e.state === St.PLAYDEAD ? radiusCells * 0.35 : radiusCells;
      if (field[i] < lim) this.wake(e, audio);
    }
  }

  wakeRect(x0: number, z0: number, x1: number, z1: number, audio: AudioManager): void {
    for (const e of this.list) {
      const cx = Math.floor(e.pos[0] / CELL), cz = Math.floor(e.pos[2] / CELL);
      if (cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1) this.wake(e, audio);
    }
  }

  // Tiro: primeiro inimigo atingido pelo raio (cabeça conta dobrado).
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): { e: Enemy; t: number; head: boolean } | null {
    let best: { e: Enemy; t: number; head: boolean } | null = null;
    for (const e of this.list) {
      if (!e.alive || e.state === St.RISE) continue;
      const lying = e.state === St.PLAYDEAD;
      const r = e.def.radius * e.def.scale * (lying ? 1.8 : 0.95);
      const h = lying ? 0.45 : e.def.height * e.def.scale;
      const [x, y, z] = e.pos;
      const qx = x - ox, qz = z - oz;
      const along = qx * dx + qz * dz;
      if (along < -2 || along > maxT + 2) continue;
      const headH = e.def.kind === "rat" || lying ? 0 : h * 0.18;
      const hr = e.def.kind === "angler" ? r * 1.2 : r * 0.7;
      if (headH > 0) {
        const hb = rayBox(ox, oy, oz, dx, dy, dz, x - hr, y + h - headH, z - hr, x + hr, y + h + 0.05, z + hr);
        if (hb && hb.t <= maxT && (!best || hb.t < best.t)) best = { e, t: hb.t, head: true };
      }
      const bb = rayBox(ox, oy, oz, dx, dy, dz, x - r, y, z - r, x + r, y + h - headH, z + r);
      if (bb && bb.t <= maxT && (!best || bb.t < best.t)) best = { e, t: bb.t, head: false };
    }
    return best;
  }

  damage(e: Enemy, amount: number, audio: AudioManager, fx: Effects, events: EnemyEvents, dirX = 0, dirZ = 0): boolean {
    if (!e.alive) return false;
    e.hp -= amount;
    e.flash = 0.35;
    const cy = e.pos[1] + e.def.height * e.def.scale * 0.6;
    fx.blood(e.pos[0], cy, e.pos[2], dirX, dirZ, Math.min(14, 4 + amount / 5), e.def.darkBlood);
    if (e.hp <= 0) {
      this.kill(e, audio, fx, events);
      return true;
    }
    if (!e.awake) this.wake(e, audio);
    if (e.state === St.CHASE && Math.random() < e.def.pain) {
      e.setState(St.HURT);
      e.anim.play(e.anim.def.clip("hit") ? "hit" : "idle", { loop: false, fade: 0.08, restart: true });
      audio.enemy(e.def.soundKind, "hurt", e.pos[0], cy, e.pos[2]);
    }
    // Sombra: às vezes some e reaparece perto (teleporte).
    if (e.def.kind === "shade" && Math.random() < 0.25) e.stuck = -1;
    if (e.boss) {
      const f = e.hp / e.maxHp;
      if ((f < 0.66 && e.summoned === 0) || (f < 0.33 && e.summoned === 1)) {
        e.summoned++;
        events.spawnBossAdds(e);
      }
      if (f < 0.4 && !e.enraged) {
        e.enraged = true;
        audio.enemy(e.def.soundKind, "alert", e.pos[0], cy, e.pos[2]);
      }
    }
    return false;
  }

  private kill(e: Enemy, audio: AudioManager, fx: Effects, events: EnemyEvents): void {
    e.setState(St.DEAD);
    e.anim.play("death", { loop: false, fade: 0.1, restart: true });
    audio.enemy(e.def.soundKind, "death", e.pos[0], e.pos[1] + 1, e.pos[2]);
    fx.pool(e.pos[0], e.pos[1], e.pos[2], 0.5 + e.def.radius * e.def.scale, e.def.darkBlood);
    this.kills++;
    events.onDeath(e);
  }

  update(dt: number, level: Level, player: Player, field: Float32Array, audio: AudioManager, fx: Effects, ev: EnemyEvents): void {
    const eye = player.eye();
    for (const e of this.list) {
      e.anim.update(dt);
      e.flash = Math.max(0, e.flash - dt * 2.5);
      if (!e.alive) {
        e.corpseAge += dt;
        if (e.def.kind === "shade" && e.anim.finished) {
          e.sinking += dt * 0.5;
          if (e.sinking < 1 && Math.random() < dt * 20) fx.smokePuff(e.pos[0], e.pos[1], e.pos[2], 1);
        }
        continue;
      }
      const d = e.def;
      e.stateTime += dt;
      e.cooldown -= dt;
      e.castCooldown -= dt;
      const dx = player.pos[0] - e.pos[0], dz = player.pos[2] - e.pos[2];
      const dist = Math.hypot(dx, dz);
      // Longe e dormindo: nada a fazer.
      if (!e.awake && dist > 45) continue;

      // Visão (checada ~5x/s).
      e.seeTimer -= dt;
      if (e.seeTimer <= 0) {
        e.seeTimer = 0.2;
        e.canSee = player.alive && dist < 60 && level.los(e.pos[0], e.pos[2], player.pos[0], player.pos[2]);
      }
      const toPlayer = Math.atan2(dx, -dz);

      switch (e.state) {
        case St.SLEEP: {
          const facing = Math.abs(angleDiff(e.yaw, toPlayer)) < 1.8;
          if (e.canSee && dist < d.sight && (facing || dist < d.sight * 0.4)) this.wake(e, audio);
          this.idleSounds(e, dt, dist, audio);
          break;
        }
        case St.LURE:
          if ((e.canSee && dist < d.sight) || dist < 3) this.wake(e, audio);
          break;
        case St.PLAYDEAD:
          if (dist < 3.4 && e.canSee) this.wake(e, audio);
          break;
        case St.RISE:
          if (e.anim.time <= 0.001 || e.stateTime > 2.2) {
            e.setState(St.CHASE);
          }
          break;
        case St.ALERT:
          e.yaw += angleDiff(e.yaw, toPlayer) * Math.min(1, dt * 6);
          e.anim.play("idle", { fade: 0.15 });
          if (e.stateTime > (d.kind === "angler" ? 0.8 : d.kind === "troll" || d.kind === "king" ? 1.0 : 0.35)) e.setState(St.CHASE);
          break;
        case St.HURT:
          if (e.stateTime > 0.32) e.setState(St.CHASE);
          break;
        case St.CHASE: {
          if (!player.alive) {
            e.anim.play("idle", { fade: 0.3 });
            break;
          }
          const inRange = dist < d.range * d.scale && Math.abs(player.pos[1] - e.pos[1]) < 1.6;
          if (inRange && e.cooldown <= 0 && e.canSee) {
            e.setState(St.ATTACK);
            e.attackDone = false;
            e.anim.play("attack", { loop: false, restart: true, fade: 0.1, speed: d.kind === "rat" ? 1.5 : e.enraged ? 1.3 : 1 });
            audio.enemy(d.soundKind, "attack", e.pos[0], e.pos[1] + d.height * 0.7, e.pos[2]);
            break;
          }
          if (d.ranged && e.canSee && dist > 4 && dist < d.ranged.range && e.castCooldown <= 0) {
            e.setState(St.CAST);
            e.attackDone = false;
            e.anim.play("attack", { loop: false, restart: true, fade: 0.1 });
            audio.enemy(d.soundKind, "cast", e.pos[0], e.pos[1] + 1.6, e.pos[2]);
            break;
          }
          // Sombra: teleporte após levar dano.
          if (e.stuck < 0) {
            e.stuck = 0;
            this.blink(e, level, player, fx, audio);
            break;
          }
          this.move(e, dt, dist, dx, dz, level, field, ev);
          this.idleSounds(e, dt, dist, audio);
          break;
        }
        case St.ATTACK: {
          e.yaw += angleDiff(e.yaw, toPlayer) * Math.min(1, dt * (d.kind === "troll" || d.kind === "king" ? 2.5 : 8));
          if (d.kind === "rat" && e.anim.progress < 0.5) {
            // Salto do rato.
            const s = 3.5 * dt;
            level.moveCircle(e.pos, Math.sin(e.yaw) * s, -Math.cos(e.yaw) * s, d.radius);
          }
          if (!e.attackDone && e.anim.progress >= d.hitTime) {
            e.attackDone = true;
            const reach = d.range * d.scale * 1.25;
            const front = Math.abs(angleDiff(e.yaw, toPlayer)) < 1.2;
            if (dist < reach && front && Math.abs(player.pos[1] - e.pos[1]) < 1.8) {
              ev.onAttackHit(e, d.damage * e.dmgMul);
            }
            if (d.kind === "troll" || d.kind === "king") {
              audio.enemy(d.soundKind, "slam", e.pos[0], e.pos[1], e.pos[2]);
              const fx0 = e.pos[0] + Math.sin(e.yaw) * 1.6 * d.scale, fz0 = e.pos[2] - Math.cos(e.yaw) * 1.6 * d.scale;
              fx.dust(fx0, e.pos[1], fz0, 10, 1.2);
              player.addTrauma(Math.max(0, 0.7 - dist * 0.05));
            }
          }
          if (e.anim.finished || e.stateTime > 3) {
            e.cooldown = d.cooldown * (e.enraged ? 0.6 : 1);
            e.setState(St.CHASE);
          }
          break;
        }
        case St.CAST: {
          e.yaw += angleDiff(e.yaw, toPlayer) * Math.min(1, dt * 8);
          if (!e.attackDone && e.anim.progress >= d.hitTime) {
            e.attackDone = true;
            this.castBolt(e, eye, player, fx);
          }
          if (e.anim.finished || e.stateTime > 2.5) {
            e.castCooldown = d.ranged!.cooldown * (0.8 + Math.random() * 0.5);
            e.setState(St.CHASE);
          }
          break;
        }
      }

      // Pés no chão (suave nos degraus).
      const fl = level.floorAt(e.pos[0], e.pos[2]);
      e.pos[1] += (fl - e.pos[1]) * Math.min(1, dt * 10);
      // Não atravessa o jogador.
      const minD = d.radius * d.scale + player.radius;
      if (dist < minD && dist > 0.001) {
        const push = (minD - dist) / dist;
        level.moveCircle(e.pos, -dx * push, -dz * push, d.radius * d.scale);
      }
    }
    this.separate(level);
    this.updateProjectiles(dt, level, player, fx, audio, ev);
  }

  private idleSounds(e: Enemy, dt: number, dist: number, audio: AudioManager): void {
    e.soundTimer -= dt;
    if (e.soundTimer <= 0) {
      e.soundTimer = 4 + Math.random() * 7;
      if (dist < 26) audio.enemy(e.def.soundKind, "idle", e.pos[0], e.pos[1] + e.def.height * 0.8, e.pos[2]);
    }
  }

  private move(e: Enemy, dt: number, dist: number, dx: number, dz: number, level: Level, field: Float32Array, ev: EnemyEvents): void {
    const d = e.def;
    let speed = d.speed * (e.enraged ? 1.35 : 1);
    if (level.typeAt(e.pos[0], e.pos[2]) === 2) speed *= 0.7; // água
    let tx = dx, tz = dz;
    if (!(e.canSee && dist < 16)) {
      // Desce o campo de caminhos.
      const cx = Math.floor(e.pos[0] / CELL), cz = Math.floor(e.pos[2] / CELL);
      const here = level.idx(cx, cz);
      let best = field[here], bx = -1, bz = -1;
      for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oz) continue;
          const nx = cx + ox, nz = cz + oz;
          if (!level.inBounds(nx, nz)) continue;
          const j = level.idx(nx, nz);
          if (field[j] < best && level.walkable(here, nx, nz)) {
            if (ox && oz && (!level.walkable(here, cx + ox, cz) || !level.walkable(here, cx, cz + oz))) continue;
            best = field[j];
            bx = nx;
            bz = nz;
          }
        }
      }
      if (bx < 0) {
        if (!isFinite(field[here])) {
          e.anim.play("idle", { fade: 0.3 });
          return;
        }
        tx = dx;
        tz = dz;
      } else {
        tx = (bx + 0.5) * CELL - e.pos[0];
        tz = (bz + 0.5) * CELL - e.pos[2];
        // Porta fechada no caminho: abre.
        const j = level.idx(bx, bz);
        if (level.doorAt[j] >= 0 && level.doors[level.doorAt[j]].open < 0.9) ev.openDoorAt(bx, bz, true);
      }
    }
    const len = Math.hypot(tx, tz) || 1;
    let ux = tx / len, uz = tz / len;
    if (d.kind === "rat") {
      // Ziguezague.
      e.zig += dt * 6;
      const s = Math.sin(e.zig) * 0.55;
      const px = -uz, pz = ux;
      ux += px * s;
      uz += pz * s;
      const l2 = Math.hypot(ux, uz);
      ux /= l2;
      uz /= l2;
    }
    const want = Math.atan2(ux, -uz);
    e.yaw += angleDiff(e.yaw, want) * Math.min(1, dt * (d.kind === "troll" || d.kind === "king" ? 3 : 7));
    const step = speed * dt;
    level.moveCircle(e.pos, ux * step, uz * step, d.radius * d.scale);
    // Travou? Tenta desviar.
    const moved = Math.hypot(e.pos[0] - e.lastPos[0], e.pos[2] - e.lastPos[1]);
    e.lastPos = [e.pos[0], e.pos[2]];
    if (moved < step * 0.2) {
      e.stuck += dt;
      if (e.stuck > 0.4) {
        level.moveCircle(e.pos, -uz * step * 1.5, ux * step * 1.5, d.radius * d.scale);
        if (e.stuck > 1.2) e.stuck = 0;
      }
    } else e.stuck = Math.max(0, e.stuck - dt);
    const rate = speed * d.animRate;
    e.anim.play(d.moveAnim, { fade: 0.2, speed: rate });
  }

  private blink(e: Enemy, level: Level, player: Player, fx: Effects, audio: AudioManager): void {
    fx.smokePuff(e.pos[0], e.pos[1], e.pos[2], 14);
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * TAU, r = 4 + Math.random() * 5;
      const x = player.pos[0] + Math.sin(a) * r, z = player.pos[2] + Math.cos(a) * r;
      if (level.fits(x, z, e.def.radius) && level.los(x, z, player.pos[0], player.pos[2])) {
        e.pos = [x, level.floorAt(x, z), z];
        break;
      }
    }
    fx.smokePuff(e.pos[0], e.pos[1], e.pos[2], 14);
    audio.enemy("shade", "hurt", e.pos[0], e.pos[1] + 1.5, e.pos[2]);
    e.castCooldown = Math.min(e.castCooldown, 0.6);
  }

  private castBolt(e: Enemy, eye: [number, number, number], player: Player, fx: Effects): void {
    const r = e.def.ranged!;
    const hx = e.pos[0] + Math.sin(e.yaw) * 0.9, hz = e.pos[2] - Math.cos(e.yaw) * 0.9, hy = e.pos[1] + 1.5;
    // Mira com um pouco de antecipação (pega quem fica parado).
    const lead = 0.25;
    const tx = eye[0] + player.vel[0] * lead, ty = eye[1] - 0.3, tz = eye[2] + player.vel[1] * lead;
    const dx = tx - hx, dy = ty - hy, dz = tz - hz;
    const l = Math.hypot(dx, dy, dz) || 1;
    this.projectiles.push({ x: hx, y: hy, z: hz, vx: (dx / l) * r.speed, vy: (dy / l) * r.speed, vz: (dz / l) * r.speed, life: 3, damage: r.damage * e.dmgMul });
    fx.sparksBlue(hx, hy, hz, 8);
  }

  private updateProjectiles(dt: number, level: Level, player: Player, fx: Effects, audio: AudioManager, ev: EnemyEvents): void {
    const eye = player.eye();
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      const sp = Math.hypot(p.vx, p.vy, p.vz);
      const hit = level.raycast(p.x, p.y, p.z, p.vx / sp, p.vy / sp, p.vz / sp, sp * dt);
      if (hit) {
        fx.sparksBlue(hit.x, hit.y, hit.z, 14);
        audio.lightningHit(hit.x, hit.y, hit.z);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const d = Math.hypot(p.x - eye[0], (p.y - (eye[1] - 0.5)) * 0.7, p.z - eye[2]);
      if (d < 0.75 && player.alive) {
        fx.sparksBlue(p.x, p.y, p.z, 16);
        audio.lightningHit(p.x, p.y, p.z);
        ev.onAttackHit({ def: ENEMY_DEFS.shade, pos: [p.x - p.vx, p.y, p.z - p.vz] } as unknown as Enemy, p.damage);
        continue;
      }
      if (p.life > 0) keep.push(p);
    }
    this.projectiles = keep;
  }

  // Empurra inimigos sobrepostos (evita "pilhas").
  private separate(level: Level): void {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive || !a.awake) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive) continue;
        const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2];
        const min = (a.def.radius * a.def.scale + b.def.radius * b.def.scale) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          level.moveCircle(a.pos, -dx * push, -dz * push, a.def.radius * a.def.scale);
          if (b.awake) level.moveCircle(b.pos, dx * push, dz * push, b.def.radius * b.def.scale);
        }
      }
    }
  }

  // Volta ao estado inicial (morreu e voltou ao checkpoint).
  resetAwake(level: Level): void {
    for (const e of this.list) {
      if (!e.alive) continue;
      e.pos = [...e.spawnPos];
      e.pos[1] = level.floorAt(e.pos[0], e.pos[2]);
      e.yaw = e.spawnYaw;
      e.state = e.initialState === St.PLAYDEAD || e.initialState === St.LURE ? e.initialState : St.SLEEP;
      e.stateTime = 0;
      e.cooldown = 0;
      if (e.boss) {
        e.hp = e.maxHp;
        e.summoned = 0;
        e.enraged = false;
      }
      if (e.state === St.PLAYDEAD) e.anim.play("death", { loop: false, fade: 0, startAt: 1, restart: true });
      else e.anim.play("idle", { fade: 0 });
    }
    this.projectiles = [];
  }

  // --------------------------------------------------------- desenho
  submit(q: RenderQueue, planes: Float32Array, cam: [number, number, number], level: Level, time: number): { lure: [number, number, number][] } {
    const lure: [number, number, number][] = [];
    const m = this.model;
    for (const e of this.list) {
      const d = e.def;
      const dx = e.pos[0] - cam[0], dz = e.pos[2] - cam[2];
      if (dx * dx + dz * dz > 55 * 55) continue;
      if (e.sinking >= 1) continue;
      const h = d.height * d.scale;
      if (!mat4.sphereInFrustum(planes, e.pos[0], e.pos[1] + h / 2, e.pos[2], Math.max(h, 2.6 * d.scale))) continue;
      const asset = this.assets[d.model];
      const model = d.skin === "female" && asset.female ? asset.female : asset.model;
      const s = q.skinned(model, asset.skel.jointCount);
      e.anim.writeBones(s.bones, s.boneOffset);
      const y = e.pos[1] - e.sinking * h * 0.9;
      mat4.fromYawInto(m, 0, e.pos[0], y, e.pos[2], Math.PI - e.yaw, d.scale);
      s.d.set(m, s.o);
      const tint = d.kind === "shade" ? 0.75 : 1;
      const cell = level.cellIndexAt(e.pos[0], e.pos[2]);
      s.d.set([tint, tint, tint, 1, 0, e.flash, s.firstBone, cell], s.o + 16);
      if (d.kind === "angler" && e.alive) {
        // A isca: ponto à frente e acima da cabeça, balançando.
        const k = 1.0;
        lure.push([
          e.pos[0] + Math.sin(e.yaw) * 0.72 * k + Math.sin(time * 2 + e.id) * 0.04,
          e.pos[1] + 1.6 + Math.sin(time * 3 + e.id) * 0.04,
          e.pos[2] - Math.cos(e.yaw) * 0.72 * k,
        ]);
      }
    }
    return { lure };
  }
}
