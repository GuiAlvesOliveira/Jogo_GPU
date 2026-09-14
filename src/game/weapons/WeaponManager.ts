// ============================================================
//  WeaponManager — Inventário e arma atual (CPU)
// ------------------------------------------------------------
//  Guarda todas as armas do jogador, qual está equipada, e expõe
//  operações de troca/recarga. Também recebe munição dos pickups
//  (FASE 11) via addAmmo().
// ============================================================

import { AmmoType, Weapon, WEAPONS } from "./Weapon";

// Reserva inicial de munição por arma (índices casam com WEAPONS).
const STARTING_RESERVE = [48, 24, 90];

export class WeaponManager {
  private readonly weapons: Weapon[];
  private index = 0;

  constructor() {
    this.weapons = WEAPONS.map((cfg, i) => new Weapon(cfg, STARTING_RESERVE[i] ?? 0));
  }

  get current(): Weapon {
    return this.weapons[this.index];
  }

  get currentIndex(): number {
    return this.index;
  }

  // Troca de arma (ignora índice inválido ou igual ao atual).
  switchTo(i: number): void {
    if (i < 0 || i >= this.weapons.length || i === this.index) return;
    this.weapons[this.index].cancelReload(); // recarga não sobrevive à troca
    this.index = i;
  }

  reloadCurrent(): void {
    this.current.beginReload();
  }

  update(dt: number): void {
    this.current.update(dt);
  }

  // Adiciona munição de um tipo à arma compatível, respeitando o teto.
  // Retorna quanto foi de fato adicionado (0 se já estava no máximo).
  addAmmo(type: AmmoType, amount: number): number {
    let added = 0;
    for (const w of this.weapons) {
      if (w.config.ammoType !== type) continue;
      const before = w.reserve;
      w.reserve = Math.min(w.config.maxReserve, w.reserve + amount);
      added += w.reserve - before;
    }
    return added;
  }

  // Restaura o inventário (ao reiniciar a fase).
  reset(): void {
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      w.cancelReload();
      w.magazine = w.config.magazineSize;
      w.reserve = STARTING_RESERVE[i] ?? 0;
    }
    this.index = 0;
  }
}
