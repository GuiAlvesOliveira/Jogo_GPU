// ============================================================
//  LevelData.ts — Tipos e tabelas do mapa (dados, CPU)
// ------------------------------------------------------------
//  O mapa em si (grade ASCII) está em setorZero.ts, gerado por
//  tools/level/build_map.py. Aqui ficam:
//    - a lista de CAMADAS de textura (mesma ordem de textures.py);
//    - as ZONAS (texturas, teto, ambiente e neblina de cada região);
//    - o formato dos GATILHOS de script (sustos/emboscadas).
// ============================================================

export const CELL = 2.5; // tamanho da célula (m)

// Camadas da texture array do mapa (arquivos L_<nome>.jpg / N_<nome>.jpg).
export const LAYERS = [
  "camp_wall", "camp_floor", "camp_ceil",
  "sewer_wall", "sewer_floor", "sewer_ceil", "water",
  "cata_wall", "cata_wall2", "cata_floor", "cata_ceil",
  "mine_wall", "mine_floor", "gold", "mine_ceil",
  "forge_wall", "forge_floor", "lava", "forge_ceil",
  "door", "crate", "metal", "tile", "cata_wall3",
] as const;
export type LayerName = (typeof LAYERS)[number];
export const L = Object.fromEntries(LAYERS.map((n, i) => [n, i])) as Record<LayerName, number>;

// Propriedades por camada: [emissivo, rolagem U, rolagem V, especular].
export function layerInfo(): Float32Array<ArrayBuffer> {
  const info = new Float32Array(32 * 4);
  for (let i = 0; i < LAYERS.length; i++) info.set([0, 0, 0, 0.18], i * 4);
  const set = (n: LayerName, v: [number, number, number, number]) => info.set(v, L[n] * 4);
  set("water", [0.02, 0.035, 0.0, 0.9]);
  set("lava", [1.35, 0.01, 0.004, 0.25]);
  set("sewer_wall", [0, 0, 0, 0.4]);
  set("sewer_floor", [0, 0, 0, 0.45]);
  set("metal", [0, 0, 0, 0.6]);
  set("gold", [0.06, 0, 0, 0.9]);
  set("tile", [0, 0, 0, 0.35]);
  set("cata_floor", [0, 0, 0, 0.3]);
  return info;
}

export interface ZoneDef {
  key: string;
  name: string;
  wall: number;
  wallAlt: number;
  floor: number;
  floorAlt: number;
  ceil: number;
  column: number;
  ceilH: number;
  ambient: [number, number, number];
  fog: [number, number, number];
  fogDensity: number;
  musicBase: number; // nota do drone ambiente (Hz)
}

export const ZONES: ZoneDef[] = [
  {
    key: "c", name: "ACAMPAMENTO DE ESCAVAÇÃO",
    wall: L.camp_wall, wallAlt: L.camp_wall, floor: L.camp_floor, floorAlt: L.metal, ceil: L.camp_ceil, column: L.crate,
    ceilH: 3.0, ambient: [0.06, 0.05, 0.04], fog: [0.012, 0.01, 0.008], fogDensity: 0.04, musicBase: 55,
  },
  {
    key: "s", name: "ESGOTOS",
    wall: L.sewer_wall, wallAlt: L.sewer_wall, floor: L.sewer_floor, floorAlt: L.tile, ceil: L.sewer_ceil, column: L.sewer_wall,
    ceilH: 3.4, ambient: [0.03, 0.042, 0.04], fog: [0.006, 0.011, 0.011], fogDensity: 0.05, musicBase: 49,
  },
  {
    key: "k", name: "CATACUMBAS",
    wall: L.cata_wall, wallAlt: L.cata_wall3, floor: L.cata_floor, floorAlt: L.cata_floor, ceil: L.cata_ceil, column: L.cata_wall2,
    ceilH: 3.0, ambient: [0.022, 0.022, 0.032], fog: [0.004, 0.004, 0.009], fogDensity: 0.06, musicBase: 41,
  },
  {
    key: "f", name: "A FORJA",
    wall: L.forge_wall, wallAlt: L.forge_wall, floor: L.forge_floor, floorAlt: L.metal, ceil: L.forge_ceil, column: L.forge_wall,
    ceilH: 4.5, ambient: [0.075, 0.032, 0.015], fog: [0.035, 0.012, 0.004], fogDensity: 0.03, musicBase: 36.7,
  },
  {
    key: "m", name: "MINAS PROFUNDAS",
    wall: L.mine_wall, wallAlt: L.gold, floor: L.mine_floor, floorAlt: L.mine_floor, ceil: L.mine_ceil, column: L.crate,
    ceilH: 3.6, ambient: [0.036, 0.031, 0.026], fog: [0.009, 0.008, 0.006], fogDensity: 0.04, musicBase: 46.2,
  },
];
export const ZONE_INDEX: Record<string, number> = Object.fromEntries(ZONES.map((z, i) => [z.key, i]));

// ---- Gatilhos de script (formato gerado pelo build_map.py) ----
export interface TriggerDef {
  name: string;
  rect: [number, number, number, number]; // células x0, y0, x1, y1
  once?: boolean;
  on?: "key_red" | "key_blue" | "key_yellow"; // dispara ao pegar a chave (não ao entrar)
  on_enter?: boolean;
  spawn?: [string, number, number][]; // [tipo, x, y]
  message?: string;
  sound?: string;
  lights_off?: string; // "s_cistern" (região) ou chave de zona
  close_door?: [number, number];
  wake?: [number, number, number, number];
  boss?: boolean;
}

// Tipos de célula.
export enum Cell {
  SOLID = 0,
  FLOOR = 1,
  WATER = 2,
  LAVA = 3,
  PLATFORM = 4,
  COLUMN = 5,
  CRATE = 6,
  BRAZIER = 7,
  DOOR = 8,
  SECRET = 9,
  ELEVATOR = 10,
}
