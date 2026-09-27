// Capítulo 08 — IA dos inimigos: máquina de estados, fichas, campo de
// caminhos (Dijkstra) e uma sandbox que roda a IA no mapa real.

import type { SlideDef } from "../deck";
import { esc, fmt, loop } from "../dom";
import { ENEMY_DEFS, KIND_BY_CHAR, type EnemyKind } from "../../game/enemies/Enemies";
import { CELL, Cell } from "../../levels/LevelData";
import { MAP_ROWS } from "../../levels/setorZero";
import { KINDS, KIND_LABEL, COUNTS, GROUP_OF } from "../data/balance";
import { nivel } from "../data/nivel";
import { MapView, GROUP_COLOR } from "../mapview";
import { codeBlock } from "../highlight";
import { snippet } from "../data/codigo";
import { seqColor } from "../charts";
import { showTip, hideTip } from "../tooltip";
import { goTo } from "../nav";
import { showInGallery } from "./galeria";
import { IMG, combine } from "./common";

// ------------------------------------------------------------ máquina de estados
type S = "SLEEP" | "LURE" | "PLAYDEAD" | "RISE" | "ALERT" | "CHASE" | "ATTACK" | "CAST" | "HURT" | "DEAD";
const POS: Record<S, [number, number]> = {
  SLEEP: [110, 90],
  LURE: [110, 250],
  PLAYDEAD: [110, 410],
  RISE: [300, 470],
  ALERT: [320, 170],
  CHASE: [560, 280],
  ATTACK: [800, 120],
  CAST: [830, 290],
  HURT: [800, 450],
  DEAD: [560, 520],
};
const EDGES: [S, S, string, number?][] = [
  ["SLEEP", "ALERT", "vê o jogador · tiro ouvido · dano"],
  ["LURE", "ALERT", "jogador a < 7 m visível, ou < 3 m"],
  ["PLAYDEAD", "RISE", "jogador a < 3,4 m"],
  ["RISE", "CHASE", "levantou (morte ao contrário)"],
  ["ALERT", "CHASE", "0,35 s (abissal 0,8 · troll 1,0)"],
  ["CHASE", "ATTACK", "no alcance + recarga + visão", -18],
  ["ATTACK", "CHASE", "fim do golpe", 18],
  ["CHASE", "CAST", "sombra: 4–20 m, visão", -14],
  ["CAST", "CHASE", "raio lançado", 14],
  ["CHASE", "HURT", "dano (chance = pain)", -16],
  ["HURT", "CHASE", "0,32 s", 16],
  ["CHASE", "DEAD", "HP ≤ 0"],
];
const APPLIES: Record<EnemyKind, S[]> = {
  zombie: ["SLEEP", "ALERT", "CHASE", "ATTACK", "HURT", "DEAD"],
  runner: ["SLEEP", "ALERT", "CHASE", "ATTACK", "HURT", "DEAD"],
  corpse: ["PLAYDEAD", "RISE", "CHASE", "ATTACK", "HURT", "DEAD"],
  rat: ["SLEEP", "ALERT", "CHASE", "ATTACK", "HURT", "DEAD"],
  angler: ["LURE", "ALERT", "CHASE", "ATTACK", "HURT", "DEAD"],
  shade: ["SLEEP", "ALERT", "CHASE", "ATTACK", "CAST", "HURT", "DEAD"],
  troll: ["SLEEP", "ALERT", "CHASE", "ATTACK", "HURT", "DEAD"],
  king: ["SLEEP", "ALERT", "CHASE", "ATTACK", "DEAD"],
};
const STATE_INFO: Record<S, { d: string; from: string; to: string }> = {
  SLEEP: { d: "Parado até perceber o jogador: precisa vê-lo dentro do alcance de visão e mais ou menos de frente (ou muito perto). Um tiro acorda quem estiver perto PELO CAMINHO (campo de Dijkstra), não em linha reta.", from: "case St.SLEEP:", to: "break;" },
  LURE: { d: "O abissal fica imóvel no escuro com a isca acesa (uma luz dinâmica). Só vê a 7 m — mas se o jogador chegar a 3 m, ataca de qualquer jeito. É o principal susto do jogo.", from: "case St.LURE:", to: "break;" },
  PLAYDEAD: { d: "Zumbi “caído” no chão com a pose final da morte. Enquanto finge, a caixa de acerto é baixa (bug corrigido no fim do prompt).", from: "case St.PLAYDEAD:", to: "break;" },
  RISE: { d: "Levanta tocando o clipe de morte AO CONTRÁRIO (velocidade −1,3) — foi preciso ensinar o animador a tocar clipes de trás para frente.", from: "case St.RISE:", to: "break;" },
  ALERT: { d: "Percebeu o jogador: grita (som 3D) e vira para ele por um instante antes de correr. Dá ao jogador tempo de reagir.", from: "case St.ALERT:", to: "break;" },
  CHASE: { d: "Persegue. Se vê o jogador a menos de 16 m, vai direto; senão desce o campo de caminhos (Dijkstra). Abre portas normais no caminho, anda mais devagar na água, desvia se travar. Ratos fazem zigue-zague.", from: "case St.CHASE: {", to: "this.idleSounds(e, dt, dist, audio);" },
  ATTACK: { d: "Golpe corpo a corpo sincronizado com a animação: o dano só acontece no quadro de impacto (hitTime) e se o jogador ainda estiver na frente e no alcance. Trolls tremem a câmera.", from: "case St.ATTACK: {", to: "e.setState(St.CHASE);" },
  CAST: { d: "A sombra lança um raio elétrico mirando um pouco à frente do jogador (antecipação de 0,25 s). Depois de levar dano, às vezes some e reaparece perto (teleporte).", from: "case St.CAST: {", to: "e.setState(St.CHASE);" },
  HURT: { d: "Cambaleia 0,32 s ao levar dano, com probabilidade = pain (zumbi 50%, troll 5%, Rei 0%).", from: "case St.HURT:", to: "break;" },
  DEAD: { d: "Cadáver com poça de sangue; zumbis podem soltar munição (30%). A sombra se desfaz no chão. O Rei abre a saída.", from: "private kill(", to: "events.onDeath(e);" },
};

function fsmSvg(): string {
  const W = 940, H = 580, rw = 132, rh = 46;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="fsm-svg" role="img" aria-label="Máquina de estados dos inimigos"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#7c8792"/></marker></defs>`;
  for (const [a, b, label, bend] of EDGES) {
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const off = bend ?? 0;
    const nx = -uy * off, ny = ux * off;
    const clip = (px: number, py: number, sx: number, sy: number): [number, number] => {
      const tx = Math.abs(sx) > 1e-6 ? (rw / 2 + 6) / Math.abs(sx) : Infinity;
      const ty = Math.abs(sy) > 1e-6 ? (rh / 2 + 6) / Math.abs(sy) : Infinity;
      const t = Math.min(tx, ty);
      return [px + sx * t, py + sy * t];
    };
    const [sx, sy] = clip(x1 + nx, y1 + ny, ux, uy);
    const [ex, ey] = clip(x2 + nx, y2 + ny, -ux, -uy);
    s += `<g class="fsm-edge" data-a="${a}" data-b="${b}"><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#56626e" stroke-width="2" marker-end="url(#arr)"/>`;
    const mx = (sx + ex) / 2 + nx * 0.6, my = (sy + ey) / 2 + ny * 0.6;
    s += `<text class="fsm-lbl" x="${mx}" y="${my - 6}" text-anchor="middle">${esc(label)}</text></g>`;
  }
  for (const k of Object.keys(POS) as S[]) {
    const [x, y] = POS[k];
    s += `<g class="fsm-node" data-s="${k}"><rect x="${x - rw / 2}" y="${y - rh / 2}" width="${rw}" height="${rh}" rx="8"/><text x="${x}" y="${y + 6}" text-anchor="middle">${k}</text></g>`;
  }
  return s + `</svg>`;
}

export const fsm: SlideDef = {
  id: "ia-estados",
  title: "A máquina de estados",
  lead: "Da FSM de 6 estados da fase 7 para 10 estados no jogo final. Escolha um inimigo para ver quais estados ele usa; clique num estado para ler o código.",
  body: () => `
  <div class="fsm fill">
    <div class="stack">
      <div class="seg-ctl sm fsm-kinds">${KINDS.map((k, i) => `<button data-k="${k}" class="${i ? "" : "on"}">${esc(KIND_LABEL[k])}</button>`).join("")}</div>
      <div class="panel flush fsm-host">${fsmSvg()}</div>
    </div>
    <div class="panel fsm-detail scroll"></div>
  </div>`,
  init: (root) => {
    const detail = root.querySelector(".fsm-detail") as HTMLElement;
    let kind: EnemyKind = "zombie";
    let state: S = "CHASE";
    const render = () => {
      const ap = new Set(APPLIES[kind]);
      root.querySelectorAll(".fsm-node").forEach((n) => {
        const s = (n as SVGElement).dataset.s as S;
        n.classList.toggle("off", !ap.has(s));
        n.classList.toggle("on", s === state);
      });
      root.querySelectorAll(".fsm-edge").forEach((e) => {
        const a = (e as SVGElement).dataset.a as S, b = (e as SVGElement).dataset.b as S;
        e.classList.toggle("off", !(ap.has(a) && ap.has(b)));
        e.classList.toggle("on", a === state || b === state);
      });
      const inf = STATE_INFO[state];
      const sn = snippet("src/game/enemies/Enemies.ts", inf.from, inf.to, 30);
      const d = ENEMY_DEFS[kind];
      detail.innerHTML = `<div class="row"><span class="tag cpu">CPU</span><h3 style="margin:0">${state}</h3></div><p class="small">${esc(inf.d)}</p>
        <div class="kv small"><span>${esc(KIND_LABEL[kind])}</span><b>visão ${d.sight} m · alcance ${d.range} m · recarga ${d.cooldown} s · pain ${Math.round(d.pain * 100)}%</b></div>
        <div class="mono small dim" style="margin:8px 0 4px">src/game/enemies/Enemies.ts · linha ${sn.from}</div>${codeBlock(sn.code, "ts", { from: sn.from })}`;
    };
    root.querySelector(".fsm-kinds")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-k]") as HTMLElement | null;
      if (!b) return;
      kind = b.dataset.k as EnemyKind;
      root.querySelectorAll(".fsm-kinds button").forEach((x) => x.classList.toggle("on", x === b));
      if (!APPLIES[kind].includes(state)) state = "CHASE";
      render();
    });
    root.querySelector(".fsm-host")!.addEventListener("click", (e) => {
      const n = (e.target as Element).closest(".fsm-node") as SVGElement | null;
      if (!n) return;
      state = n.dataset.s as S;
      render();
    });
    render();
  },
};

// ------------------------------------------------------------ fichas
const KIND_IMG: Record<EnemyKind, string> = {
  zombie: "testes/c_chase.jpg",
  runner: "testes/s_redkey.jpg",
  corpse: "testes/ai_corpse.jpg",
  rat: "testes/e_rat.jpg",
  angler: "testes/e_angler.jpg",
  shade: "testes/e_shade.jpg",
  troll: "testes/e_troll.jpg",
  king: "testes/s_arena.jpg",
};
const KIND_TXT: Record<EnemyKind, string> = {
  zombie: "Lento, aguenta tiros, anda em grupo. O inimigo básico do §12.",
  runner: "Mesma malha com outra pele: rápido e frágil. O “inimigo rápido” do §12.",
  corpse: "Finge estar morto até o jogador chegar perto — e levanta.",
  rat: "Bandos nos esgotos: rápido, pouco dano, salto no ataque, zigue-zague.",
  angler: "Emboscada: parado no escuro com a isca luminosa; 7 m de visão, bote de 27.",
  shade: "Lança raios a até 20 m e se teleporta ao levar dano.",
  troll: "O “inimigo pesado”: 520 de vida, golpe de 32 que treme a tela.",
  king: "Chefe: 1700 de vida, chama 2 ondas de reforços e fica furioso abaixo de 40%.",
};

export const fichas: SlideDef = {
  id: "ia-fichas",
  title: "Oito tipos de inimigo",
  lead: "Todos os números vêm de <code>ENEMY_DEFS</code>, a mesma tabela que o jogo usa. As barras comparam cada atributo com o maior valor entre os oito.",
  body: () => {
    const max = { hp: 1700, speed: 5.2, damage: 42, sight: 40 };
    const bar = (v: number, m: number, cls = "") => `<i class="bar ${cls}" style="width:${Math.max(3, (v / m) * 100)}%"></i>`;
    return `<div class="cards fill">${KINDS.map((k) => {
      const d = ENEMY_DEFS[k];
      const c = COUNTS[k];
      return `<div class="panel ecard">
        <img src="${IMG}${KIND_IMG[k]}" alt="${esc(KIND_LABEL[k])}" loading="lazy" data-zoom>
        <div class="row"><b>${esc(KIND_LABEL[k])}</b><span class="spacer"></span><i class="dotc" style="background:${GROUP_COLOR[GROUP_OF[k]]}"></i><span class="mono small dim">${c.mapa + c.gatilho + c.chefe}×</span></div>
        <p class="small muted">${esc(KIND_TXT[k])}</p>
        <div class="bars">
          <span>vida</span>${bar(d.hp, max.hp)}<b class="num">${d.hp}</b>
          <span>velocidade</span>${bar(d.speed, max.speed)}<b class="num">${fmt.n1(d.speed)}</b>
          <span>dano</span>${bar(d.damage, max.damage)}<b class="num">${d.damage}</b>
          <span>visão</span>${bar(d.sight, max.sight)}<b class="num">${d.sight}</b>
        </div>
        <button class="btn sm ghost" data-3d="${d.model}">ver em 3D →</button>
      </div>`;
    }).join("")}</div>`;
  },
  init: (root) => {
    root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-3d]") as HTMLElement | null;
      if (!b) return;
      showInGallery(b.dataset["3d"]!);
      goTo("galeria-3d");
    });
  },
};

// ------------------------------------------------------------ campo de caminhos
export const dijkstra: SlideDef = {
  id: "ia-caminhos",
  title: "Campo de caminhos (Dijkstra)",
  lead: "Em vez de calcular um caminho por inimigo, o jogo calcula UM campo: a distância de cada célula até o jogador. Cada inimigo só olha os 8 vizinhos e anda para o menor. Clique para mover o “jogador”.",
  body: () => `
  <div class="dj fill">
    <div class="panel flush dj-view"><canvas class="dj-canvas"></canvas></div>
    <div class="stack">
      <div class="panel stack tight">
        <div class="row"><button class="btn sm dj-replay">Refazer a onda</button><label class="chk"><input type="checkbox" class="dj-paths" checked> caminhos dos inimigos</label></div>
        <label class="ctl">Alcance máximo (custo) <span class="v dj-max-v">70</span><input type="range" class="dj-max" min="10" max="140" value="70"></label>
      </div>
      <div class="panel small">
        <div class="h4">Custos (grade de 8 vizinhos)</div>
        <div class="kv"><span>passo reto</span><b>1</b></div><div class="kv"><span>diagonal</span><b>1,414</b></div><div class="kv"><span>água</span><b>× 1,6</b></div><div class="kv"><span>lava</span><b>× 10</b></div>
        <p class="cap dim" style="margin:8px 0 0">Sem cortar quinas; degraus &gt; 0,6 m e portas trancadas bloqueiam. Recalculado a cada 0,3 s ou quando o jogador muda de célula.</p>
      </div>
      <div class="panel tight dj-info small"></div>
      ${codeBlock(snippet("src/world/Level.ts", "pathField(tx: number", "heap.push(j, nd);", 26).code, "ts", { from: snippet("src/world/Level.ts", "pathField(tx: number").from })}
    </div>
  </div>`,
  mount: (root) => {
    const lv = nivel();
    const canvas = root.querySelector(".dj-canvas") as HTMLCanvasElement;
    const mv = new MapView(canvas, lv, { layers: ["doors"], dim: 0.1 });
    const field = new Float32Array(lv.W * lv.H);
    let target: [number, number] = [45, 56];
    let maxD = 70;
    let wave = 0;
    let fmax = 1;
    const enemies: [number, number][] = [];
    MAP_ROWS.forEach((row, z) => {
      for (let x = 0; x < row.length; x++) if (KIND_BY_CHAR[row[x]]) enemies.push([x, z]);
    });
    const compute = () => {
      const t0 = performance.now();
      lv.pathField(target[0], target[1], field, maxD);
      const ms = performance.now() - t0;
      fmax = 1;
      let reached = 0;
      for (let i = 0; i < field.length; i++) if (isFinite(field[i])) {
        fmax = Math.max(fmax, field[i]);
        reached++;
      }
      wave = 0;
      (root.querySelector(".dj-info") as HTMLElement).innerHTML = `Jogador em (${target[0]}, ${target[1]}) · <b>${fmt.n0(reached)}</b> células alcançadas em <b>${fmt.n1(ms)} ms</b> (nesta CPU, com a mesma função do jogo).`;
    };
    const pathFrom = (sx: number, sz: number): [number, number][] => {
      const pts: [number, number][] = [[sx, sz]];
      let cx = sx, cz = sz;
      for (let g = 0; g < 300; g++) {
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
        cx = bx;
        cz = bz;
        pts.push([cx, cz]);
      }
      return pts;
    };
    compute();
    const stop = loop((dt) => {
      wave = Math.min(fmax, wave + dt * fmax * 0.6);
      const showPaths = (root.querySelector(".dj-paths") as HTMLInputElement).checked;
      mv.draw((c, m) => {
        for (let z = 0; z < lv.H; z++)
          for (let x = 0; x < lv.W; x++) {
            const d = field[lv.idx(x, z)];
            if (!isFinite(d) || d > wave) continue;
            c.fillStyle = seqColor(1 - d / fmax);
            c.globalAlpha = 0.8;
            c.fillRect(m.ox + x * m.cs, m.oy + z * m.cs, m.cs + 0.5, m.cs + 0.5);
          }
        c.globalAlpha = 1;
        for (const [ex, ez] of enemies) {
          const i = lv.idx(ex, ez);
          const reach = isFinite(field[i]) && field[i] <= wave;
          const [X, Y] = m.px(ex, ez);
          if (reach && showPaths && wave >= fmax) {
            const p = pathFrom(ex, ez);
            c.strokeStyle = "#f2a65acc";
            c.lineWidth = 1.5;
            c.beginPath();
            p.forEach(([x, z], k) => {
              const [a, b] = m.px(x, z);
              if (k) c.lineTo(a, b);
              else c.moveTo(a, b);
            });
            c.stroke();
          }
          c.fillStyle = reach ? "#f2a65a" : "#56626e";
          c.beginPath();
          c.arc(X, Y, Math.max(2, m.cs * 0.3), 0, Math.PI * 2);
          c.fill();
        }
        const [X, Y] = m.px(target[0], target[1]);
        c.fillStyle = "#ece6da";
        c.strokeStyle = "#0b0f13";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(X, Y, m.cs * 0.7, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      });
    });
    const onClick = (e: MouseEvent) => {
      const cell = mv.cellAt(e);
      if (!cell) return;
      const t = lv.type[lv.idx(cell[0], cell[1])];
      if (t === Cell.SOLID || t === Cell.COLUMN) return;
      target = cell;
      compute();
    };
    const onMove = (e: MouseEvent) => {
      const cell = mv.cellAt(e);
      if (!cell) return hideTip();
      const d = field[lv.idx(cell[0], cell[1])];
      showTip(`(${cell[0]}, ${cell[1]}) · custo até o jogador: <b>${isFinite(d) ? fmt.n1(d) : "∞ (fora do alcance)"}</b>`, e.clientX, e.clientY);
    };
    const maxEl = root.querySelector(".dj-max") as HTMLInputElement;
    const onMax = () => {
      maxD = Number(maxEl.value);
      (root.querySelector(".dj-max-v") as HTMLElement).textContent = String(maxD);
      compute();
    };
    const onReplay = () => (wave = 0);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", hideTip);
    maxEl.addEventListener("input", onMax);
    root.querySelector(".dj-replay")!.addEventListener("click", onReplay);
    return combine(stop, () => {
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
      maxEl.removeEventListener("input", onMax);
      root.querySelector(".dj-replay")!.removeEventListener("click", onReplay);
    });
  },
};

// ------------------------------------------------------------ sandbox
interface Bot {
  kind: EnemyKind;
  x: number;
  z: number;
  yaw: number;
  st: S;
  t: number;
  hp: number;
  cd: number;
  cast: number;
  see: boolean;
  seeT: number;
  zig: number;
  flash: number;
}

const REGIONS: { n: string; r: [number, number, number, number]; spawn: [number, number] }[] = [
  { n: "Acampamento", r: [0, 46, 22, 69], spawn: [5, 64] },
  { n: "Catacumbas", r: [0, 24, 36, 43], spawn: [22, 30] },
  { n: "Minas", r: [53, 2, 87, 23], spawn: [60, 10] },
];

export const sandbox: SlideDef = {
  id: "ia-sandbox",
  title: "Sandbox: a IA rodando no mapa real",
  lead: "O jogador (branco) segue o mouse. Adicione inimigos e veja os estados mudarem: visão com linha de visada na grade, perseguição pelo campo de caminhos, ataque no alcance. Clique num inimigo para atirar nele; “barulho” simula um tiro.",
  body: () => `
  <div class="sb fill" data-keys="own">
    <div class="panel flush sb-view"><canvas class="sb-canvas" tabindex="0"></canvas></div>
    <div class="stack">
      <div class="panel tight stack">
        <div class="h4" style="margin:0">Região</div>
        <div class="seg-ctl sm sb-reg">${REGIONS.map((r, i) => `<button data-r="${i}" class="${i === 1 ? "on" : ""}">${r.n}</button>`).join("")}</div>
        <div class="h4" style="margin:4px 0 0">Adicionar inimigo</div>
        <div class="sb-add">${KINDS.filter((k) => k !== "king").map((k) => `<button class="btn sm" data-k="${k}"><i class="dotc" style="background:${GROUP_COLOR[GROUP_OF[k]]}"></i>${esc(KIND_LABEL[k])}</button>`).join("")}</div>
        <div class="row"><button class="btn sm primary sb-noise">💥 Barulho (tiro)</button><button class="btn sm ghost sb-clear">Limpar</button></div>
        <div class="row"><label class="chk"><input type="checkbox" class="sb-sight" checked> raio de visão</label><label class="chk"><input type="checkbox" class="sb-god" checked> jogador imortal</label></div>
      </div>
      <div class="panel tight sb-log scroll small mono"></div>
    </div>
  </div>`,
  mount: (root) => {
    const lv = nivel();
    const canvas = root.querySelector(".sb-canvas") as HTMLCanvasElement;
    let reg = 1;
    const mv = new MapView(canvas, lv, { region: REGIONS[reg].r, layers: ["doors"], dim: 0 });
    const field = new Float32Array(lv.W * lv.H);
    let fieldT = 0;
    let fieldCell = -1;
    const player: [number, number, number] = [(REGIONS[reg].spawn[0] + 0.5) * CELL, 0, (REGIONS[reg].spawn[1] + 0.5) * CELL];
    let aim: [number, number] | null = null;
    let hp = 100;
    let bots: Bot[] = [];
    const logEl = root.querySelector(".sb-log") as HTMLElement;
    const lines: string[] = [];
    const log = (s: string) => {
      lines.unshift(s);
      lines.length = Math.min(lines.length, 40);
      logEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");
    };
    const TAU = Math.PI * 2;
    const angDiff = (a: number, b: number) => {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d;
    };
    const setSt = (b: Bot, s: S) => {
      if (b.st !== s) log(`<span style="color:${GROUP_COLOR[GROUP_OF[b.kind]]}">${KIND_LABEL[b.kind]}</span> ${b.st} → <b>${s}</b>`);
      b.st = s;
      b.t = 0;
    };
    const spawn = (kind: EnemyKind) => {
      const [x0, z0, x1, z1] = REGIONS[reg].r;
      for (let k = 0; k < 60; k++) {
        const cx = x0 + Math.floor(Math.random() * (x1 - x0 + 1)), cz = z0 + Math.floor(Math.random() * (z1 - z0 + 1));
        const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
        if (Math.hypot(x - player[0], z - player[2]) < 10) continue;
        if (!lv.fits(x, z, ENEMY_DEFS[kind].radius) || lv.typeAt(x, z) === Cell.LAVA) continue;
        const st: S = kind === "angler" ? "LURE" : kind === "corpse" ? "PLAYDEAD" : "SLEEP";
        bots.push({ kind, x, z, yaw: Math.random() * TAU, st, t: 0, hp: ENEMY_DEFS[kind].hp, cd: 0, cast: 1.5, see: false, seeT: 0, zig: Math.random() * 10, flash: 0 });
        log(`+ ${KIND_LABEL[kind]} em (${cx}, ${cz}) · ${st}`);
        return;
      }
    };
    const wake = (b: Bot) => {
      if (b.st === "PLAYDEAD") return setSt(b, "RISE");
      if (b.st === "SLEEP" || b.st === "LURE") setSt(b, "ALERT");
    };
    const setRegion = (i: number) => {
      reg = i;
      mv.region = REGIONS[i].r;
      bots = [];
      player[0] = (REGIONS[i].spawn[0] + 0.5) * CELL;
      player[2] = (REGIONS[i].spawn[1] + 0.5) * CELL;
      fieldCell = -1;
      ["zombie", "rat", "shade"].forEach((k) => spawn(k as EnemyKind));
    };
    setRegion(1);
    const stop = loop((dt) => {
      // jogador segue o mouse (com a colisão do jogo)
      if (aim) {
        const dx = aim[0] - player[0], dz = aim[1] - player[2];
        const d = Math.hypot(dx, dz);
        if (d > 0.2) {
          const s = Math.min(d, 6 * dt);
          lv.moveCircle(player, (dx / d) * s, (dz / d) * s, 0.35);
        }
      }
      const pc = lv.cellIndexAt(player[0], player[2]);
      fieldT -= dt;
      if (fieldT <= 0 || pc !== fieldCell) {
        fieldT = 0.3;
        fieldCell = pc;
        lv.pathField(Math.floor(player[0] / CELL), Math.floor(player[2] / CELL), field, 70);
      }
      const god = (root.querySelector(".sb-god") as HTMLInputElement).checked;
      for (const b of bots) {
        const d = ENEMY_DEFS[b.kind];
        b.t += dt;
        b.cd -= dt;
        b.cast -= dt;
        b.flash = Math.max(0, b.flash - dt * 2.5);
        if (b.st === "DEAD") continue;
        const dx = player[0] - b.x, dz = player[2] - b.z;
        const dist = Math.hypot(dx, dz);
        b.seeT -= dt;
        if (b.seeT <= 0) {
          b.seeT = 0.2;
          b.see = dist < 60 && lv.los(b.x, b.z, player[0], player[2]);
        }
        const toP = Math.atan2(dx, -dz);
        switch (b.st) {
          case "SLEEP":
            if (b.see && dist < d.sight && (Math.abs(angDiff(b.yaw, toP)) < 1.8 || dist < d.sight * 0.4)) wake(b);
            break;
          case "LURE":
            if ((b.see && dist < d.sight) || dist < 3) wake(b);
            break;
          case "PLAYDEAD":
            if (dist < 3.4 && b.see) wake(b);
            break;
          case "RISE":
            if (b.t > 1.2) setSt(b, "CHASE");
            break;
          case "ALERT":
            b.yaw += angDiff(b.yaw, toP) * Math.min(1, dt * 6);
            if (b.t > (b.kind === "angler" ? 0.8 : b.kind === "troll" ? 1 : 0.35)) setSt(b, "CHASE");
            break;
          case "HURT":
            if (b.t > 0.32) setSt(b, "CHASE");
            break;
          case "CHASE": {
            if (dist < d.range * d.scale && b.cd <= 0 && b.see) {
              setSt(b, "ATTACK");
              break;
            }
            if (d.ranged && b.see && dist > 4 && dist < d.ranged.range && b.cast <= 0) {
              setSt(b, "CAST");
              break;
            }
            let tx = dx, tz = dz;
            if (!(b.see && dist < 16)) {
              const cx = Math.floor(b.x / CELL), cz = Math.floor(b.z / CELL);
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
              if (bx >= 0) {
                tx = (bx + 0.5) * CELL - b.x;
                tz = (bz + 0.5) * CELL - b.z;
              } else if (!isFinite(field[here])) break;
            }
            const len = Math.hypot(tx, tz) || 1;
            let ux = tx / len, uz = tz / len;
            if (b.kind === "rat") {
              b.zig += dt * 6;
              const s = Math.sin(b.zig) * 0.55;
              const px = -uz, pz = ux;
              ux += px * s;
              uz += pz * s;
              const l2 = Math.hypot(ux, uz);
              ux /= l2;
              uz /= l2;
            }
            b.yaw += angDiff(b.yaw, Math.atan2(ux, -uz)) * Math.min(1, dt * 7);
            let sp = d.speed;
            if (lv.typeAt(b.x, b.z) === Cell.WATER) sp *= 0.7;
            const p: [number, number, number] = [b.x, 0, b.z];
            lv.moveCircle(p, ux * sp * dt, uz * sp * dt, d.radius);
            b.x = p[0];
            b.z = p[2];
            break;
          }
          case "ATTACK":
            b.yaw += angDiff(b.yaw, toP) * Math.min(1, dt * 8);
            if (b.t > 0.6 * d.hitTime * 2 && b.cd <= 0) {
              b.cd = d.cooldown + 0.6;
              if (dist < d.range * d.scale * 1.25) {
                if (!god) hp = Math.max(0, hp - d.damage);
                log(`${KIND_LABEL[b.kind]} acerta: −${d.damage} de vida`);
              }
            }
            if (b.t > 0.9) setSt(b, "CHASE");
            break;
          case "CAST":
            b.yaw += angDiff(b.yaw, toP) * Math.min(1, dt * 8);
            if (b.t > 0.5) {
              b.cast = d.ranged!.cooldown;
              log(`Sombra lança um raio (${d.ranged!.damage})`);
              if (!god) hp = Math.max(0, hp - d.ranged!.damage);
              setSt(b, "CHASE");
            }
            break;
        }
      }
      // separação simples entre inimigos acordados
      for (let i = 0; i < bots.length; i++)
        for (let j = i + 1; j < bots.length; j++) {
          const a = bots[i], c = bots[j];
          if (a.st === "DEAD" || c.st === "DEAD") continue;
          const dx = c.x - a.x, dz = c.z - a.z, m = (ENEMY_DEFS[a.kind].radius + ENEMY_DEFS[c.kind].radius) * 0.9;
          const d2 = dx * dx + dz * dz;
          if (d2 < m * m && d2 > 1e-6) {
            const dd = Math.sqrt(d2), push = ((m - dd) / dd) * 0.5;
            const pa: [number, number, number] = [a.x, 0, a.z];
            lv.moveCircle(pa, -dx * push, -dz * push, ENEMY_DEFS[a.kind].radius);
            a.x = pa[0];
            a.z = pa[2];
          }
        }
      const showSight = (root.querySelector(".sb-sight") as HTMLInputElement).checked;
      mv.draw((c, m) => {
        const [PX, PY] = m.mpx(player[0], player[2]);
        for (const b of bots) {
          const d = ENEMY_DEFS[b.kind];
          const [X, Y] = m.mpx(b.x, b.z);
          const col = GROUP_COLOR[GROUP_OF[b.kind]];
          if (b.st !== "DEAD") {
            if (showSight && (b.st === "SLEEP" || b.st === "LURE")) {
              c.strokeStyle = col + "55";
              c.lineWidth = 1;
              c.beginPath();
              c.arc(X, Y, (d.sight / CELL) * m.cs, 0, TAU);
              c.stroke();
            }
            if (b.see && b.st !== "SLEEP" && b.st !== "PLAYDEAD") {
              c.strokeStyle = b.st === "CAST" ? "#8fd1e0" : "#5fd35f88";
              c.lineWidth = b.st === "CAST" ? 3 : 1.2;
              c.setLineDash(b.st === "CAST" ? [] : [4, 4]);
              c.beginPath();
              c.moveTo(X, Y);
              c.lineTo(PX, PY);
              c.stroke();
              c.setLineDash([]);
            }
          }
          const r = Math.max(4, (d.radius / CELL) * m.cs * 1.3);
          c.globalAlpha = b.st === "DEAD" ? 0.35 : 1;
          c.fillStyle = b.flash > 0 ? "#ffffff" : col;
          c.beginPath();
          c.arc(X, Y, r, 0, TAU);
          c.fill();
          c.strokeStyle = "#0b0f13";
          c.lineWidth = 2;
          c.stroke();
          c.strokeStyle = "#0b0f13";
          c.beginPath();
          c.moveTo(X, Y);
          c.lineTo(X + Math.sin(b.yaw) * r, Y - Math.cos(b.yaw) * r);
          c.stroke();
          c.globalAlpha = 1;
          c.font = `600 ${Math.max(10, Math.round(m.cs * 0.42))}px "IBM Plex Mono", monospace`;
          c.textAlign = "center";
          c.fillStyle = "#ece6da";
          c.fillText(b.st, X, Y - r - 5);
        }
        c.fillStyle = "#ece6da";
        c.strokeStyle = "#0b0f13";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(PX, PY, Math.max(5, m.cs * 0.28), 0, TAU);
        c.fill();
        c.stroke();
        c.font = `600 ${Math.max(11, Math.round(m.cs * 0.45))}px "IBM Plex Mono", monospace`;
        c.textAlign = "left";
        c.fillStyle = hp > 30 ? "#ece6da" : "#e0564c";
        c.fillText(`vida ${hp}`, 12, 22);
      });
    });
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * canvas.width, y = ((e.clientY - r.top) / r.height) * canvas.height;
      aim = [((x - mv.ox) / mv.cs) * CELL, ((y - mv.oy) / mv.cs) * CELL];
    };
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * canvas.width, y = ((e.clientY - r.top) / r.height) * canvas.height;
      const wx = ((x - mv.ox) / mv.cs) * CELL, wz = ((y - mv.oy) / mv.cs) * CELL;
      const hit = bots.find((b) => b.st !== "DEAD" && Math.hypot(b.x - wx, b.z - wz) < Math.max(0.9, ENEMY_DEFS[b.kind].radius * 1.6));
      if (!hit) return;
      hit.hp -= 26;
      hit.flash = 0.35;
      log(`tiro no ${KIND_LABEL[hit.kind]}: −26 (${Math.max(0, hit.hp)} restantes)`);
      if (hit.hp <= 0) return setSt(hit, "DEAD");
      if (hit.st === "SLEEP" || hit.st === "LURE" || hit.st === "PLAYDEAD") wake(hit);
      else if (hit.st === "CHASE" && Math.random() < ENEMY_DEFS[hit.kind].pain) setSt(hit, "HURT");
    };
    const onNoise = () => {
      let n = 0;
      for (const b of bots) {
        if (b.st !== "SLEEP" && b.st !== "LURE" && b.st !== "PLAYDEAD") continue;
        const i = lv.cellIndexAt(b.x, b.z);
        const lim = b.st === "SLEEP" ? 16 : 16 * 0.35;
        if (i >= 0 && field[i] < lim) {
          wake(b);
          n++;
        }
      }
      log(`💥 barulho: ${n} acordado(s) pelo caminho (custo < 16)`);
    };
    const onAdd = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-k]") as HTMLElement | null;
      if (b) spawn(b.dataset.k as EnemyKind);
    };
    const onReg = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-r]") as HTMLElement | null;
      if (!b) return;
      root.querySelectorAll(".sb-reg button").forEach((x) => x.classList.toggle("on", x === b));
      setRegion(Number(b.dataset.r));
      hp = 100;
    };
    const onClear = () => {
      bots = [];
      hp = 100;
      log("— limpo —");
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    root.querySelector(".sb-noise")!.addEventListener("click", onNoise);
    root.querySelector(".sb-add")!.addEventListener("click", onAdd);
    root.querySelector(".sb-reg")!.addEventListener("click", onReg);
    root.querySelector(".sb-clear")!.addEventListener("click", onClear);
    return combine(stop, () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      root.querySelector(".sb-noise")!.removeEventListener("click", onNoise);
      root.querySelector(".sb-add")!.removeEventListener("click", onAdd);
      root.querySelector(".sb-reg")!.removeEventListener("click", onReg);
      root.querySelector(".sb-clear")!.removeEventListener("click", onClear);
    });
  },
};
