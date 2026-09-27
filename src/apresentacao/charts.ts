// ============================================================
//  charts.ts — gráficos SVG feitos à mão (barras, linhas, calor)
// ------------------------------------------------------------
//  Regras seguidas: um eixo por gráfico; legenda sempre que há 2+
//  séries; tooltip ao passar o mouse; tabela com os mesmos dados;
//  texto sempre nas cores de texto (nunca na cor da série);
//  barras finas com a ponta arredondada (4 px) e 2 px de folga.
// ============================================================

import { el, esc, fmt } from "./dom";
import { showTip, hideTip } from "./tooltip";

// Paletas validadas (scripts/validate_palette.js, superfície #141a20).
export const PAL = {
  cat: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  cpu: "#cc7a1f",
  gpu: "#2a98b8",
  diff: ["#1c5cab", "#3987e5", "#9ec5f4"], // fácil → difícil (rampa ordinal)
  seq: ["#104281", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"],
};

export interface Series {
  name: string;
  color: string;
  values: number[];
}

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 1, step: 0.25 };
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const max = nice * exp;
  const steps = nice === 2.5 ? 5 : nice === 1 || nice === 10 ? 5 : 4;
  return { max, step: max / steps };
}

function legendHtml(series: { name: string; color: string }[]): string {
  if (series.length < 2) return "";
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}

function tableHtml(head: string[], rows: (string | number)[][]): string {
  return `<details class="chart-table"><summary>Ver tabela</summary><div class="tbl-wrap"><table class="tbl"><thead><tr>${head
    .map((h, i) => `<th class="${i ? "n" : ""}">${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${typeof c === "number" ? esc(fmt.n1(c).replace(/,0$/, "")) : esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div></details>`;
}

// Retângulo com só a ponta (lado direito) arredondada.
function barPath(x: number, y: number, w: number, h: number, r: number, roundEnd: boolean): string {
  if (w <= 0 || h <= 0) return "";
  const rr = roundEnd ? Math.min(r, w, h / 2) : 0;
  return `M${x},${y}H${x + w - rr}${rr ? `Q${x + w},${y} ${x + w},${y + rr}` : ""}V${y + h - rr}${rr ? `Q${x + w},${y + h} ${x + w - rr},${y + h}` : ""}H${x}Z`;
}

export interface BarOpts {
  categories: string[];
  series: Series[];
  stacked?: boolean;
  width?: number;
  rowH?: number;
  labelW?: number;
  fmtV?: (v: number) => string;
  unit?: string;
  max?: number;
  total?: boolean; // mostra o total no fim da barra (empilhada) ou o valor (única)
  catTips?: string[]; // texto extra no tooltip de cada categoria
  ariaLabel?: string;
  refLine?: { value: number; label: string };
}

// Barras horizontais (agrupadas ou empilhadas).
export function barChart(o: BarOpts): HTMLElement {
  const W = o.width ?? 720;
  const labelW = o.labelW ?? 150;
  const nS = o.series.length;
  const rowH = o.rowH ?? (o.stacked || nS === 1 ? 30 : 14 * nS + 12);
  const padT = 8, padB = 30, padR = 58;
  const H = padT + padB + rowH * o.categories.length;
  const plotW = W - labelW - padR;
  const f = o.fmtV ?? ((v: number) => fmt.n0(v));
  const totals = o.categories.map((_, ci) => o.series.reduce((s, se) => s + (se.values[ci] || 0), 0));
  const rawMax = o.max ?? (o.stacked ? Math.max(...totals) : Math.max(...o.series.flatMap((s) => s.values)));
  const { max, step } = niceMax(Math.max(rawMax, o.refLine?.value ?? 0));
  const x = (v: number) => labelW + (v / max) * plotW;

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.ariaLabel ?? "")}">`;
  svg += `<g class="grid">`;
  for (let v = 0; v <= max + 1e-9; v += step) svg += `<line x1="${x(v)}" x2="${x(v)}" y1="${padT}" y2="${H - padB + 4}"/>`;
  svg += `</g><g class="axis">`;
  for (let v = 0; v <= max + 1e-9; v += step) svg += `<text x="${x(v)}" y="${H - 10}" text-anchor="middle">${esc(f(v))}</text>`;
  svg += `</g>`;
  o.categories.forEach((cat, ci) => {
    const y0 = padT + ci * rowH;
    svg += `<text class="lbl" x="${labelW - 10}" y="${y0 + rowH / 2 + 4}" text-anchor="end">${esc(cat)}</text>`;
    if (o.stacked) {
      let acc = 0;
      const bh = Math.min(20, rowH - 8);
      const by = y0 + (rowH - bh) / 2;
      const last = o.series.reduce((li, s, si) => ((s.values[ci] || 0) > 0 ? si : li), -1);
      o.series.forEach((s, si) => {
        const v = s.values[ci] || 0;
        if (v <= 0) return;
        const x0 = x(acc) + (acc > 0 ? 1 : 0);
        const x1 = x(acc + v) - (si === last ? 0 : 1);
        svg += `<path class="mark" fill="${s.color}" d="${barPath(x0, by, Math.max(0.5, x1 - x0), bh, 4, si === last)}" data-c="${ci}" data-s="${si}"/>`;
        acc += v;
      });
      if (o.total) svg += `<text class="val" x="${x(acc) + 6}" y="${by + bh / 2 + 4}">${esc(f(acc))}${o.unit ? " " + esc(o.unit) : ""}</text>`;
    } else {
      const bh = Math.max(6, Math.min(18, (rowH - 10) / nS - 2));
      const groupH = nS * bh + (nS - 1) * 2;
      o.series.forEach((s, si) => {
        const v = s.values[ci] || 0;
        const by = y0 + (rowH - groupH) / 2 + si * (bh + 2);
        svg += `<path class="mark" fill="${s.color}" d="${barPath(x(0), by, Math.max(0.5, x(v) - x(0)), bh, 4, true)}" data-c="${ci}" data-s="${si}"/>`;
        if (o.total && (nS === 1 || bh >= 10)) svg += `<text class="val" x="${x(v) + 6}" y="${by + bh / 2 + 4}">${esc(f(v))}</text>`;
      });
    }
    svg += `<rect class="hit" x="0" y="${y0}" width="${W}" height="${rowH}" data-c="${ci}"/>`;
  });
  if (o.refLine) {
    const rx = x(o.refLine.value);
    svg += `<line x1="${rx}" x2="${rx}" y1="${padT - 4}" y2="${H - padB + 4}" stroke="#ece6da" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    svg += `<text class="val" x="${rx + 5}" y="${padT + 8}">${esc(o.refLine.label)}</text>`;
  }
  svg += `<line class="base" x1="${x(0)}" x2="${x(0)}" y1="${padT}" y2="${H - padB + 4}"/></svg>`;

  const root = el(`<div class="chart">${legendHtml(o.series)}${svg}${tableHtml(
    ["", ...o.series.map((s) => s.name), ...(o.stacked && nS > 1 ? ["Total"] : [])],
    o.categories.map((c, ci) => [c, ...o.series.map((s) => s.values[ci] || 0), ...(o.stacked && nS > 1 ? [totals[ci]] : [])]),
  )}</div>`);
  const svgEl = root.querySelector("svg")!;
  svgEl.addEventListener("mousemove", (e) => {
    const t = (e.target as Element).closest("[data-c]") as SVGElement | null;
    if (!t) return hideTip();
    const ci = Number(t.dataset.c);
    const rows = o.series
      .map((s) => `<div><span class="sw" style="background:${s.color}"></span>${esc(s.name)}: <b>${esc(f(s.values[ci] || 0))}</b>${o.unit ? " " + esc(o.unit) : ""}</div>`)
      .join("");
    const tot = o.stacked && nS > 1 ? `<div class="k">total ${esc(f(totals[ci]))}${o.unit ? " " + esc(o.unit) : ""}</div>` : "";
    const extra = o.catTips?.[ci] ? `<div class="k" style="margin-top:4px">${o.catTips[ci]}</div>` : "";
    showTip(`<b>${esc(o.categories[ci])}</b>${rows}${tot}${extra}`, e.clientX, e.clientY);
    svgEl.querySelectorAll(".mark").forEach((m) => m.classList.toggle("hot", (m as SVGElement).dataset.c === String(ci)));
  });
  svgEl.addEventListener("mouseleave", () => {
    hideTip();
    svgEl.querySelectorAll(".mark.hot").forEach((m) => m.classList.remove("hot"));
  });
  return root;
}

export interface LineSeries {
  name: string;
  color: string;
  fn: (x: number) => number;
  dash?: string;
}

export interface LineOpts {
  x0: number;
  x1: number;
  series: LineSeries[];
  width?: number;
  height?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
  samples?: number;
  marks?: { x: number; label: string }[];
}

// Gráfico de linhas de funções (curvas de luz, tone mapping…), com mira.
export function lineChart(o: LineOpts): { root: HTMLElement; update: (series?: LineSeries[]) => void } {
  const W = o.width ?? 640, H = o.height ?? 300;
  const padL = 52, padR = 110, padT = 14, padB = 40;
  const fx = o.fmtX ?? ((v: number) => fmt.n1(v).replace(/,0$/, ""));
  const fy = o.fmtY ?? ((v: number) => fmt.n2(v));
  const root = el(`<div class="chart"></div>`);
  let series = o.series;
  const draw = () => {
    const N = o.samples ?? 160;
    const data = series.map((s) => Array.from({ length: N + 1 }, (_, i) => {
      const xv = o.x0 + ((o.x1 - o.x0) * i) / N;
      return [xv, s.fn(xv)] as [number, number];
    }));
    const rawMax = o.yMax ?? Math.max(...data.flat().map((p) => p[1]));
    const { max, step } = niceMax(rawMax);
    const X = (v: number) => padL + ((v - o.x0) / (o.x1 - o.x0)) * (W - padL - padR);
    const Y = (v: number) => H - padB - (Math.min(v, max * 1.02) / max) * (H - padT - padB);
    const { step: xs } = niceMax(o.x1 - o.x0);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    svg += `<g class="grid">`;
    for (let v = 0; v <= max + 1e-9; v += step) svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}"/>`;
    svg += `</g><g class="axis">`;
    for (let v = 0; v <= max + 1e-9; v += step) svg += `<text x="${padL - 8}" y="${Y(v) + 4}" text-anchor="end">${esc(fy(v))}</text>`;
    for (let v = o.x0; v <= o.x1 + 1e-9; v += xs) svg += `<text x="${X(v)}" y="${H - padB + 18}" text-anchor="middle">${esc(fx(v))}</text>`;
    svg += `</g>`;
    if (o.xLabel) svg += `<text class="tick" x="${(padL + W - padR) / 2}" y="${H - 4}" text-anchor="middle">${esc(o.xLabel)}</text>`;
    if (o.yLabel) svg += `<text class="tick" x="${padL}" y="${padT - 2}" text-anchor="start">${esc(o.yLabel)}</text>`;
    svg += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    for (const m of o.marks ?? []) {
      svg += `<line x1="${X(m.x)}" x2="${X(m.x)}" y1="${padT}" y2="${H - padB}" stroke="#5b6773" stroke-dasharray="3 4"/>`;
      svg += `<text class="tick" x="${X(m.x) + 4}" y="${padT + 10}">${esc(m.label)}</text>`;
    }
    series.forEach((s, si) => {
      const d = data[si].map(([a, b], i) => `${i ? "L" : "M"}${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join("");
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round"/>`;
      const [lx, ly] = data[si][data[si].length - 1];
      svg += `<text class="lbl" x="${X(lx) + 8}" y="${Y(ly) + 4 + si * 0}">${esc(s.name)}</text>`;
    });
    svg += `<line class="xh" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="#ece6da66" visibility="hidden"/>`;
    series.forEach((s, si) => (svg += `<circle class="xp" data-i="${si}" r="5" fill="${s.color}" stroke="#141a20" stroke-width="2" visibility="hidden"/>`));
    svg += `<rect class="hit" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}"/></svg>`;
    root.innerHTML = `${legendHtml(series)}${svg}`;
    const svgEl = root.querySelector("svg")!;
    const hit = svgEl.querySelector(".hit")!;
    const xh = svgEl.querySelector(".xh") as SVGLineElement;
    const pts = Array.from(svgEl.querySelectorAll(".xp")) as SVGCircleElement[];
    hit.addEventListener("mousemove", (e) => {
      const me = e as MouseEvent;
      const r = svgEl.getBoundingClientRect();
      const sx = ((me.clientX - r.left) / r.width) * W;
      const xv = o.x0 + ((sx - padL) / (W - padL - padR)) * (o.x1 - o.x0);
      const cx = Math.max(o.x0, Math.min(o.x1, xv));
      xh.setAttribute("x1", String(X(cx)));
      xh.setAttribute("x2", String(X(cx)));
      xh.setAttribute("visibility", "visible");
      let html = `<div class="k">${esc(o.xLabel ?? "x")} = ${esc(fx(cx))}</div>`;
      series.forEach((s, si) => {
        const yv = s.fn(cx);
        pts[si].setAttribute("cx", String(X(cx)));
        pts[si].setAttribute("cy", String(Y(yv)));
        pts[si].setAttribute("visibility", "visible");
        html += `<div><span class="sw" style="background:${s.color}"></span>${esc(s.name)}: <b>${esc(fy(yv))}</b></div>`;
      });
      showTip(html, me.clientX, me.clientY);
    });
    hit.addEventListener("mouseleave", () => {
      hideTip();
      xh.setAttribute("visibility", "hidden");
      pts.forEach((p) => p.setAttribute("visibility", "hidden"));
    });
  };
  draw();
  return {
    root,
    update: (s?: LineSeries[]) => {
      if (s) series = s;
      draw();
    },
  };
}

// Interpola a rampa sequencial (t em 0..1).
export function seqColor(t: number): string {
  const r = PAL.seq;
  const u = Math.max(0, Math.min(1, t)) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(u));
  const f = u - i;
  const a = hex(r[i]), b = hex(r[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hex(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Luminância relativa aproximada (para escolher a cor do texto na célula).
export function isLight(t: number): boolean {
  return t > 0.62;
}
