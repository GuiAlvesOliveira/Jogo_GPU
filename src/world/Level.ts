// ============================================================
//  Level.ts — O mundo em GRADE (lógica, CPU)
// ------------------------------------------------------------
//  Converte o mapa ASCII em dados por célula (tipo, altura do piso e
//  do teto, zona, texturas) e responde às perguntas do jogo:
//    - COLISÃO: círculo (jogador/inimigo) × paredes e obstáculos,
//      resolvida por eixo (desliza ao longo das paredes);
//    - RAYCAST 3D: tiros atravessam a grade célula a célula (DDA de
//      Amanatides–Woo), testando piso, teto, degraus, portas e
//      obstáculos;
//    - LINHA DE VISÃO 2D (IA e luzes);
//    - CAMPO DE CAMINHOS (Dijkstra a partir do jogador): cada célula
//      guarda a distância até ele; o inimigo desce o "gradiente".
//  Nada disso toca a GPU: é lógica de jogo sequencial e barata.
// ============================================================

import { CELL, Cell, ZONES, ZONE_INDEX, L } from "../levels/LevelData";
import type { TriggerDef } from "../levels/LevelData";

export type DoorKind = "normal" | "red" | "blue" | "yellow" | "exit" | "secret";

export interface Spawn {
  ch: string;
  cx: number;
  cz: number;
  x: number;
  z: number;
}

export interface Door {
  cx: number;
  cz: number;
  kind: DoorKind;
  axis: "x" | "z"; // eixo ao longo do qual o painel se estende
  open: number; // 0 fechada .. 1 aberta
  target: number;
  locked: boolean; // trancada por script (arena)
  geom: number; // índice da geometria (LevelMesh)
}

export interface LightDef {
  x: number;
  y: number;
  z: number;
  range: number;
  color: [number, number, number];
  intensity: number;
  flicker: number;
  speed: number;
  phase: number;
  cx: number;
  cz: number;
  zone: number;
  kind: "torch" | "lamp" | "brazier" | "lava" | "key";
  enabled: boolean;
}

export interface RayHit {
  t: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  surface: "wall" | "floor" | "ceil" | "door" | "obstacle" | "water" | "lava";
}

const DOOR_CH: Record<string, DoorKind> = { D: "normal", R: "red", B: "blue", Y: "yellow", X: "exit", H: "secret" };
const ENTITY_CH = "@zZpradTKhm1234SWQV!$&";

export class Level {
  readonly W: number;
  readonly H: number;
  readonly S = CELL;
  readonly rows: string[];
  readonly type: Uint8Array;
  readonly floorH: Float32Array;
  readonly ceilH: Float32Array;
  readonly zone: Uint8Array;
  readonly wallLayer: Int16Array; // camada forçada de paredes sólidas (-1 = da zona vizinha)
  readonly floorLayer: Int16Array;
  readonly ceilLayer: Int16Array;
  readonly doorAt: Int16Array;
  readonly doors: Door[] = [];
  readonly spawns: Spawn[] = [];
  readonly lights: LightDef[] = [];
  readonly triggers: TriggerDef[];
  start = { x: 0, z: 0, yaw: 0 };

  constructor(rows: string[], zoneRows: string[], ceilRects: [number, number, number, number, number][], triggers: TriggerDef[]) {
    this.rows = rows;
    this.triggers = triggers;
    const W = (this.W = rows[0].length);
    const H = (this.H = rows.length);
    const N = W * H;
    this.type = new Uint8Array(N);
    this.floorH = new Float32Array(N);
    this.ceilH = new Float32Array(N);
    this.zone = new Uint8Array(N);
    this.wallLayer = new Int16Array(N).fill(-1);
    this.floorLayer = new Int16Array(N);
    this.ceilLayer = new Int16Array(N);
    this.doorAt = new Int16Array(N).fill(-1);

    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        const ch = rows[z][x];
        const zi = ZONE_INDEX[zoneRows[z][x]] ?? 0;
        const zd = ZONES[zi];
        this.zone[i] = zi;
        this.ceilH[i] = zd.ceilH;
        this.floorLayer[i] = zd.floor;
        this.ceilLayer[i] = zd.ceil;
        let t = Cell.FLOOR;
        if (ch === "#" || ch === "g" || ch === "%") {
          t = Cell.SOLID;
          if (ch === "g") this.wallLayer[i] = L.gold;
          if (ch === "%") this.wallLayer[i] = zd.wallAlt;
        } else if (ch === ",") this.floorLayer[i] = zd.floorAlt;
        else if (ch === "~") {
          t = Cell.WATER;
          this.floorH[i] = -0.35;
          this.floorLayer[i] = L.water;
        } else if (ch === "=") {
          t = Cell.LAVA;
          this.floorH[i] = -0.45;
          this.floorLayer[i] = L.lava;
        } else if (ch === "^") {
          t = Cell.PLATFORM;
          this.floorH[i] = 0.5;
          this.floorLayer[i] = zd.floorAlt;
        } else if (ch === "o") t = Cell.COLUMN;
        else if (ch === "c") t = Cell.CRATE;
        else if (ch === "L") t = Cell.BRAZIER;
        else if (ch === "E") {
          t = Cell.ELEVATOR;
          this.floorLayer[i] = L.metal;
        } else if (ch in DOOR_CH) t = ch === "H" ? Cell.SECRET : Cell.DOOR;
        this.type[i] = t;
      }
    }
    for (const [x0, z0, x1, z1, h] of ceilRects) {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.ceilH[z * W + x] = h;
    }
    // Plataformas elevadas herdam o piso da zona; salas com teto alto etc.
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const ch = rows[z][x];
        const i = z * W + x;
        if (ch in DOOR_CH) {
          const kind = DOOR_CH[ch];
          // Passagem norte-sul (aberto ao norte/sul) → painel ao longo de X.
          const openAt = (cx: number, cz: number) => this.inBounds(cx, cz) && !"#g%DRBYXH".includes(rows[cz][cx]);
          const axis = openAt(x, z - 1) || openAt(x, z + 1) ? "x" : "z";
          this.doorAt[i] = this.doors.length;
          this.doors.push({ cx: x, cz: z, kind, axis, open: 0, target: 0, locked: false, geom: this.doors.length });
        }
        if (ENTITY_CH.includes(ch)) {
          const s = { ch, cx: x, cz: z, x: (x + 0.5) * CELL, z: (z + 0.5) * CELL };
          if (ch === "@") this.start = { x: s.x, z: s.z, yaw: 0 };
          else this.spawns.push(s);
        }
      }
    }
    this.buildLights();
  }

  // ------------------------------------------------------------ básicos
  idx(cx: number, cz: number): number {
    return cz * this.W + cx;
  }
  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.W && cz < this.H;
  }
  solidAt(cx: number, cz: number): boolean {
    return !this.inBounds(cx, cz) || this.type[this.idx(cx, cz)] === Cell.SOLID;
  }
  cellX(x: number): number {
    return Math.floor(x / CELL);
  }
  cellIndexAt(x: number, z: number): number {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    return this.inBounds(cx, cz) ? this.idx(cx, cz) : -1;
  }
  floorAt(x: number, z: number): number {
    const i = this.cellIndexAt(x, z);
    return i < 0 ? 0 : this.floorH[i];
  }
  ceilAt(x: number, z: number): number {
    const i = this.cellIndexAt(x, z);
    return i < 0 ? 3 : this.ceilH[i];
  }
  zoneAt(x: number, z: number): number {
    const i = this.cellIndexAt(x, z);
    return i < 0 ? 0 : this.zone[i];
  }
  typeAt(x: number, z: number): Cell {
    const i = this.cellIndexAt(x, z);
    return i < 0 ? Cell.SOLID : (this.type[i] as Cell);
  }
  doorClosed(i: number): boolean {
    const d = this.doorAt[i];
    return d >= 0 && this.doors[d].open < 0.9;
  }

  // Obstáculo (coluna/caixote/braseiro) dentro da célula: [x0, z0, x1, z1, altura].
  obstacle(cx: number, cz: number): [number, number, number, number, number] | null {
    const t = this.type[this.idx(cx, cz)];
    let half = 0, h = 0;
    if (t === Cell.COLUMN) (half = 0.45), (h = 99);
    else if (t === Cell.CRATE) (half = 0.72), (h = 1.45);
    else if (t === Cell.BRAZIER) (half = 0.4), (h = 1.0);
    else return null;
    const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
    return [x - half, z - half, x + half, z + half, h];
  }

  // A célula bloqueia a passagem inteira para quem está com os pés em fy?
  blocks(cx: number, cz: number, fy: number, maxStep: number): boolean {
    if (!this.inBounds(cx, cz)) return true;
    const i = this.idx(cx, cz);
    const t = this.type[i];
    if (t === Cell.SOLID) return true;
    if ((t === Cell.DOOR || t === Cell.SECRET) && this.doors[this.doorAt[i]].open < 0.9) return true;
    if (this.floorH[i] - fy > maxStep) return true;
    return false;
  }

  // ------------------------------------------------------------ colisão
  // Move `p` (x, y=pés, z) por (dx, dz) com raio r. Muta `p`.
  moveCircle(p: [number, number, number], dx: number, dz: number, r: number, maxStep = 0.6): boolean {
    let hit = false;
    const fy = this.floorAt(p[0], p[2]);
    p[0] += dx;
    if (this.resolve(p, r, fy, maxStep, 0, dx)) hit = true;
    p[2] += dz;
    if (this.resolve(p, r, fy, maxStep, 2, dz)) hit = true;
    return hit;
  }

  private resolve(p: [number, number, number], r: number, fy: number, maxStep: number, axis: 0 | 2, d: number): boolean {
    const S = CELL;
    let hit = false;
    const c0x = Math.floor((p[0] - r) / S), c1x = Math.floor((p[0] + r) / S);
    const c0z = Math.floor((p[2] - r) / S), c1z = Math.floor((p[2] + r) / S);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        let box: [number, number, number, number] | null = null;
        if (this.blocks(cx, cz, fy, maxStep)) box = [cx * S, cz * S, (cx + 1) * S, (cz + 1) * S];
        else {
          const ob = this.obstacle(cx, cz);
          if (ob && ob[4] > 0.3) box = [ob[0], ob[1], ob[2], ob[3]];
        }
        if (!box) continue;
        if (p[0] > box[0] - r && p[0] < box[2] + r && p[2] > box[1] - r && p[2] < box[3] + r) {
          hit = true;
          const lo = axis === 0 ? box[0] : box[1];
          const hi = axis === 0 ? box[2] : box[3];
          if (d > 0) p[axis] = lo - r - 1e-4;
          else if (d < 0) p[axis] = hi + r + 1e-4;
          else p[axis] = p[axis] - lo < hi - p[axis] ? lo - r - 1e-4 : hi + r + 1e-4;
        }
      }
    }
    return hit;
  }

  // Um círculo cabe nesta posição (para spawns/teleporte)?
  fits(x: number, z: number, r: number): boolean {
    const p: [number, number, number] = [x, 0, z];
    const fy = this.floorAt(x, z);
    const c = Math.floor(x / CELL), d = Math.floor(z / CELL);
    if (this.blocks(c, d, fy, 0.6)) return false;
    const q: [number, number, number] = [x, 0, z];
    this.moveCircle(q, 0, 0, r);
    return Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.01;
  }

  // -------------------------------------------------- linha de visão 2D
  // Sem paredes (nem portas fechadas) entre A e B?
  los(ax: number, az: number, bx: number, bz: number, doorsBlock = true): boolean {
    const S = CELL;
    let cx = Math.floor(ax / S), cz = Math.floor(az / S);
    const tx = Math.floor(bx / S), tz = Math.floor(bz / S);
    const dx = bx - ax, dz = bz - az;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(S / dx) : Infinity;
    const tDZ = dz !== 0 ? Math.abs(S / dz) : Infinity;
    let tMX = dx !== 0 ? ((dx > 0 ? (cx + 1) * S - ax : ax - cx * S) / Math.abs(dx)) : Infinity;
    let tMZ = dz !== 0 ? ((dz > 0 ? (cz + 1) * S - az : az - cz * S) / Math.abs(dz)) : Infinity;
    for (let guard = 0; guard < 400; guard++) {
      if (cx === tx && cz === tz) return true;
      if (tMX < tMZ) {
        cx += stepX;
        tMX += tDX;
      } else {
        cz += stepZ;
        tMZ += tDZ;
      }
      if (cx === tx && cz === tz) return true;
      if (!this.inBounds(cx, cz)) return false;
      const i = this.idx(cx, cz);
      const t = this.type[i];
      if (t === Cell.SOLID) return false;
      if (doorsBlock && (t === Cell.DOOR || t === Cell.SECRET) && this.doors[this.doorAt[i]].open < 0.5) return false;
      if (!doorsBlock && t === Cell.SECRET && this.doors[this.doorAt[i]].open < 0.5) return false;
    }
    return false;
  }

  // ---------------------------------------------------------- raycast 3D
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): RayHit | null {
    const S = CELL;
    let cx = Math.floor(ox / S), cz = Math.floor(oz / S);
    if (!this.inBounds(cx, cz)) return null;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(S / dx) : Infinity;
    const tDZ = dz !== 0 ? Math.abs(S / dz) : Infinity;
    let tMX = dx !== 0 ? ((dx > 0 ? (cx + 1) * S - ox : ox - cx * S) / Math.abs(dx)) : Infinity;
    let tMZ = dz !== 0 ? ((dz > 0 ? (cz + 1) * S - oz : oz - cz * S) / Math.abs(dz)) : Infinity;
    let t0 = 0;
    const mk = (t: number, nx: number, ny: number, nz: number, surface: RayHit["surface"]): RayHit => ({
      t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, nx, ny, nz, surface,
    });
    for (let guard = 0; guard < 300 && t0 <= maxDist; guard++) {
      const i = this.idx(cx, cz);
      const t1 = Math.min(tMX, tMZ, maxDist);
      const fl = this.floorH[i], ce = this.ceilH[i];
      const type = this.type[i];
      // Obstáculo / porta dentro da célula.
      let best: RayHit | null = null;
      const ob = this.obstacle(cx, cz);
      if (ob) {
        const h = rayBox(ox, oy, oz, dx, dy, dz, ob[0], fl, ob[1], ob[2], Math.min(ce, fl + ob[4]), ob[3]);
        if (h && h.t >= t0 - 1e-4 && h.t <= t1) best = mk(h.t, h.nx, h.ny, h.nz, "obstacle");
      }
      if ((type === Cell.DOOR || type === Cell.SECRET) && this.doorAt[i] >= 0) {
        const d = this.doors[this.doorAt[i]];
        if (d.open < 0.98) {
          const x0 = cx * S, z0 = cz * S;
          const thick = type === Cell.SECRET ? S / 2 : 0.18;
          const bottom = fl + d.open * (ce - fl);
          const b = d.axis === "x"
            ? rayBox(ox, oy, oz, dx, dy, dz, x0, bottom, z0 + S / 2 - thick, x0 + S, ce, z0 + S / 2 + thick)
            : rayBox(ox, oy, oz, dx, dy, dz, x0 + S / 2 - thick, bottom, z0, x0 + S / 2 + thick, ce, z0 + S);
          if (b && b.t >= t0 - 1e-4 && b.t <= t1 && (!best || b.t < best.t)) best = mk(b.t, b.nx, b.ny, b.nz, "door");
        }
      }
      // Piso e teto desta célula.
      if (dy < 0) {
        const tf = (fl - oy) / dy;
        if (tf >= t0 && tf <= t1 && (!best || tf < best.t)) {
          best = mk(tf, 0, 1, 0, type === Cell.WATER ? "water" : type === Cell.LAVA ? "lava" : "floor");
        }
      } else if (dy > 0) {
        const tc = (ce - oy) / dy;
        if (tc >= t0 && tc <= t1 && (!best || tc < best.t)) best = mk(tc, 0, -1, 0, "ceil");
      }
      if (best) return best;
      if (t1 >= maxDist) return null;
      // Avança para a próxima célula.
      let nx = 0, nz = 0;
      if (tMX < tMZ) {
        cx += stepX;
        t0 = tMX;
        tMX += tDX;
        nx = -stepX;
      } else {
        cz += stepZ;
        t0 = tMZ;
        tMZ += tDZ;
        nz = -stepZ;
      }
      if (!this.inBounds(cx, cz)) return mk(t0, nx, 0, nz, "wall");
      const j = this.idx(cx, cz);
      if (this.type[j] === Cell.SOLID) return mk(t0, nx, 0, nz, "wall");
      // Degrau/verga: o raio entra abaixo do piso ou acima do teto vizinho.
      const y = oy + dy * t0;
      if (y < this.floorH[j] || y > this.ceilH[j]) return mk(t0, nx, 0, nz, "wall");
    }
    return null;
  }

  // ---------------------------------------------------------- caminhos
  // Dijkstra (grade 8-conexa) a partir de (tx, tz). Retorna distâncias.
  pathField(tx: number, tz: number, out: Float32Array, maxDist = 60): void {
    out.fill(Infinity);
    if (!this.inBounds(tx, tz)) return;
    const W = this.W;
    const heap = new MinHeap();
    const s = this.idx(tx, tz);
    out[s] = 0;
    heap.push(s, 0);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.size) {
      const [i, d] = heap.pop();
      if (d > out[i] || d > maxDist) continue;
      const cx = i % W, cz = (i / W) | 0;
      for (const [ox, oz, c] of dirs) {
        const nx = cx + ox, nz = cz + oz;
        if (!this.walkable(i, nx, nz)) continue;
        if (ox !== 0 && oz !== 0 && (!this.walkable(i, cx + ox, cz) || !this.walkable(i, cx, cz + oz))) continue;
        const j = this.idx(nx, nz);
        const t = this.type[j];
        const cost = c * (t === Cell.LAVA ? 10 : t === Cell.WATER ? 1.6 : 1);
        const nd = d + cost;
        if (nd < out[j]) {
          out[j] = nd;
          heap.push(j, nd);
        }
      }
    }
  }

  // Um inimigo consegue passar de i para (nx, nz)?
  walkable(from: number, nx: number, nz: number): boolean {
    if (!this.inBounds(nx, nz)) return false;
    const j = this.idx(nx, nz);
    const t = this.type[j];
    if (t === Cell.SOLID || t === Cell.COLUMN || t === Cell.CRATE || t === Cell.BRAZIER) return false;
    if (t === Cell.SECRET) return this.doors[this.doorAt[j]].open > 0.9;
    if (t === Cell.DOOR) {
      const d = this.doors[this.doorAt[j]];
      if (d.kind !== "normal" || d.locked) return d.open > 0.9;
    }
    return Math.abs(this.floorH[j] - this.floorH[from]) <= 0.6;
  }

  // ------------------------------------------------------------ luzes
  private buildLights(): void {
    const S = CELL;
    const add = (l: Omit<LightDef, "cx" | "cz" | "zone" | "enabled">) => {
      const cx = Math.floor(l.x / S), cz = Math.floor(l.z / S);
      this.lights.push({ ...l, cx, cz, zone: this.zone[this.idx(cx, cz)], enabled: true });
    };
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let z = 0; z < this.H; z++) {
      for (let x = 0; x < this.W; x++) {
        const ch = this.rows[z][x];
        const i = this.idx(x, z);
        const cxm = (x + 0.5) * S, czm = (z + 0.5) * S;
        if (ch === "t") {
          // Tocha: presa na parede sólida mais próxima.
          let wx = 0, wz = 0;
          if (this.solidAt(x, z - 1)) wz = -1;
          else if (this.solidAt(x - 1, z)) wx = -1;
          else if (this.solidAt(x + 1, z)) wx = 1;
          else if (this.solidAt(x, z + 1)) wz = 1;
          add({
            x: cxm + wx * (S / 2 - 0.35), y: this.floorH[i] + 2.1, z: czm + wz * (S / 2 - 0.35),
            range: 9.5, color: [1.0, 0.52, 0.2], intensity: 2.4, flicker: 0.35, speed: 7 + rnd() * 4, phase: rnd() * 100, kind: "torch",
          });
        } else if (ch === "l") {
          add({
            x: cxm, y: this.ceilH[i] - 0.45, z: czm,
            range: 10, color: [0.7, 0.82, 1.0], intensity: 2.0, flicker: 0.15, speed: 13, phase: rnd() * 100, kind: "lamp",
          });
        } else if (ch === "L") {
          add({
            x: cxm, y: this.floorH[i] + 1.45, z: czm,
            range: 13, color: [1.0, 0.45, 0.14], intensity: 3.0, flicker: 0.3, speed: 6 + rnd() * 3, phase: rnd() * 100, kind: "brazier",
          });
        } else if (ch === "=" && x % 3 === 1 && z % 3 === 1) {
          add({
            x: cxm, y: this.floorH[i] + 0.9, z: czm,
            range: 7.5, color: [1.0, 0.33, 0.07], intensity: 1.5, flicker: 0.25, speed: 1.5 + rnd(), phase: rnd() * 100, kind: "lava",
          });
        }
      }
    }
  }
}

// Raio × caixa alinhada (slabs). Retorna t de entrada e a normal.
export function rayBox(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
): { t: number; nx: number; ny: number; nz: number } | null {
  let tmin = -Infinity, tmax = Infinity;
  let nx = 0, ny = 0, nz = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return null;
      continue;
    }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = a === 0 ? sign : 0;
      ny = a === 1 ? sign : 0;
      nz = a === 2 ? sign : 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return { t: Math.max(tmin, 0), nx, ny, nz };
}

// Heap mínima simples (índice, prioridade) para o Dijkstra.
class MinHeap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, p: number): void {
    const ids = this.ids, pr = this.pr;
    ids.push(id);
    pr.push(p);
    let i = ids.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (pr[par] <= pr[i]) break;
      [ids[par], ids[i]] = [ids[i], ids[par]];
      [pr[par], pr[i]] = [pr[i], pr[par]];
      i = par;
    }
  }
  pop(): [number, number] {
    const ids = this.ids, pr = this.pr;
    const top: [number, number] = [ids[0], pr[0]];
    const li = ids.pop()!, lp = pr.pop()!;
    if (ids.length) {
      ids[0] = li;
      pr[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < ids.length && pr[l] < pr[m]) m = l;
        if (r < ids.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [ids[m], ids[i]] = [ids[i], ids[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}
