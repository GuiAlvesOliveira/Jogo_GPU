// ============================================================
//  levelFactory.ts — Constrói um nível a partir do número da fase
// ------------------------------------------------------------
//  Em vez de um arquivo estático por fase, geramos o Level a partir
//  de um número. Isso permite PROGRESSÃO entre fases (FASE 13) e,
//  na FASE 14, aplicar o SCALING de dificuldade (mais inimigos,
//  mais vida/dano) só mexendo aqui — o resto do jogo não muda.
//
//  Por enquanto (FASE 13) a geometria do mapa é a mesma e os
//  inimigos são fixos; a FASE 14 troca `enemySpawns` por um cálculo
//  em função de `n`.
// ============================================================

import { Level, Box, EnemySpawn, AmmoSpawn, Difficulty } from "./types";

const WALL_H = 3;
const WALL_Y = WALL_H / 2;

// ---- CONFIG DE DIFICULDADE (tudo ajustável em um só lugar, §11) ----
const DIFFICULTY = {
  baseCount: 5, // inimigos na fase 1
  countPerLevel: 3, // + por fase: count = baseCount + (n-1)*countPerLevel
  // Multiplicadores por fase (aplicados como base^(n-1)):
  healthMul: 1.18,
  damageMul: 1.12,
  speedMul: 1.05,
  maxSpeedMul: 1.6, // teto do multiplicador de velocidade
};

// Pool de posições de spawn (áreas abertas do mapa). A contagem da fase
// pega as N primeiras; o teto de inimigos é o tamanho deste pool.
const SPAWN_POOL: [number, number][] = [
  [0, -8], [8, 3], [-8, -6], [8, -9], [-9, -4],
  [9, -4], [-8, 0], [8, 0], [-9, 4], [9, 4],
  [-8, 9], [8, -3], [0, -4], [-1, -9], [1, -9],
  [-10, -8], [10, -8], [-10, 8], [10, -1], [5, 6],
];

const FLOOR = [0.18, 0.18, 0.22] as [number, number, number];
const WALL = [0.45, 0.42, 0.5] as [number, number, number];
const PILLAR = [0.5, 0.3, 0.3] as [number, number, number];

// Geometria base do mapa (compartilhada entre as fases por enquanto).
function baseBoxes(): Box[] {
  return [
    // Chão (24 x 24), topo em y = 0.
    { center: [0, -0.5, 0], size: [24, 1, 24], color: FLOOR },
    // Paredes externas.
    { center: [0, WALL_Y, -12], size: [24, WALL_H, 1], color: WALL },
    { center: [0, WALL_Y, 12], size: [24, WALL_H, 1], color: WALL },
    { center: [-12, WALL_Y, 0], size: [1, WALL_H, 24], color: WALL },
    { center: [12, WALL_Y, 0], size: [1, WALL_H, 24], color: WALL },
    // Paredes internas (corredor).
    { center: [-3, WALL_Y, -3], size: [1, WALL_H, 12], color: WALL },
    { center: [3, WALL_Y, 3], size: [1, WALL_H, 12], color: WALL },
    // Pilares.
    { center: [6, WALL_Y, -6], size: [2, WALL_H, 2], color: PILLAR },
    { center: [-7, WALL_Y, 5], size: [2, WALL_H, 2], color: PILLAR },
    { center: [8, WALL_Y, 7], size: [2, WALL_H, 2], color: PILLAR },
  ];
}

// Quantos inimigos nesta fase (crescente, limitado ao pool).
function enemyCountFor(n: number): number {
  const count = DIFFICULTY.baseCount + (n - 1) * DIFFICULTY.countPerLevel;
  return Math.min(SPAWN_POOL.length, Math.max(1, count));
}

// Inimigos da fase: pega as N primeiras posições do pool.
function enemySpawnsFor(n: number): EnemySpawn[] {
  const count = enemyCountFor(n);
  return SPAWN_POOL.slice(0, count).map((position) => ({ position, type: "basic" as const }));
}

// Multiplicadores de dificuldade em função da fase.
function difficultyFor(n: number): Difficulty {
  const e = n - 1;
  return {
    healthMul: Math.pow(DIFFICULTY.healthMul, e),
    damageMul: Math.pow(DIFFICULTY.damageMul, e),
    speedMul: Math.min(DIFFICULTY.maxSpeedMul, Math.pow(DIFFICULTY.speedMul, e)),
  };
}

function ammoSpawnsFor(_n: number): AmmoSpawn[] {
  return [
    { position: [-9, -9], ammoType: "pistol", amount: 24 },
    { position: [9, -9], ammoType: "shotgun", amount: 8 },
    { position: [0, 6], ammoType: "rifle", amount: 40 },
    { position: [-9, 9], ammoType: "pistol", amount: 24 },
  ];
}

export function createLevel(n: number): Level {
  return {
    id: n,
    name: `Setor ${String(n).padStart(2, "0")}`,
    playerSpawn: { position: [0, 1.6, 9], yaw: 0 },
    boxes: baseBoxes(),
    enemySpawns: enemySpawnsFor(n),
    ammoSpawns: ammoSpawnsFor(n),
    // Saída no lado norte da sala (área aberta).
    exit: { position: [0, -10] },
    difficulty: difficultyFor(n),
  };
}
