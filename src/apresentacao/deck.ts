// ============================================================
//  deck.ts — motor da apresentação (navegação, escala, overview)
// ------------------------------------------------------------
//  Cada slide é DADO (SlideDef): título, conteúdo (montado só na
//  primeira visita) e um `mount` opcional chamado a cada visita —
//  é ali que ligamos laços de animação, canvases WebGPU e áudio, e
//  a função devolvida desliga tudo quando o slide sai de cena.
// ============================================================

import { el, esc, type Cleanup } from "./dom";
import { hideTip } from "./tooltip";

export interface SlideDef {
  id: string;
  title: string;
  lead?: string;
  head?: boolean;
  cls?: string;
  body: () => string | HTMLElement;
  init?: (root: HTMLElement) => void;
  mount?: (root: HTMLElement) => Cleanup | void;
}

export interface ChapterDef {
  key: string;
  title: string;
  slides: SlideDef[];
}

interface Entry {
  def: SlideDef;
  chapter: number;
  node: HTMLElement;
  built: boolean;
}

export const STAGE_W = 1600;
export const STAGE_H = 900;

export class Deck {
  private readonly entries: Entry[] = [];
  private readonly chapters: ChapterDef[];
  private current = -1;
  private cleanup: Cleanup | null = null;
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly wrap: HTMLElement;
  private readonly overview: HTMLElement;
  private readonly bar: HTMLElement;
  private narrow = false;
  scale = 1;

  constructor(root: HTMLElement, chapters: ChapterDef[]) {
    this.root = root;
    this.chapters = chapters;
    this.wrap = el(`<div class="stage-wrap"><div class="stage" id="stage"></div></div>`);
    this.stage = this.wrap.firstElementChild as HTMLElement;
    this.bar = el(`<nav class="bar" aria-label="Navegação">
      <button class="chap" type="button" title="Visão geral (O)"><b></b><span class="t"></span></button>
      <div class="progress"></div>
      <span class="count"></span>
      <button class="icon-btn" data-a="prev" type="button" title="Anterior (←)">‹</button>
      <button class="icon-btn" data-a="next" type="button" title="Próximo (→)">›</button>
      <button class="icon-btn" data-a="ov" type="button" title="Visão geral (O)">▦</button>
      <button class="icon-btn" data-a="fs" type="button" title="Tela cheia (F)">⛶</button>
    </nav>`);
    this.overview = el(`<div class="overview" hidden></div>`);
    root.append(this.wrap, this.bar, this.overview);

    chapters.forEach((c, ci) => {
      c.slides.forEach((def) => {
        const node = el(`<section class="slide ${def.head === false ? "no-head" : ""} ${def.cls ?? ""}" hidden aria-roledescription="slide"></section>`);
        node.dataset.id = def.id;
        this.stage.appendChild(node);
        this.entries.push({ def, chapter: ci, node, built: false });
      });
    });

    this.buildBar();
    this.buildOverview();
    this.bindKeys();
    // Links internos: qualquer elemento com data-go="id-do-slide".
    document.addEventListener("click", (ev) => {
      const a = (ev.target as HTMLElement).closest("[data-go]") as HTMLElement | null;
      if (!a) return;
      ev.preventDefault();
      this.goTo(a.dataset.go!);
    });
    window.addEventListener("resize", () => this.layout());
    window.addEventListener("hashchange", () => this.fromHash());
    this.layout();
    if (!this.fromHash()) this.go(0);
  }

  get count(): number {
    return this.entries.length;
  }

  indexOf(id: string): number {
    return this.entries.findIndex((e) => e.def.id === id);
  }

  goTo(id: string): void {
    const i = this.indexOf(id);
    if (i >= 0) this.go(i);
  }

  private fromHash(): boolean {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = id ? this.indexOf(id) : -1;
    if (i >= 0 && i !== this.current) {
      this.go(i);
      return true;
    }
    return i >= 0;
  }

  // ------------------------------------------------------ escala
  private layout(): void {
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    const narrow = w < 820 || w / Math.max(1, h) < 0.95;
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      this.root.classList.toggle("narrow", narrow);
    }
    if (narrow) {
      this.scale = 1;
      this.stage.style.transform = "none";
      return;
    }
    const s = Math.min(w / STAGE_W, h / STAGE_H);
    this.scale = s;
    const x = (w - STAGE_W * s) / 2;
    const y = (h - STAGE_H * s) / 2;
    this.stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    document.documentElement.style.setProperty("--stage-scale", String(s));
  }

  // --------------------------------------------------- navegação
  go(i: number): void {
    i = Math.max(0, Math.min(this.entries.length - 1, i));
    if (i === this.current) return;
    hideTip();
    if (this.cleanup) {
      try {
        this.cleanup();
      } catch (e) {
        console.error(e);
      }
      this.cleanup = null;
    }
    const prev = this.entries[this.current];
    if (prev) prev.node.hidden = true;
    this.current = i;
    const e = this.entries[i];
    if (!e.built) this.build(e);
    e.node.hidden = false;
    e.node.classList.remove("enter");
    void e.node.offsetWidth;
    e.node.classList.add("enter");
    if (this.narrow) this.wrap.scrollTop = 0;
    if (e.def.mount) {
      try {
        this.cleanup = e.def.mount(e.node) || null;
      } catch (err) {
        console.error(err);
      }
    }
    const hash = `#${e.def.id}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    this.updateBar();
    const ch = this.chapters[e.chapter];
    document.title = `${e.def.title} · ${ch.title} · Setor Zero`;
  }

  next(): void {
    this.go(this.current + 1);
  }
  prev(): void {
    this.go(this.current - 1);
  }

  private build(e: Entry): void {
    const { def } = e;
    const ch = this.chapters[e.chapter];
    const num = String(e.chapter).padStart(2, "0");
    if (def.head !== false) {
      e.node.appendChild(
        el(`<header class="slide-head">
          <div class="kicker"><span class="num">${num} /</span>${esc(ch.title)}</div>
          <h2>${def.title}</h2>
          ${def.lead ? `<p class="lead">${def.lead}</p>` : ""}
        </header>`),
      );
    }
    const body = el(`<div class="slide-body"></div>`);
    const content = def.body();
    if (typeof content === "string") body.innerHTML = content;
    else body.appendChild(content);
    e.node.appendChild(body);
    e.built = true;
    try {
      def.init?.(e.node);
    } catch (err) {
      console.error(err);
    }
  }

  // ------------------------------------------------------- barra
  private buildBar(): void {
    const prog = this.bar.querySelector(".progress") as HTMLElement;
    this.chapters.forEach((c, ci) => {
      const seg = el(`<div class="seg" title="${esc(String(ci).padStart(2, "0") + " · " + c.title)}"><i></i></div>`);
      seg.style.setProperty("--n", String(c.slides.length));
      seg.addEventListener("click", () => this.go(this.entries.findIndex((e) => e.chapter === ci)));
      prog.appendChild(seg);
    });
    this.bar.querySelector(".chap")!.addEventListener("click", () => this.toggleOverview());
    this.bar.addEventListener("click", (ev) => {
      const a = (ev.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
      if (!a) return;
      const act = a.dataset.a;
      if (act === "prev") this.prev();
      else if (act === "next") this.next();
      else if (act === "ov") this.toggleOverview();
      else if (act === "fs") this.toggleFullscreen();
    });
  }

  private updateBar(): void {
    const e = this.entries[this.current];
    const ch = this.chapters[e.chapter];
    (this.bar.querySelector(".chap b") as HTMLElement).textContent = String(e.chapter).padStart(2, "0");
    (this.bar.querySelector(".chap .t") as HTMLElement).textContent = ch.title;
    (this.bar.querySelector(".count") as HTMLElement).textContent = `${this.current + 1} / ${this.entries.length}`;
    const segs = Array.from(this.bar.querySelectorAll(".progress .seg")) as HTMLElement[];
    segs.forEach((s, ci) => {
      s.classList.toggle("done", ci < e.chapter);
      const bar = s.firstElementChild as HTMLElement;
      if (ci === e.chapter) {
        const first = this.entries.findIndex((x) => x.chapter === ci);
        const n = this.chapters[ci].slides.length;
        bar.style.width = `${((this.current - first + 1) / n) * 100}%`;
      } else bar.style.width = "";
    });
    this.overview.querySelectorAll("button[data-i]").forEach((b) => b.classList.toggle("on", Number((b as HTMLElement).dataset.i) === this.current));
  }

  // --------------------------------------------------- overview
  private buildOverview(): void {
    let html = `<h3>Roteiro completo</h3><div class="ov-grid">`;
    let idx = 0;
    this.chapters.forEach((c, ci) => {
      html += `<div class="ov-chap"><h4><span>${String(ci).padStart(2, "0")}</span>${esc(c.title)}</h4><ol>`;
      c.slides.forEach((s) => {
        html += `<li><button type="button" data-i="${idx}"><em>${idx + 1}</em>${s.title}</button></li>`;
        idx++;
      });
      html += `</ol></div>`;
    });
    html += `</div>`;
    this.overview.innerHTML = html;
    this.overview.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!b) return;
      this.overview.hidden = true;
      this.go(Number(b.dataset.i));
    });
  }

  toggleOverview(force?: boolean): void {
    this.overview.hidden = force !== undefined ? !force : !this.overview.hidden;
    if (!this.overview.hidden) {
      const on = this.overview.querySelector("button.on") as HTMLElement | null;
      on?.scrollIntoView({ block: "center" });
    }
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // ------------------------------------------------------ teclado
  private bindKeys(): void {
    window.addEventListener("keydown", (ev) => {
      const t = ev.target as HTMLElement;
      if (t && (t.closest("input, textarea, select, [contenteditable]") || t.closest("[data-keys='own']"))) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      switch (ev.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          ev.preventDefault();
          this.next();
          break;
        case "ArrowLeft":
        case "PageUp":
          ev.preventDefault();
          this.prev();
          break;
        case "Home":
          this.go(0);
          break;
        case "End":
          this.go(this.entries.length - 1);
          break;
        case "o":
        case "O":
          this.toggleOverview();
          break;
        case "Escape":
          if (!this.overview.hidden) this.toggleOverview(false);
          break;
        case "f":
        case "F":
          this.toggleFullscreen();
          break;
      }
    });
  }
}
