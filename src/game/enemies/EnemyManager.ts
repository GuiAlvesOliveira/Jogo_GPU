// ============================================================
//  EnemyManager — Gerencia todos os inimigos do nível (CPU)
// ------------------------------------------------------------
//  Responsável por criar (spawn), atualizar e fornecer os dados
//  de renderização dos inimigos.
//
//  Renderização: cada inimigo vira uma INSTÂNCIA (mesma técnica do
//  mapa). Aqui montamos, por frame, o Float32Array intercalado
//  [model(16) | cor(4)] que o Renderer envia ao storage buffer
//  dinâmico e desenha com um único draw call.
//
//  FASE 6: spawn + render. `update()` ainda não move nada (IA=FASE 7).
// ============================================================

import { Level } from "../../levels/types";
import { Enemy, EnemyState } from "./Enemy";
import { CollisionSystem } from "../../collision/CollisionSystem";
import { Player } from "../Player";
import * as mat4 from "../../core/math/mat4";

const FLOATS_PER_INSTANCE = 20; // model (16) + cor (4)

// --- Parâmetros da IA ---
const ALERT_TIME = 0.4; // pausa de "percebeu você" antes de perseguir
const ATTACK_RATE = 1.0; // intervalo entre ataques (s)
const LOSE_INTEREST = 1.6; // multiplica detectionRadius: acima disso, desiste
const ATTACK_EXIT = 1.25; // multiplica attackRange: histerese p/ sair do ATTACK

export class EnemyManager {
  private enemies: Enemy[] = [];
  // Buffer reutilizado entre frames para evitar realocação (object pooling
  // do lado da CPU). Recriado só se o número de inimigos aumentar.
  private instanceData: Float32Array<ArrayBuffer> = new Float32Array(0);

  // Cria os inimigos a partir dos spawns do nível.
  spawnFromLevel(level: Level): void {
    const d = level.difficulty;
    const scale = { health: d.healthMul, damage: d.damageMul, speed: d.speedMul };
    this.enemies = level.enemySpawns.map(
      (s) => new Enemy(s.type, s.position[0], s.position[1], scale),
    );
  }

  get all(): readonly Enemy[] {
    return this.enemies;
  }

  get aliveCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.isAlive) n++;
    return n;
  }

  // Atualização por frame: máquina de estados da IA.
  //   playerPos — posição do jogador (para detecção/perseguição)
  //   collision — para os inimigos não atravessarem paredes
  //   player    — alvo do dano quando um inimigo ataca
  update(
    dt: number,
    playerPos: [number, number, number],
    collision: CollisionSystem,
    player: Player,
  ): void {
    for (const e of this.enemies) {
      if (!e.isAlive) continue;

      const a = e.archetype;
      // Vetor e distância (no plano XZ) até o jogador.
      const dx = playerPos[0] - e.position[0];
      const dz = playerPos[2] - e.position[2];
      const dist = Math.hypot(dx, dz);

      if (e.attackCooldown > 0) e.attackCooldown -= dt;

      switch (e.state) {
        case EnemyState.IDLE:
          // Percebeu o jogador dentro do raio de detecção?
          if (dist < a.detectionRadius) {
            e.state = EnemyState.ALERT;
            e.alertTimer = ALERT_TIME;
          }
          break;

        case EnemyState.ALERT:
          // Encara o jogador por um instante e então parte para cima.
          e.faceTowards(playerPos[0], playerPos[2]);
          e.alertTimer -= dt;
          if (dist > a.detectionRadius * LOSE_INTEREST) {
            e.state = EnemyState.IDLE;
          } else if (e.alertTimer <= 0) {
            e.state = EnemyState.CHASE;
          }
          break;

        case EnemyState.CHASE:
          e.faceTowards(playerPos[0], playerPos[2]);
          if (dist <= a.attackRange) {
            e.state = EnemyState.ATTACK;
            e.attackCooldown = 0; // ataca assim que chega
          } else if (dist > a.detectionRadius * LOSE_INTEREST) {
            e.state = EnemyState.IDLE; // perdeu o jogador
          } else {
            // Move-se em direção ao jogador, resolvendo colisão com o mapa.
            this.moveTowards(e, dx, dz, dist, dt, collision);
          }
          break;

        case EnemyState.ATTACK:
          e.faceTowards(playerPos[0], playerPos[2]);
          if (dist > a.attackRange * ATTACK_EXIT) {
            e.state = EnemyState.CHASE; // jogador se afastou
          } else if (e.attackCooldown <= 0) {
            // Golpe pronto: aplica dano (efetivo/escalado) e reinicia o cooldown.
            player.takeDamage(e.damage);
            e.attackCooldown = ATTACK_RATE;
          }
          break;

        case EnemyState.HURT:
          // Breve "flinch" ao levar dano; depois retoma a perseguição.
          e.faceTowards(playerPos[0], playerPos[2]);
          e.hurtTimer -= dt;
          if (e.hurtTimer <= 0) e.state = EnemyState.CHASE;
          break;

        default:
          break; // DEAD é filtrado por isAlive
      }
    }
  }

  // Desloca o inimigo em direção ao jogador (com colisão).
  private moveTowards(
    e: Enemy,
    dx: number,
    dz: number,
    dist: number,
    dt: number,
    collision: CollisionSystem,
  ): void {
    if (dist <= 0.0001) return;
    const inv = 1 / dist;
    const step = e.speed * dt;
    const mx = dx * inv * step;
    const mz = dz * inv * step;

    // Faixa vertical do inimigo (pés um pouco acima do chão).
    const half = e.archetype.size[1] / 2;
    const radius = e.archetype.size[0] / 2;
    const feet = e.position[1] - half + 0.05;
    const head = e.position[1] + half;
    collision.moveAndCollide(e.position, mx, mz, radius, feet, head);
  }

  // Monta os dados de instância dos inimigos VIVOS.
  // Retorna o array e a contagem (para pass.draw(..., count)).
  buildInstances(): { data: Float32Array<ArrayBuffer>; count: number } {
    const alive = this.enemies.filter((e) => e.isAlive);
    const needed = alive.length * FLOATS_PER_INSTANCE;
    if (this.instanceData.length < needed) {
      this.instanceData = new Float32Array(needed);
    }

    const data = this.instanceData;
    for (let i = 0; i < alive.length; i++) {
      const e = alive[i];
      const a = e.archetype;
      // model = translação(centro) * rotaçãoY(olhar) * escala(tamanho)
      const model = mat4.chain(
        mat4.translation(e.position[0], e.position[1], e.position[2]),
        mat4.rotationY(e.rotation),
        mat4.scaling(a.size[0], a.size[1], a.size[2]),
      );
      // Flash branco enquanto está no "flinch" (feedback de dano).
      const hurt = e.state === EnemyState.HURT;
      const base = i * FLOATS_PER_INSTANCE;
      data.set(model, base);
      data[base + 16] = hurt ? 1.0 : a.color[0];
      data[base + 17] = hurt ? 0.9 : a.color[1];
      data[base + 18] = hurt ? 0.9 : a.color[2];
      data[base + 19] = 1.0;
    }

    return { data, count: alive.length };
  }
}
