// Capítulo 07 — O mapa: grade interativa, rota, gatilhos de susto, gerador.

import type { SlideDef } from "../deck";
import { esc, fmt } from "../dom";
import { nivel } from "../data/nivel";
import { MapView, cellLabel, GROUP_COLOR, KEY_HEX, ZONE_FLOOR, type Layer } from "../mapview";
import { Level } from "../../world/Level";
import { MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS, MAP_W, MAP_H } from "../../levels/setorZero";
import { ZONES, CELL } from "../../levels/LevelData";
import { KIND_BY_CHAR } from "../../game/enemies/Enemies";
import { PICKUP_TABLE } from "../../game/Pickups";
import { GROUPS, KIND_LABEL, ENEMIES, PICKUPS } from "../data/balance";
import { showTip, hideTip } from "../tooltip";
import { codeBlock } from "../highlight";
import { snippet } from "../data/codigo";
import { IMG, combine } from "./common";

// Rota principal: waypoints na ordem das chaves.
const WAYPOINTS: { c: [number, number]; n: string }[] = [
  { c: [5, 64], n: "início (elevador de descida)" },
  { c: [80, 54], n: "chave vermelha (cisterna)" },
  { c: [30, 43], n: "porta vermelha" },
  { c: [18, 15], n: "chave azul (catacumbas)" },
  { c: [36, 15], n: "porta azul → forja" },
  { c: [53, 10], n: "porta das minas" },
  { c: [80, 32], n: "chave amarela (troll)" },
  { c: [52, 34], n: "porta amarela → arena" },
  { c: [44, 34], n: "Rei Troll" },
  { c: [44, 25], n: "elevador de saída" },
];

let routeCache: { pts: [number, number][]; meters: number; legs: number[] } | null = null;
function route(): { pts: [number, number][]; meters: number; legs: number[] } {
  if (routeCache) return routeCache;
  // Instância separada, com todas as portas abertas (a rota assume as chaves).
  const lv = new Level(MAP_ROWS, ZONE_ROWS, CEIL_RECTS, TRIGGERS);
  lv.doors.forEach((d) => (d.open = 1));
  const field = new Float32Array(lv.W * lv.H);
  const pts: [number, number][] = [];
  const legs: number[] = [];
  let meters = 0;
  for (let k = 0; k + 1 < WAYPOINTS.length; k++) {
    const [sx, sz] = WAYPOINTS[k].c, [tx, tz] = WAYPOINTS[k + 1].c;
    lv.pathField(tx, tz, field, 1e9);
    let cx = sx, cz = sz;
    let leg = 0;
    pts.push([cx, cz]);
    for (let guard = 0; guard < 2000 && (cx !== tx || cz !== tz); guard++) {
      const here = lv.idx(cx, cz);
      let best = field[here], bx = -1, bz = -1;
      for (let oz = -1; oz <= 1; oz++)
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oz) continue;
          const nx = cx + ox, nz = cz + oz;
          if (!lv.inBounds(nx, nz)) continue;
          const j = lv.idx(nx, nz);
          if (field[j] < best && lv.walkable(here, nx, nz)) {
            if (ox && oz && (!lv.walkable(here, cx + ox, cz) || !lv.walkable(here, cx, cz + oz))) continue;
            best = field[j];
            bx = nx;
            bz = nz;
          }
        }
      if (bx < 0) break;
      leg += Math.hypot(bx - cx, bz - cz) * CELL;
      cx = bx;
      cz = bz;
      pts.push([cx, cz]);
    }
    legs.push(leg);
    meters += leg;
  }
  routeCache = { pts, meters, legs };
  return routeCache;
}

const LAYERS: { k: Layer | "route" | "zones"; label: string; on: boolean }[] = [
  { k: "entities", label: "inimigos", on: true },
  { k: "pickups", label: "itens", on: true },
  { k: "doors", label: "portas", on: true },
  { k: "lights", label: "luzes", on: false },
  { k: "triggers", label: "gatilhos", on: false },
  { k: "route", label: "rota principal", on: true },
];

export const mapa: SlideDef = {
  id: "mapa",
  title: "O mapa: 88 × 70 células de 2,5 m",
  lead: "Cerca de 220 × 175 metros numa grade só. A rota das chaves foi calculada agora, com o mesmo Dijkstra que os inimigos usam. Passe o mouse para inspecionar as células.",
  body: () => {
    const n = (f: (ch: string) => boolean) => MAP_ROWS.join("").split("").filter(f).length;
    return `
    <div class="mp fill">
      <div class="panel flush mp-view"><canvas class="mp-canvas"></canvas></div>
      <div class="stack mp-side">
        <div class="panel tight"><div class="h4">Camadas</div><div class="mp-layers">${LAYERS.map((l) => `<label class="chk"><input type="checkbox" data-l="${l.k}" ${l.on ? "checked" : ""}> ${l.label}</label>`).join("")}</div></div>
        <div class="panel tight"><div class="h4">Zonas</div><div class="legend">${ZONES.map((z, i) => `<span><i style="background:${ZONE_FLOOR[i]}"></i>${esc(z.name.toLowerCase())}</span>`).join("")}<span><i style="background:#a8431a"></i>lava</span><span><i style="background:#1d4a5c"></i>água</span></div></div>
        <div class="panel tight"><div class="h4">Inimigos</div><div class="legend">${GROUPS.map((g) => `<span><i style="background:${GROUP_COLOR[g]};border-radius:50%"></i>${g}</span>`).join("")}</div></div>
        <div class="panel tight mp-stats">
          <div class="kv"><span>células de chão</span><b class="num">${fmt.n0(MAP_W * MAP_H - n((c) => "#g%".includes(c)))}</b></div>
          <div class="kv"><span>inimigos no mapa + gatilhos + chefe</span><b class="num">${ENEMIES.filter((e) => e.origem === "mapa").length} + ${ENEMIES.filter((e) => e.origem === "gatilho").length} + 8</b></div>
          <div class="kv"><span>itens</span><b class="num">${PICKUPS.length}</b></div>
          <div class="kv"><span>luzes (tochas, braseiros, lâmpadas, lava)</span><b class="num">${nivel().lights.length}</b></div>
          <div class="kv"><span>portas (3 trancadas, 3 secretas)</span><b class="num">${nivel().doors.length}</b></div>
          <div class="kv"><span>rota principal</span><b class="num mp-route-len">…</b></div>
        </div>
      </div>
    </div>`;
  },
  mount: (root) => {
    const lv = nivel();
    const canvas = root.querySelector(".mp-canvas") as HTMLCanvasElement;
    const mv = new MapView(canvas, lv);
    const on = new Set(LAYERS.filter((l) => l.on).map((l) => l.k));
    const r = route();
    (root.querySelector(".mp-route-len") as HTMLElement).textContent = `≈ ${fmt.n0(r.meters)} m`;
    let hover: [number, number] | null = null;
    const draw = () => {
      mv.layers = new Set(Array.from(on).filter((k) => k !== "route" && k !== "zones") as Layer[]);
      mv.draw((c, m) => {
        if (on.has("route")) {
          c.strokeStyle = "#ece6dadd";
          c.lineWidth = Math.max(2, m.cs * 0.22);
          c.setLineDash([m.cs * 0.6, m.cs * 0.4]);
          c.beginPath();
          r.pts.forEach(([x, z], i) => {
            const [X, Y] = m.px(x, z);
            if (i) c.lineTo(X, Y);
            else c.moveTo(X, Y);
          });
          c.stroke();
          c.setLineDash([]);
          WAYPOINTS.forEach((w, i) => {
            const [X, Y] = m.px(w.c[0], w.c[1]);
            c.fillStyle = "#0b0f13";
            c.strokeStyle = "#ece6da";
            c.lineWidth = 2;
            c.beginPath();
            c.arc(X, Y, m.cs * 0.75, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.fillStyle = "#ece6da";
            c.font = `600 ${Math.round(m.cs * 0.95)}px "IBM Plex Mono", monospace`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(String(i + 1), X, Y + 1);
          });
        }
        if (hover) {
          c.strokeStyle = "#8fd1e0";
          c.lineWidth = 2;
          c.strokeRect(m.ox + hover[0] * m.cs, m.oy + hover[1] * m.cs, m.cs, m.cs);
        }
      });
    };
    const onLayer = (e: Event) => {
      const i = e.target as HTMLInputElement;
      if (!i.dataset.l) return;
      if (i.checked) on.add(i.dataset.l as Layer);
      else on.delete(i.dataset.l as Layer);
      draw();
    };
    const onMove = (e: MouseEvent) => {
      const c = mv.cellAt(e);
      hover = c;
      draw();
      if (!c) return hideTip();
      const [cx, cz] = c;
      const i = lv.idx(cx, cz);
      const ch = MAP_ROWS[cz][cx];
      const k = KIND_BY_CHAR[ch];
      const p = PICKUP_TABLE[ch];
      const wp = WAYPOINTS.findIndex((w) => w.c[0] === cx && w.c[1] === cz);
      const trig = lv.triggers.filter((t) => cx >= t.rect[0] && cx <= t.rect[2] && cz >= t.rect[1] && cz <= t.rect[3]).map((t) => t.name);
      const ent = k ? `inimigo: <b>${KIND_LABEL[k]}</b>` : p ? `item: <b>${p.kind === "health" ? `vida +${p.amount}` : p.kind === "ammo" ? `munição +${p.amount}` : p.kind === "weapon" ? p.weapon : `chave ${p.key}`}</b>` : "";
      showTip(
        `<b>(${cx}, ${cz})</b> · ${esc(cellLabel(lv, cx, cz))}<div class="k">${esc(ZONES[lv.zone[i]].name.toLowerCase())} · piso ${fmt.n2(lv.floorH[i])} m · teto ${fmt.n1(lv.ceilH[i])} m · caractere '${esc(ch)}'</div>${ent ? `<div>${ent}</div>` : ""}${wp >= 0 ? `<div>rota ${wp + 1}: ${esc(WAYPOINTS[wp].n)}</div>` : ""}${trig.length ? `<div class="k">gatilho: ${esc(trig.join(", "))}</div>` : ""}`,
        e.clientX,
        e.clientY,
      );
    };
    const onLeave = () => {
      hover = null;
      hideTip();
      draw();
    };
    root.querySelector(".mp-layers")!.addEventListener("change", onLayer);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    draw();
    return combine(
      () => ro.disconnect(),
      () => root.querySelector(".mp-layers")!.removeEventListener("change", onLayer),
      () => canvas.removeEventListener("mousemove", onMove),
      () => canvas.removeEventListener("mouseleave", onLeave),
    );
  },
};

// ------------------------------------------------------------ sustos
// Um campo por linha (arrays numa linha só), como no arquivo gerado.
function jsonCompact(o: object): string {
  return "{\n" + Object.entries(o).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`).join(",\n") + "\n}";
}

const TRIG_TXT: Record<string, string> = {
  red_key: "Pegar a chave vermelha apaga as luzes da cisterna e solta ratos e corredoras dos dois lados.",
  cata_enter: "Ao entrar nas catacumbas, a porta bate atrás do jogador; uma sombra aparece no fundo.",
  ossuary: "Só um sussurro e uma mensagem: “Tem algo aqui dentro com você.” Tensão sem inimigo.",
  blue_key: "A chave azul apaga a zona inteira das catacumbas: três sombras e uma corredora no escuro.",
  lava_hall: "Aviso de perigo ambiental (a lava fere e a água atrasa).",
  arena: "A porta da arena se tranca; começa a luta com o Rei Troll (com barra de vida).",
  mine_enter: "Rugido distante: o troll das minas já está lá, dormindo.",
  yellow_key: "Pegar a chave amarela acorda o troll e tudo o que está na área dele.",
};

export const sustos: SlideDef = {
  id: "sustos",
  title: "Gatilhos de susto",
  lead: "O mapa não é só geometria: o gerador escreve gatilhos (retângulos na grade) com ações. É assim que o pedido “tomar algum susto” virou dado.",
  body: () => `
  <div class="trg fill">
    <div class="trg-list scroll">${TRIGGERS.map(
      (t, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}"><b class="mono">${esc(t.name)}</b><span class="small muted">${esc(t.message ?? "")}</span><span class="row" style="gap:6px">${t.on ? `<span class="tag" style="color:${KEY_HEX[t.on.replace("key_", "")]}">ao pegar a chave</span>` : `<span class="tag">ao entrar</span>`}${t.lights_off ? `<span class="tag bug">apaga luzes</span>` : ""}${t.spawn?.length ? `<span class="tag warn">+${t.spawn.length} inimigos</span>` : ""}${t.close_door ? `<span class="tag">tranca porta</span>` : ""}${t.boss ? `<span class="tag cpu">chefe</span>` : ""}${t.wake ? `<span class="tag">acorda área</span>` : ""}</span></button>`,
    ).join("")}</div>
    <div class="panel flush trg-view"><canvas class="trg-canvas"></canvas></div>
    <div class="panel trg-detail scroll"></div>
  </div>`,
  mount: (root) => {
    const lv = nivel();
    const canvas = root.querySelector(".trg-canvas") as HTMLCanvasElement;
    const detail = root.querySelector(".trg-detail") as HTMLElement;
    const mv = new MapView(canvas, lv, { layers: ["doors", "entities", "pickups"], dim: 0.25 });
    let cur = 0;
    const draw = () => {
      const t = TRIGGERS[cur];
      const [a, b, c2, d] = t.rect;
      const pts: [number, number][] = [[a, b], [c2, d], ...(t.spawn ?? []).map((s) => [s[1], s[2]] as [number, number])];
      if (t.close_door) pts.push(t.close_door);
      if (t.wake) pts.push([t.wake[0], t.wake[1]], [t.wake[2], t.wake[3]]);
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      const pad = 6;
      mv.region = [Math.max(0, Math.min(...xs) - pad), Math.max(0, Math.min(...zs) - pad), Math.min(lv.W - 1, Math.max(...xs) + pad), Math.min(lv.H - 1, Math.max(...zs) + pad)];
      mv.draw((c, m) => {
        c.fillStyle = "#e0564c33";
        c.strokeStyle = "#e0564c";
        c.lineWidth = 2;
        c.fillRect(m.ox + a * m.cs, m.oy + b * m.cs, (c2 - a + 1) * m.cs, (d - b + 1) * m.cs);
        c.strokeRect(m.ox + a * m.cs, m.oy + b * m.cs, (c2 - a + 1) * m.cs, (d - b + 1) * m.cs);
        if (t.wake) {
          c.setLineDash([6, 5]);
          c.strokeStyle = "#fab219";
          c.strokeRect(m.ox + t.wake[0] * m.cs, m.oy + t.wake[1] * m.cs, (t.wake[2] - t.wake[0] + 1) * m.cs, (t.wake[3] - t.wake[1] + 1) * m.cs);
          c.setLineDash([]);
        }
        for (const [ch, x, z] of t.spawn ?? []) {
          const [X, Y] = m.px(x, z);
          const k = KIND_BY_CHAR[ch];
          c.fillStyle = GROUP_COLOR[GROUPS.find((g) => g === (k === "rat" ? "Ratazanas" : k === "shade" ? "Abissal e Sombra" : "Zumbis"))!];
          c.strokeStyle = "#fff";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(X, Y, m.cs * 0.45, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
        if (t.close_door) {
          const [X, Y] = m.px(t.close_door[0], t.close_door[1]);
          c.strokeStyle = "#fab219";
          c.lineWidth = 3;
          c.strokeRect(X - m.cs * 0.6, Y - m.cs * 0.6, m.cs * 1.2, m.cs * 1.2);
        }
      });
      const actions: string[] = [];
      if (t.on) actions.push(`dispara ao pegar a <b>chave ${t.on.replace("key_", "")}</b>`);
      else actions.push("dispara ao <b>entrar</b> no retângulo");
      if (t.lights_off) actions.push(`apaga as luzes de <b>${esc(t.lights_off === "k" ? "toda a zona" : t.lights_off)}</b>`);
      if (t.spawn?.length) actions.push(`faz surgir <b>${t.spawn.map((s) => KIND_LABEL[KIND_BY_CHAR[s[0]]]).join(", ")}</b>`);
      if (t.close_door) actions.push(`tranca a porta em (${t.close_door.join(", ")})`);
      if (t.wake) actions.push("acorda todos os inimigos da área tracejada");
      if (t.boss) actions.push("inicia a luta com o chefe");
      if (t.sound) actions.push(`som: <b>${esc(t.sound)}</b>`);
      detail.innerHTML = `<div class="h4">${esc(t.name)}</div><p class="lead-small">“${esc(t.message ?? "")}”</p><p class="small">${esc(TRIG_TXT[t.name] ?? "")}</p><ul class="dash small">${actions.map((a) => `<li>${a}</li>`).join("")}</ul>
        <div class="mono small dim" style="margin-top:10px">setorZero.ts (gerado)</div>${codeBlock(jsonCompact(t), "json", { numbers: false })}`;
    };
    const onClick = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!b) return;
      cur = Number(b.dataset.i);
      root.querySelectorAll(".trg-list button").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    };
    root.querySelector(".trg-list")!.addEventListener("click", onClick);
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    draw();
    return combine(() => ro.disconnect(), () => root.querySelector(".trg-list")!.removeEventListener("click", onClick));
  },
};

export const gerador: SlideDef = {
  id: "gerador",
  title: "O mapa é gerado e validado por script",
  lead: "Ninguém desenhou o mapa à mão célula a célula: <code>build_map.py</code> descreve salas e corredores com primitivas e depois <b>prova</b> que o jogo é zerável — cada chave alcançável só com as chaves anteriores.",
  body: () => {
    const s1 = snippet("tools/level/build_map.py", "def room(", "def ceil(", 22);
    const s2 = snippet("tools/level/build_map.py", "def reachable(", "return seen", 22);
    return `
    <div class="cols fill" style="grid-template-columns: 1fr 1fr 0.9fr">
      <div class="stack"><div class="h4">Primitivas de desenho</div>${codeBlock(s1.code, "py", { from: s1.from })}</div>
      <div class="stack"><div class="h4">Validação: busca em largura com chaves</div>${codeBlock(s2.code, "py", { from: s2.from })}</div>
      <div class="stack">
        <figure><img src="${IMG}pipeline/mapa_gerador.jpg" alt="Prévia do mapa gerada pelo script" data-zoom><figcaption>Prévia em PNG gerada pelo próprio script</figcaption></figure>
        <div class="panel tight small">
          <div class="h4">Legenda do ASCII</div>
          <div class="ascii-legend mono">
            <span><b>#</b> parede</span><span><b>.</b> chão</span><span><b>~</b> água</span><span><b>=</b> lava</span><span><b>^</b> plataforma</span><span><b>o</b> coluna</span><span><b>D</b> porta</span><span><b>R B Y</b> trancadas</span><span><b>H</b> secreta</span><span><b>z Z p r a d T K</b> inimigos</span><span><b>h m</b> vida</span><span><b>1–4</b> munição</span><span><b>S W Q V</b> armas</span><span><b>! $ &amp;</b> chaves</span><span><b>t L l</b> luzes</span>
          </div>
        </div>
      </div>
    </div>`;
  },
};

