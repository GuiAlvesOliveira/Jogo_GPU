// ============================================================
//  Player — Estado do jogador (CPU)
// ------------------------------------------------------------
//  Guarda os atributos "de RPG" do jogador. A POSIÇÃO e a
//  orientação continuam na Camera (o corpo/olho do jogador); aqui
//  ficam vida e, futuramente, armadura, munição-base etc.
//
//  FASE 9: apenas HP. Armadura/power-ups entram depois (§16).
// ============================================================

export class Player {
  readonly maxHp = 100;
  hp = 100;

  // Armadura: absorve parte do dano. Sobe com pickups (§16, mais tarde).
  readonly maxArmor = 100;
  armor = 0;

  get isAlive(): boolean {
    return this.hp > 0;
  }

  // Aplica dano (limitado a 0). Retorna o HP resultante.
  takeDamage(amount: number): number {
    if (!this.isAlive) return this.hp;
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  // Restaura o jogador (usado ao reiniciar a fase).
  reset(): void {
    this.hp = this.maxHp;
    this.armor = 0;
  }
}
