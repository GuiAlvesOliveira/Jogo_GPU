// ============================================================
//  dom.ts — utilitários mínimos de DOM para a apresentação
// ------------------------------------------------------------
//  Sem framework: os slides são montados com template strings
//  (html``) e alguns helpers. Tudo roda na CPU, claro.
// ============================================================

export type Cleanup = () => void;

// Cria um elemento a partir de HTML (o primeiro nó raiz).
export function el<T extends HTMLElement = HTMLElement>(markup: string): T {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as T;
}

// Fragmento com vários nós.
export function frag(markup: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content;
}

export function $<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const e = root.querySelector(sel);
  if (!e) throw new Error(`elemento não encontrado: ${sel}`);
  return e as T;
}

export function $$<T extends Element = HTMLElement>(root: ParentNode, sel: string): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

// Formatação pt-BR.
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = {
  n0: (v: number) => nf0.format(v),
  n1: (v: number) => nf1.format(v),
  n2: (v: number) => nf2.format(v),
  kb: (bytes: number) => (bytes >= 1024 * 1024 ? `${nf1.format(bytes / 1024 / 1024)} MB` : `${nf0.format(Math.round(bytes / 1024))} KB`),
};

// Horário local do Brasil (UTC−3) a partir de um ISO em UTC.
export function brTime(iso: string, withDate = false): string {
  const d = new Date(iso);
  const t = new Date(d.getTime() - 3 * 3600 * 1000);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  if (!withDate) return `${hh}:${mm}`;
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mo = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

// Controle segmentado simples. Chama onChange com o valor escolhido.
export function segmented<T extends string>(
  options: { value: T; label: string; title?: string }[],
  initial: T,
  onChange: (v: T) => void,
  cls = "",
): HTMLElement {
  const root = el(`<div class="seg-ctl ${cls}" role="tablist"></div>`);
  for (const o of options) {
    const b = el<HTMLButtonElement>(`<button type="button" role="tab">${o.label}</button>`);
    if (o.title) b.title = o.title;
    b.dataset.v = o.value;
    if (o.value === initial) b.classList.add("on");
    b.addEventListener("click", () => {
      root.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onChange(o.value);
    });
    root.appendChild(b);
  }
  return root;
}

// Liga um <canvas> ao tamanho real em pixels (considera a escala do palco).
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 2): { w: number; h: number; dpr: number } {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr: r.width > 0 ? w / r.width : dpr };
}

// Posição do ponteiro em coordenadas do canvas (pixels do buffer).
export function canvasPoint(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
}

// Laço de animação que para sozinho quando o slide sai de cena.
export function loop(fn: (dt: number, t: number) => void): Cleanup {
  let raf = 0;
  let last = performance.now();
  const start = last;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, (now - start) / 1000);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// Observa mudanças de tamanho de um elemento.
export function onResize(target: Element, fn: () => void): Cleanup {
  const ro = new ResizeObserver(() => fn());
  ro.observe(target);
  return () => ro.disconnect();
}
