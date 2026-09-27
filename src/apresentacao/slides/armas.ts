// Capítulo 09 — Armas e combate: arsenal, dispersão, tempo para matar.

import type { SlideDef } from "../deck";
import { esc, fmt, loop, fitCanvas } from "../dom";
import { WEAPONS, AMMO_MAX, AMMO_NAME, type WeaponDef } from "../../game/weapons/Weapons";
import { ENEMY_DEFS, type EnemyKind } from "../../game/enemies/Enemies";
import { KINDS, KIND_LABEL, DIFFS, DIFF_LABEL, enemyHp, ttk, dps, canHeadshot, type Diff } from "../data/balance";
import { barChart, PAL, seqColor, isLight } from "../charts";
import { showTip, hideTip } from "../tooltip";
import { goTo } from "../nav";
import { showInGallery } from "./galeria";
import { IMG, combine } from "./common";
import { codeBlock } from "../highlight";
import { snippet } from "../data/codigo";

const W_IMG: Record<string, string> = { knife: "w2_knifeslash", usp: "w_usp", mossberg: "w_mossberg", m4: "w_m4", ak47: "w_ak47", scar: "w_scar" };

export const arsenal: SlideDef = {
  id: "arsenal",
  title: "Seis armas, uma tabela",
  lead: "Cada arma é um objeto em <code>WEAPONS</code>: dano, projéteis, dispersão, cadência, pente, recarga, recuo e como aparece na mão. Munição é por calibre, compartilhada (como no DOOM).",
  body: () => `
  <div class="ars fill">
    <div class="ars-grid">${WEAPONS.map((w) => {
      const d = dps(w);
      return `<div class="panel wcard">
        <img src="${IMG}testes/${W_IMG[w.id]}.jpg" alt="${esc(w.name)}" loading="lazy" data-zoom>
        <div class="row"><span class="mono dim small">${w.slot}</span><b>${esc(w.name)}</b><span class="spacer"></span><button class="btn sm ghost" data-3d="${w.model}">3D</button></div>
        <div class="wstats small">
          <span>dano</span><b class="num">${w.pellets > 1 ? `${w.damage} × ${w.pellets}` : w.damage}</b>
          <span>cadência</span><b class="num">${fmt.n1(w.rate)}/s ${w.auto && !w.melee ? "auto" : w.melee ? "" : "semi"}</b>
          <span>${w.melee ? "alcance" : "pente"}</span><b class="num">${w.melee ? `${fmt.n1(w.range)} m` : w.mag}</b>
          <span>recarga</span><b class="num">${w.melee ? "—" : w.perShell ? `${fmt.n2(w.reload)} s/cartucho` : `${fmt.n1(w.reload)} s`}</b>
          <span>dispersão</span><b class="num">${w.melee ? "—" : `${fmt.n0(w.spread * 1000)} mrad`}</b>
          <span>munição</span><b class="small">${w.ammo ? `${AMMO_NAME[w.ammo]} (máx ${AMMO_MAX[w.ammo]})` : "infinita"}</b>
          <span>DPS</span><b class="num">${fmt.n0(d.burst)} <span class="dim">/ ${fmt.n0(d.sustained)} c/ recarga</span></b>
        </div>
      </div>`;
    }).join("")}</div>
    <div class="panel ars-chart"><h4>Dano por segundo: rajada contínua × com recargas</h4></div>
  </div>`,
  init: (root) => {
    root.querySelector(".ars-chart")!.appendChild(
      barChart({
        categories: WEAPONS.map((w) => w.name),
        series: [
          { name: "rajada (pente cheio)", color: PAL.cat[0], values: WEAPONS.map((w) => dps(w).burst) },
          { name: "sustentado (com recargas)", color: PAL.cat[1], values: WEAPONS.map((w) => dps(w).sustained) },
        ],
        width: 520,
        labelW: 130,
        total: true,
        unit: "de dano/s",
      }),
    );
    root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-3d]") as HTMLElement | null;
      if (!b) return;
      showInGallery(b.dataset["3d"]!);
      goTo("galeria-3d");
    });
  },
};

// ------------------------------------------------------------ dispersão
export const dispersao: SlideDef = {
  id: "dispersao",
  title: "Simulador de dispersão",
  lead: "A mesma fórmula do jogo: cada projétil sai num cone (raio = √aleatório × dispersão, para distribuir uniforme no disco). Atirar em sequência abre o cone (bloom); mirar fecha 55%; andar abre 60%.",
  body: () => `
  <div class="dsp fill">
    <div class="panel flush dsp-view"><canvas class="dsp-canvas"></canvas></div>
    <div class="stack">
      <div class="panel tight stack">
        <div class="seg-ctl sm dsp-w">${WEAPONS.filter((w) => !w.melee).map((w, i) => `<button data-w="${w.id}" class="${i === 1 ? "on" : ""}">${esc(w.name.split(" ")[0])}</button>`).join("")}</div>
        <div class="seg-ctl sm dsp-e">${(["zombie", "rat", "shade", "troll"] as EnemyKind[]).map((k, i) => `<button data-e="${k}" class="${i ? "" : "on"}">${esc(KIND_LABEL[k])}</button>`).join("")}</div>
        <label class="ctl">Distância <span class="v dsp-d-v">12 m</span><input type="range" class="dsp-d" min="2" max="40" value="12"></label>
        <div class="row"><label class="chk"><input type="checkbox" class="dsp-aim"> mirando</label><label class="chk"><input type="checkbox" class="dsp-move"> andando</label><label class="chk"><input type="checkbox" class="dsp-head"> mirar na cabeça</label></div>
        <div class="row"><button class="btn sm primary dsp-fire">Atirar</button><button class="btn sm dsp-burst">Segurar 1 s</button><button class="btn sm ghost dsp-clear">Limpar</button></div>
      </div>
      <div class="panel tight dsp-stats"></div>
      ${codeBlock(snippet("src/game/Game.ts", "// Direção com dispersão", "const dx = cp * Math.sin(yy)", 6).code, "ts", { numbers: false })}
    </div>
  </div>`,
  mount: (root) => {
    const canvas = root.querySelector(".dsp-canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    let w: WeaponDef = WEAPONS[1];
    let kind: EnemyKind = "zombie";
    let dist = 12;
    let bloom = 0;
    let hold = 0;
    let cool = 0;
    let shots: { x: number; y: number; hit: 0 | 1 | 2; age: number }[] = [];
    let fired = 0, body = 0, head = 0, dmg = 0;
    const get = (s: string) => root.querySelector(s) as HTMLInputElement;
    const box = () => {
      const d = ENEMY_DEFS[kind];
      const r = d.radius * d.scale * 0.95, h = d.height * d.scale;
      const headH = kind === "rat" ? 0 : h * 0.18;
      const hr = kind === "angler" ? r * 1.2 : r * 0.7;
      return { r, h, headH, hr };
    };
    const spreadNow = () => {
      const moving = get(".dsp-move").checked, aiming = get(".dsp-aim").checked;
      return (w.spread + bloom + (moving ? w.spread * 0.6 : 0)) * (aiming ? 0.45 : 1);
    };
    const fire = () => {
      const s = spreadNow();
      const b = box();
      const aimY = get(".dsp-head").checked && b.headH > 0 ? b.h - b.headH / 2 : b.h * 0.55;
      for (let k = 0; k < w.pellets; k++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * s;
        const x = Math.tan(Math.cos(a) * rr) * dist;
        const y = aimY + Math.tan(Math.sin(a) * rr) * dist;
        let hit: 0 | 1 | 2 = 0;
        if (b.headH > 0 && Math.abs(x) <= b.hr && y >= b.h - b.headH && y <= b.h + 0.05) hit = 2;
        else if (Math.abs(x) <= b.r && y >= 0 && y <= b.h - b.headH) hit = 1;
        shots.push({ x, y, hit, age: 0 });
        fired++;
        if (hit === 2) {
          head++;
          dmg += w.damage * 2.1;
        } else if (hit === 1) {
          body++;
          dmg += w.damage;
        }
      }
      const moving = get(".dsp-move").checked;
      bloom = Math.min(0.05, bloom + w.spread * 0.35 + (moving ? 0.004 : 0));
      if (shots.length > 600) shots = shots.slice(-600);
    };
    const clear = () => {
      shots = [];
      fired = body = head = dmg = 0;
      bloom = 0;
    };
    const stats = root.querySelector(".dsp-stats") as HTMLElement;
    let lastStats = "";
    const stop = loop((dt) => {
      bloom = Math.max(0, bloom - dt * 0.12);
      cool -= dt;
      if (hold > 0) {
        hold -= dt;
        if (cool <= 0) {
          fire();
          cool = 1 / w.rate;
        }
      }
      const { w: cw, h: ch } = fitCanvas(canvas);
      const b = box();
      const span = Math.max(2.4, b.h * 1.6, Math.tan(0.09) * dist * 2.4);
      const sc = Math.min(cw, ch) / span;
      const cx = cw / 2, gy = ch * 0.5 + (b.h / 2) * sc;
      ctx.fillStyle = "#0c1014";
      ctx.fillRect(0, 0, cw, ch);
      // grade de 0,5 m
      ctx.strokeStyle = "#ffffff0d";
      ctx.lineWidth = 1;
      for (let m = -span; m <= span; m += 0.5) {
        ctx.beginPath();
        ctx.moveTo(cx + m * sc, 0);
        ctx.lineTo(cx + m * sc, ch);
        ctx.moveTo(0, gy - m * sc);
        ctx.lineTo(cw, gy - m * sc);
        ctx.stroke();
      }
      ctx.fillStyle = "#1c232b";
      ctx.fillRect(0, gy, cw, ch - gy);
      // caixas de acerto (as mesmas de EnemyManager.rayHit)
      ctx.fillStyle = "#3987e533";
      ctx.strokeStyle = "#3987e5";
      ctx.lineWidth = 2;
      ctx.fillRect(cx - b.r * sc, gy - (b.h - b.headH) * sc, 2 * b.r * sc, (b.h - b.headH) * sc);
      ctx.strokeRect(cx - b.r * sc, gy - (b.h - b.headH) * sc, 2 * b.r * sc, (b.h - b.headH) * sc);
      if (b.headH > 0) {
        ctx.fillStyle = "#d9592633";
        ctx.strokeStyle = "#d95926";
        ctx.fillRect(cx - b.hr * sc, gy - (b.h + 0.05) * sc, 2 * b.hr * sc, (b.headH + 0.05) * sc);
        ctx.strokeRect(cx - b.hr * sc, gy - (b.h + 0.05) * sc, 2 * b.hr * sc, (b.headH + 0.05) * sc);
      }
      // cone atual
      const s = spreadNow();
      const aimY = get(".dsp-head").checked && b.headH > 0 ? b.h - b.headH / 2 : b.h * 0.55;
      ctx.strokeStyle = "#ece6da88";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, gy - aimY * sc, Math.max(2, Math.tan(s) * dist * sc), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ece6da";
      ctx.beginPath();
      ctx.moveTo(cx - 8, gy - aimY * sc);
      ctx.lineTo(cx + 8, gy - aimY * sc);
      ctx.moveTo(cx, gy - aimY * sc - 8);
      ctx.lineTo(cx, gy - aimY * sc + 8);
      ctx.stroke();
      for (const p of shots) {
        p.age += dt;
        ctx.fillStyle = p.hit === 2 ? "#ffcf8a" : p.hit === 1 ? "#ece6da" : "#e0564c";
        ctx.globalAlpha = Math.max(0.25, 1 - p.age / 8);
        ctx.beginPath();
        ctx.arc(cx + p.x * sc, gy - p.y * sc, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#aab3bc";
      ctx.font = `${Math.round(12 * (cw / 800) + 4)}px "IBM Plex Mono", monospace`;
      ctx.fillText(`${KIND_LABEL[kind]} a ${dist} m · grade 0,5 m · cone ${fmt.n1(s * 1000)} mrad`, 12, 22);
      const st = `${fired}|${body}|${head}|${Math.round(dmg)}|${(s * 1000).toFixed(1)}`;
      if (st !== lastStats) {
        lastStats = st;
        const pct = (n: number) => (fired ? `${Math.round((n / fired) * 100)}%` : "—");
        stats.innerHTML = `<div class="kv"><span>projéteis</span><b class="num">${fired}</b></div>
          <div class="kv"><span>no corpo</span><b class="num">${body} · ${pct(body)}</b></div>
          <div class="kv"><span>na cabeça (×2,1)</span><b class="num">${head} · ${pct(head)}</b></div>
          <div class="kv"><span>dano total</span><b class="num">${fmt.n0(dmg)}</b></div>
          <div class="kv"><span>vida do alvo</span><b class="num">${ENEMY_DEFS[kind].hp}</b></div>`;
      }
    });
    const onW = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-w]") as HTMLElement | null;
      if (!b) return;
      w = WEAPONS.find((x) => x.id === b.dataset.w)!;
      root.querySelectorAll(".dsp-w button").forEach((x) => x.classList.toggle("on", x === b));
      clear();
    };
    const onE = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-e]") as HTMLElement | null;
      if (!b) return;
      kind = b.dataset.e as EnemyKind;
      root.querySelectorAll(".dsp-e button").forEach((x) => x.classList.toggle("on", x === b));
      clear();
    };
    const dEl = get(".dsp-d");
    const onD = () => {
      dist = Number(dEl.value);
      (root.querySelector(".dsp-d-v") as HTMLElement).textContent = `${dist} m`;
      clear();
    };
    const onFire = () => fire();
    const onBurst = () => {
      hold = 1;
      cool = 0;
    };
    root.querySelector(".dsp-w")!.addEventListener("click", onW);
    root.querySelector(".dsp-e")!.addEventListener("click", onE);
    dEl.addEventListener("input", onD);
    root.querySelector(".dsp-fire")!.addEventListener("click", onFire);
    root.querySelector(".dsp-burst")!.addEventListener("click", onBurst);
    root.querySelector(".dsp-clear")!.addEventListener("click", clear);
    canvas.addEventListener("click", onFire);
    return combine(stop, () => {
      root.querySelector(".dsp-w")!.removeEventListener("click", onW);
      root.querySelector(".dsp-e")!.removeEventListener("click", onE);
      dEl.removeEventListener("input", onD);
      root.querySelector(".dsp-fire")!.removeEventListener("click", onFire);
      root.querySelector(".dsp-burst")!.removeEventListener("click", onBurst);
      root.querySelector(".dsp-clear")!.removeEventListener("click", clear);
      canvas.removeEventListener("click", onFire);
    });
  },
};

// ------------------------------------------------------------ tempo para matar
export const ttkSlide: SlideDef = {
  id: "ttk",
  title: "Tempo para matar (TTK)",
  lead: "Segundos do primeiro ao último tiro para derrubar cada inimigo, acertando tudo (espingarda à queima-roupa), incluindo recargas. Troque a dificuldade e ligue os tiros na cabeça.",
  body: () => `
  <div class="stack fill" style="grid-template-rows:auto minmax(0,1fr) auto">
    <div class="row">
      <div class="seg-ctl sm ttk-d">${DIFFS.map((d) => `<button data-d="${d}" class="${d === "normal" ? "on" : ""}">${DIFF_LABEL[d]}</button>`).join("")}</div>
      <label class="chk"><input type="checkbox" class="ttk-h"> tiros na cabeça (×2,1)</label>
      <span class="spacer"></span>
      <div class="legend ttk-legend"></div>
    </div>
    <div class="ttk-grid"></div>
    <p class="cap dim" style="margin:0">Cada célula: tiros necessários · segundos. Ratazanas não têm caixa de cabeça. Cor: escala de raiz quadrada do tempo (mais claro = mais demorado).</p>
  </div>`,
  init: (root) => {
    const grid = root.querySelector(".ttk-grid") as HTMLElement;
    let diff: Diff = "normal";
    const render = () => {
      const head = (root.querySelector(".ttk-h") as HTMLInputElement).checked;
      const vals = WEAPONS.map((w) => KINDS.map((k) => ttk(w, enemyHp(k, diff), head && canHeadshot(k))));
      const maxT = Math.max(...vals.flat().map((v) => v.t));
      const norm = (t: number) => Math.sqrt(t / maxT);
      grid.innerHTML = `<div class="hm" style="grid-template-columns: 150px repeat(${KINDS.length}, 1fr)">
        <div></div>${KINDS.map((k) => `<div class="hm-col">${esc(KIND_LABEL[k])}<span class="dim mono">${enemyHp(k, diff)} HP</span></div>`).join("")}
        ${WEAPONS.map(
          (w, wi) => `<div class="hm-row">${esc(w.name)}</div>${KINDS.map((_, ki) => {
            const v = vals[wi][ki];
            const t = norm(v.t);
            return `<div class="hm-cell" data-w="${wi}" data-k="${ki}" style="background:${seqColor(t)};color:${isLight(t) ? "#0b0f13" : "#ece6da"}"><b>${fmt.n1(v.t).replace(/,0$/, "")} s</b><span>${v.shots} ${w.melee ? "golpes" : "tiros"}</span></div>`;
          }).join("")}`,
        ).join("")}
      </div>`;
      (root.querySelector(".ttk-legend") as HTMLElement).innerHTML = `<span><i style="background:${seqColor(0)}"></i>0 s</span><span><i style="background:${seqColor(0.5)}"></i>${fmt.n1(maxT * 0.25)} s</span><span><i style="background:${seqColor(1)}"></i>${fmt.n1(maxT)} s</span>`;
      grid.querySelectorAll(".hm-cell").forEach((c) =>
        c.addEventListener("mousemove", (e) => {
          const el = c as HTMLElement;
          const w = WEAPONS[Number(el.dataset.w)], k = KINDS[Number(el.dataset.k)];
          const v = vals[Number(el.dataset.w)][Number(el.dataset.k)];
          const per = w.damage * w.pellets * (head && canHeadshot(k) && !w.melee ? 2.1 : 1);
          showTip(
            `<b>${esc(w.name)} × ${esc(KIND_LABEL[k])}</b><div>${enemyHp(k, diff)} HP ÷ ${fmt.n1(per)} por disparo = <b>${v.shots}</b></div><div>(${v.shots} − 1) ÷ ${fmt.n1(w.rate)}/s + ${v.reloads} recarga(s) = <b>${fmt.n2(v.t)} s</b></div>`,
            (e as MouseEvent).clientX,
            (e as MouseEvent).clientY,
          );
        }),
      );
      grid.addEventListener("mouseleave", hideTip);
    };
    root.querySelector(".ttk-d")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-d]") as HTMLElement | null;
      if (!b) return;
      diff = b.dataset.d as Diff;
      root.querySelectorAll(".ttk-d button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    });
    root.querySelector(".ttk-h")!.addEventListener("change", render);
    render();
  },
};
