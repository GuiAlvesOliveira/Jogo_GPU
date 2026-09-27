// ============================================================
//  Pickups.ts — Itens no chão: vida, munição, armas e chaves (CPU)
// ------------------------------------------------------------
//  Os itens usam os MODELOS reais (kit de primeiros socorros, pentes,
//  cartuchos, as próprias armas) girando e flutuando. As chaves são
//  cristais coloridos brilhantes (com luz própria).
// ============================================================

import type { GPUModel } from "../render/ModelGPU";
import type { RenderQueue } from "../render/Renderer";
import * as mat4 from "../core/math/mat4";
import type { Level } from "../world/Level";
import type { Player, KeyColor } from "./Player";
import type { Arsenal, AmmoType } from "./weapons/Weapons";
import { WEAPON_BY_ID } from "./weapons/Weapons";
import type { AudioManager } from "../audio/AudioManager";
import type { HUD } from "../ui/HUD";

export type PickupKind = "health" | "ammo" | "weapon" | "key";

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  active: boolean;
  amount: number;
  ammo?: AmmoType;
  weapon?: string;
  key?: KeyColor;
  model: GPUModel;
  scale: number;
  tilt: number; // rotação em X (deitar/levantar o modelo)
  phase: number;
}

export const KEY_COLOR: Record<KeyColor, [number, number, number]> = {
  red: [1, 0.15, 0.1],
  blue: [0.2, 0.45, 1],
  yellow: [1, 0.85, 0.2],
};
const KEY_NAME: Record<KeyColor, string> = { red: "VERMELHA", blue: "AZUL", yellow: "AMARELA" };

// Tabela de itens por caractere do mapa (também lida pela apresentação
// para calcular o balanceamento).
export interface PickupDef {
  kind: PickupKind;
  amount: number;
  ammo?: AmmoType;
  weapon?: string;
  key?: KeyColor;
  model: string;
  scale: number;
  tilt?: number;
}
export const PICKUP_TABLE: Record<string, PickupDef> = {
  h: { kind: "health", amount: 25, model: "i_medkit", scale: 0.75, tilt: -1.2 },
  m: { kind: "health", amount: 60, model: "i_medkit", scale: 1.15, tilt: -1.2 },
  "1": { kind: "ammo", amount: 24, ammo: "p45", model: "i_mag_pistol", scale: 2.2 },
  "2": { kind: "ammo", amount: 8, ammo: "shell", model: "i_shells", scale: 1.4 },
  "3": { kind: "ammo", amount: 30, ammo: "r556", model: "i_mag_rifle", scale: 1.7 },
  "4": { kind: "ammo", amount: 20, ammo: "r762", model: "i_mag_heavy", scale: 1.8 },
  S: { kind: "weapon", amount: 0, weapon: "mossberg", model: "w_mossberg", scale: 1.5 },
  W: { kind: "weapon", amount: 0, weapon: "m4", model: "w_m4", scale: 1.5 },
  Q: { kind: "weapon", amount: 0, weapon: "ak47", model: "w_ak47", scale: 1.5 },
  V: { kind: "weapon", amount: 0, weapon: "scar", model: "w_scar", scale: 1.5 },
  "!": { kind: "key", amount: 0, key: "red", model: "key", scale: 0.26 },
  $: { kind: "key", amount: 0, key: "blue", model: "key", scale: 0.26 },
  "&": { kind: "key", amount: 0, key: "yellow", model: "key", scale: 0.26 },
};

export class Pickups {
  list: Pickup[] = [];
  private readonly m = new Float32Array(16);

  constructor(private readonly models: Record<string, GPUModel>, private readonly keyModels: Record<KeyColor, GPUModel>) {}

  clear(): void {
    this.list = [];
  }

  // Cria um item a partir do caractere do mapa (ou de um drop).
  add(ch: string, x: number, z: number, level: Level): void {
    const def = PICKUP_TABLE[ch];
    if (!def) return;
    const model = def.key ? this.keyModels[def.key] : this.models[def.model];
    this.list.push({
      x, y: level.floorAt(x, z), z, active: true, phase: Math.random() * 6.28,
      kind: def.kind, amount: def.amount, ammo: def.ammo, weapon: def.weapon, key: def.key,
      model, scale: def.scale, tilt: def.tilt ?? 0,
    });
  }

  // Coleta: devolve as chaves pegas neste frame (para os gatilhos).
  update(player: Player, arsenal: Arsenal, audio: AudioManager, hud: HUD): KeyColor[] {
    const keys: KeyColor[] = [];
    for (const p of this.list) {
      if (!p.active) continue;
      const dx = player.pos[0] - p.x, dz = player.pos[2] - p.z;
      if (dx * dx + dz * dz > 1.4 * 1.4 || Math.abs(player.pos[1] - p.y) > 1.2) continue;
      if (p.kind === "health") {
        if (player.hp >= player.maxHp) continue;
        const got = player.heal(p.amount);
        hud.message(`+${got} de vida`, 1.6);
        audio.pickup("health");
      } else if (p.kind === "ammo") {
        const got = arsenal.addAmmo(p.ammo!, p.amount);
        if (got <= 0) continue;
        hud.message(`+${got} munição`, 1.4);
        audio.pickup("ammo");
      } else if (p.kind === "weapon") {
        const isNew = arsenal.give(p.weapon!);
        hud.message(isNew ? `Você pegou: ${WEAPON_BY_ID[p.weapon!].name}` : "+ munição", 2.4);
        audio.pickup("weapon");
        if (isNew) hud.showSlots();
      } else if (p.kind === "key") {
        player.keys.add(p.key!);
        hud.message(`CHAVE ${KEY_NAME[p.key!]} adquirida`, 3);
        audio.pickup("key");
        keys.push(p.key!);
      }
      p.active = false;
    }
    return keys;
  }

  submit(q: RenderQueue, time: number, level: Level, planes: Float32Array): void {
    const m = this.m;
    for (const p of this.list) {
      if (!p.active) continue;
      if (!mat4.sphereInFrustum(planes, p.x, p.y + 0.5, p.z, 1)) continue;
      const isKey = p.kind === "key";
      const bob = Math.sin(time * 2.2 + p.phase) * (isKey ? 0.12 : 0.06);
      const y = p.y + (isKey ? 1.1 : p.kind === "weapon" ? 0.45 : 0.3) + bob;
      const spin = time * (isKey ? 1.6 : 1.1) + p.phase;
      mat4.fromYawInto(m, 0, p.x, y, p.z, spin, p.scale);
      let mm: Float32Array = m;
      if (isKey) mm = mat4.multiply(mat4.multiply(m as mat4.Mat4, mat4.rotationX(0.6)), mat4.rotationZ(0.785));
      else if (p.tilt) mm = mat4.multiply(m as mat4.Mat4, mat4.rotationX(p.tilt));
      const { d, o } = q.mesh(p.model);
      d.set(mm, o);
      const glow = isKey ? 0.6 : p.kind === "weapon" ? 0.25 : 0.12;
      d.set([1, 1, 1, 1, glow * (0.7 + 0.3 * Math.sin(time * 4 + p.phase)), 0, 0.6, level.cellIndexAt(p.x, p.z)], o + 16);
    }
  }
}
