// ============================================================
//  Weapon — Arma e seus atributos (CPU)
// ------------------------------------------------------------
//  Sistema de armas MODULAR. Cada arma é definida por um config
//  (dados) + um estado de runtime (munição, cooldown, reload).
//  Adicionar uma arma nova = acrescentar uma entrada em WEAPONS.
//
//  Campos pedidos no §13:
//    damage, fireRate, magazineSize, ammoType, reloadTime,
//    pellets, spread  (+ automatic e range que o hitscan usa).
//
//  O DISPARO em si (raycast/dano) fica no main; aqui cuidamos só
//  da "mecânica da arma": cadência, munição e recarga.
// ============================================================

export type AmmoType = "pistol" | "shotgun" | "rifle";

export interface WeaponConfig {
  name: string;
  damage: number; // dano POR projétil (pellet)
  fireRate: number; // disparos por segundo
  magazineSize: number; // capacidade do pente
  ammoType: AmmoType; // munição consumida / reabastecida
  reloadTime: number; // segundos para recarregar
  pellets: number; // projéteis por disparo (shotgun > 1)
  spread: number; // dispersão angular (radianos)
  automatic: boolean; // true = dispara segurando o botão
  range: number; // alcance do hitscan
  maxReserve: number; // teto da munição de reserva (§15: munição limitada)
}

// Tabela de armas. Índice = tecla (1 = pistola, 2 = shotgun, 3 = rifle).
export const WEAPONS: WeaponConfig[] = [
  {
    name: "PISTOLA",
    damage: 18,
    fireRate: 5,
    magazineSize: 12,
    ammoType: "pistol",
    reloadTime: 1.0,
    pellets: 1,
    spread: 0.0,
    automatic: false,
    range: 60,
    maxReserve: 120,
  },
  {
    name: "SHOTGUN",
    damage: 10,
    fireRate: 1.2,
    magazineSize: 6,
    ammoType: "shotgun",
    reloadTime: 1.4,
    pellets: 8,
    spread: 0.09,
    automatic: false,
    range: 30,
    maxReserve: 60,
  },
  {
    name: "RIFLE",
    damage: 12,
    fireRate: 10,
    magazineSize: 30,
    ammoType: "rifle",
    reloadTime: 1.6,
    pellets: 1,
    spread: 0.02,
    automatic: true,
    range: 70,
    maxReserve: 240,
  },
];

export class Weapon {
  readonly config: WeaponConfig;
  magazine: number; // munição no pente
  reserve: number; // munição de reserva (aumenta com pickups na FASE 11)

  private cooldown = 0; // tempo até o próximo disparo
  reloading = false;
  private reloadTimer = 0;

  constructor(config: WeaponConfig, reserve: number) {
    this.config = config;
    this.magazine = config.magazineSize;
    this.reserve = reserve;
  }

  get canFire(): boolean {
    return this.cooldown <= 0 && !this.reloading && this.magazine > 0;
  }

  get isReloading(): boolean {
    return this.reloading;
  }

  // Consome 1 de munição e arma o cooldown. Chamado quando dispara.
  fire(): void {
    this.magazine -= 1;
    this.cooldown = 1 / this.config.fireRate;
  }

  // Inicia a recarga (se fizer sentido).
  beginReload(): void {
    if (this.reloading) return;
    if (this.magazine >= this.config.magazineSize) return;
    if (this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = this.config.reloadTime;
  }

  // Cancela a recarga (ao trocar de arma).
  cancelReload(): void {
    this.reloading = false;
    this.reloadTimer = 0;
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
  }

  private finishReload(): void {
    const need = this.config.magazineSize - this.magazine;
    const take = Math.min(need, this.reserve);
    this.magazine += take;
    this.reserve -= take;
    this.reloading = false;
  }
}
