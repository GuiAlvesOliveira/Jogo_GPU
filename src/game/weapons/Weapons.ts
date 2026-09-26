// ============================================================
//  Weapons.ts — Arsenal: definições + inventário + mecânica (CPU)
// ------------------------------------------------------------
//  Cada arma é DADO (WeaponDef): dano, cadência, pente, munição,
//  dispersão, recuo, e como ela aparece na mão (view model).
//  A munição é por CALIBRE (compartilhada entre armas do mesmo tipo,
//  como no DOOM). A espingarda recarrega cartucho a cartucho (pode
//  interromper atirando).
//
//  O disparo em si (raios, dano, efeitos) é feito pelo Game, que
//  recebe um "evento de tiro" daqui.
// ============================================================

export type AmmoType = "p45" | "shell" | "r556" | "r762";

export const AMMO_NAME: Record<AmmoType, string> = { p45: ".45 ACP", shell: "CARTUCHOS 12", r556: "5.56 mm", r762: "7.62 mm" };
export const AMMO_MAX: Record<AmmoType, number> = { p45: 150, shell: 60, r556: 240, r762: 180 };

export interface WeaponDef {
  id: string;
  name: string;
  model: string;
  slot: number; // tecla 1..6
  ammo: AmmoType | null;
  damage: number;
  pellets: number;
  spread: number; // radianos
  rate: number; // disparos/s
  auto: boolean;
  mag: number;
  reload: number; // s (espingarda: por cartucho)
  perShell?: boolean;
  range: number;
  melee?: boolean;
  kick: number; // recuo vertical (rad)
  kickYaw: number;
  vmKick: number; // recuo visual (m)
  sound: string;
  casing: string | null;
  // View model: posição (m, espaço da câmera), rotação extra (rad) e escala.
  vmPos: [number, number, number];
  vmRot: [number, number, number];
  vmScale: number;
  muzzle: [number, number, number]; // ponta do cano no espaço do modelo
  flashSize: number;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "knife", name: "FACA DE COMBATE", model: "w_knife", slot: 1, ammo: null,
    damage: 55, pellets: 1, spread: 0, rate: 2.2, auto: true, mag: 0, reload: 0, range: 2.0, melee: true,
    kick: 0, kickYaw: 0, vmKick: 0, sound: "knife", casing: null,
    vmPos: [0.2, -0.17, -0.33], vmRot: [0.75, 0.55, -1.25], vmScale: 1.15, muzzle: [0, 0, -0.15], flashSize: 0,
  },
  {
    id: "usp", name: "USP .45", model: "w_usp", slot: 2, ammo: "p45",
    damage: 26, pellets: 1, spread: 0.012, rate: 4.5, auto: false, mag: 12, reload: 1.3, range: 70,
    kick: 0.025, kickYaw: 0.006, vmKick: 0.05, sound: "pistol", casing: "c_9mm",
    vmPos: [0.15, -0.145, -0.35], vmRot: [0, 0, 0], vmScale: 1.3, muzzle: [0, 0.042, -0.092], flashSize: 0.16,
  },
  {
    id: "mossberg", name: "MOSSBERG 500", model: "w_mossberg", slot: 3, ammo: "shell",
    damage: 12, pellets: 10, spread: 0.075, rate: 1.15, auto: false, mag: 6, reload: 0.48, perShell: true, range: 40,
    kick: 0.075, kickYaw: 0.015, vmKick: 0.13, sound: "shotgun", casing: "c_shell",
    vmPos: [0.17, -0.2, -0.38], vmRot: [0, 0, 0], vmScale: 1.0, muzzle: [0, 0.076, -0.455], flashSize: 0.34,
  },
  {
    id: "m4", name: "M4 CARBINE", model: "w_m4", slot: 4, ammo: "r556",
    damage: 19, pellets: 1, spread: 0.02, rate: 11, auto: true, mag: 30, reload: 1.9, range: 90,
    kick: 0.016, kickYaw: 0.008, vmKick: 0.035, sound: "rifle", casing: "c_556",
    vmPos: [0.2, -0.22, -0.46], vmRot: [0, 0, 0], vmScale: 1.0, muzzle: [0, 0.07, -0.423], flashSize: 0.22,
  },
  {
    id: "ak47", name: "AK-47", model: "w_ak47", slot: 5, ammo: "r762",
    damage: 28, pellets: 1, spread: 0.03, rate: 9.5, auto: true, mag: 30, reload: 2.2, range: 90,
    kick: 0.024, kickYaw: 0.012, vmKick: 0.045, sound: "ak", casing: "c_556",
    vmPos: [0.16, -0.19, -0.42], vmRot: [0, 0, 0], vmScale: 1.0, muzzle: [0, 0.08, -0.442], flashSize: 0.26,
  },
  {
    id: "scar", name: "SCAR-H", model: "w_scar", slot: 6, ammo: "r762",
    damage: 46, pellets: 1, spread: 0.008, rate: 5.5, auto: true, mag: 20, reload: 2.4, range: 110,
    kick: 0.034, kickYaw: 0.01, vmKick: 0.06, sound: "scar", casing: "c_556",
    vmPos: [0.18, -0.2, -0.44], vmRot: [0, 0, 0], vmScale: 1.0, muzzle: [0, 0.034, -0.402], flashSize: 0.28,
  },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export type WeaponPhase = "idle" | "reload" | "lower" | "raise";

export interface FireEvent {
  def: WeaponDef;
  melee: boolean;
}

export class Arsenal {
  owned: boolean[] = WEAPONS.map(() => false);
  mag: number[] = WEAPONS.map(() => 0);
  ammo: Record<AmmoType, number> = { p45: 0, shell: 0, r556: 0, r762: 0 };
  current = 0;
  phase: WeaponPhase = "idle";
  phaseTime = 0;
  phaseDur = 0;
  private next = -1;
  cooldown = 0;
  bloom = 0; // dispersão extra por tiro contínuo
  shotsFired = 0;
  shotsHit = 0;
  // Eventos para sons/efeitos (lidos pelo Game).
  justReloaded = false;
  justSwitched = false;
  shellLoaded = false;
  dryFire = false;

  get def(): WeaponDef {
    return WEAPONS[this.current];
  }

  reset(): void {
    this.owned = WEAPONS.map((w) => w.id === "knife" || w.id === "usp");
    this.mag = WEAPONS.map((w) => w.mag);
    this.ammo = { p45: 36, shell: 0, r556: 0, r762: 0 };
    this.current = 1;
    this.phase = "raise";
    this.phaseTime = 0;
    this.phaseDur = 0.35;
    this.cooldown = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
  }

  snapshot(): { owned: boolean[]; mag: number[]; ammo: Record<AmmoType, number>; current: number } {
    return { owned: [...this.owned], mag: [...this.mag], ammo: { ...this.ammo }, current: this.current };
  }

  restore(s: ReturnType<Arsenal["snapshot"]>): void {
    this.owned = [...s.owned];
    this.mag = [...s.mag];
    this.ammo = { ...s.ammo };
    this.current = s.current;
    this.phase = "raise";
    this.phaseTime = 0;
    this.phaseDur = 0.35;
  }

  // Pega uma arma no chão: devolve true se era nova.
  give(id: string): boolean {
    const i = WEAPONS.findIndex((w) => w.id === id);
    const w = WEAPONS[i];
    const isNew = !this.owned[i];
    this.owned[i] = true;
    if (w.ammo) this.addAmmo(w.ammo, isNew ? w.mag * 2 : w.mag);
    if (isNew) {
      this.mag[i] = w.mag;
      this.switchTo(i);
    }
    return isNew;
  }

  addAmmo(type: AmmoType, n: number): number {
    const before = this.ammo[type];
    this.ammo[type] = Math.min(AMMO_MAX[type], before + n);
    return this.ammo[type] - before;
  }

  switchTo(i: number): void {
    if (i < 0 || i >= WEAPONS.length || !this.owned[i]) return;
    if (i === this.current && this.phase !== "lower") return;
    this.next = i;
    if (this.phase !== "lower") {
      this.phase = "lower";
      this.phaseTime = 0;
      this.phaseDur = 0.16;
    }
  }

  cycle(dir: number): void {
    let i = this.next >= 0 ? this.next : this.current;
    for (let k = 0; k < WEAPONS.length; k++) {
      i = (i + dir + WEAPONS.length) % WEAPONS.length;
      if (this.owned[i]) break;
    }
    this.switchTo(i);
  }

  startReload(): void {
    const w = this.def;
    if (!w.ammo || this.phase !== "idle") return;
    if (this.mag[this.current] >= w.mag || this.ammo[w.ammo] <= 0) return;
    this.phase = "reload";
    this.phaseTime = 0;
    this.phaseDur = w.reload + (w.perShell ? 0.15 : 0);
  }

  // Avança o estado; devolve um evento de tiro se disparou neste frame.
  update(dt: number, trigger: boolean, triggerPressed: boolean, moving: boolean): FireEvent | null {
    this.justReloaded = this.justSwitched = this.shellLoaded = this.dryFire = false;
    this.cooldown -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.12);
    this.phaseTime += dt;
    const w = this.def;

    if (this.phase === "lower" && this.phaseTime >= this.phaseDur) {
      if (this.next >= 0) this.current = this.next;
      this.next = -1;
      this.phase = "raise";
      this.phaseTime = 0;
      this.phaseDur = 0.28;
      this.justSwitched = true;
      return null;
    }
    if (this.phase === "raise" && this.phaseTime >= this.phaseDur) {
      this.phase = "idle";
    }
    if (this.phase === "reload") {
      if (w.perShell) {
        // Um cartucho a cada `reload` segundos; atirar interrompe.
        if (trigger && this.mag[this.current] > 0) {
          this.phase = "idle";
        } else if (this.phaseTime >= w.reload) {
          this.phaseTime = 0;
          if (this.ammo[w.ammo!] > 0 && this.mag[this.current] < w.mag) {
            this.mag[this.current]++;
            this.ammo[w.ammo!]--;
            this.shellLoaded = true;
          }
          if (this.mag[this.current] >= w.mag || this.ammo[w.ammo!] <= 0) {
            this.phase = "idle";
            this.justReloaded = true;
          }
        }
      } else if (this.phaseTime >= this.phaseDur) {
        const need = w.mag - this.mag[this.current];
        const take = Math.min(need, this.ammo[w.ammo!]);
        this.mag[this.current] += take;
        this.ammo[w.ammo!] -= take;
        this.phase = "idle";
        this.justReloaded = true;
      }
    }
    if (this.phase !== "idle") return null;

    const want = w.auto ? trigger : triggerPressed;
    if (!want || this.cooldown > 0) return null;
    if (w.melee) {
      this.cooldown = 1 / w.rate;
      return { def: w, melee: true };
    }
    if (this.mag[this.current] <= 0) {
      if (triggerPressed) {
        if (this.ammo[w.ammo!] > 0) this.startReload();
        else this.dryFire = true;
      }
      this.cooldown = 0.25;
      return null;
    }
    this.mag[this.current]--;
    this.cooldown = 1 / w.rate;
    this.bloom = Math.min(0.05, this.bloom + w.spread * 0.35 + (moving ? 0.004 : 0));
    this.shotsFired += 1;
    return { def: w, melee: false };
  }

  // Dispersão efetiva (mirando reduz).
  spread(aiming: boolean, moving: boolean): number {
    const w = this.def;
    return (w.spread + this.bloom + (moving ? w.spread * 0.6 : 0)) * (aiming ? 0.45 : 1);
  }
}
