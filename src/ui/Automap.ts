// ============================================================
//  Automap.ts — Mapa das áreas exploradas (Tab), Canvas 2D (CPU)
// ------------------------------------------------------------
//  As células ao redor do jogador vão sendo "reveladas" enquanto
//  ele anda. O mapa desenha só o que já foi visto: paredes, portas
//  (na cor da chave), água/lava e a seta do jogador.
// ============================================================

import { Cell } from "../levels/LevelData";
import type { Level } from "../world/Level";

export class Automap {
  seen: Uint8Array;
  open = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private timer = 0;

  constructor(private readonly level: Level) {
    this.seen = new Uint8Array(level.W * level.H);
    this.canvas = document.getElementById("automap") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
  }

  toggle(): void {
    this.open = !this.open;
    this.canvas.classList.toggle("hidden", !this.open);
  }

  hide(): void {
    this.open = false;
    this.canvas.classList.add("hidden");
  }

  reveal(x: number, z: number, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    const lv = this.level;
    const cx = Math.floor(x / lv.S), cz = Math.floor(z / lv.S);
    const R = 4;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const nx = cx + dx, nz = cz + dz;
        if (!lv.inBounds(nx, nz) || dx * dx + dz * dz > R * R) continue;
        const px = (nx + 0.5) * lv.S, pz = (nz + 0.5) * lv.S;
        if (lv.type[lv.idx(nx, nz)] === Cell.SOLID || lv.los(x, z, px, pz)) this.seen[lv.idx(nx, nz)] = 1;
      }
    }
  }

  draw(px: number, pz: number, yaw: number, keys: Set<string>): void {
    if (!this.open) return;
    const lv = this.level;
    const c = this.canvas;
    const w = Math.floor(window.innerWidth * 0.8);
    const h = Math.floor(window.innerHeight * 0.8);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const s = Math.floor(Math.min(w / lv.W, h / lv.H));
    const ox = Math.floor((w - s * lv.W) / 2), oy = Math.floor((h - s * lv.H) / 2);
    const g = this.ctx;
    g.fillStyle = "rgba(4,6,8,0.92)";
    g.fillRect(0, 0, w, h);
    for (let z = 0; z < lv.H; z++) {
      for (let x = 0; x < lv.W; x++) {
        const i = lv.idx(x, z);
        if (!this.seen[i]) continue;
        const t = lv.type[i];
        let col = "";
        if (t === Cell.SOLID) {
          // Só desenha a parede se encosta em algo aberto já visto.
          let edge = false;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (lv.inBounds(x + dx, z + dz) && lv.type[lv.idx(x + dx, z + dz)] !== Cell.SOLID) edge = true;
          }
          if (!edge) continue;
          col = "#9aa8b5";
        } else if (t === Cell.WATER) col = "#2d5e9e";
        else if (t === Cell.LAVA) col = "#d2521a";
        else if (t === Cell.DOOR || t === Cell.SECRET) {
          const d = lv.doors[lv.doorAt[i]];
          col = d.kind === "red" ? "#e03030" : d.kind === "blue" ? "#3060ff" : d.kind === "yellow" ? "#e8d030" : d.kind === "exit" ? "#ffffff" : d.kind === "secret" ? (d.open > 0.5 ? "#8a5ab0" : "#6d7a86") : "#b0a080";
        } else if (t === Cell.COLUMN || t === Cell.CRATE || t === Cell.BRAZIER) col = "#5d646b";
        else col = t === Cell.PLATFORM ? "#4a5560" : "#303a44";
        g.fillStyle = col;
        g.fillRect(ox + x * s, oy + z * s, s, s);
      }
    }
    // Jogador (seta).
    const cx = ox + (px / lv.S) * s, cz = oy + (pz / lv.S) * s;
    g.save();
    g.translate(cx, cz);
    g.rotate(yaw);
    g.fillStyle = "#4dff7a";
    g.beginPath();
    g.moveTo(0, -s * 1.1);
    g.lineTo(s * 0.7, s * 0.7);
    g.lineTo(-s * 0.7, s * 0.7);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = "#c8d0d8";
    g.font = `${Math.max(12, s * 1.2)}px "Courier New", monospace`;
    g.fillText(`MAPA  —  chaves: ${[...keys].map((k) => ({ red: "vermelha", blue: "azul", yellow: "amarela" } as Record<string, string>)[k]).join(", ") || "nenhuma"}`, ox, Math.max(18, oy - 6));
  }
}
