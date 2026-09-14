// ============================================================
//  Enemy — Entidade de inimigo (CPU)
// ------------------------------------------------------------
//  Estrutura genérica de inimigo (§10 do documento). Nesta FASE 6
//  o inimigo apenas EXISTE e é desenhado (estado IDLE). A IA que
//  o faz detectar/perseguir/atacar chega na FASE 7; receber dano e
//  morrer, na FASE 8/9.
//
//  Cada arquétipo define os atributos base. Por ora só há o "basic";
//  os tipos "rápido" e "pesado" entram na FASE 12.
// ============================================================

import { EnemyType } from "../../levels/types";

// Máquina de estados do inimigo (comportamento na FASE 7).
export enum EnemyState {
  IDLE = "IDLE",
  ALERT = "ALERT",
  CHASE = "CHASE",
  ATTACK = "ATTACK",
  HURT = "HURT",
  DEAD = "DEAD",
}

// Atributos base de um arquétipo.
export interface EnemyArchetype {
  maxHealth: number;
  speed: number; // unidades por segundo
  damage: number; // dano por ataque (aplicado ao jogador na FASE 9)
  attackRange: number; // alcance do ataque corpo a corpo
  detectionRadius: number; // distância para perceber o jogador
  scoreValue: number; // pontos concedidos ao morrer (FASE 18)
  size: [number, number, number]; // dimensões da mesh
  color: [number, number, number]; // cor base
}

// Tabela de arquétipos. Fácil de estender na FASE 12.
export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetype> = {
  basic: {
    maxHealth: 30,
    speed: 2.2,
    damage: 8,
    attackRange: 1.6,
    detectionRadius: 12,
    scoreValue: 100,
    size: [0.7, 1.8, 0.7],
    color: [0.8, 0.16, 0.16],
  },
};

// Multiplicadores aplicados no spawn (vêm da dificuldade da fase, §11).
export interface EnemyScale {
  health: number;
  damage: number;
  speed: number;
}

const NO_SCALE: EnemyScale = { health: 1, damage: 1, speed: 1 };

export class Enemy {
  readonly type: EnemyType;
  readonly archetype: EnemyArchetype;

  // position é o CENTRO da mesh; y = altura/2 para "pisar" no chão (y=0).
  position: [number, number, number];
  rotation: number; // yaw, para onde o inimigo "olha"

  health: number;
  readonly maxHealth: number;
  // Stats EFETIVOS (já escalados pela dificuldade). O resto (alcance,
  // detecção, size, cor, score) permanece vindo do arquétipo.
  readonly speed: number;
  readonly damage: number;
  state: EnemyState;

  // Timers da IA (segundos).
  alertTimer = 0; // tempo restante no estado ALERT
  attackCooldown = 0; // tempo até poder atacar de novo
  hurtTimer = 0; // tempo restante do "flinch" ao levar dano

  constructor(type: EnemyType, x: number, z: number, scale: EnemyScale = NO_SCALE) {
    this.type = type;
    const a = ENEMY_ARCHETYPES[type];
    this.archetype = a;

    this.position = [x, a.size[1] / 2, z];
    this.rotation = 0;
    this.maxHealth = Math.round(a.maxHealth * scale.health);
    this.health = this.maxHealth;
    this.speed = a.speed * scale.speed;
    this.damage = a.damage * scale.damage;
    this.state = EnemyState.IDLE;
  }

  get isAlive(): boolean {
    return this.state !== EnemyState.DEAD && this.health > 0;
  }

  // Vira o inimigo para encarar um ponto (usado pela IA).
  faceTowards(x: number, z: number): void {
    const dx = x - this.position[0];
    const dz = z - this.position[2];
    // Mesma convenção da câmera: yaw=0 → -Z, forward=(sin,·,-cos).
    this.rotation = Math.atan2(dx, -dz);
  }

  // Aplica dano. Retorna true se ESTE golpe matou o inimigo (para
  // o chamador contabilizar score/efeitos na hora certa).
  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.state = EnemyState.DEAD;
      return true;
    }
    // Sobreviveu: leva um "flinch" e fica ciente do jogador.
    this.state = EnemyState.HURT;
    this.hurtTimer = 0.18;
    return false;
  }
}
