// ============================================================
//  LevelMesh.ts — Gera a GEOMETRIA do mapa a partir da grade (CPU)
// ------------------------------------------------------------
//  Roda UMA vez no carregamento. Para cada célula aberta emite:
//    - piso e teto (quads);
//    - paredes onde a vizinha é sólida (voltadas para dentro);
//    - "degraus" onde o piso/teto da vizinha tem outra altura;
//    - caixas para colunas, caixotes, braseiros e suportes de tocha.
//  Cada vértice leva: posição, normal, tangente (normal mapping),
//  UV em coordenadas de MUNDO (a textura se repete a cada 2,5 m),
//  a CAMADA da texture array e um fator de oclusão ambiente
//  (cantos e rodapés mais escuros).
//  As PORTAS viram geometrias separadas (desenhadas com deslocamento
//  vertical enquanto abrem).
// ============================================================

import { CELL, Cell, ZONES, L } from "../levels/LevelData";
import { LEVEL_VERTEX_FLOATS } from "../render/Renderer";
import type { Level } from "./Level";

class MeshBuilder {
  v: number[] = [];
  i: number[] = [];

  // Quad com 4 cantos (ordem anti-horária vista da frente), normal,
  // tangente (+w = handedness), UVs, camada e AO por canto.
  quad(
    p: number[][], n: number[], t: number[], uv: number[][], layer: number, ao: number[] = [1, 1, 1, 1],
  ): void {
    const base = this.v.length / LEVEL_VERTEX_FLOATS;
    for (let k = 0; k < 4; k++) {
      this.v.push(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], t[0], t[1], t[2], t[3], uv[k][0], uv[k][1], layer, ao[k]);
    }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Parede vertical: normal horizontal (nx, nz), de (ax,az) a (bx,bz)
  // vista da frente, entre y0 e y1.
  wall(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, nx: number, nz: number, layer: number, aoBottom = 0.72, aoTop = 0.85): void {
    // direita de quem olha a parede = cross(-N, Y) = (nz, 0, -nx)
    const rx = nz, rz = -nx;
    const ua = (ax * rx + az * rz) / CELL, ub = (bx * rx + bz * rz) / CELL;
    this.quad(
      [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]],
      [nx, 0, nz],
      [rx, 0, rz, 1],
      [[ua, -y0 / CELL], [ub, -y0 / CELL], [ub, -y1 / CELL], [ua, -y1 / CELL]],
      layer,
      [aoBottom, aoBottom, aoTop, aoTop],
    );
  }

  // Caixa alinhada (sem a face de baixo).
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, layer: number, top = true): void {
    this.wall(x0, z1, x1, z1, y0, y1, 0, 1, layer, 0.7, 1);
    this.wall(x1, z0, x0, z0, y0, y1, 0, -1, layer, 0.7, 1);
    this.wall(x1, z1, x1, z0, y0, y1, 1, 0, layer, 0.7, 1);
    this.wall(x0, z0, x0, z1, y0, y1, -1, 0, layer, 0.7, 1);
    if (top) {
      this.quad(
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
        [0, 1, 0], [1, 0, 0, 1],
        [[x0 / CELL, z1 / CELL], [x1 / CELL, z1 / CELL], [x1 / CELL, z0 / CELL], [x0 / CELL, z0 / CELL]],
        layer,
      );
    }
  }
}

export interface LevelGeometry {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  doorVertices: Float32Array<ArrayBuffer>;
  doorIndices: Uint32Array<ArrayBuffer>;
  doorRanges: { first: number; count: number }[];
}

export function buildLevelMesh(lv: Level): LevelGeometry {
  const S = CELL;
  const m = new MeshBuilder();
  const { W, H } = lv;
  const open = (cx: number, cz: number) => lv.inBounds(cx, cz) && lv.type[lv.idx(cx, cz)] !== Cell.SOLID;
  // AO de canto: quantas das 3 células vizinhas ao canto são sólidas.
  const cornerAO = (cx: number, cz: number, sx: number, sz: number) => {
    let n = 0;
    if (!open(cx + sx, cz)) n++;
    if (!open(cx, cz + sz)) n++;
    if (!open(cx + sx, cz + sz)) n++;
    return 1 - n * 0.16;
  };

  for (let cz = 0; cz < H; cz++) {
    for (let cx = 0; cx < W; cx++) {
      const i = lv.idx(cx, cz);
      const t = lv.type[i];
      if (t === Cell.SOLID) continue;
      const zd = ZONES[lv.zone[i]];
      const x0 = cx * S, x1 = x0 + S, z0 = cz * S, z1 = z0 + S;
      const fl = lv.floorH[i], ce = lv.ceilH[i];
      const ao00 = cornerAO(cx, cz, -1, -1), ao10 = cornerAO(cx, cz, 1, -1);
      const ao11 = cornerAO(cx, cz, 1, 1), ao01 = cornerAO(cx, cz, -1, 1);

      // Piso (normal +Y): cantos em ordem anti-horária vista de cima.
      m.quad(
        [[x0, fl, z1], [x1, fl, z1], [x1, fl, z0], [x0, fl, z0]],
        [0, 1, 0], [1, 0, 0, 1],
        [[x0 / S, z1 / S], [x1 / S, z1 / S], [x1 / S, z0 / S], [x0 / S, z0 / S]],
        lv.floorLayer[i], [ao01, ao11, ao10, ao00],
      );
      // Teto (normal -Y).
      m.quad(
        [[x0, ce, z0], [x1, ce, z0], [x1, ce, z1], [x0, ce, z1]],
        [0, -1, 0], [1, 0, 0, -1],
        [[x0 / S, z0 / S], [x1 / S, z0 / S], [x1 / S, z1 / S], [x0 / S, z1 / S]],
        lv.ceilLayer[i], [ao00 * 0.9, ao10 * 0.9, ao11 * 0.9, ao01 * 0.9],
      );

      // Paredes / degraus para os 4 vizinhos.
      const sides: [number, number, number, number, number, number, number, number][] = [
        // vizinho dx,dz | canto A (x,z) | canto B (x,z) | normal nx,nz
        [0, -1, x0, z0, x1, z0, 0, 1],
        [0, 1, x1, z1, x0, z1, 0, -1],
        [-1, 0, x0, z1, x0, z0, 1, 0],
        [1, 0, x1, z0, x1, z1, -1, 0],
      ];
      for (const [dx, dz, ax, az, bx, bz, nx, nz] of sides) {
        const ncx = cx + dx, ncz = cz + dz;
        if (!open(ncx, ncz)) {
          const j = lv.inBounds(ncx, ncz) ? lv.idx(ncx, ncz) : -1;
          const layer = j >= 0 && lv.wallLayer[j] >= 0 ? lv.wallLayer[j] : zd.wall;
          m.wall(ax, az, bx, bz, fl, ce, nx, nz, layer);
          continue;
        }
        const j = lv.idx(ncx, ncz);
        const nf = lv.floorH[j], nc = lv.ceilH[j];
        if (nf > fl + 1e-3) m.wall(ax, az, bx, bz, fl, nf, nx, nz, lv.type[j] === Cell.PLATFORM ? zd.column : zd.wall, 0.75, 0.95);
        if (nc < ce - 1e-3) m.wall(ax, az, bx, bz, nc, ce, nx, nz, ZONES[lv.zone[j]].wall, 1, 0.85);
      }

      // Obstáculos.
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (t === Cell.COLUMN) m.box(mx - 0.45, fl, mz - 0.45, mx + 0.45, ce, mz + 0.45, zd.column, false);
      else if (t === Cell.CRATE) m.box(mx - 0.72, fl, mz - 0.72, mx + 0.72, fl + 1.45, mz + 0.72, L.crate);
      else if (t === Cell.BRAZIER) {
        m.box(mx - 0.12, fl, mz - 0.12, mx + 0.12, fl + 0.75, mz + 0.12, L.metal);
        m.box(mx - 0.4, fl + 0.75, mz - 0.4, mx + 0.4, fl + 1.0, mz + 0.4, L.metal);
      }
      // Suporte da tocha (pequena caixa de madeira na parede).
      const ch = lv.rows[cz][cx];
      if (ch === "t") {
        let wx = 0, wz = 0;
        if (lv.solidAt(cx, cz - 1)) wz = -1;
        else if (lv.solidAt(cx - 1, cz)) wx = -1;
        else if (lv.solidAt(cx + 1, cz)) wx = 1;
        else if (lv.solidAt(cx, cz + 1)) wz = 1;
        const px = mx + wx * (S / 2 - 0.12), pz = mz + wz * (S / 2 - 0.12);
        m.box(px - 0.07, fl + 1.55, pz - 0.07, px + 0.07, fl + 2.0, pz + 0.07, L.crate);
      } else if (ch === "l") {
        m.box(mx - 0.18, ce - 0.35, mz - 0.18, mx + 0.18, ce - 0.25, mz + 0.18, L.metal);
      }
    }
  }

  // ---- Portas: uma geometria por porta, na posição FECHADA ----
  const dm = new MeshBuilder();
  const ranges: { first: number; count: number }[] = [];
  for (const d of lv.doors) {
    const first = dm.i.length;
    const i = lv.idx(d.cx, d.cz);
    const x0 = d.cx * S, z0 = d.cz * S;
    const fl = lv.floorH[i], ce = lv.ceilH[i];
    const zd = ZONES[lv.zone[i]];
    const layer = d.kind === "secret" ? zd.wall : d.kind === "normal" ? L.door : L.metal;
    if (d.kind === "secret") {
      // Bloco inteiro com a textura da parede (passagem secreta).
      dm.box(x0 + 0.002, fl, z0 + 0.002, x0 + S - 0.002, ce, z0 + S - 0.002, layer, false);
    } else if (d.axis === "x") {
      dm.box(x0, fl, z0 + S / 2 - 0.16, x0 + S, ce, z0 + S / 2 + 0.16, layer, false);
    } else {
      dm.box(x0 + S / 2 - 0.16, fl, z0, x0 + S / 2 + 0.16, ce, z0 + S, layer, false);
    }
    ranges.push({ first, count: dm.i.length - first });
  }

  return {
    vertices: new Float32Array(m.v),
    indices: new Uint32Array(m.i),
    doorVertices: new Float32Array(dm.v.length ? dm.v : new Array(LEVEL_VERTEX_FLOATS).fill(0)),
    doorIndices: new Uint32Array(dm.i.length ? dm.i : [0, 0, 0]),
    doorRanges: ranges,
  };
}

// ------------------------------------------------------------------
//  Iluminação estática: lista de luzes por célula (com visibilidade)
// ------------------------------------------------------------------
//  Para cada luz, visita as células no alcance e testa se a luz
//  ENXERGA a célula (linha de visão na grade até o centro e 4 pontos
//  internos). Cada célula guarda até 14 luzes (as mais fortes), em
//  2 x vec4<u32> (índices de 16 bits) + a zona (para o ambiente).
export function buildCellLights(lv: Level): Uint32Array<ArrayBuffer> {
  const S = CELL;
  const N = lv.W * lv.H;
  const lists: { i: number; w: number }[][] = Array.from({ length: N }, () => []);
  lv.lights.forEach((l, li) => {
    const r = Math.ceil(l.range / S);
    for (let cz = l.cz - r; cz <= l.cz + r; cz++) {
      for (let cx = l.cx - r; cx <= l.cx + r; cx++) {
        if (!lv.inBounds(cx, cz) || lv.type[lv.idx(cx, cz)] === Cell.SOLID) continue;
        const nx = Math.max(cx * S, Math.min(l.x, (cx + 1) * S));
        const nz = Math.max(cz * S, Math.min(l.z, (cz + 1) * S));
        const dist = Math.hypot(nx - l.x, nz - l.z);
        if (dist > l.range) continue;
        const pts = [
          [(cx + 0.5) * S, (cz + 0.5) * S],
          [cx * S + 0.3, cz * S + 0.3], [cx * S + S - 0.3, cz * S + 0.3],
          [cx * S + 0.3, cz * S + S - 0.3], [cx * S + S - 0.3, cz * S + S - 0.3],
        ];
        let vis = cx === l.cx && cz === l.cz;
        for (let k = 0; !vis && k < pts.length; k++) vis = lv.los(l.x, l.z, pts[k][0], pts[k][1], false);
        if (!vis) continue;
        const w = l.intensity * Math.pow(1 - dist / l.range, 2);
        lists[lv.idx(cx, cz)].push({ i: li, w });
      }
    }
  });
  const out = new Uint32Array(N * 8);
  for (let c = 0; c < N; c++) {
    const list = lists[c].sort((a, b) => b.w - a.w).slice(0, 14);
    const ids = new Array(14).fill(0xffff);
    list.forEach((e, k) => (ids[k] = e.i));
    for (let k = 0; k < 7; k++) out[c * 8 + k] = (ids[k * 2] & 0xffff) | ((ids[k * 2 + 1] & 0xffff) << 16);
    out[c * 8 + 7] = lv.zone[c];
  }
  return out;
}

// Luzes estáticas no formato da GPU (12 floats cada).
export function packLights(lv: Level): Float32Array<ArrayBuffer> {
  const d = new Float32Array(Math.max(1, lv.lights.length) * 12);
  lv.lights.forEach((l, i) => packLight(d, i * 12, l.x, l.y, l.z, l.range, l.color, l.enabled ? l.intensity : 0, l.flicker, l.speed, l.phase));
  return d;
}

export function packLight(
  d: Float32Array, o: number, x: number, y: number, z: number, range: number,
  c: [number, number, number], intensity: number, flicker = 0, speed = 0, phase = 0,
): void {
  d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = range;
  d[o + 4] = c[0]; d[o + 5] = c[1]; d[o + 6] = c[2]; d[o + 7] = intensity;
  d[o + 8] = flicker; d[o + 9] = speed; d[o + 10] = phase; d[o + 11] = 0;
}
