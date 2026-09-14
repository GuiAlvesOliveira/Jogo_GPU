// ============================================================
//  RaycastSystem — Lança raios contra o mundo (CPU)
// ------------------------------------------------------------
//  Usado pelo tiro (hitscan): a partir da câmera, lançamos um ray
//  e descobrimos o PRIMEIRO inimigo atingido — desde que nenhuma
//  parede esteja na frente (oclusão).
//
//  Técnica: interseção ray × AABB pelo método dos "slabs". Para
//  cada eixo calculamos o intervalo [t1, t2] em que o ray está
//  dentro da faixa da caixa; a interseção dos três intervalos dá
//  a entrada (tmin) e a saída (tmax). Se tmin ≤ tmax e tmin ≥ 0,
//  houve acerto a distância tmin.
//
//  É matemática pequena e sequencial (poucas caixas por tiro),
//  então roda na CPU — condiz com "colisões/raycast na CPU".
// ============================================================

import { Box } from "../../levels/types";
import { Enemy } from "../enemies/Enemy";

export interface RayHit {
  enemy: Enemy;
  distance: number;
}

const EPS = 1e-6;

// Interseção ray × AABB. Retorna a distância de entrada (tmin) ou null.
function rayAABB(
  origin: [number, number, number],
  dir: [number, number, number],
  min: [number, number, number],
  max: [number, number, number],
): number | null {
  let tmin = 0;
  let tmax = Infinity;

  for (let axis = 0; axis < 3; axis++) {
    const o = origin[axis];
    const d = dir[axis];
    if (Math.abs(d) < EPS) {
      // Ray paralelo a este par de planos: só passa se já está dentro.
      if (o < min[axis] || o > max[axis]) return null;
    } else {
      const inv = 1 / d;
      let t1 = (min[axis] - o) * inv;
      let t2 = (max[axis] - o) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class RaycastSystem {
  // Encontra o inimigo vivo mais próximo atingido pelo ray, respeitando
  // a oclusão das paredes (`boxes`). Retorna null se nada for atingido.
  static raycast(
    origin: [number, number, number],
    dir: [number, number, number],
    maxDistance: number,
    enemies: readonly Enemy[],
    boxes: readonly Box[],
  ): RayHit | null {
    // 1) Distância até a parede mais próxima (limita o alcance efetivo).
    let wallDist = maxDistance;
    for (const b of boxes) {
      const min: [number, number, number] = [
        b.center[0] - b.size[0] / 2,
        b.center[1] - b.size[1] / 2,
        b.center[2] - b.size[2] / 2,
      ];
      const max: [number, number, number] = [
        b.center[0] + b.size[0] / 2,
        b.center[1] + b.size[1] / 2,
        b.center[2] + b.size[2] / 2,
      ];
      const t = rayAABB(origin, dir, min, max);
      if (t !== null && t < wallDist) wallDist = t;
    }

    // 2) Inimigo vivo mais próximo, mais perto que a parede.
    let best: RayHit | null = null;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const s = e.archetype.size;
      const min: [number, number, number] = [
        e.position[0] - s[0] / 2,
        e.position[1] - s[1] / 2,
        e.position[2] - s[2] / 2,
      ];
      const max: [number, number, number] = [
        e.position[0] + s[0] / 2,
        e.position[1] + s[1] / 2,
        e.position[2] + s[2] / 2,
      ];
      const t = rayAABB(origin, dir, min, max);
      if (t !== null && t <= wallDist && (best === null || t < best.distance)) {
        best = { enemy: e, distance: t };
      }
    }

    return best;
  }
}
