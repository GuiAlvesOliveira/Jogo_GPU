// ============================================================
//  mapview.ts — desenho 2D da grade do nível REAL (Canvas 2D)
// ------------------------------------------------------------
//  Usado pelos slides de mapa, iluminação e IA. Lê a classe Level
//  do jogo (tipos de célula, zonas, portas, luzes) e o ASCII do mapa
//  para as entidades.
// ============================================================

import type { Level } from "../world/Level";
import { Cell } from "../levels/LevelData";
import { MAP_ROWS } from "../levels/setorZero";
import { KIND_BY_CHAR } from "../game/enemies/Enemies";
import { PICKUP_TABLE } from "../game/Pickups";
import { GROUP_OF, GROUPS } from "./data/balance";
import { PAL } from "./charts";
import { fitCanvas, canvasPoint } from "./dom";

export const ZONE_FLOOR = ["#3b3327", "#22332f", "#2a2a38", "#3d2619", "#35302a"];
export const GROUP_COLOR: Record<string, string> = Object.fromEntries(GROUPS.map((g, i) => [g, PAL.cat[i]]));
export const KEY_HEX: Record<string, string> = { red: "#e5483d", blue: "#3f7ff0", yellow: "#f0cf3a" };

export type Layer = "entities" | "pickups" | "lights" | "triggers" | "doors";

export interface MapViewOpts {
  region?: [number, number, number, number]; // cx0, cz0, cx1, cz1 (inclusive)
  layers?: Layer[];
  dim?: number; // escurece o fundo (0..1) para sobreposições
}

export class MapView {
  readonly ctx: CanvasRenderingContext2D;
  region: [number, number, number, number];
  layers: Set<Layer>;
  dim: number;
  cs = 10; // pixels por célula (no buffer)
  ox = 0;
  oy = 0;
  private base: HTMLCanvasElement | null = null;
  private baseKey = "";

  constructor(readonly canvas: HTMLCanvasElement, readonly lv: Level, o: MapViewOpts = {}) {
    this.ctx = canvas.getContext("2d")!;
    this.region = o.region ?? [0, 0, lv.W - 1, lv.H - 1];
    this.layers = new Set(o.layers ?? ["entities", "pickups", "doors"]);
    this.dim = o.dim ?? 0;
  }

  layout(): void {
    const { w, h } = fitCanvas(this.canvas);
    const [x0, z0, x1, z1] = this.region;
    const cw = x1 - x0 + 1, ch = z1 - z0 + 1;
    this.cs = Math.max(1, Math.min(w / cw, h / ch));
    this.ox = (w - cw * this.cs) / 2 - x0 * this.cs;
    this.oy = (h - ch * this.cs) / 2 - z0 * this.cs;
  }

  // centro da célula em pixels do buffer
  px(cx: number, cz: number): [number, number] {
    return [this.ox + (cx + 0.5) * this.cs, this.oy + (cz + 0.5) * this.cs];
  }
  // posição em metros → pixels
  mpx(x: number, z: number): [number, number] {
    return [this.ox + (x / this.lv.S) * this.cs, this.oy + (z / this.lv.S) * this.cs];
  }

  cellAt(e: { clientX: number; clientY: number }): [number, number] | null {
    const [x, y] = canvasPoint(this.canvas, e);
    const cx = Math.floor((x - this.ox) / this.cs), cz = Math.floor((y - this.oy) / this.cs);
    const [x0, z0, x1, z1] = this.region;
    if (cx < x0 || cz < z0 || cx > x1 || cz > z1) return null;
    return [cx, cz];
  }

  // Fundo estático (paredes, pisos) em cache.
  private drawBase(): HTMLCanvasElement {
    const key = `${this.canvas.width}x${this.canvas.height}:${this.region.join(",")}:${this.dim}`;
    if (this.base && this.baseKey === key) return this.base;
    const b = this.base ?? document.createElement("canvas");
    b.width = this.canvas.width;
    b.height = this.canvas.height;
    const c = b.getContext("2d")!;
    const lv = this.lv, cs = this.cs;
    c.fillStyle = "#07090b";
    c.fillRect(0, 0, b.width, b.height);
    const [x0, z0, x1, z1] = this.region;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const i = lv.idx(x, z);
        const t = lv.type[i];
        const X = this.ox + x * cs, Y = this.oy + z * cs;
        if (t === Cell.SOLID) {
          const ch = MAP_ROWS[z][x];
          c.fillStyle = ch === "g" ? "#3a3316" : ch === "%" ? "#1c2026" : "#11151a";
          c.fillRect(X, Y, cs + 0.5, cs + 0.5);
          continue;
        }
        let col = ZONE_FLOOR[lv.zone[i]] ?? "#2a2a2a";
        if (t === Cell.WATER) col = "#1d4a5c";
        else if (t === Cell.LAVA) col = "#a8431a";
        else if (t === Cell.PLATFORM) col = "#4a4640";
        else if (t === Cell.ELEVATOR) col = "#56606a";
        c.fillStyle = col;
        c.fillRect(X, Y, cs + 0.5, cs + 0.5);
        if (t === Cell.COLUMN || t === Cell.CRATE || t === Cell.BRAZIER) {
          c.fillStyle = t === Cell.CRATE ? "#6b5436" : t === Cell.BRAZIER ? "#d9822b" : "#11151a";
          const m = cs * (t === Cell.CRATE ? 0.2 : 0.28);
          c.fillRect(X + m, Y + m, cs - 2 * m, cs - 2 * m);
        }
      }
    }
    // grade sutil
    if (cs >= 7) {
      c.strokeStyle = "#ffffff0a";
      c.lineWidth = 1;
      c.beginPath();
      for (let x = x0; x <= x1 + 1; x++) {
        const X = Math.round(this.ox + x * cs) + 0.5;
        c.moveTo(X, this.oy + z0 * cs);
        c.lineTo(X, this.oy + (z1 + 1) * cs);
      }
      for (let z = z0; z <= z1 + 1; z++) {
        const Y = Math.round(this.oy + z * cs) + 0.5;
        c.moveTo(this.ox + x0 * cs, Y);
        c.lineTo(this.ox + (x1 + 1) * cs, Y);
      }
      c.stroke();
    }
    if (this.dim > 0) {
      c.fillStyle = `rgba(7,9,11,${this.dim})`;
      c.fillRect(0, 0, b.width, b.height);
    }
    this.base = b;
    this.baseKey = key;
    return b;
  }

  draw(overlay?: (ctx: CanvasRenderingContext2D, mv: MapView) => void): void {
    this.layout();
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.drawBase(), 0, 0);
    const lv = this.lv, cs = this.cs;
    const [x0, z0, x1, z1] = this.region;
    const inR = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    if (this.layers.has("doors")) {
      for (const d of lv.doors) {
        if (!inR(d.cx, d.cz)) continue;
        const [X, Y] = this.px(d.cx, d.cz);
        const col = d.kind === "red" || d.kind === "blue" || d.kind === "yellow" ? KEY_HEX[d.kind] : d.kind === "exit" ? "#e8e2d6" : d.kind === "secret" ? "#b48cf0" : "#9a7a52";
        c.fillStyle = col;
        const a = cs * 0.46, b = cs * 0.14;
        if (d.kind === "secret") {
          c.globalAlpha = 0.75;
          c.fillRect(X - a, Y - a, 2 * a, 2 * a);
          c.globalAlpha = 1;
        } else if (d.axis === "x") c.fillRect(X - a, Y - b, 2 * a, 2 * b);
        else c.fillRect(X - b, Y - a, 2 * b, 2 * a);
      }
    }
    if (this.layers.has("lights")) {
      for (const l of lv.lights) {
        if (!inR(l.cx, l.cz) || l.kind === "lava") continue;
        const [X, Y] = this.mpx(l.x, l.z);
        c.fillStyle = l.kind === "lamp" ? "#bcd8ff" : "#ffc26b";
        c.beginPath();
        c.arc(X, Y, Math.max(2, cs * 0.2), 0, Math.PI * 2);
        c.fill();
      }
    }
    if (this.layers.has("triggers")) {
      c.lineWidth = Math.max(1, cs * 0.12);
      for (const t of lv.triggers) {
        const [a, b, e, f] = t.rect;
        c.strokeStyle = "#e0564ccc";
        c.setLineDash([cs * 0.5, cs * 0.35]);
        c.strokeRect(this.ox + a * cs, this.oy + b * cs, (e - a + 1) * cs, (f - b + 1) * cs);
      }
      c.setLineDash([]);
    }
    for (let z = z0; z <= z1; z++) {
      const row = MAP_ROWS[z];
      for (let x = x0; x <= x1; x++) {
        const ch = row[x];
        const [X, Y] = this.px(x, z);
        const k = KIND_BY_CHAR[ch];
        if (k && this.layers.has("entities")) {
          c.fillStyle = GROUP_COLOR[GROUP_OF[k]];
          c.strokeStyle = "#07090b";
          c.lineWidth = Math.max(1, cs * 0.12);
          c.beginPath();
          c.arc(X, Y, Math.max(2.2, cs * (k === "king" ? 0.52 : k === "troll" ? 0.42 : k === "rat" ? 0.24 : 0.32)), 0, Math.PI * 2);
          c.fill();
          c.stroke();
          continue;
        }
        const p = PICKUP_TABLE[ch];
        if (p && this.layers.has("pickups")) {
          const r = Math.max(2, cs * 0.26);
          if (p.kind === "health") {
            c.fillStyle = "#5fd35f";
            c.fillRect(X - r, Y - r * 0.34, 2 * r, r * 0.68);
            c.fillRect(X - r * 0.34, Y - r, r * 0.68, 2 * r);
          } else if (p.kind === "ammo") {
            c.fillStyle = "#d9c9a3";
            c.fillRect(X - r * 0.7, Y - r * 0.7, r * 1.4, r * 1.4);
          } else if (p.kind === "weapon") {
            c.fillStyle = "#f2a65a";
            c.beginPath();
            c.moveTo(X, Y - r * 1.3);
            c.lineTo(X + r * 1.3, Y);
            c.lineTo(X, Y + r * 1.3);
            c.lineTo(X - r * 1.3, Y);
            c.closePath();
            c.fill();
          } else if (p.kind === "key") {
            c.fillStyle = KEY_HEX[p.key!];
            c.beginPath();
            c.arc(X, Y, r * 1.25, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = "#fff";
            c.lineWidth = 1.5;
            c.stroke();
          }
        }
        if (ch === "@" && this.layers.has("entities")) {
          c.fillStyle = "#ece6da";
          c.beginPath();
          c.moveTo(X, Y - cs * 0.5);
          c.lineTo(X + cs * 0.4, Y + cs * 0.35);
          c.lineTo(X - cs * 0.4, Y + cs * 0.35);
          c.closePath();
          c.fill();
        }
      }
    }
    overlay?.(c, this);
  }
}

export function cellLabel(lv: Level, cx: number, cz: number): string {
  const i = lv.idx(cx, cz);
  const t = lv.type[i];
  const names: Record<number, string> = {
    [Cell.SOLID]: "parede",
    [Cell.FLOOR]: "piso",
    [Cell.WATER]: "água (piso −0,35 m)",
    [Cell.LAVA]: "lava (piso −0,45 m)",
    [Cell.PLATFORM]: "plataforma (+0,5 m)",
    [Cell.COLUMN]: "coluna",
    [Cell.CRATE]: "caixote",
    [Cell.BRAZIER]: "braseiro",
    [Cell.DOOR]: "porta",
    [Cell.SECRET]: "passagem secreta",
    [Cell.ELEVATOR]: "elevador",
  };
  return names[t] ?? "?";
}
