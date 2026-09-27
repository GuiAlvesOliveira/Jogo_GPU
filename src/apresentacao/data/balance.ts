// ============================================================
//  balance.ts — métricas de balanceamento calculadas dos DADOS
//  reais do jogo (as mesmas tabelas que o jogo usa em runtime)
// ------------------------------------------------------------
//  Nada aqui é digitado à mão: inimigos, armas, itens, mapa e
//  gatilhos são importados de src/game e src/levels. Se o jogo
//  mudar, os gráficos da apresentação mudam junto.
// ============================================================

import { ENEMY_DEFS, KIND_BY_CHAR, type EnemyKind } from "../../game/enemies/Enemies";
import { WEAPONS, AMMO_MAX, type AmmoType, type WeaponDef } from "../../game/weapons/Weapons";
import { PICKUP_TABLE } from "../../game/Pickups";
import { DIFFICULTY_MULT } from "../../game/Game";
import { MAP_ROWS, ZONE_ROWS, TRIGGERS } from "../../levels/setorZero";

export type Diff = "easy" | "normal" | "hard";
export const DIFFS: Diff[] = ["easy", "normal", "hard"];
export const DIFF_LABEL: Record<Diff, string> = { easy: "Fácil", normal: "Normal", hard: "Difícil" };
export const DIFF_MULT = DIFFICULTY_MULT;

export const KINDS: EnemyKind[] = ["zombie", "runner", "corpse", "rat", "angler", "shade", "troll", "king"];
export const KIND_LABEL: Record<EnemyKind, string> = {
  zombie: "Zumbi",
  runner: "Corredora",
  corpse: "Zumbi caído",
  rat: "Ratazana",
  angler: "Abissal",
  shade: "Sombra",
  troll: "Troll",
  king: "Rei Troll",
};

// Grupos para gráficos empilhados (no máximo 4 séries).
export const GROUPS = ["Zumbis", "Ratazanas", "Abissal e Sombra", "Trolls"] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_OF: Record<EnemyKind, Group> = {
  zombie: "Zumbis",
  runner: "Zumbis",
  corpse: "Zumbis",
  rat: "Ratazanas",
  angler: "Abissal e Sombra",
  shade: "Abissal e Sombra",
  troll: "Trolls",
  king: "Trolls",
};

// Trechos da rota (a arena do chefe fica dentro da zona da forja).
export const SEGMENTS = [
  { key: "c", name: "Acampamento" },
  { key: "s", name: "Esgotos" },
  { key: "k", name: "Catacumbas" },
  { key: "f", name: "Forja" },
  { key: "m", name: "Minas" },
  { key: "A", name: "Arena" },
] as const;
export type SegKey = (typeof SEGMENTS)[number]["key"];

export function segOf(cx: number, cz: number): SegKey {
  const z = ZONE_ROWS[cz]?.[cx] ?? "c";
  if (z === "f" && cz >= 27) return "A";
  return z as SegKey;
}

export interface EnemyEntry {
  kind: EnemyKind;
  cx: number;
  cz: number;
  seg: SegKey;
  origem: "mapa" | "gatilho" | "chefe";
  gatilho?: string;
}

export const ENEMIES: EnemyEntry[] = [];
MAP_ROWS.forEach((row, cz) => {
  for (let cx = 0; cx < row.length; cx++) {
    const k = KIND_BY_CHAR[row[cx]];
    if (k) ENEMIES.push({ kind: k, cx, cz, seg: segOf(cx, cz), origem: "mapa" });
  }
});
for (const t of TRIGGERS) {
  for (const [ch, cx, cz] of t.spawn ?? []) {
    const k = KIND_BY_CHAR[ch];
    if (k) ENEMIES.push({ kind: k, cx, cz, seg: segOf(cx, cz), origem: "gatilho", gatilho: t.name });
  }
}
// O Rei chama 2 ondas de 4 (sombra ou corredora, 50% cada): valor esperado.
const ADD_SPOTS: [number, number][] = [[41, 31], [48, 31], [41, 38], [48, 38]];
for (let wave = 0; wave < 2; wave++) {
  ADD_SPOTS.forEach(([cx, cz], i) => ENEMIES.push({ kind: (i + wave) % 2 ? "shade" : "runner", cx, cz, seg: "A", origem: "chefe" }));
}

export interface PickupEntry {
  ch: string;
  cx: number;
  cz: number;
  seg: SegKey;
}
export const PICKUPS: PickupEntry[] = [];
MAP_ROWS.forEach((row, cz) => {
  for (let cx = 0; cx < row.length; cx++) if (PICKUP_TABLE[row[cx]]) PICKUPS.push({ ch: row[cx], cx, cz, seg: segOf(cx, cz) });
});

export const AMMO_TYPES: AmmoType[] = ["p45", "shell", "r556", "r762"];
export const AMMO_LABEL: Record<AmmoType, string> = { p45: ".45 ACP", shell: "Cartucho 12", r556: "5.56 mm", r762: "7.62 mm" };
// Arma de referência para converter munição em dano (7.62: a AK-47, estimativa conservadora).
export const AMMO_WEAPON: Record<AmmoType, string> = { p45: "usp", shell: "mossberg", r556: "m4", r762: "ak47" };
export const WEAPON_BY = Object.fromEntries(WEAPONS.map((w) => [w.id, w])) as Record<string, WeaponDef>;

export function damagePerRound(a: AmmoType): number {
  const w = WEAPON_BY[AMMO_WEAPON[a]];
  return w.damage * w.pellets;
}

// Munição total disponível numa partida (inicial + chão + armas + drops esperados).
export interface AmmoBudget {
  type: AmmoType;
  inicial: number;
  chao: number;
  armas: number;
  drops: number;
  total: number;
  max: number;
  dano: number;
}

const ZOMBIE_KILLS = ENEMIES.filter((e) => e.kind === "zombie" || e.kind === "runner" || e.kind === "corpse").length;
export const AMMO: AmmoBudget[] = AMMO_TYPES.map((type) => {
  const inicial = type === "p45" ? 36 + 12 : 0;
  let chao = 0, armas = 0;
  for (const p of PICKUPS) {
    const d = PICKUP_TABLE[p.ch];
    if (d.kind === "ammo" && d.ammo === type) chao += d.amount;
    if (d.kind === "weapon" && WEAPON_BY[d.weapon!].ammo === type) armas += WEAPON_BY[d.weapon!].mag * 2;
  }
  // Zumbis: 30% de chance de soltar munição (55% .45 ×24, 45% cartuchos ×8).
  const drops = type === "p45" ? ZOMBIE_KILLS * 0.3 * 0.55 * 24 : type === "shell" ? ZOMBIE_KILLS * 0.3 * 0.45 * 8 : 0;
  const total = inicial + chao + armas + drops;
  return { type, inicial, chao, armas, drops, total, max: AMMO_MAX[type], dano: total * damagePerRound(type) };
});

export function enemyHp(kind: EnemyKind, d: Diff): number {
  return Math.round(ENEMY_DEFS[kind].hp * DIFF_MULT[d].hp);
}
export function enemyDmg(kind: EnemyKind, d: Diff): number {
  return ENEMY_DEFS[kind].damage * DIFF_MULT[d].dmg;
}

export const HP_POOL: Record<Diff, number> = Object.fromEntries(DIFFS.map((d) => [d, ENEMIES.reduce((s, e) => s + enemyHp(e.kind, d), 0)])) as Record<Diff, number>;
export const AMMO_DAMAGE = AMMO.reduce((s, a) => s + a.dano, 0);

export const HEAL = PICKUPS.reduce((s, p) => s + (PICKUP_TABLE[p.ch].kind === "health" ? PICKUP_TABLE[p.ch].amount : 0), 0);
export const KITS = { small: PICKUPS.filter((p) => p.ch === "h").length, big: PICKUPS.filter((p) => p.ch === "m").length };

// ------------------------------------------------ combate (fórmulas)
export function canHeadshot(kind: EnemyKind): boolean {
  return kind !== "rat";
}

export interface TTK {
  shots: number;
  reloads: number;
  t: number;
}

// Tiros e tempo para matar, acertando tudo (espingarda à queima-roupa).
export function ttk(w: WeaponDef, hp: number, head: boolean): TTK {
  const per = w.damage * w.pellets * (head && !w.melee ? 2.1 : 1);
  const shots = Math.ceil(hp / per);
  const reloads = w.mag > 0 ? Math.floor((shots - 1) / w.mag) : 0;
  const reloadTime = w.perShell ? w.mag * w.reload : w.reload;
  return { shots, reloads, t: (shots - 1) / w.rate + reloads * reloadTime };
}

export function dps(w: WeaponDef): { burst: number; sustained: number } {
  const burst = w.damage * w.pellets * w.rate;
  if (!w.mag) return { burst, sustained: burst };
  const reloadTime = w.perShell ? w.mag * w.reload : w.reload;
  const magTime = w.mag / w.rate;
  return { burst, sustained: (w.mag * w.damage * w.pellets) / (magTime + reloadTime) };
}

// Golpes para derrubar o jogador com 100 de vida.
export function hitsToDie(kind: EnemyKind, d: Diff, hp = 100): number {
  return Math.ceil(hp / enemyDmg(kind, d));
}

// ------------------------------------------------- por trecho da rota
export interface SegStats {
  key: SegKey;
  name: string;
  byGroup: Record<Group, number>;
  count: number;
  hp: number; // normal
  heal: number;
  ammoDmg: number;
}

export const SEG_STATS: SegStats[] = SEGMENTS.map((s) => {
  const es = ENEMIES.filter((e) => e.seg === s.key);
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  es.forEach((e) => byGroup[GROUP_OF[e.kind]]++);
  const ps = PICKUPS.filter((p) => p.seg === s.key);
  let heal = 0, ammoDmg = 0;
  for (const p of ps) {
    const d = PICKUP_TABLE[p.ch];
    if (d.kind === "health") heal += d.amount;
    if (d.kind === "ammo") ammoDmg += d.amount * damagePerRound(d.ammo!);
    if (d.kind === "weapon") {
      const w = WEAPON_BY[d.weapon!];
      ammoDmg += w.mag * 2 * damagePerRound(w.ammo!);
    }
  }
  return { key: s.key, name: s.name, byGroup, count: es.length, hp: es.reduce((a, e) => a + enemyHp(e.kind, "normal"), 0), heal, ammoDmg };
});

// ------------------------------- a fórmula das fases antigas (fase 14)
export const OLD_SCALING = [1, 2, 3, 4, 5].map((n) => {
  const count = Math.min(20, 5 + (n - 1) * 3);
  const hp = 30 * Math.pow(1.18, n - 1);
  const dmg = 8 * Math.pow(1.12, n - 1);
  const speed = 2.2 * Math.pow(1.05, n - 1);
  return { n, count, hp, dmg, speed, pool: count * hp };
});

export const COUNTS: Record<EnemyKind, { mapa: number; gatilho: number; chefe: number }> = Object.fromEntries(
  KINDS.map((k) => [
    k,
    {
      mapa: ENEMIES.filter((e) => e.kind === k && e.origem === "mapa").length,
      gatilho: ENEMIES.filter((e) => e.kind === k && e.origem === "gatilho").length,
      chefe: ENEMIES.filter((e) => e.kind === k && e.origem === "chefe").length,
    },
  ]),
) as Record<EnemyKind, { mapa: number; gatilho: number; chefe: number }>;
