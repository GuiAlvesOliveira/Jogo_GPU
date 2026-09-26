// ============================================================
//  HUD.ts — Interface por cima do canvas (HTML/CSS, CPU)
// ------------------------------------------------------------
//  A GPU desenha o mundo; o HUD é DOM comum (mais simples e nítido
//  para texto). Só mexemos no DOM quando um valor muda.
// ============================================================

import type { Arsenal } from "../game/weapons/Weapons";
import { AMMO_NAME, WEAPONS } from "../game/weapons/Weapons";
import type { Player } from "../game/Player";

const $ = (id: string) => document.getElementById(id)!;

export class HUD {
  private cache = new Map<string, string>();
  private msgTimer = 0;
  private zoneTimer = 0;
  private hitTimer = 0;
  private slotsTimer = 0;
  private promptText = "";

  private set(id: string, value: string, prop: "text" | "width" | "class" = "text"): void {
    const k = id + prop;
    if (this.cache.get(k) === value) return;
    this.cache.set(k, value);
    const el = $(id);
    if (prop === "text") el.textContent = value;
    else if (prop === "width") el.style.width = value;
    else el.className = value;
  }

  show(on: boolean): void {
    $("hud").classList.toggle("hidden", !on);
    $("crosshair").classList.toggle("hidden", !on);
  }

  message(text: string, seconds = 3.5): void {
    const el = $("hud-msg");
    el.textContent = text;
    el.classList.add("show");
    this.msgTimer = seconds;
  }

  zoneTitle(text: string): void {
    const el = $("hud-zone");
    el.textContent = text;
    el.classList.add("show");
    this.zoneTimer = 4;
  }

  objective(text: string): void {
    this.set("hud-objective", text);
  }

  hitMarker(kill: boolean): void {
    const el = $("hitmarker");
    el.classList.remove("show", "kill");
    void el.offsetWidth;
    el.classList.add("show");
    if (kill) el.classList.add("kill");
    this.hitTimer = 0.2;
  }

  prompt(text: string): void {
    if (text === this.promptText) return;
    this.promptText = text;
    $("hud-prompt").textContent = text;
    $("hud-prompt").classList.toggle("show", !!text);
  }

  damageFlash(angle: number, strength: number): void {
    const f = $("damage-flash");
    f.style.opacity = String(Math.min(0.85, 0.35 + strength / 40));
    f.classList.remove("fade");
    void f.offsetWidth;
    f.classList.add("fade");
    const d = $("dmg-dir");
    d.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    d.classList.remove("show");
    void d.offsetWidth;
    d.classList.add("show");
  }

  bossBar(name: string | null, frac = 1): void {
    $("boss-bar").classList.toggle("hidden", name === null);
    if (name !== null) {
      this.set("boss-name", name);
      this.set("boss-fill", `${Math.max(0, frac) * 100}%`, "width");
    }
  }

  showSlots(): void {
    this.slotsTimer = 2.2;
    $("hud-slots").classList.add("show");
  }

  update(dt: number, player: Player, arsenal: Arsenal, spread: number, flashlightOn: boolean): void {
    this.msgTimer -= dt;
    if (this.msgTimer <= 0) $("hud-msg").classList.remove("show");
    this.zoneTimer -= dt;
    if (this.zoneTimer <= 0) $("hud-zone").classList.remove("show");
    this.hitTimer -= dt;
    this.slotsTimer -= dt;
    if (this.slotsTimer <= 0) $("hud-slots").classList.remove("show");

    const hp = Math.ceil(player.hp);
    this.set("hp-val", String(hp));
    this.set("hp-bar", `${(hp / player.maxHp) * 100}%`, "width");
    this.set("hud-health", hp <= 30 ? "low" : "", "class");
    this.set("st-bar", `${player.stamina * 100}%`, "width");
    this.set("stamina", player.stamina < 0.98 ? "show" : "", "class");

    const w = arsenal.def;
    this.set("w-name", w.name);
    if (w.ammo) {
      const mag = arsenal.mag[arsenal.current];
      this.set("mag", arsenal.phase === "reload" && !w.perShell ? "--" : String(mag));
      this.set("reserve", String(arsenal.ammo[w.ammo]));
      this.set("ammo-type", AMMO_NAME[w.ammo]);
      this.set("ammo-sep", "sep", "class");
      this.set("hud-ammo", mag === 0 ? "empty" : mag <= Math.ceil(w.mag * 0.25) ? "low" : "", "class");
    } else {
      this.set("mag", "∞");
      this.set("reserve", "");
      this.set("ammo-sep", "hidden", "class");
      this.set("ammo-type", "CORPO A CORPO");
      this.set("hud-ammo", "", "class");
    }
    for (const c of ["red", "blue", "yellow"] as const) this.set(`key-${c}`, player.keys.has(c) ? `key ${c} have` : `key ${c}`, "class");
    this.set("flash-ind", flashlightOn ? "on" : "", "class");

    // Slots de arma (1..6).
    const slots = WEAPONS.map((_wd, i) => `${arsenal.owned[i] ? (i === arsenal.current ? "cur" : "own") : "none"}`).join(",");
    if (this.cache.get("slots") !== slots) {
      this.cache.set("slots", slots);
      $("hud-slots").innerHTML = WEAPONS.map(
        (wd, i) => `<div class="slot ${arsenal.owned[i] ? (i === arsenal.current ? "cur" : "own") : "none"}"><b>${wd.slot}</b>${arsenal.owned[i] ? wd.name : "—"}</div>`,
      ).join("");
    }

    // Mira dinâmica: abre com a dispersão.
    const gap = Math.round(6 + spread * 420);
    if (this.cache.get("gap") !== String(gap)) {
      this.cache.set("gap", String(gap));
      ($("crosshair") as HTMLElement).style.setProperty("--gap", `${gap}px`);
    }
    $("crosshair").classList.toggle("melee", !w.ammo);
  }
}
