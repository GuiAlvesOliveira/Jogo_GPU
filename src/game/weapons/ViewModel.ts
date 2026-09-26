// ============================================================
//  ViewModel — A arma na mão do jogador (CPU calcula a matriz)
// ------------------------------------------------------------
//  A arma é um modelo 3D colocado NA FRENTE DA CÂMERA: montamos a
//  matriz no espaço da câmera (deslocamento + animações) e depois
//  levamos ao mundo com a inversa da view. Ela é desenhada num 2º
//  render pass com depth limpo (nunca entra na parede).
//
//  Animações procedurais (sem keyframes):
//    - balanço ao andar (acompanha o "bob" da câmera);
//    - atraso (sway) ao girar o mouse;
//    - recuo com mola ao atirar;
//    - abaixar/levantar ao trocar de arma; inclinar ao recarregar;
//    - arco do golpe de faca.
// ============================================================

import * as mat4 from "../../core/math/mat4";
import type { Arsenal } from "./Weapons";

export class ViewModel {
  private swayX = 0;
  private swayY = 0;
  private kick = 0;
  private kickVel = 0;
  private slash = 0;
  private bobT = 0;
  private aim = 0;
  flashTimer = 0;
  flashRot = 0;
  readonly world = new Float32Array(16);
  private readonly local = new Float32Array(16);

  fire(melee: boolean): void {
    if (melee) this.slash = 1;
    else {
      this.kickVel += 9;
      this.flashTimer = 0.055;
      this.flashRot = Math.random() * Math.PI * 2;
    }
  }

  update(dt: number, arsenal: Arsenal, lookDX: number, lookDY: number, bobAmount: number, walked: number, aiming: boolean): void {
    // Atraso ao virar (a arma "fica para trás").
    this.swayX += (-lookDX * 0.00035 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (lookDY * 0.00035 - this.swayY) * Math.min(1, dt * 8);
    this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX));
    this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY));
    // Mola do recuo.
    this.kickVel += (-this.kick * 220 - this.kickVel * 22) * dt;
    this.kick += this.kickVel * dt;
    this.slash = Math.max(0, this.slash - dt * 3.2);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.bobT = walked;
    this.aim += ((aiming ? 1 : 0) - this.aim) * Math.min(1, dt * 10);

    const w = arsenal.def;
    let [px, py, pz] = w.vmPos;
    let [rx, ry, rz] = w.vmRot;
    // Mirando: arma vai para o centro.
    px *= 1 - this.aim * 0.75;
    py += this.aim * 0.035;
    // Balanço de caminhada (figura de 8).
    const b = bobAmount * (1 - this.aim * 0.7);
    px += Math.cos(this.bobT * 1.9) * 0.012 * b + this.swayX;
    py += Math.abs(Math.sin(this.bobT * 1.9)) * 0.012 * b - 0.006 * b + this.swayY;
    // Recuo.
    pz += this.kick * w.vmKick;
    rx += this.kick * w.vmKick * 2.2;
    // Fases.
    const k = arsenal.phaseDur > 0 ? Math.min(1, arsenal.phaseTime / arsenal.phaseDur) : 1;
    if (arsenal.phase === "lower") py -= 0.3 * k;
    else if (arsenal.phase === "raise") {
      py -= 0.3 * (1 - k) * (1 - k);
      rx -= 0.3 * (1 - k);
    } else if (arsenal.phase === "reload") {
      const s = w.perShell ? 0.6 : Math.sin(Math.min(1, k) * Math.PI);
      py -= 0.06 * s;
      rz += 0.55 * s;
      rx += 0.25 * s;
      if (w.perShell) ry += Math.sin(arsenal.phaseTime / w.reload * Math.PI) * 0.12;
    }
    if (this.slash > 0) {
      // Faca: arco da direita para a esquerda.
      const t = 1 - this.slash;
      const s = Math.sin(t * Math.PI);
      px -= 0.2 * s;
      pz -= 0.12 * s;
      ry += 0.9 * s;
      rz -= 0.7 * s;
    }

    // local = T * Ry * Rx * Rz * S
    const T = mat4.translation(px, py, pz);
    const R = mat4.multiply(mat4.multiply(mat4.rotationY(ry), mat4.rotationX(rx)), mat4.rotationZ(rz));
    const S = mat4.scaling(w.vmScale, w.vmScale, w.vmScale);
    this.local.set(mat4.multiply(mat4.multiply(T, R), S));
  }

  // Leva a matriz local (espaço da câmera) para o mundo.
  computeWorld(invView: Float32Array): Float32Array {
    mat4.multiplyInto(this.world, invView, this.local);
    return this.world;
  }

  muzzleWorld(muzzle: [number, number, number]): [number, number, number] {
    return mat4.transformPoint(this.world, muzzle[0], muzzle[1], muzzle[2]);
  }
}
