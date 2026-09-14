// ============================================================
//  Pickup — Item de munição no mapa (CPU)
// ------------------------------------------------------------
//  Um item coletável que flutua/gira no cenário. Ao ser pego,
//  entrega munição de um tipo ao jogador e some do mapa.
// ============================================================

import { AmmoType } from "../weapons/Weapon";

// Cor de cada tipo de munição (para identificar o item de longe).
const AMMO_COLOR: Record<AmmoType, [number, number, number]> = {
  pistol: [0.95, 0.85, 0.2], // amarelo
  shotgun: [0.95, 0.45, 0.15], // laranja
  rifle: [0.2, 0.85, 0.95], // ciano
};

export class Pickup {
  active = true;

  // position é o CENTRO do item; baseY é a altura em torno da qual flutua.
  position: [number, number, number];
  readonly baseY = 0.7;
  readonly ammoType: AmmoType;
  readonly amount: number;
  readonly size: [number, number, number] = [0.5, 0.5, 0.5];
  readonly color: [number, number, number];

  constructor(ammoType: AmmoType, x: number, z: number, amount: number) {
    this.ammoType = ammoType;
    this.amount = amount;
    this.color = AMMO_COLOR[ammoType];
    this.position = [x, this.baseY, z];
  }
}
