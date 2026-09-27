// Uma instância do nível real (a mesma classe Level do jogo), criada sob demanda.

import { Level } from "../../world/Level";
import { MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS } from "../../levels/setorZero";

let lv: Level | null = null;

export function nivel(): Level {
  if (!lv) lv = new Level(MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS);
  return lv;
}
