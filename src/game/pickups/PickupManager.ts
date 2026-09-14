// ============================================================
//  PickupManager — Gerencia os pickups do nível (CPU)
// ------------------------------------------------------------
//  Cria os pickups, detecta a coleta pelo jogador (distância no
//  plano XZ) e fornece as instâncias para renderização. Reaproveita
//  o MESMO buffer dinâmico dos inimigos (mesmo formato de instância),
//  combinado no main.
//
//  Efeito visual: os itens giram e "flutuam" (bob) via a matriz
//  model — animação barata calculada na CPU, aplicada na GPU.
// ============================================================

import { Level } from "../../levels/types";
import { Pickup } from "./Pickup";
import { WeaponManager } from "../weapons/WeaponManager";
import * as mat4 from "../../core/math/mat4";

const FLOATS_PER_INSTANCE = 20; // model (16) + cor (4)
const COLLECT_RADIUS = 1.2; // distância p/ coletar (jogador + item)
const SPIN_SPEED = 1.6; // rad/s
const BOB_AMPLITUDE = 0.12; // altura do "flutuar"

export class PickupManager {
  private pickups: Pickup[] = [];
  private instanceData: Float32Array<ArrayBuffer> = new Float32Array(0);

  spawnFromLevel(level: Level): void {
    this.pickups = level.ammoSpawns.map(
      (s) => new Pickup(s.ammoType, s.position[0], s.position[1], s.amount),
    );
  }

  // Verifica coleta. Ao pegar, adiciona munição (respeitando o teto)
  // e desativa o item. Retorna true se algo foi coletado neste frame.
  update(playerPos: [number, number, number], weapons: WeaponManager): boolean {
    let collected = false;
    for (const p of this.pickups) {
      if (!p.active) continue;
      const dx = playerPos[0] - p.position[0];
      const dz = playerPos[2] - p.position[2];
      if (Math.hypot(dx, dz) <= COLLECT_RADIUS) {
        const added = weapons.addAmmo(p.ammoType, p.amount);
        // Só consome o item se realmente aproveitou alguma munição
        // (evita "desperdiçar" pickup com a reserva já no máximo).
        if (added > 0) {
          p.active = false;
          collected = true;
        }
      }
    }
    return collected;
  }

  // Instâncias dos pickups ativos, com giro e flutuação em função do tempo.
  buildInstances(time: number): { data: Float32Array<ArrayBuffer>; count: number } {
    const active = this.pickups.filter((p) => p.active);
    const needed = active.length * FLOATS_PER_INSTANCE;
    if (this.instanceData.length < needed) this.instanceData = new Float32Array(needed);

    const data = this.instanceData;
    const bob = Math.sin(time * 2.4) * BOB_AMPLITUDE;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const model = mat4.chain(
        mat4.translation(p.position[0], p.baseY + bob, p.position[2]),
        mat4.rotationY(time * SPIN_SPEED),
        mat4.scaling(p.size[0], p.size[1], p.size[2]),
      );
      const base = i * FLOATS_PER_INSTANCE;
      data.set(model, base);
      data[base + 16] = p.color[0];
      data[base + 17] = p.color[1];
      data[base + 18] = p.color[2];
      data[base + 19] = 1.0;
    }
    return { data, count: active.length };
  }
}
