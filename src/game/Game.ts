// ============================================================
//  Game.ts — Orquestra o jogo (CPU): estados, sistemas e o frame
// ------------------------------------------------------------
//  update(dt): entrada → jogador → portas → gatilhos (sustos) →
//  armas (tiros por raycast) → inimigos (IA) → itens → efeitos →
//  som → HUD.
//  render():   monta a fila do Renderer (mapa/portas, itens,
//  personagens, efeitos, chamas, arma na mão) + parâmetros do frame
//  (câmera, lanterna, neblina, luzes dinâmicas) e manda desenhar.
// ============================================================

import * as mat4 from "../core/math/mat4";
import { InputManager } from "../core/InputManager";
import { Renderer } from "../render/Renderer";
import type { FrameParams } from "../render/Renderer";
import { Level } from "../world/Level";
import type { Door } from "../world/Level";
import { buildLevelMesh, buildCellLights, packLights } from "../world/LevelMesh";
import { MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS } from "../levels/setorZero";
import { CELL, Cell, ZONES, layerInfo } from "../levels/LevelData";
import type { TriggerDef } from "../levels/LevelData";
import { Player } from "./Player";
import type { KeyColor } from "./Player";
import { Arsenal, WEAPONS } from "./weapons/Weapons";
import type { FireEvent } from "./weapons/Weapons";
import { ViewModel } from "./weapons/ViewModel";
import { EnemyManager, ENEMY_DEFS, KIND_BY_CHAR, St } from "./enemies/Enemies";
import type { Enemy, EnemyEvents } from "./enemies/Enemies";
import { Pickups, KEY_COLOR } from "./Pickups";
import { Effects, FX, UV, UV_BOLT } from "./effects/Effects";
import type { GameAssets } from "./Assets";
import { AudioManager } from "../audio/AudioManager";
import { HUD } from "../ui/HUD";
import { Automap } from "../ui/Automap";

export type GameMode = "menu" | "playing" | "paused" | "dead" | "victory";
export type Difficulty = "easy" | "normal" | "hard";

// Multiplicadores por dificuldade (vida e dano dos inimigos).
export const DIFFICULTY_MULT: Record<Difficulty, { hp: number; dmg: number }> = {
  easy: { hp: 0.8, dmg: 0.55 },
  normal: { hp: 1.0, dmg: 1.0 },
  hard: { hp: 1.25, dmg: 1.45 },
};
const DIFF = DIFFICULTY_MULT;

interface Checkpoint {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  arsenal: ReturnType<Arsenal["snapshot"]>;
  keys: KeyColor[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Cor da neblina já como aparece na tela (mesmo tone mapping + gama do
// shader): usada no "clear", para o que passa do plano distante não
// virar um buraco preto.
function displayFog(c: [number, number, number], exposure: number): [number, number, number] {
  const aces = (x: number) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
  return [0, 1, 2].map((i) => Math.pow(aces(c[i] * exposure), 1 / 2.2)) as [number, number, number];
}

export class Game {
  mode: GameMode = "menu";
  readonly level: Level;
  readonly player = new Player();
  readonly arsenal = new Arsenal();
  readonly vm = new ViewModel();
  readonly enemies: EnemyManager;
  readonly pickups: Pickups;
  readonly fx = new Effects();
  readonly hud = new HUD();
  readonly automap: Automap;
  difficulty: Difficulty = "normal";
  time = 0;
  playTime = 0;
  deaths = 0;
  secretsFound = 0;
  secretsTotal = 0;
  private field: Float32Array;
  private fieldTimer = 0;
  private fieldCell = -1;
  private fired = new Set<string>();
  private checkpoint: Checkpoint | null = null;
  private zoneSeen = new Set<number>();
  private currentZone = -1;
  private boss: Enemy | null = null;
  private bossDead = false;
  private lightData: Float32Array<ArrayBuffer>;
  private lookDX = 0;
  private lookDY = 0;
  private scareFlicker = 0;
  private deathTimer = 0;
  private events: EnemyEvents;
  onModeChange: ((m: GameMode) => void) | null = null;

  constructor(
    private readonly renderer: Renderer,
    private readonly assets: GameAssets,
    private readonly input: InputManager,
    readonly audio: AudioManager,
  ) {
    this.level = new Level(MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS);
    this.field = new Float32Array(this.level.W * this.level.H);
    this.enemies = new EnemyManager(assets.enemies);
    this.pickups = new Pickups(assets.models, assets.keys);
    this.automap = new Automap(this.level);
    this.secretsTotal = this.level.doors.filter((d) => d.kind === "secret").length;

    // Envia o mapa para a GPU (uma vez).
    const geo = buildLevelMesh(this.level);
    this.lightData = packLights(this.level);
    renderer.setLevel({
      ...geo,
      albedo: assets.albedo,
      normals: assets.normals,
      layerInfo: layerInfo(),
      staticLights: this.lightData,
      cellLights: buildCellLights(this.level),
      gridW: this.level.W,
      gridH: this.level.H,
      cellSize: CELL,
    });

    this.events = {
      onAttackHit: (e, dmg) => this.hurtPlayer(dmg, e.pos[0], e.pos[2]),
      onDeath: (e) => this.onEnemyDeath(e),
      openDoorAt: (cx, cz, byEnemy) => this.openDoor(cx, cz, byEnemy),
      spawnBossAdds: (e) => this.bossAdds(e),
    };
    this.fx.onShellLand = (x, y, z) => this.audio.casing(x, y, z);
  }

  private setMode(m: GameMode): void {
    this.mode = m;
    this.onModeChange?.(m);
  }

  // ---------------------------------------------------------- partida
  newGame(diff: Difficulty): void {
    this.difficulty = diff;
    const lv = this.level;
    for (const d of lv.doors) {
      d.open = d.target = 0;
      d.locked = false;
    }
    lv.lights.forEach((l) => (l.enabled = true));
    this.renderer.writeStaticLights(0, packLights(lv));
    this.fired.clear();
    this.zoneSeen.clear();
    this.currentZone = -1;
    this.fx.clear();
    this.enemies.clear();
    this.enemies.hpMul = DIFF[diff].hp;
    this.enemies.dmgMul = DIFF[diff].dmg;
    this.pickups.clear();
    this.boss = null;
    this.bossDead = false;
    this.secretsFound = 0;
    this.deaths = 0;
    this.playTime = 0;
    this.automap.seen.fill(0);
    for (const s of lv.spawns) {
      const kind = KIND_BY_CHAR[s.ch];
      if (kind) {
        const e = this.enemies.spawn(kind, s.x, s.z, lv);
        if (kind === "king") this.boss = e;
      } else this.pickups.add(s.ch, s.x, s.z, lv);
    }
    this.player.hp = this.player.maxHp;
    this.player.keys.clear();
    this.player.stamina = 1;
    this.player.flashlight = true;
    this.player.spawn(lv.start.x, lv.start.z, lv.start.yaw, lv);
    this.arsenal.reset();
    this.saveCheckpoint();
    this.hud.bossBar(null);
    this.hud.objective("Encontre uma saída pelos esgotos.");
    this.setMode("playing");
    this.hud.message("Algo deu errado no Setor Zero. Ninguém respondeu no rádio.", 5);
  }

  private saveCheckpoint(): void {
    const p = this.player;
    this.checkpoint = { x: p.pos[0], z: p.pos[2], yaw: p.yaw, hp: Math.max(p.hp, 60), arsenal: this.arsenal.snapshot(), keys: [...p.keys] };
  }

  respawn(): void {
    const c = this.checkpoint!;
    this.player.hp = c.hp;
    this.player.keys = new Set(c.keys);
    this.player.spawn(c.x, c.z, c.yaw, this.level);
    this.arsenal.restore(c.arsenal);
    this.enemies.resetAwake(this.level);
    // Arena: reabre a porta amarela se o chefe ainda vive.
    if (this.boss && this.boss.alive) {
      const f = this.fired;
      if (f.has("arena")) {
        f.delete("arena");
        const d = this.level.doors[this.level.doorAt[this.level.idx(52, 34)]];
        if (d) d.locked = false;
      }
      this.hud.bossBar(null);
    }
    this.fx.clear();
    this.setMode("playing");
    this.hud.message("De volta ao último ponto seguro.", 2.5);
  }

  pause(): void {
    if (this.mode === "playing") this.setMode("paused");
  }

  resume(): void {
    if (this.mode === "paused") this.setMode("playing");
  }

  // ------------------------------------------------------------- dano
  private hurtPlayer(dmg: number, fx: number, fz: number): void {
    const p = this.player;
    if (!p.alive) return;
    const got = p.damage(dmg, fx, fz);
    if (got <= 0) return;
    this.hud.damageFlash(p.lastHitAngle, got);
    this.audio.playerHurt(got > 20);
    if (!p.alive) this.die();
  }

  private die(): void {
    this.deaths++;
    this.audio.playerDeath();
    this.deathTimer = 1.6;
    this.setMode("dead");
  }

  private onEnemyDeath(e: Enemy): void {
    // Zumbis às vezes deixam munição.
    if ((e.def.kind === "zombie" || e.def.kind === "runner" || e.def.kind === "corpse") && Math.random() < 0.3) {
      this.pickups.add(Math.random() < 0.55 ? "1" : "2", e.pos[0], e.pos[2], this.level);
    }
    if (e.boss) {
      this.bossDead = true;
      this.hud.bossBar(null);
      this.hud.message("O REI TROLL CAIU. O portão do elevador se abriu!", 5);
      this.hud.objective("Suba no elevador ao norte da arena.");
      this.audio.ui("victory");
      for (const d of this.level.doors) if (d.kind === "exit" || d.kind === "yellow") ((d.target = 1), (d.locked = false));
      this.player.addTrauma(0.6);
    }
  }

  private bossAdds(e: Enemy): void {
    const lv = this.level;
    const spots: [number, number][] = [[41, 31], [48, 31], [41, 38], [48, 38]];
    for (const [cx, cz] of spots) {
      const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
      const add = this.enemies.spawn(Math.random() < 0.5 ? "shade" : "runner", x, z, lv, St.ALERT, 0, true);
      this.fx.smokePuff(x, lv.floorAt(x, z), z, 16);
      add.castCooldown = 1.5;
    }
    this.audio.stinger(0.7);
    this.hud.message(e.summoned === 1 ? "O Rei chama as sombras!" : "Mais delas!", 2.5);
  }

  // ----------------------------------------------------------- portas
  private openDoor(cx: number, cz: number, byEnemy: boolean): boolean {
    const lv = this.level;
    const i = lv.idx(cx, cz);
    const di = lv.doorAt[i];
    if (di < 0) return false;
    const d = lv.doors[di];
    if (d.target === 1) return true;
    if (d.locked) {
      if (!byEnemy) {
        this.hud.message("A porta está travada.", 1.5);
        this.audio.ui("locked");
      }
      return false;
    }
    const need: Record<string, KeyColor> = { red: "red", blue: "blue", yellow: "yellow" };
    if (d.kind in need) {
      if (byEnemy) return false;
      if (!this.player.keys.has(need[d.kind])) {
        const nm = { red: "VERMELHA", blue: "AZUL", yellow: "AMARELA" }[need[d.kind]];
        this.hud.message(`Precisa da chave ${nm}.`, 2);
        this.audio.door(d.cx * CELL + 1.25, 1.5, d.cz * CELL + 1.25, true);
        return false;
      }
    }
    if (d.kind === "exit") {
      if (!this.bossDead) {
        if (!byEnemy) {
          this.hud.message("O portão só abre quando o guardião cair.", 2.5);
          this.audio.door(d.cx * CELL + 1.25, 1.5, d.cz * CELL + 1.25, true);
        }
        return false;
      }
    }
    if (d.kind === "secret") {
      if (byEnemy) return false;
      this.secretsFound++;
      this.hud.message("Você encontrou uma passagem secreta!", 2.5);
    }
    d.target = 1;
    this.audio.door(d.cx * CELL + 1.25, 1.5, d.cz * CELL + 1.25, false);
    return true;
  }

  private closeDoor(d: Door, lock: boolean): void {
    d.target = 0;
    d.locked = lock;
    this.audio.bang(d.cx * CELL + 1.25, 1.5, d.cz * CELL + 1.25);
  }

  // Tecla E / encostar: procura porta à frente.
  private use(auto: boolean): void {
    const p = this.player;
    const f = p.forward();
    const lv = this.level;
    for (let dist = 0.6; dist <= 2.4; dist += 0.3) {
      const x = p.pos[0] + f[0] * dist, z = p.pos[2] + f[2] * dist;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (!lv.inBounds(cx, cz)) return;
      const i = lv.idx(cx, cz);
      if (lv.doorAt[i] >= 0) {
        const d = lv.doors[lv.doorAt[i]];
        if (d.target === 1) return;
        if (auto && (d.kind === "secret" || d.kind === "exit")) return;
        if (auto && d.kind !== "normal" && this.promptCooldown > 0) return;
        this.openDoor(cx, cz, false);
        if (auto) this.promptCooldown = 1.5;
        return;
      }
      if (lv.type[i] === Cell.SOLID) return;
    }
  }
  private promptCooldown = 0;

  private doorPrompt(): string {
    const p = this.player;
    const f = p.forward();
    const lv = this.level;
    for (let dist = 0.6; dist <= 2.4; dist += 0.3) {
      const cx = Math.floor((p.pos[0] + f[0] * dist) / CELL), cz = Math.floor((p.pos[2] + f[2] * dist) / CELL);
      if (!lv.inBounds(cx, cz)) return "";
      const i = lv.idx(cx, cz);
      if (lv.doorAt[i] >= 0) {
        const d = lv.doors[lv.doorAt[i]];
        if (d.target === 1 || d.kind === "secret") return "";
        return d.kind === "exit" ? "[E] Portão do elevador" : "[E] Abrir";
      }
      if (lv.type[i] === Cell.SOLID) return "";
    }
    return "";
  }

  private updateDoors(dt: number): void {
    for (const d of this.level.doors) {
      const speed = d.kind === "secret" ? 0.6 : 1.5;
      if (d.open < d.target) d.open = Math.min(d.target, d.open + dt * speed);
      else if (d.open > d.target) d.open = Math.max(d.target, d.open - dt * 2.2);
    }
  }

  // --------------------------------------------------------- gatilhos
  private checkTriggers(keyPicked: KeyColor[]): void {
    const p = this.player;
    const cx = Math.floor(p.pos[0] / CELL), cz = Math.floor(p.pos[2] / CELL);
    for (const t of this.level.triggers) {
      if (this.fired.has(t.name)) continue;
      if (t.on) {
        const color = t.on.replace("key_", "") as KeyColor;
        if (!keyPicked.includes(color)) continue;
      } else {
        const [x0, z0, x1, z1] = t.rect;
        if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
      }
      this.fired.add(t.name);
      this.runTrigger(t);
    }
  }

  private runTrigger(t: TriggerDef): void {
    const lv = this.level;
    const p = this.player;
    if (t.message) this.hud.message(t.message, 3.5);
    if (t.sound) this.audio.scripted(t.sound, p.pos[0], p.pos[1] + 1.6, p.pos[2]);
    if (t.spawn) {
      for (const [ch, cx, cz] of t.spawn) {
        const kind = KIND_BY_CHAR[ch];
        if (!kind) continue;
        const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
        const e = this.enemies.spawn(kind, x, z, lv, St.ALERT, Math.atan2(p.pos[0] - x, -(p.pos[2] - z)));
        if (kind === "shade") this.fx.smokePuff(x, lv.floorAt(x, z), z, 12);
        e.castCooldown = 1 + Math.random();
      }
    }
    if (t.close_door) {
      const [cx, cz] = t.close_door;
      const d = lv.doors[lv.doorAt[lv.idx(cx, cz)]];
      if (d) this.closeDoor(d, !!t.boss);
    }
    if (t.wake) this.enemies.wakeRect(t.wake[0], t.wake[1], t.wake[2], t.wake[3], this.audio);
    if (t.lights_off) this.lightsOff(t.lights_off);
    if (t.boss && this.boss) {
      this.enemies.wake(this.boss, this.audio);
      this.hud.bossBar(ENEMY_DEFS.king.name.toUpperCase(), 1);
      this.saveCheckpointAt(47, 34);
      this.hud.objective("Mate o Rei Troll.");
    }
    if (t.on === "key_red") this.hud.objective("Volte pela galeria norte até a porta VERMELHA.");
    if (t.on === "key_blue") this.hud.objective("Siga para o leste: porta AZUL, atravessando a forja.");
    if (t.on === "key_yellow") this.hud.objective("Leve a chave AMARELA até a porta da arena (oeste).");
    if (t.on) this.saveCheckpoint();
  }

  private saveCheckpointAt(cx: number, cz: number): void {
    this.saveCheckpoint();
    this.checkpoint!.x = (cx + 0.5) * CELL;
    this.checkpoint!.z = (cz + 0.5) * CELL;
  }

  private lightsOff(region: string): void {
    const lv = this.level;
    const inRegion = (l: { cx: number; cz: number; zone: number }) => {
      if (region === "s_cistern") return l.cx >= 76 && l.cx <= 87 && l.cz >= 46 && l.cz <= 63;
      const zi = ZONES.findIndex((z) => z.key === region);
      return l.zone === zi;
    };
    let changed = false;
    lv.lights.forEach((l) => {
      if (l.enabled && inRegion(l)) {
        l.enabled = false;
        changed = true;
      }
    });
    if (changed) {
      this.lightData = packLights(lv);
      this.renderer.writeStaticLights(0, this.lightData);
    }
    this.scareFlicker = 2.5;
    this.player.addTrauma(0.35);
  }

  // --------------------------------------------------------- tiros
  private handleFire(ev: FireEvent): void {
    const p = this.player;
    const eye = p.eye();
    const f = p.forward();
    const w = ev.def;
    this.vm.fire(ev.melee);
    this.audio.weapon(w.sound);
    if (ev.melee) {
      let best: Enemy | null = null;
      let bestD = w.range + 0.6;
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const dx = e.pos[0] - p.pos[0], dz = e.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz) - e.def.radius * e.def.scale;
        if (d > bestD) continue;
        if ((dx * f[0] + dz * f[2]) / (Math.hypot(dx, dz) || 1) < 0.55) continue;
        best = e;
        bestD = d;
      }
      if (best) {
        const sneak = !best.awake ? 2.5 : 1;
        const killed = this.enemies.damage(best, w.damage * sneak, this.audio, this.fx, this.events, f[0], f[2]);
        this.audio.impact(best.pos[0], best.pos[1] + 1, best.pos[2], true);
        this.hud.hitMarker(killed);
      } else {
        const hit = this.level.raycast(eye[0], eye[1], eye[2], f[0], f[1], f[2], w.range);
        if (hit) {
          this.fx.impact(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.surface);
          this.audio.impact(hit.x, hit.y, hit.z, false);
        }
      }
      return;
    }
    // Arma de fogo: clarão, cápsula, recuo e N projéteis (hitscan).
    const muzzle = this.vm.muzzleWorld(w.muzzle);
    this.fx.muzzle(muzzle[0], muzzle[1], muzzle[2]);
    if (w.casing) {
      const [yaw] = p.viewAngles();
      const rx = Math.cos(yaw), rz = Math.sin(yaw);
      const m = this.assets.models[w.casing];
      const ex = eye[0] + rx * 0.14 + f[0] * 0.25, ey = eye[1] - 0.12, ez = eye[2] + rz * 0.14 + f[2] * 0.25;
      this.fx.shell(m, ex, ey, ez, rx * rand(1.5, 2.6) + p.vel[0], rand(1.5, 2.8), rz * rand(1.5, 2.6) + p.vel[1]);
    }
    p.recoilPitch += w.kick * rand(0.8, 1.2);
    p.recoilYaw += w.kickYaw * rand(-1, 1);
    p.addTrauma(w.id === "mossberg" ? 0.18 : w.id === "scar" ? 0.1 : 0.04);
    const spread = this.arsenal.spread(this.input.aim, p.moving);
    let anyHit = false, anyKill = false;
    const [yaw, pitch] = p.viewAngles();
    for (let k = 0; k < w.pellets; k++) {
      // Direção com dispersão (distribuição dentro de um cone).
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const yy = yaw + Math.cos(a) * r, pp = pitch + Math.sin(a) * r;
      const cp = Math.cos(pp);
      const dx = cp * Math.sin(yy), dy = Math.sin(pp), dz = -cp * Math.cos(yy);
      const wall = this.level.raycast(eye[0], eye[1], eye[2], dx, dy, dz, w.range);
      const wallT = wall ? wall.t : w.range;
      const hit = this.enemies.rayHit(eye[0], eye[1], eye[2], dx, dy, dz, wallT);
      let end: [number, number, number];
      if (hit) {
        const dmg = w.damage * (hit.head ? 2.1 : 1);
        const killed = this.enemies.damage(hit.e, dmg, this.audio, this.fx, this.events, dx, dz);
        anyHit = true;
        if (killed) anyKill = true;
        end = [eye[0] + dx * hit.t, eye[1] + dy * hit.t, eye[2] + dz * hit.t];
        this.fx.blood(end[0], end[1], end[2], dx, dz, hit.head ? 10 : 5, hit.e.def.darkBlood);
        if (k === 0) this.audio.impact(end[0], end[1], end[2], true);
      } else if (wall) {
        end = [wall.x, wall.y, wall.z];
        this.fx.impact(wall.x, wall.y, wall.z, wall.nx, wall.ny, wall.nz, wall.surface);
        if (k === 0) this.audio.impact(wall.x, wall.y, wall.z, false);
      } else end = [eye[0] + dx * w.range, eye[1] + dy * w.range, eye[2] + dz * w.range];
      if (w.pellets === 1 && Math.random() < 0.5) this.fx.tracer(muzzle[0], muzzle[1], muzzle[2], end[0], end[1], end[2]);
    }
    if (anyHit) {
      this.arsenal.shotsHit++;
      this.hud.hitMarker(anyKill);
    }
    // O barulho acorda quem está perto (pelo caminho, não em linha reta).
    this.enemies.noise(this.field, this.level, 16, this.audio);
  }

  // ---------------------------------------------------------- update
  update(dt: number): void {
    this.time += dt;
    const input = this.input;
    if (this.mode === "dead") {
      this.deathTimer -= dt;
      this.player.update(dt, input, this.level, false);
      this.enemies.update(dt, this.level, this.player, this.field, this.audio, this.fx, this.events);
      this.fx.update(dt, this.level);
      return;
    }
    if (this.mode !== "playing") return;
    this.playTime += dt;
    const p = this.player;
    const lv = this.level;
    this.promptCooldown -= dt;

    // Teclas de ação.
    if (input.wasPressed("Tab")) this.automap.toggle();
    if (input.wasPressed("KeyF")) p.flashlight = !p.flashlight;
    if (input.wasPressed("KeyE")) this.use(false);
    if (input.wasPressed("KeyR")) this.arsenal.startReload();
    for (let i = 0; i < WEAPONS.length; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) {
        this.arsenal.switchTo(i);
        this.hud.showSlots();
      }
    }
    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      this.arsenal.cycle(wheel > 0 ? 1 : -1);
      this.hud.showSlots();
    }

    // Jogador (o delta do mouse é lido aqui dentro).
    const md = input.consumeMouse();
    this.lookDX = md.dx;
    this.lookDY = md.dy;
    input.simulateMouse(md.dx, md.dy);
    p.update(dt, input, lv, true);
    if (p.moving) this.use(true);
    if (p.stepped()) this.audio.footstep(p.inWater, p.sprinting);

    this.updateDoors(dt);

    // Campo de caminhos (Dijkstra) a partir do jogador.
    this.fieldTimer -= dt;
    const pc = lv.cellIndexAt(p.pos[0], p.pos[2]);
    if (this.fieldTimer <= 0 || pc !== this.fieldCell) {
      this.fieldTimer = 0.3;
      this.fieldCell = pc;
      lv.pathField(Math.floor(p.pos[0] / CELL), Math.floor(p.pos[2] / CELL), this.field, 70);
    }

    // Armas.
    const ev = this.arsenal.update(dt, input.fire, input.firePressedNow, p.moving);
    if (ev) this.handleFire(ev);
    if (this.arsenal.dryFire) this.audio.dryFire();
    if (this.arsenal.justSwitched) this.audio.reload("in");
    if (this.arsenal.shellLoaded) this.audio.reload("shell");
    if (this.arsenal.justReloaded) this.audio.reload(this.arsenal.def.perShell ? "rack" : "in");
    if (this.arsenal.phase === "reload" && this.arsenal.phaseTime < dt * 1.5 && !this.arsenal.def.perShell) this.audio.reload("out");
    this.vm.update(dt, this.arsenal, this.lookDX, this.lookDY, p.bobAmount, p.distanceWalked, input.aim && !this.arsenal.def.melee);

    // Inimigos, itens, gatilhos, efeitos.
    this.enemies.update(dt, lv, p, this.field, this.audio, this.fx, this.events);
    const keys = this.pickups.update(p, this.arsenal, this.audio, this.hud);
    this.checkTriggers(keys);
    this.fx.update(dt, lv);
    if (this.boss && this.boss.alive && this.fired.has("arena")) this.hud.bossBar(ENEMY_DEFS.king.name.toUpperCase(), this.boss.hp / this.boss.maxHp);

    // Brasas perto da lava.
    if (Math.random() < dt * 25) {
      const x = p.pos[0] + rand(-10, 10), z = p.pos[2] + rand(-10, 10);
      if (lv.typeAt(x, z) === Cell.LAVA) this.fx.embers(x, lv.floorAt(x, z) + 0.1, z);
    }

    // Zonas: título, checkpoint na primeira entrada.
    const zi = lv.zoneAt(p.pos[0], p.pos[2]);
    if (zi !== this.currentZone) {
      this.currentZone = zi;
      if (!this.zoneSeen.has(zi)) {
        this.zoneSeen.add(zi);
        this.hud.zoneTitle(ZONES[zi].name);
        if (this.zoneSeen.size > 1) {
          this.saveCheckpoint();
          this.audio.ui("checkpoint");
        }
      }
    }
    this.automap.reveal(p.pos[0], p.pos[2], dt);

    // Vitória: no elevador depois do chefe.
    if (this.bossDead && lv.typeAt(p.pos[0], p.pos[2]) === Cell.ELEVATOR) {
      this.audio.ui("victory");
      this.setMode("victory");
    }

    this.scareFlicker = Math.max(0, this.scareFlicker - dt);
    if (!p.alive && this.mode === "playing") this.die();

    // Som: ouvinte na câmera + ambiente.
    const eye = p.eye();
    const f = p.forward();
    this.audio.setListener(eye[0], eye[1], eye[2], f[0], f[1], f[2]);
    this.audio.tick(dt, zi, ZONES[zi].musicBase, Math.min(1, this.enemies.hunting / 3), p.hp <= 30, eye[0], eye[1], eye[2]);

    this.hud.prompt(this.doorPrompt());
    this.hud.update(dt, p, this.arsenal, this.arsenal.spread(input.aim, p.moving), p.flashlight);
    this.automap.draw(p.pos[0], p.pos[2], p.yaw, p.keys);
  }

  // ---------------------------------------------------------- render
  render(aspect: number): void {
    const q = this.renderer.queue;
    q.clear();
    const p = this.player;
    const lv = this.level;
    const eye = p.eye();
    const view = p.viewMatrix();
    const proj = mat4.perspective((72 * Math.PI) / 180, aspect, 0.05, 160);
    const vmProj = mat4.perspective((58 * Math.PI) / 180, aspect, 0.02, 10);
    const viewProj = mat4.multiply(proj, view);
    const vmViewProj = mat4.multiply(vmProj, view);
    const planes = mat4.frustumPlanes(viewProj);
    const invView = mat4.invert(view);
    const right: [number, number, number] = [view[0], view[4], view[8]];
    const up: [number, number, number] = [view[1], view[5], view[9]];
    const t = this.time;

    // Portas.
    for (const d of lv.doors) {
      if (d.open >= 0.999) continue;
      const i = lv.idx(d.cx, d.cz);
      const h = lv.ceilH[i] - lv.floorH[i];
      // Passagens secretas: um pouco mais escuras que a parede (dica sutil).
      const tint = d.kind === "red" || d.kind === "blue" || d.kind === "yellow" ? KEY_COLOR[d.kind] : d.kind === "exit" ? [0.9, 0.9, 0.95] : d.kind === "secret" ? [0.78, 0.74, 0.7] : [1, 1, 1];
      const glow = d.kind === "red" || d.kind === "blue" || d.kind === "yellow" ? 0.12 + 0.06 * Math.sin(t * 3) : 0;
      q.door(d.geom, 0, d.open * h, 0, -1, tint[0], tint[1], tint[2], glow);
    }

    this.pickups.submit(q, t, lv, planes);
    const { lure } = this.enemies.submit(q, planes, eye, lv, t);
    this.fx.submit(q, eye);

    // Chamas das tochas/braseiros + halos.
    const extraLights: { x: number; y: number; z: number; r: number; g: number; b: number; range: number; intensity: number }[] = [];
    for (const l of lv.lights) {
      if (!l.enabled || l.kind === "lava") continue;
      const dx = l.x - eye[0], dz = l.z - eye[2];
      if (dx * dx + dz * dz > 40 * 40) continue;
      if (!mat4.sphereInFrustum(planes, l.x, l.y, l.z, 1)) continue;
      const fl = 0.85 + 0.15 * Math.sin(t * l.speed + l.phase) + 0.08 * Math.sin(t * 17 + l.phase);
      const g = UV[FX.GLOW];
      if (l.kind === "torch" || l.kind === "brazier") {
        const s = l.kind === "brazier" ? 0.55 : 0.28;
        const fu = UV[FX.FLAME];
        q.sprite(true, l.x, l.y - 0.05 + s * 0.6, l.z, s * fl, 1, 0.8, 0.55, 1, fu[0], fu[1], fu[2], fu[3], 3, 0, 0, 0, 0, 0.7);
        q.sprite(true, l.x, l.y, l.z, s * 2.6, 1, 0.45, 0.15, 0.35 * fl, g[0], g[1], g[2], g[3]);
      } else {
        q.sprite(true, l.x, l.y, l.z, 0.9, 0.6, 0.75, 1, 0.45 * fl, g[0], g[1], g[2], g[3]);
      }
    }
    // Chaves: halo + luz.
    for (const pk of this.pickups.list) {
      if (!pk.active || pk.kind !== "key") continue;
      const c = KEY_COLOR[pk.key!];
      const g = UV[FX.GLOW];
      q.sprite(true, pk.x, pk.y + 1.1, pk.z, 0.9, c[0], c[1], c[2], 0.8, g[0], g[1], g[2], g[3]);
      extraLights.push({ x: pk.x, y: pk.y + 1.2, z: pk.z, r: c[0], g: c[1], b: c[2], range: 6, intensity: 1.8 });
    }
    // Isca luminosa dos abissais.
    for (const [x, y, z] of lure) {
      const g = UV[FX.GLOW];
      const pulse = 0.8 + 0.2 * Math.sin(t * 5);
      q.sprite(true, x, y, z, 0.35 * pulse, 1, 0.95, 0.7, 1, g[0], g[1], g[2], g[3]);
      extraLights.push({ x, y, z, r: 1, g: 0.9, b: 0.65, range: 6.5, intensity: 2.2 * pulse });
    }
    // Raios das sombras.
    for (const pr of this.enemies.projectiles) {
      const g = UV[FX.GLOW];
      q.sprite(true, pr.x, pr.y, pr.z, 0.45, 0.5, 0.75, 1, 1, g[0], g[1], g[2], g[3]);
      for (let k = 0; k < 2; k++) {
        const b = UV_BOLT[k];
        const a = Math.random() * Math.PI * 2;
        q.sprite(true, pr.x - Math.cos(a) * 0.5, pr.y + rand(-0.3, 0.3), pr.z - Math.sin(a) * 0.5, 0.12, 0.7, 0.85, 1, 1, b[0], b[1], b[2], b[3], 2, pr.x + Math.cos(a) * 0.5, pr.y + rand(-0.3, 0.3), pr.z + Math.sin(a) * 0.5);
      }
      extraLights.push({ x: pr.x, y: pr.y, z: pr.z, r: 0.45, g: 0.7, b: 1, range: 7, intensity: 2.5 });
    }

    // Arma na mão.
    if (this.mode === "playing" || this.mode === "paused") {
      const w = this.arsenal.def;
      const model = this.assets.models[w.model];
      const world = this.vm.computeWorld(invView);
      const vmI = q.viewModel(model);
      vmI.d.set(world, vmI.o);
      vmI.d.set([1, 1, 1, 1, 0, 0, 0.9, lv.cellIndexAt(p.pos[0], p.pos[2])], vmI.o + 16);
      if (this.vm.flashTimer > 0 && w.flashSize > 0) {
        const m = this.vm.muzzleWorld(w.muzzle);
        const fu = UV[FX.FLASH];
        const s = w.flashSize * rand(0.8, 1.2);
        q.sprite(true, m[0], m[1], m[2], s, 1, 0.85, 0.6, 1, fu[0], fu[1], fu[2], fu[3], 0, 0, 0, 0, this.vm.flashRot, 1, 0, true);
        const g = UV[FX.GLOW];
        q.sprite(true, m[0], m[1], m[2], s * 1.8, 1, 0.6, 0.3, 0.5, g[0], g[1], g[2], g[3], 0, 0, 0, 0, 0, 1, 0, true);
      }
    }

    this.fx.packLights(extraLights, eye);
    const zd = ZONES[Math.max(0, this.currentZone)];
    const fwd = p.forward();
    // Lanterna: sai um pouco à direita/abaixo do olho.
    const fp: [number, number, number] = [eye[0] + right[0] * 0.18 - up[0] * 0.12, eye[1] + right[1] * 0.18 - up[1] * 0.12, eye[2] + right[2] * 0.18 - up[2] * 0.12];
    let flashI = 2.1 * p.flashFlicker;
    if (this.scareFlicker > 0) flashI *= Math.random() < 0.5 ? 0.05 : 1;
    const zoneAmb = new Float32Array(32);
    ZONES.forEach((z, i) => zoneAmb.set([...z.ambient, 0], i * 4));
    const params: FrameParams = {
      viewProj,
      vmViewProj,
      camPos: eye,
      camRight: right,
      camUp: up,
      time: t,
      fogColor: zd.fog,
      fogDensity: zd.fogDensity,
      flashOn: p.flashlight && p.alive,
      flashPos: fp,
      flashDir: fwd,
      flashRange: 30,
      flashCosInner: Math.cos((11 * Math.PI) / 180),
      flashCosOuter: Math.cos((26 * Math.PI) / 180),
      flashIntensity: flashI,
      exposure: 1.25,
      ambientScale: this.mode === "dead" ? 0.6 : 1,
      zoneAmbient: zoneAmb,
      dynLights: this.fx.lightData,
      dynCount: this.fx.lightCount,
      clearColor: displayFog(zd.fog, 1.25),
      vmFlashScale: 0.12,
    };
    this.renderer.render(params);
  }

  // Estatísticas para a tela final.
  stats(): { time: string; kills: string; secrets: string; deaths: number; accuracy: string } {
    const s = Math.floor(this.playTime);
    const acc = this.arsenal.shotsFired > 0 ? Math.round((this.arsenal.shotsHit / this.arsenal.shotsFired) * 100) : 0;
    return {
      time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      kills: `${this.enemies.kills} / ${this.enemies.total}`,
      secrets: `${this.secretsFound} / ${this.secretsTotal}`,
      deaths: this.deaths,
      accuracy: `${acc}%`,
    };
  }

  get deathScreenReady(): boolean {
    return this.deathTimer <= 0;
  }

  // Luzes estáticas reenviadas (usado pelo modo debug).
  refreshLights(): void {
    this.lightData = packLights(this.level);
    this.renderer.writeStaticLights(0, this.lightData);
  }
}

