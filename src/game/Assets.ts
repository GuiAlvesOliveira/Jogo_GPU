// ============================================================
//  Assets.ts — Carrega modelos e texturas do jogo (CPU → GPU)
// ------------------------------------------------------------
//  Tudo vem de public/game (gerado por tools/assets): modelos .glb
//  (armas, itens, inimigos com esqueleto) e texturas .jpg/.png.
//  Os downloads acontecem em paralelo; `onProgress` alimenta a
//  barra de carregamento do menu.
// ============================================================

import { loadGLB } from "../assets/GLB";
import type { GLBModel } from "../assets/GLB";
import { loadBitmap } from "../gpu/textures";
import { SkeletonDef } from "../render/Animator";
import type { GPUModel } from "../render/ModelGPU";
import type { Renderer } from "../render/Renderer";
import { LAYERS } from "../levels/LevelData";
import type { EnemyAsset } from "./enemies/Enemies";

const BASE = "game/";
const STATIC = [
  "w_knife", "w_usp", "w_mossberg", "w_m4", "w_ak47", "w_scar",
  "i_medkit", "i_mag_pistol", "i_mag_rifle", "i_mag_heavy", "i_shells",
  "c_9mm", "c_556", "c_shell",
];
const SKINNED = ["e_zombie", "e_rat", "e_angler", "e_shade", "e_troll"];

export interface GameAssets {
  models: Record<string, GPUModel>;
  enemies: Record<string, EnemyAsset>;
  albedo: ImageBitmap[];
  normals: ImageBitmap[];
  keys: Record<"red" | "blue" | "yellow", GPUModel>;
}

export async function loadAssets(renderer: Renderer, onProgress: (f: number) => void): Promise<GameAssets> {
  let done = 0;
  const total = STATIC.length + SKINNED.length + LAYERS.length * 2 + 2;
  const tick = <T>(p: Promise<T>): Promise<T> =>
    p.then((v) => {
      done++;
      onProgress(done / total);
      return v;
    });

  const glbs = await Promise.all([...STATIC, ...SKINNED].map((n) => tick(loadGLB(`${BASE}models/${n}.glb`))));
  const byName: Record<string, GLBModel> = {};
  [...STATIC, ...SKINNED].forEach((n, i) => (byName[n] = glbs[i]));
  const [albedo, normals, atlasBmp, femaleBmp] = await Promise.all([
    Promise.all(LAYERS.map((l) => tick(loadBitmap(`${BASE}textures/L_${l}.jpg`)))),
    Promise.all(LAYERS.map((l) => tick(loadBitmap(`${BASE}textures/N_${l}.jpg`)))),
    tick(loadBitmap(`${BASE}textures/fx_atlas.png`)),
    tick(loadBitmap(`${BASE}textures/zombieFemaleA.png`)),
  ]);

  const up = renderer.uploader;
  const models: Record<string, GPUModel> = {};
  for (const n of STATIC) models[n] = up.upload(n, byName[n]);
  const enemies: Record<string, EnemyAsset> = {};
  for (const n of SKINNED) {
    enemies[n] = { model: up.upload(n, byName[n]), skel: new SkeletonDef(byName[n]) };
  }
  enemies.e_zombie.female = up.upload("e_zombie_f", byName.e_zombie, renderer.textures.fromBitmap(femaleBmp, true, "zombie-female"));
  renderer.setAtlas(renderer.textures.fromBitmap(atlasBmp, true, "fx-atlas"));
  const keys = {
    red: up.cube("key-red", [1, 0.15, 0.1, 1], [2.2, 0.25, 0.15]),
    blue: up.cube("key-blue", [0.15, 0.35, 1, 1], [0.3, 0.7, 2.4]),
    yellow: up.cube("key-yellow", [1, 0.85, 0.15, 1], [2.2, 1.8, 0.3]),
  };
  return { models, enemies, albedo, normals, keys };
}
