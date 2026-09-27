// Capítulo 02 — Evolução fase a fase (14/09): linha do tempo, explorador,
// correções e crescimento do código.

import type { SlideDef } from "../deck";
import { esc, fmt, brTime } from "../dom";
import { goTo } from "../nav";
import { markdown } from "../md";
import { highlightLines, langOf } from "../highlight";
import { diffLines, hunks, stat, type Op } from "../diff";
import { FASES, TIPO_LABEL, type Fase } from "../data/fases";
import HIST_RAW from "../data/historia.json";
import LOCS from "../data/fases_loc.json";
import { LOC } from "../data/codigo";
import { barChart, PAL } from "../charts";
import { showTip, hideTip } from "../tooltip";
import { IMG } from "./common";

export interface HistEntry {
  sessao: 1 | 2;
  ts: string;
  prompt: string;
  fase: number | null;
  report: string;
  errors: string[];
  interrupted: boolean;
  nota?: string;
}
export const HIST = HIST_RAW as HistEntry[];

const t = (iso: string) => new Date(iso).getTime();

export function promptOf(n: number): HistEntry | undefined {
  const all = HIST.filter((h) => h.fase === n);
  return all[all.length - 1];
}

// Minutos entre o prompt da fase e o próximo prompt.
export function durationOf(n: number): number {
  const e = promptOf(n);
  if (!e) return 0;
  const i = HIST.indexOf(e);
  const next = HIST[i + 1];
  return next ? (t(next.ts) - t(e.ts)) / 60000 : 0;
}

// ------------------------------------------------------------ linha do tempo
type Kind = "fase" | "bug" | "interrompido" | "git" | "final" | "outro";
function kindOf(h: HistEntry): Kind {
  if (h.interrupted || (h.sessao === 1 && !h.report)) return "interrompido";
  if (/commit|push|github|repo/i.test(h.prompt)) return "git";
  if (/apenas 1 prompt/.test(h.prompt)) return "final";
  if (h.fase && /nada acontece|não inicia|MIME/i.test(h.prompt)) return "bug";
  if (h.fase || h.ts === HIST[0].ts) return "fase";
  return "outro";
}
const KIND_STYLE: Record<Kind, { fill: string; stroke: string; label: string }> = {
  fase: { fill: "#7c8792", stroke: "#141a20", label: "avançar fase" },
  bug: { fill: "#fab219", stroke: "#141a20", label: "fase + bug relatado" },
  interrompido: { fill: "#141a20", stroke: "#e0564c", label: "interrompido / falhou" },
  git: { fill: "#2a98b8", stroke: "#141a20", label: "git / GitHub" },
  final: { fill: "#f2a65a", stroke: "#141a20", label: "o prompt único" },
  outro: { fill: "#aab3bc", stroke: "#141a20", label: "outros pedidos" },
};

function trackSvg(entries: HistEntry[], W: number, title: string): string {
  const H = 118, padL = 16, padR = 16, y = 62;
  const t0 = t(entries[0].ts), t1 = t(entries[entries.length - 1].ts);
  const span = Math.max(1, t1 - t0);
  const X = (iso: string) => padL + ((t(iso) - t0) / span) * (W - padL - padR);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="tl-svg" role="img" aria-label="${esc(title)}">`;
  svg += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="#36424e" stroke-width="2"/>`;
  // marcas de 10 em 10 minutos
  const step = span > 3 * 3600e3 ? 30 * 60e3 : 10 * 60e3;
  for (let k = Math.ceil(t0 / step) * step; k <= t1; k += step) {
    const x = padL + ((k - t0) / span) * (W - padL - padR);
    svg += `<line x1="${x}" x2="${x}" y1="${y + 6}" y2="${y + 12}" stroke="#36424e"/><text class="tick" x="${x}" y="${y + 28}" text-anchor="middle">${brTime(new Date(k).toISOString())}</text>`;
  }
  entries.forEach((h) => {
    const k = kindOf(h);
    const st = KIND_STYLE[k];
    const x = X(h.ts);
    const idx = HIST.indexOf(h);
    if (k === "final") {
      const end = t(h.ts) + 94 * 60e3;
      const x2 = padL + ((end - t0) / span) * (W - padL - padR);
      svg += `<rect x="${x}" y="${y - 7}" width="${Math.max(4, x2 - x)}" height="14" rx="4" fill="#f2a65a" opacity="0.28"/>`;
      svg += `<text class="val" x="${(x + x2) / 2}" y="${y - 16}" text-anchor="middle">94 min de trabalho autônomo</text>`;
    }
    const r = k === "final" ? 10 : 7;
    svg += `<circle class="tl-dot" cx="${x}" cy="${y}" r="${r}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5" data-i="${idx}"/>`;
    if (h.fase && h.sessao === 1 && k !== "interrompido") svg += `<text class="tick" x="${x}" y="${y - 16}" text-anchor="middle">F${h.fase}</text>`;
    svg += `<circle class="tl-hit" cx="${x}" cy="${y}" r="13" fill="transparent" data-i="${idx}"/>`;
  });
  svg += `</svg>`;
  return svg;
}

export const linhaDoTempo: SlideDef = {
  id: "linha-do-tempo",
  title: "Todos os prompts, em ordem",
  lead: "Duas sessões, doze dias de distância. Passe o mouse sobre um ponto para ler o prompt; clique para ver a resposta. Horários de Brasília.",
  body: () => {
    const s1 = HIST.filter((h) => h.sessao === 1);
    const s2 = HIST.filter((h) => h.sessao === 2);
    const legend = (Object.keys(KIND_STYLE) as Kind[])
      .map((k) => `<span><i style="background:${KIND_STYLE[k].fill};border:2px solid ${k === "interrompido" ? "#e0564c" : "transparent"}"></i>${KIND_STYLE[k].label}</span>`)
      .join("");
    const mins = FASES.map((f) => durationOf(f.n));
    return `
    <div class="tl fill">
      <div class="panel tight">
        <div class="row"><h4 style="margin:0">14/09 · sessão 1 · ${s1.length} prompts · ${brTime(s1[0].ts)}–${brTime(s1[s1.length - 1].ts)}</h4><span class="spacer"></span><div class="legend">${legend}</div></div>
        ${trackSvg(s1, 1440, "Sessão 1")}
        <h4 style="margin:6px 0 0">26/09 · sessão 2 · ${s2.length} prompts · ${brTime(s2[0].ts)}–${brTime(s2[s2.length - 1].ts)}</h4>
        ${trackSvg(s2, 1440, "Sessão 2")}
      </div>
      <div class="tl-bottom">
        <div class="panel tl-detail scroll"><p class="muted">Clique num ponto da linha do tempo.</p></div>
        <div class="panel tl-chart">
          <h4>Minutos entre um prompt e o próximo (fases 1–17)</h4>
          <div class="tl-bars"></div>
          <p class="cap dim" style="margin:6px 0 0">Média de ${fmt.n1(mins.reduce((a, b) => a + b, 0) / mins.length)} min por fase, contando o teste do usuário.</p>
        </div>
      </div>
    </div>`;
  },
  init: (root) => {
    const mins = FASES.map((f) => durationOf(f.n));
    root.querySelector(".tl-bars")!.appendChild(
      barChart({
        categories: FASES.map((f) => `F${f.n} ${f.titulo}`),
        series: [{ name: "minutos", color: PAL.cat[0], values: mins }],
        width: 560,
        rowH: 15,
        labelW: 200,
        fmtV: (v) => fmt.n1(v).replace(/,0$/, ""),
        unit: "min",
        total: true,
      }),
    );
    const detail = root.querySelector(".tl-detail") as HTMLElement;
    const showDetail = (i: number) => {
      const h = HIST[i];
      const k = kindOf(h);
      const rep = h.report ? h.report.split("\n## ")[0].slice(0, 900) : "";
      detail.innerHTML = `
        <div class="row"><span class="tag" style="border-color:${KIND_STYLE[k].fill}">${KIND_STYLE[k].label}</span><span class="mono small dim">${brTime(h.ts, true)}</span>${h.fase ? `<button class="btn sm" data-fase-open="${h.fase}">Abrir a fase ${h.fase} →</button>` : ""}</div>
        <blockquote class="prompt-quote">${esc(h.prompt.length > 600 ? h.prompt.slice(0, 600) + "…" : h.prompt)}</blockquote>
        ${h.nota ? `<p class="small" style="color:#ff9a92">${esc(h.nota)}</p>` : ""}
        ${rep ? `<div class="md">${markdown(rep)}</div>` : ""}`;
    };
    root.querySelectorAll(".tl-svg").forEach((svg) => {
      svg.addEventListener("mousemove", (e) => {
        const c = (e.target as Element).closest("[data-i]") as SVGElement | null;
        if (!c) return hideTip();
        const h = HIST[Number(c.dataset.i)];
        showTip(`<div class="k">${brTime(h.ts, true)} · ${KIND_STYLE[kindOf(h)].label}</div>${esc(h.prompt.slice(0, 220))}${h.prompt.length > 220 ? "…" : ""}`, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      });
      svg.addEventListener("mouseleave", hideTip);
      svg.addEventListener("click", (e) => {
        const c = (e.target as Element).closest("[data-i]") as SVGElement | null;
        if (c) showDetail(Number(c.dataset.i));
      });
    });
    showDetail(HIST.findIndex((h) => /A tela inicial ainda/.test(h.prompt)));
  },
};

// ------------------------------------------------------------ explorador
const srcCache = new Map<number, Promise<Record<string, string>>>();
function srcOf(n: number): Promise<Record<string, string>> {
  let p = srcCache.get(n);
  if (!p) {
    p = fetch(`apresentacao/fases/f${String(n).padStart(2, "0")}/src.json`).then((r) => r.json());
    srcCache.set(n, p);
  }
  return p;
}

let pendingFase = 0;
let selectFase: ((n: number) => void) | null = null;
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("[data-fase],[data-fase-open]") as HTMLElement | null;
  if (!a) return;
  const n = Number(a.dataset.fase ?? a.dataset.faseOpen);
  if (!n) return;
  pendingFase = n;
  selectFase?.(n);
  if (a.dataset.faseOpen) goTo("fases");
});

function faseIcons(f: Fase): string {
  const c = f.correcoes;
  let s = "";
  if (c.some((x) => x.tipo === "compilacao")) s += `<i class="dot bug" title="erro de compilação"></i>`;
  if (c.some((x) => x.tipo === "usuario")) s += `<i class="dot warn" title="bug relatado pelo usuário"></i>`;
  if (f.n === 16) s += `<i class="dot stop" title="interrompida"></i>`;
  return s;
}

function leftHtml(f: Fase): string {
  const h = promptOf(f.n);
  const prompt = f.n === 1 ? "A especificação completa de 31 seções (capítulo 01). A última seção dizia: “Comece SOMENTE pela FASE 1.”" : h?.prompt ?? "";
  const dur = durationOf(f.n);
  return `
    <div class="kicker"><span class="num">F${f.n} /</span>${esc(f.plano)}</div>
    <h3 class="fx-title">${esc(f.titulo)}</h3>
    <div class="row small dim mono">${h ? brTime(h.ts, true) : ""} · ${fmt.n1(dur).replace(/,0$/, "")} min até o próximo prompt</div>
    <div class="h4" style="margin-top:14px">Prompt do usuário</div>
    <blockquote class="prompt-quote">${esc(prompt)}</blockquote>
    <div class="h4">Conceito de computação gráfica</div>
    <p class="concept">${esc(f.conceito)}</p>
    <div class="h4">O que foi feito</div>
    <ul class="dash small">${f.fez.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <div class="cpu-gpu">
      <div><span class="tag cpu">CPU</span> ${f.cpu.length ? f.cpu.map(esc).join(" · ") : "<span class='dim'>—</span>"}</div>
      <div><span class="tag gpu">GPU</span> ${f.gpu.length ? f.gpu.map(esc).join(" · ") : "<span class='dim'>—</span>"}</div>
    </div>`;
}

function correcoesHtml(f: Fase): string {
  const h = promptOf(f.n);
  const cards = f.correcoes.length
    ? f.correcoes
        .map((c) => {
          const tl = TIPO_LABEL[c.tipo];
          return `<div class="fix-card"><span class="tag ${tl.cls}">${tl.label}</span><h5>${esc(c.titulo)}</h5>
          ${c.sintoma ? `<p><b>Sintoma</b> ${esc(c.sintoma)}</p>` : ""}${c.causa ? `<p><b>Causa</b> ${esc(c.causa)}</p>` : ""}<p><b>Correção</b> ${esc(c.correcao)}</p></div>`;
        })
        .join("")
    : `<div class="fix-card ok"><span class="tag ok">✓ sem correções</span><p>Compilou e funcionou na primeira tentativa: <code>tsc --noEmit</code> e <code>vite build</code> passaram.</p></div>`;
  const raw = h?.errors?.length ? `<div class="h4" style="margin-top:12px">Saída real registrada na sessão</div><pre class="code err">${h.errors.map(esc).join("\n\n")}</pre>` : "";
  return `<div class="fix-list">${cards}</div>${raw}`;
}

export const explorador: SlideDef = {
  id: "fases",
  title: "Explorador das 17 fases",
  head: false,
  cls: "slide-fx",
  body: () => `
  <div class="fx">
    <div class="fx-top">
      <div class="kicker"><span class="num">02 /</span>Evolução fase a fase</div>
      <div class="fx-pills">${FASES.map((f) => `<button type="button" class="fx-pill" data-n="${f.n}">F${f.n}${faseIcons(f)}</button>`).join("")}</div>
      <div class="row"><button class="icon-btn" data-step="-1" title="Fase anterior">‹</button><button class="icon-btn" data-step="1" title="Próxima fase">›</button></div>
    </div>
    <div class="fx-main">
      <div class="panel fx-left scroll"></div>
      <div class="fx-right">
        <div class="seg-ctl fx-tabs">
          <button data-tab="tela" class="on">Tela</button>
          <button data-tab="rodar">▶ Rodar esta fase</button>
          <button data-tab="codigo">Código (diff)</button>
          <button data-tab="correcoes">Correções</button>
          <button data-tab="relatorio">Relatório do Claude</button>
        </div>
        <div class="fx-pane" data-pane="tela"><figure class="fx-shot"><img alt="" data-zoom><figcaption></figcaption></figure></div>
        <div class="fx-pane" data-pane="rodar" hidden>
          <div class="fx-run"><iframe title="Fase rodando" allow="fullscreen; autoplay"></iframe></div>
          <p class="cap dim fx-run-hint">Build real da fase, reconstruído a partir das edições registradas na conversa. Clique no jogo para capturar o mouse; <kbd>Esc</kbd> solta. Clique fora para voltar a navegar os slides.</p>
        </div>
        <div class="fx-pane fx-code" data-pane="codigo" hidden>
          <div class="fx-files scroll"></div>
          <div class="fx-diff scroll"></div>
        </div>
        <div class="fx-pane scroll" data-pane="correcoes" hidden></div>
        <div class="fx-pane panel scroll" data-pane="relatorio" hidden><div class="md"></div></div>
      </div>
    </div>
  </div>`,
  init: (root) => {
    let cur = 1;
    let tab = "tela";
    let active = false;
    const left = root.querySelector(".fx-left") as HTMLElement;
    const img = root.querySelector(".fx-shot img") as HTMLImageElement;
    const cap = root.querySelector(".fx-shot figcaption") as HTMLElement;
    const iframe = root.querySelector(".fx-run iframe") as HTMLIFrameElement;
    const files = root.querySelector(".fx-files") as HTMLElement;
    const diffEl = root.querySelector(".fx-diff") as HTMLElement;
    const fixes = root.querySelector('[data-pane="correcoes"]') as HTMLElement;
    const report = root.querySelector('[data-pane="relatorio"] .md') as HTMLElement;
    let codeToken = 0;
    let selectedFile = "";
    let fullFile = false;

    const renderFile = async (n: number, path: string) => {
      selectedFile = path;
      const [now, prev] = await Promise.all([srcOf(n), n > 1 ? srcOf(n - 1) : Promise.resolve({} as Record<string, string>)]);
      const b = (now[path] ?? "").replace(/\r\n/g, "\n");
      const a = (prev[path] ?? "").replace(/\r\n/g, "\n");
      const lang = langOf(path);
      files.querySelectorAll("button").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset.p === path));
      const hb = highlightLines(b, lang);
      const head = `<div class="fx-diff-head row"><span class="mono small">${esc(path)}</span><span class="spacer"></span><label class="chk"><input type="checkbox" ${fullFile ? "checked" : ""} class="fx-full"> arquivo completo</label></div>`;
      if (fullFile || !a || !(path in prev)) {
        const kind = !(path in prev) && n > 1 ? `<span class="tag ok">arquivo novo na F${n}</span>` : "";
        diffEl.innerHTML = `${head}${kind}<pre class="code">${hb.map((l, i) => `<span class="line${!(path in prev) && n > 1 ? " add" : ""}"><span class="ln">${i + 1}</span>${l || " "}</span>`).join("")}</pre>`;
      } else {
        const ha = highlightLines(a, lang);
        const ops = diffLines(a.split("\n"), b.split("\n"));
        const hs = hunks(ops, 3);
        const line = (o: Op) => {
          if (o.t === "-") return `<span class="line del"><span class="ln">−</span>${ha[o.a] || " "}</span>`;
          if (o.t === "+") return `<span class="line add"><span class="ln">${o.b + 1}</span>${hb[o.b] || " "}</span>`;
          return `<span class="line"><span class="ln">${o.b + 1}</span>${hb[o.b] || " "}</span>`;
        };
        diffEl.innerHTML = `${head}<pre class="code">${
          hs.length ? hs.map((h) => `<span class="line hunk"><span class="ln">@@</span> linha ${h.b0 + 1}</span>${h.ops.map(line).join("")}`).join("") : `<span class="line"><span class="ln"></span>sem mudanças</span>`
        }</pre>`;
      }
      diffEl.scrollTop = 0;
      (diffEl.querySelector(".fx-full") as HTMLInputElement).addEventListener("change", (e) => {
        fullFile = (e.target as HTMLInputElement).checked;
        void renderFile(n, path);
      });
    };

    const renderCode = async (n: number) => {
      const token = ++codeToken;
      files.innerHTML = `<p class="dim small">carregando…</p>`;
      const [now, prev] = await Promise.all([srcOf(n), n > 1 ? srcOf(n - 1) : Promise.resolve({} as Record<string, string>)]);
      if (token !== codeToken) return;
      const paths = Array.from(new Set([...Object.keys(now), ...Object.keys(prev)])).sort();
      const rows = paths.map((p) => {
        const inNow = p in now, inPrev = p in prev;
        if (!inPrev && inNow) return { p, st: "A", add: now[p].split("\n").length, del: 0 };
        if (inPrev && !inNow) return { p, st: "D", add: 0, del: prev[p].split("\n").length };
        if (now[p] === prev[p]) return { p, st: "=", add: 0, del: 0 };
        const s = stat(diffLines(prev[p].replace(/\r\n/g, "\n").split("\n"), now[p].replace(/\r\n/g, "\n").split("\n")));
        return { p, st: "M", ...s };
      });
      rows.sort((x, y) => (x.st === "=" ? 1 : 0) - (y.st === "=" ? 1 : 0) || x.p.localeCompare(y.p));
      const changed = rows.filter((r) => r.st !== "=");
      const totAdd = changed.reduce((s, r) => s + r.add, 0), totDel = changed.reduce((s, r) => s + r.del, 0);
      files.innerHTML =
        `<div class="small mono dim" style="padding:4px 6px 8px">F${n} vs F${n - 1 || "—"} · <span class="plus">+${totAdd}</span> <span class="minus">−${totDel}</span></div>` +
        rows
          .map(
            (r) =>
              `<button type="button" data-p="${esc(r.p)}" class="${r.st === "=" ? "same" : ""}"><em class="st st-${r.st === "=" ? "same" : r.st}">${r.st === "=" ? "·" : r.st}</em><span>${esc(r.p.replace(/^src\//, ""))}</span>${r.st !== "=" ? `<small><span class="plus">+${r.add}</span> <span class="minus">−${r.del}</span></small>` : ""}</button>`,
          )
          .join("");
      const pick = changed.find((r) => r.p === selectedFile) ?? changed.find((r) => /\.(ts|wgsl)$/.test(r.p) && r.st !== "D") ?? rows[0];
      if (pick) void renderFile(n, pick.p);
    };
    files.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-p]") as HTMLElement | null;
      if (b) void renderFile(cur, b.dataset.p!);
    });

    const syncIframe = () => {
      const want = active && tab === "rodar" ? `apresentacao/fases/f${String(cur).padStart(2, "0")}/index.html` : "about:blank";
      if (iframe.getAttribute("src") !== want) iframe.setAttribute("src", want);
    };

    const select = (n: number) => {
      cur = Math.max(1, Math.min(17, n));
      const f = FASES[cur - 1];
      root.querySelectorAll(".fx-pill").forEach((p) => p.classList.toggle("on", Number((p as HTMLElement).dataset.n) === cur));
      left.innerHTML = leftHtml(f);
      left.scrollTop = 0;
      img.src = `${IMG}fases/f${String(cur).padStart(2, "0")}.jpg`;
      img.alt = `Fase ${cur}: ${f.titulo}`;
      cap.textContent = `Captura do build reconstruído da fase ${cur} (Chrome headless, WebGPU).`;
      fixes.innerHTML = correcoesHtml(f);
      const h = promptOf(cur);
      report.innerHTML = markdown(h?.report || "(sem relatório: fase interrompida)");
      if (tab === "codigo") void renderCode(cur);
      syncIframe();
    };
    selectFase = select;

    root.querySelectorAll(".fx-tabs button").forEach((b) =>
      b.addEventListener("click", () => {
        tab = (b as HTMLElement).dataset.tab!;
        root.querySelectorAll(".fx-tabs button").forEach((x) => x.classList.toggle("on", x === b));
        root.querySelectorAll(".fx-pane").forEach((p) => ((p as HTMLElement).hidden = (p as HTMLElement).dataset.pane !== tab));
        if (tab === "codigo") void renderCode(cur);
        syncIframe();
      }),
    );
    root.querySelector(".fx-pills")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-n]") as HTMLElement | null;
      if (b) select(Number(b.dataset.n));
    });
    root.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => select(cur + Number((b as HTMLElement).dataset.step))));
    (root as HTMLElement & { __fx?: { setActive: (v: boolean) => void } }).__fx = {
      setActive: (v: boolean) => {
        active = v;
        syncIframe();
      },
    };
    select(pendingFase || 1);
  },
  mount: (root) => {
    const fx = (root as HTMLElement & { __fx?: { setActive: (v: boolean) => void } }).__fx;
    fx?.setActive(true);
    if (pendingFase) {
      selectFase?.(pendingFase);
      pendingFase = 0;
    }
    return () => fx?.setActive(false);
  },
};

// ------------------------------------------------------------ correções
export const correcoes: SlideDef = {
  id: "correcoes",
  title: "Como cada passo foi corrigido",
  lead: (() => {
    const all = FASES.flatMap((f) => f.correcoes);
    const n = (t: string) => all.filter((c) => c.tipo === t).length;
    return `Todas as correções das 17 fases: ${n("compilacao")} vieram do compilador e ${n("usuario")} de bugs que o usuário relatou no próprio prompt da fase seguinte. Clique numa linha para abrir a fase.`;
  })(),
  body: () => {
    const rows = FASES.flatMap((f) => f.correcoes.map((c) => ({ f, c })));
    const count = (tipo: string) => rows.filter((r) => r.c.tipo === tipo).length;
    return `
    <div class="stack fill" style="grid-template-rows:auto minmax(0,1fr)">
      <div class="row">
        <span class="tag bug">✕ ${count("compilacao")} erros de compilação</span>
        <span class="tag warn">! ${count("usuario")} relatos do usuário</span>
        <span class="tag">${count("processo")} de processo</span>
        <span class="tag">${count("nota")} notas de projeto</span>
        <span class="spacer"></span>
        <span class="small dim">${FASES.filter((f) => !f.correcoes.length).length} fases passaram de primeira</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl fixes">
          <thead><tr><th>Fase</th><th>Tipo</th><th>Problema</th><th>Causa</th><th>Correção</th></tr></thead>
          <tbody>${rows
            .map(
              ({ f, c }) =>
                `<tr class="click" data-fase-open="${f.n}"><td class="mono">F${f.n}</td><td><span class="tag ${TIPO_LABEL[c.tipo].cls}">${TIPO_LABEL[c.tipo].label}</span></td><td><b>${esc(c.titulo)}</b>${c.sintoma ? `<div class="small muted">${esc(c.sintoma)}</div>` : ""}</td><td class="small muted">${esc(c.causa ?? "—")}</td><td class="small">${esc(c.correcao)}</td></tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>
    </div>`;
  },
};

// ------------------------------------------------------------ crescimento
export const crescimento: SlideDef = {
  id: "crescimento",
  title: "O código crescendo",
  lead: "Linhas de TypeScript (CPU) e de WGSL (GPU) ao fim de cada fase, e o salto do jogo final. A proporção GPU/CPU também cresceu: o motor novo tem cinco shaders de cena.",
  body: () => `<div class="cols fill" style="grid-template-columns: 1fr 340px"><div class="panel grow-chart"></div><div class="stack">
      <div class="panel stat cpu"><span class="v num">${fmt.n0(LOCS[16].ts)} → ${fmt.n0(LOC.ts)}</span><span class="l">linhas de TypeScript · F17 → final</span></div>
      <div class="panel stat gpu"><span class="v num">${fmt.n0(LOCS[16].wgsl)} → ${fmt.n0(LOC.wgsl)}</span><span class="l">linhas de WGSL · F17 → final</span></div>
      <div class="panel stat"><span class="v num">${fmt.n0(LOC.py)}</span><span class="l">linhas de Python (pipeline offline)</span></div>
      <p class="small muted">O motor das fases foi <b>substituído</b>, não remendado: o prompt final reescreveu o renderer (1 pipeline → 5), trocou caixas por uma grade e cubos vermelhos por modelos com esqueleto.</p>
    </div></div>`,
  init: (root) => {
    const cats = [...LOCS.map((l) => `F${l.n}`), "Jogo final"];
    root.querySelector(".grow-chart")!.appendChild(
      barChart({
        categories: cats,
        series: [
          { name: "TypeScript (CPU)", color: PAL.cpu, values: [...LOCS.map((l) => l.ts), LOC.ts] },
          { name: "WGSL (GPU)", color: PAL.gpu, values: [...LOCS.map((l) => l.wgsl), LOC.wgsl] },
        ],
        stacked: true,
        total: true,
        width: 1060,
        rowH: 32,
        labelW: 110,
        unit: "linhas",
        ariaLabel: "Linhas de código por fase",
      }),
    );
  },
};
