// ============================================================
//  types.ts — Estruturas de dados de um nível (CPU)
// ------------------------------------------------------------
//  O mapa é definido por DADOS, não por chamadas de render fixas.
//  Nesta FASE 4 um nível é essencialmente um conjunto de caixas
//  (Box) — chão, paredes e obstáculos. Nas próximas fases este
//  mesmo Level ganha enemySpawns, ammoSpawns, exit, etc.
// ============================================================

// Uma caixa alinhada aos eixos (AABB), descrita por centro + tamanho.
export interface Box {
  center: [number, number, number]; // centro (x, y, z)
  size: [number, number, number]; // dimensões totais (largura, altura, prof.)
  color: [number, number, number]; // cor base RGB (0..1)
}

import type { AmmoType } from "../game/weapons/Weapon";

// Arquétipos de inimigo disponíveis (mais tipos chegam na FASE 12).
export type EnemyType = "basic";

// Ponto de nascimento de um inimigo, no plano do chão (x, z).
export interface EnemySpawn {
  position: [number, number]; // x, z
  type: EnemyType;
}

// Pickup de munição espalhado pelo mapa (§15).
export interface AmmoSpawn {
  position: [number, number]; // x, z
  ammoType: AmmoType;
  amount: number;
}

// Saída da fase: fica "aberta" só quando todos os inimigos morrem.
export interface LevelExit {
  position: [number, number]; // x, z (no plano do chão)
}

// Multiplicadores de dificuldade aplicados aos inimigos da fase (§11).
export interface Difficulty {
  healthMul: number;
  damageMul: number;
  speedMul: number;
}

export interface Level {
  id: number;
  name: string;
  // Onde o jogador nasce e para onde olha (yaw em radianos).
  playerSpawn: { position: [number, number, number]; yaw: number };
  // Geometria estática do mapa (chão, paredes, obstáculos).
  boxes: Box[];
  // Onde os inimigos nascem.
  enemySpawns: EnemySpawn[];
  // Pickups de munição espalhados pelo mapa.
  ammoSpawns: AmmoSpawn[];
  // Saída da fase.
  exit: LevelExit;
  // Escalonamento de dificuldade aplicado aos inimigos.
  difficulty: Difficulty;
}
