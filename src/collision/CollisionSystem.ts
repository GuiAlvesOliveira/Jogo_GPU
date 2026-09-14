// ============================================================
//  CollisionSystem — Colisão jogador × mapa (CPU)
// ------------------------------------------------------------
//  Colisão é lógica de jogo → roda na CPU (como o documento pede).
//
//  Modelo:
//    - Jogador: um CÍRCULO de raio `radius` no plano XZ, com uma
//      faixa vertical [feet, head] (para saber a que altura ele
//      colide). Isso naturalmente ignora o CHÃO (cuja face de topo
//      fica no nível dos pés) e considera só paredes/obstáculos.
//    - Mapa: cada Box é uma AABB (caixa alinhada aos eixos).
//
//  Resolução POR EIXO (axis-separated):
//    1) aplica o movimento em X e empurra o jogador para fora de
//       qualquer parede sobreposta (na borda X);
//    2) faz o mesmo em Z.
//    Isso é simples, estável e permite "deslizar" ao longo das
//    paredes em vez de travar.
//
//  Técnica: expandimos a AABB pelo raio do jogador e o tratamos
//  como um ponto. Os cantos ficam "quadrados" (colisão levemente
//  antecipada nos cantos), o que é aceitável e comum em FPS.
// ============================================================

import { Box } from "../levels/types";

interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export class CollisionSystem {
  private readonly aabbs: AABB[];

  constructor(boxes: Box[]) {
    // Pré-calcula os limites (min/max) de cada caixa uma única vez.
    this.aabbs = boxes.map((b) => ({
      minX: b.center[0] - b.size[0] / 2,
      maxX: b.center[0] + b.size[0] / 2,
      minY: b.center[1] - b.size[1] / 2,
      maxY: b.center[1] + b.size[1] / 2,
      minZ: b.center[2] - b.size[2] / 2,
      maxZ: b.center[2] + b.size[2] / 2,
    }));
  }

  // A caixa intersecta a faixa vertical [feet, head] da entidade?
  private verticalOverlap(feet: number, head: number, box: AABB): boolean {
    return feet < box.maxY && head > box.minY;
  }

  // Move `position` por (dx, dz) resolvendo colisões contra o mapa.
  // Muta `position` no lugar.
  //   radius     — raio da entidade (círculo em XZ)
  //   feet, head — faixa vertical ocupada (para saber o que colide;
  //                escolhida acima do chão para não colidir com o piso)
  moveAndCollide(
    position: [number, number, number],
    dx: number,
    dz: number,
    radius: number,
    feet: number,
    head: number,
  ): void {
    // ---- Eixo X ----
    position[0] += dx;
    for (const box of this.aabbs) {
      if (!this.verticalOverlap(feet, head, box)) continue;
      const insideX = position[0] > box.minX - radius && position[0] < box.maxX + radius;
      const insideZ = position[2] > box.minZ - radius && position[2] < box.maxZ + radius;
      if (insideX && insideZ) {
        if (dx > 0) position[0] = box.minX - radius; // vindo da esquerda
        else if (dx < 0) position[0] = box.maxX + radius; // vindo da direita
      }
    }

    // ---- Eixo Z ----
    position[2] += dz;
    for (const box of this.aabbs) {
      if (!this.verticalOverlap(feet, head, box)) continue;
      const insideX = position[0] > box.minX - radius && position[0] < box.maxX + radius;
      const insideZ = position[2] > box.minZ - radius && position[2] < box.maxZ + radius;
      if (insideX && insideZ) {
        if (dz > 0) position[2] = box.minZ - radius; // vindo do sul
        else if (dz < 0) position[2] = box.maxZ + radius; // vindo do norte
      }
    }
  }
}
