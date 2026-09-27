// Capítulo 01 — O primeiro prompt (a especificação de 31 seções).

import type { SlideDef } from "../deck";
import { esc, fmt } from "../dom";
import { markdown } from "../md";
import SPEC from "../data/spec.md?raw";

interface Sec {
  n: number;
  title: string;
  body: string;
}

function sections(): Sec[] {
  const lines = SPEC.replace(/\r\n/g, "\n").split("\n");
  const out: Sec[] = [{ n: 0, title: "Projeto: FPS 3D retrô com WebGPU", body: "" }];
  for (const l of lines) {
    const m = /^#{1,2}\s+(\d+)\.\s+(.*)$/.exec(l);
    if (m) {
      out.push({ n: Number(m[1]), title: m[2].trim(), body: "" });
      continue;
    }
    if (/^#\s+PROJETO/.test(l)) continue;
    out[out.length - 1].body += l + "\n";
  }
  return out.map((s) => ({ ...s, body: s.body.replace(/^\s*---\s*$/gm, "").trim() }));
}

const KEY_SECTIONS = new Set([2, 3, 29, 30, 31]);

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export const spec: SlideDef = {
  id: "especificacao",
  title: "A especificação: 31 seções",
  lead: `14/09/2026, 10:21. Um único texto de ${fmt.n0(SPEC.length)} caracteres descrevendo o jogo inteiro — e exigindo que ele <b>não</b> fosse construído de uma vez. A primeira tentativa caiu (token de login expirado); o mesmo prompt foi reenviado às 10:22.`,
  body: () => {
    const secs = sections();
    return `
    <div class="spec fill">
      <nav class="spec-list scroll" aria-label="Seções">
        ${secs
          .map(
            (s, i) => `<button type="button" data-i="${i}" class="${i === 2 ? "on" : ""}"><em>${s.n ? `§${s.n}` : "—"}</em><span>${esc(cap(s.title))}</span>${KEY_SECTIONS.has(s.n) ? `<i class="tag cpu">chave</i>` : ""}</button>`,
          )
          .join("")}
      </nav>
      <article class="panel spec-view scroll"></article>
    </div>`;
  },
  init: (root) => {
    const secs = sections();
    const view = root.querySelector(".spec-view") as HTMLElement;
    const show = (i: number) => {
      const s = secs[i];
      view.innerHTML = `<div class="kicker"><span class="num">${s.n ? `§${s.n}` : "intro"}</span>${esc(s.title)}</div><div class="md spec-md">${markdown(s.body)}</div>`;
      view.scrollTop = 0;
      root.querySelectorAll(".spec-list button").forEach((b) => b.classList.toggle("on", Number((b as HTMLElement).dataset.i) === i));
    };
    root.querySelector(".spec-list")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (b) show(Number(b.dataset.i));
    });
    show(2);
  },
};

const PLAN = [
  "Inicializar WebGPU, triângulo",
  "MVP e cubo 3D",
  "Câmera FPS",
  "Chão, paredes, 1º mapa",
  "Colisão",
  "Primeiro inimigo",
  "IA básica",
  "Raycast e tiro",
  "Vida, dano, morte",
  "Armas",
  "Munição e pickups",
  "HUD",
  "Sistema de fases",
  "Scaling de dificuldade",
  "Iluminação",
  "Partículas",
  "Áudio",
  "Otimização",
];

export const roteiroFases: SlideDef = {
  id: "regra-incremental",
  title: "A regra: uma fase por vez",
  lead: "As seções 29 e 30 transformaram o pedido num processo: 18 fases em ordem, e cada uma só começa depois que a anterior foi testada e aprovada pelo usuário.",
  body: () => `
  <div class="stack fill" style="gap:26px">
    <div class="plan">
      ${PLAN.map((p, i) => {
        const n = i + 1;
        const st = n === 16 ? "stop" : n === 18 ? "skip" : "ok";
        const label = st === "ok" ? "feita" : st === "stop" ? "interrompida" : "não feita";
        const icon = st === "ok" ? "✓" : st === "stop" ? "⏸" : "✕";
        return `<div class="plan-step ${st}" ${st !== "skip" ? `data-go="fases" data-fase="${n}"` : ""} title="${esc(label)}"><b>F${n}</b><span>${esc(p)}</span><i>${icon} ${label}</i></div>`;
      }).join("")}
    </div>
    <div class="cols-2" style="gap:26px">
      <div class="panel">
        <h4>§30 · Regra importante para o Claude Code</h4>
        <ol class="loop-steps">
          <li><b>Analise</b> a arquitetura atual</li>
          <li><b>Explique</b> brevemente o que será alterado</li>
          <li><b>Implemente</b> apenas a próxima etapa</li>
          <li><b>Execute</b> e teste o projeto</li>
          <li><b>Corrija</b> os erros</li>
          <li><b>Verifique</b> se a etapa realmente funciona</li>
          <li>Só então <b>avance</b></li>
        </ol>
      </div>
      <div class="panel stack">
        <h4>Como isso aconteceu na prática</h4>
        <p class="small">Cada fase terminou com <code>tsc --noEmit</code> + <code>vite build</code> passando e um relatório: <i>arquivos criados, o que roda na CPU × GPU, como testar</i>. O usuário respondia <b>“avançar para a FASE N”</b> — às vezes com um bug junto.</p>
        <p class="small">A fase 16 (partículas) foi interrompida e a 18 (otimização) nunca começou. Doze dias depois, <b>um único prompt</b> dispensou as duas e pediu o jogo completo com os assets.</p>
        <div class="row"><button class="btn sm" data-go="fases">Explorar as 17 fases →</button><button class="btn sm ghost" data-go="prompt-unico">Ir para o prompt final →</button></div>
      </div>
    </div>
  </div>`,
};

type St = "ok" | "part" | "no" | "new";
const REQ: [string, string, [St, string], [St, string]][] = [
  ["§2", "WebGPU direto, sem engine", ["ok", "F1"], ["ok", "motor próprio"]],
  ["§22", "Shaders WGSL comentados", ["ok", "F1–F15"], ["ok", "5 shaders + mipmaps"]],
  ["§3", "CPU × GPU explícito", ["ok", "comentários por arquivo"], ["ok", "idem"]],
  ["§6", "Câmera FPS + Pointer Lock", ["ok", "F3"], ["ok", "+ corrida, recuo, tremor"]],
  ["§7", "Movimento e colisão", ["ok", "F5 · AABB"], ["ok", "grade, degraus, água, lava"]],
  ["§8", "Mapa definido por dados", ["ok", "F4 · lista de caixas"], ["ok", "grade 88×70 gerada por script"]],
  ["§10", "Inimigos com estados", ["ok", "F6–F7 · 6 estados"], ["ok", "10 estados"]],
  ["§12", "3 arquétipos de inimigo", ["part", "só “basic”"], ["ok", "8 tipos"]],
  ["§13", "Armas modulares", ["ok", "F10 · 3 armas"], ["ok", "6 armas"]],
  ["§14", "Tiro por raycast", ["ok", "F8 · slabs"], ["ok", "DDA 3D + cabeça ×2,1"]],
  ["§15", "Munição e pickups", ["ok", "F11"], ["ok", "+ drops dos zumbis"]],
  ["§16", "Vida, dano, game over", ["ok", "F9"], ["ok", "+ kits médicos, checkpoints"]],
  ["§17", "HUD", ["ok", "F12"], ["ok", "+ mapa automático"]],
  ["§18", "Score", ["ok", "F12"], ["new", "estatísticas finais"]],
  ["§11 §19", "Fases com dificuldade crescente", ["ok", "F13–F14 · fórmula"], ["new", "1 mapa gigante + 3 dificuldades"]],
  ["§23", "Iluminação", ["ok", "F15 · Lambert"], ["ok", "tochas, lanterna, dinâmicas"]],
  ["§24", "Partículas e efeitos", ["no", "F16 interrompida"], ["part", "CPU simula, GPU desenha"]],
  ["§25", "Áudio", ["ok", "F17 · síntese"], ["ok", "+ som 3D (HRTF)"]],
  ["§21", "Otimização", ["no", "F18 não feita"], ["ok", "instancing, culling, 1 draw do mapa"]],
  ["§28", "Modo debug", ["no", "—"], ["part", "?debug para testes automáticos"]],
];

const cell = ([s, t]: [St, string]) => {
  const icon = s === "ok" ? "✓" : s === "part" ? "◐" : s === "no" ? "✕" : "↻";
  const cls = s === "ok" ? "ok" : s === "part" ? "warn" : s === "no" ? "bug" : "";
  const lbl = s === "ok" ? "atendido" : s === "part" ? "parcial" : s === "no" ? "não atendido" : "mudou";
  return `<td><span class="tag ${cls}" title="${lbl}">${icon} ${lbl}</span> <span class="small muted">${esc(t)}</span></td>`;
};

export const requisitos: SlideDef = {
  id: "requisitos",
  title: "Pedido × entregue",
  lead: "Os principais requisitos da especificação, onde foram atendidos nas fases incrementais e como ficaram no jogo final. “Mudou” marca decisões conscientes do prompt final.",
  body: () => `
  <div class="tbl-wrap fill">
    <table class="tbl req">
      <thead><tr><th>§</th><th>Requisito</th><th>Fases 1–17 · 14/09</th><th>Jogo final · 26/09</th></tr></thead>
      <tbody>${REQ.map((r) => `<tr><td class="mono dim">${r[0]}</td><td>${esc(r[1])}</td>${cell(r[2])}${cell(r[3])}</tr>`).join("")}</tbody>
    </table>
  </div>`,
};
