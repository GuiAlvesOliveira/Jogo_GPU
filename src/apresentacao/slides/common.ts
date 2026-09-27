// Componentes reutilizados pelos slides: figura, antes/depois, zoom, abas.

import { el, esc, type Cleanup } from "../dom";

export const IMG = "apresentacao/img/";

export function fig(src: string, cap = "", cls = ""): string {
  return `<figure class="${cls}"><img src="${IMG}${src}" alt="${esc(cap)}" loading="lazy" data-zoom>${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
}

// Comparador antes/depois com divisória arrastável.
export function beforeAfter(a: string, b: string, labelA: string, labelB: string, pos = 50): HTMLElement {
  const root = el(`<div class="ba" style="--p:${pos}%">
    <img class="ba-a" src="${a}" alt="${esc(labelA)}" draggable="false">
    <img class="ba-b" src="${b}" alt="${esc(labelB)}" draggable="false">
    <span class="ba-l ba-la">${esc(labelA)}</span><span class="ba-l ba-lb">${esc(labelB)}</span>
    <div class="ba-h"><i></i></div>
  </div>`);
  const set = (clientX: number) => {
    const r = root.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    root.style.setProperty("--p", `${p}%`);
  };
  let dragging = false;
  root.addEventListener("pointerdown", (e) => {
    dragging = true;
    root.setPointerCapture(e.pointerId);
    set(e.clientX);
  });
  root.addEventListener("pointermove", (e) => dragging && set(e.clientX));
  root.addEventListener("pointerup", () => (dragging = false));
  root.style.touchAction = "none";
  return root;
}

export function setBA(root: HTMLElement, a: string, b: string, labelA: string, labelB: string): void {
  (root.querySelector(".ba-a") as HTMLImageElement).src = a;
  (root.querySelector(".ba-b") as HTMLImageElement).src = b;
  (root.querySelector(".ba-la") as HTMLElement).textContent = labelA;
  (root.querySelector(".ba-lb") as HTMLElement).textContent = labelB;
}

// Zoom de imagens: qualquer [data-zoom] abre em tela cheia.
export function initLightbox(): void {
  const box = el(`<div class="lightbox" hidden><img alt=""><p></p></div>`);
  document.body.appendChild(box);
  const img = box.querySelector("img")!;
  const cap = box.querySelector("p")!;
  document.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("[data-zoom]") as HTMLImageElement | null;
    if (t && t.tagName === "IMG") {
      img.src = t.currentSrc || t.src;
      cap.textContent = t.alt || "";
      box.hidden = false;
      return;
    }
    if (!box.hidden && (e.target as HTMLElement).closest(".lightbox")) box.hidden = true;
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!box.hidden && (e.key === "Escape" || e.key === " ")) {
        box.hidden = true;
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

// Abas simples: botões [data-tab] alternam painéis [data-pane].
export function bindTabs(root: HTMLElement, onChange?: (key: string) => void): void {
  const btns = Array.from(root.querySelectorAll("[data-tab]")) as HTMLElement[];
  const panes = Array.from(root.querySelectorAll("[data-pane]")) as HTMLElement[];
  const show = (k: string) => {
    btns.forEach((b) => b.classList.toggle("on", b.dataset.tab === k));
    panes.forEach((p) => (p.hidden = p.dataset.pane !== k));
    onChange?.(k);
  };
  btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.tab!)));
  const first = btns.find((b) => b.classList.contains("on")) ?? btns[0];
  if (first) show(first.dataset.tab!);
}

export function combine(...fns: (Cleanup | void | null | undefined)[]): Cleanup {
  return () => fns.forEach((f) => f && f());
}

// Contagem de linhas (para o capítulo de código).
export function loc(s: string): number {
  return s.split("\n").length;
}
