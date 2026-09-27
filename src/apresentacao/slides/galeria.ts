// Capítulo 05 — Galeria 3D (WebGPU ao vivo) e texturas / normal mapping.

import type { SlideDef } from "../deck";
import { esc, fmt, loop, canvasPoint } from "../dom";
import { ModelViewer, type ModelStats } from "../viewer";
import { NormalDemo } from "../texdemo";
import { NO_GPU_HTML } from "../gpu";
import { MODELS, TEX } from "../data/assets";
import { combine } from "./common";

let viewer: ModelViewer | null = null;
let viewerReady: Promise<boolean> | null = null;
let currentId = "e_troll";

// Outros slides (fichas dos inimigos) pedem um modelo específico.
export function showInGallery(id: string): void {
  currentId = id;
}

function statsHtml(s: ModelStats): string {
  const info = MODELS.find((m) => m.id === s.id)!;
  const row = (k: string, v: string) => `<div class="kv"><span>${k}</span><b class="num">${v}</b></div>`;
  return `
    <div class="h4">${esc(info.grupo)} · ${esc(info.origem)}</div>
    <h3 style="margin:0 0 4px">${esc(info.nome)}</h3>
    <p class="small muted" style="margin:0 0 10px">${esc(info.uso)}</p>
    ${row("arquivo", fmt.kb(s.bytes))}
    ${row("vértices", fmt.n0(s.vertices))}
    ${row("triângulos", fmt.n0(s.triangles))}
    ${row("primitives (draws)", String(s.primitives))}
    ${row("materiais", String(s.materials.length))}
    ${row("texturas", s.textures.length ? s.textures.join(", ") : "—")}
    ${row("ossos", s.joints ? String(s.joints) : "—")}
    ${row("tamanho (m)", s.size.map((v) => fmt.n2(v)).join(" × "))}`;
}

export const galeria3d: SlideDef = {
  id: "galeria-3d",
  title: "Galeria 3D ao vivo",
  lead: "Os 21 modelos do jogo, lidos pelo mesmo <code>GLB.ts</code>, enviados pelo mesmo <code>ModelUploader</code> e animados pelo mesmo <code>Animator</code>. Arraste para girar, role para aproximar.",
  body: () => {
    const groups = ["Inimigo", "Arma", "Item", "Cápsula"] as const;
    return `
    <div class="gal fill">
      <nav class="gal-list scroll">${groups
        .map((g) => `<div class="h4">${g === "Cápsula" ? "Cápsulas" : g + "s"}</div>${MODELS.filter((m) => m.grupo === g)
          .map((m) => `<button type="button" data-id="${m.id}" class="${m.id === currentId ? "on" : ""}">${esc(m.nome)}<small class="mono">${m.id}</small></button>`)
          .join("")}`)
        .join("")}</nav>
      <div class="gal-view panel flush"><canvas class="gal-canvas" aria-label="Modelo 3D"></canvas><div class="gal-hint mono">arraste · roda · duplo clique</div></div>
      <div class="gal-side stack">
        <div class="panel stack tight">
          <div class="seg-ctl sm gpu gal-mode"><button data-m="lit" class="on">Iluminado</button><button data-m="albedo">Cor base</button><button data-m="normals">Normais</button></div>
          <div class="seg-ctl sm gpu gal-wire"><button data-w="solid" class="on">Sólido</button><button data-w="both">+ arame</button><button data-w="wire">Só arame</button></div>
          <div class="row">
            <label class="chk"><input type="checkbox" class="gal-skel"> esqueleto</label>
            <label class="chk"><input type="checkbox" class="gal-grid" checked> grade</label>
            <label class="chk"><input type="checkbox" class="gal-rot" checked> girar</label>
          </div>
        </div>
        <div class="panel stack tight gal-anim">
          <div class="h4" style="margin:0">Clipes de animação</div>
          <div class="gal-clips row"></div>
          <label class="ctl">Velocidade <span class="v gal-sp-v">1,0×</span><input type="range" class="gal-sp" min="-1.5" max="2" step="0.1" value="1"></label>
        </div>
        <div class="panel gal-stats scroll"></div>
      </div>
    </div>`;
  },
  mount: (root) => {
    const canvas = root.querySelector(".gal-canvas") as HTMLCanvasElement;
    const stats = root.querySelector(".gal-stats") as HTMLElement;
    const clipsEl = root.querySelector(".gal-clips") as HTMLElement;
    const animPanel = root.querySelector(".gal-anim") as HTMLElement;
    if (!viewer) {
      viewer = new ModelViewer(canvas);
      viewerReady = viewer.init();
    }
    const v = viewer;
    const renderClips = (s: ModelStats) => {
      animPanel.hidden = !s.clips.length;
      clipsEl.innerHTML = s.clips
        .map((c) => `<button type="button" class="btn sm ${c.name === v.clip ? "primary" : ""}" data-c="${esc(c.name)}">${esc(c.name)} <span class="dim">${fmt.n1(c.duration)}s</span></button>`)
        .join("");
      (root.querySelector(".gal-skel") as HTMLInputElement).disabled = !s.joints;
    };
    const load = async (id: string) => {
      currentId = id;
      root.querySelectorAll(".gal-list button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.id === id));
      stats.innerHTML = `<p class="dim small">carregando ${esc(id)}.glb…</p>`;
      const weapon = id.startsWith("w_") || id.startsWith("i_") || id.startsWith("c_");
      const s = await v.show(id, { yaw: weapon ? Math.PI / 2 + 0.35 : 0.6, pitch: weapon ? 0.25 : 0.15 });
      if (!s) return;
      stats.innerHTML = statsHtml(s);
      renderClips(s);
    };
    const handlers: [Element, string, EventListener][] = [];
    const on = (sel: string, ev: string, fn: EventListener) => {
      const e = root.querySelector(sel)!;
      e.addEventListener(ev, fn);
      handlers.push([e, ev, fn]);
    };
    on(".gal-list", "click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-id]") as HTMLElement | null;
      if (b) void load(b.dataset.id!);
    });
    on(".gal-mode", "click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-m]") as HTMLElement | null;
      if (!b) return;
      v.mode = b.dataset.m as ModelViewer["mode"];
      root.querySelectorAll(".gal-mode button").forEach((x) => x.classList.toggle("on", x === b));
    });
    on(".gal-wire", "click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-w]") as HTMLElement | null;
      if (!b) return;
      v.wire = b.dataset.w as ModelViewer["wire"];
      root.querySelectorAll(".gal-wire button").forEach((x) => x.classList.toggle("on", x === b));
    });
    on(".gal-skel", "change", (e) => (v.skeleton = (e.target as HTMLInputElement).checked));
    on(".gal-grid", "change", (e) => (v.grid = (e.target as HTMLInputElement).checked));
    on(".gal-rot", "change", (e) => (v.autoRotate = (e.target as HTMLInputElement).checked));
    on(".gal-sp", "input", (e) => {
      v.speed = Number((e.target as HTMLInputElement).value);
      (root.querySelector(".gal-sp-v") as HTMLElement).textContent = `${fmt.n1(v.speed)}×`;
    });
    on(".gal-clips", "click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-c]") as HTMLElement | null;
      if (!b) return;
      v.play(b.dataset.c!);
      clipsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("primary", x === b));
    });
    on(".gal-canvas", "viewer-autorotate", () => ((root.querySelector(".gal-rot") as HTMLInputElement).checked = false));
    let stop: (() => void) | null = null;
    let unbind: (() => void) | null = null;
    let alive = true;
    void viewerReady!.then((ok) => {
      if (!alive) return;
      if (!ok) {
        (root.querySelector(".gal-view") as HTMLElement).innerHTML = NO_GPU_HTML;
        return;
      }
      unbind = v.bindControls();
      if (!v.stats || v.stats.id !== currentId) void load(currentId);
      else {
        stats.innerHTML = statsHtml(v.stats);
        renderClips(v.stats);
      }
      stop = loop((dt) => v.frame(dt));
    });
    return () => {
      alive = false;
      stop?.();
      unbind?.();
      handlers.forEach(([e, ev, fn]) => e.removeEventListener(ev, fn));
    };
  },
};

let demo: NormalDemo | null = null;
let demoReady: Promise<boolean> | null = null;
let demoLayer = "cata_wall";

export const texturas: SlideDef = {
  id: "texturas",
  title: "24 camadas de textura e o normal map",
  lead: "Cada material do mapa é uma camada de uma <b>texture array</b> (512 × 512, com mipmaps gerados na GPU). Mova o mouse sobre a imagem: a luz segue o cursor. À esquerda da linha, superfície plana; à direita, a normal vem do normal map.",
  body: () => `
  <div class="tex fill">
    <div class="tex-grid scroll">${TEX.map(
      (t, i) => `<button type="button" data-l="${t.nome}" class="${t.nome === demoLayer ? "on" : ""}" title="${esc(t.fonte)}"><img src="game/textures/L_${t.nome}.jpg" alt="${t.nome}" loading="lazy"><span class="mono">${i}</span></button>`,
    ).join("")}</div>
    <div class="tex-view panel flush"><canvas class="tex-canvas" aria-label="Demonstração de normal map"></canvas></div>
    <div class="stack">
      <div class="panel tight stack">
        <div class="seg-ctl sm gpu tex-mode"><button data-m="0" class="on">Iluminado</button><button data-m="1">Cor (albedo)</button><button data-m="2">Normal map</button></div>
        <label class="ctl">Divisória <span class="v tex-split-v">50%</span><input type="range" class="tex-split" min="0" max="1" step="0.01" value="0.5"></label>
        <label class="ctl">Altura da luz <span class="v tex-h-v">0,22</span><input type="range" class="tex-h" min="0.05" max="0.8" step="0.01" value="0.22"></label>
      </div>
      <div class="panel tex-info"></div>
    </div>
  </div>`,
  mount: (root) => {
    const canvas = root.querySelector(".tex-canvas") as HTMLCanvasElement;
    const info = root.querySelector(".tex-info") as HTMLElement;
    if (!demo) {
      demo = new NormalDemo(canvas);
      demoReady = demo.init();
    }
    const d = demo;
    const showInfo = (name: string) => {
      const t = TEX.find((x) => x.nome === name)!;
      const i = TEX.indexOf(t);
      info.innerHTML = `<div class="h4">camada ${i} · ${esc(t.zona)}</div><h3 style="margin:0 0 8px">${esc(t.nome)}</h3>
        <div class="kv"><span>fonte</span><b>${esc(t.fonte)}</b></div>
        <div class="kv"><span>pacote</span><b>${t.pacote === "wests" ? "wests_textures" : "Tileset combinado"}</b></div>
        <div class="kv"><span>normal map</span><b>${t.normal === "original" ? "original do pacote" : "gerado (Sobel na luminância)"}</b></div>
        <div class="kv"><span>arquivos</span><b class="mono small">L_${t.nome}.jpg · N_${t.nome}.jpg</b></div>`;
    };
    const pick = async (name: string) => {
      demoLayer = name;
      root.querySelectorAll(".tex-grid button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.l === name));
      showInfo(name);
      await d.setLayer(name);
    };
    const onGrid = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-l]") as HTMLElement | null;
      if (b) void pick(b.dataset.l!);
    };
    const onMode = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-m]") as HTMLElement | null;
      if (!b) return;
      d.mode = Number(b.dataset.m);
      root.querySelectorAll(".tex-mode button").forEach((x) => x.classList.toggle("on", x === b));
    };
    const split = root.querySelector(".tex-split") as HTMLInputElement;
    const hgt = root.querySelector(".tex-h") as HTMLInputElement;
    const onSplit = () => {
      d.split = Number(split.value);
      (root.querySelector(".tex-split-v") as HTMLElement).textContent = `${Math.round(d.split * 100)}%`;
    };
    const onH = () => {
      d.height = Number(hgt.value);
      (root.querySelector(".tex-h-v") as HTMLElement).textContent = fmt.n2(d.height);
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = canvasPoint(canvas, e);
      d.light = [x / canvas.width, y / canvas.height];
    };
    root.querySelector(".tex-grid")!.addEventListener("click", onGrid);
    root.querySelector(".tex-mode")!.addEventListener("click", onMode);
    split.addEventListener("input", onSplit);
    hgt.addEventListener("input", onH);
    canvas.addEventListener("pointermove", onMove);
    showInfo(demoLayer);
    let stop: (() => void) | null = null;
    let alive = true;
    void demoReady!.then(async (ok) => {
      if (!alive) return;
      if (!ok) {
        (root.querySelector(".tex-view") as HTMLElement).innerHTML = NO_GPU_HTML;
        return;
      }
      await pick(demoLayer);
      stop = loop((_, t) => d.frame(t));
    });
    return combine(
      () => (alive = false),
      () => stop?.(),
      () => root.querySelector(".tex-grid")!.removeEventListener("click", onGrid),
      () => root.querySelector(".tex-mode")!.removeEventListener("click", onMode),
      () => split.removeEventListener("input", onSplit),
      () => hgt.removeEventListener("input", onH),
      () => canvas.removeEventListener("pointermove", onMove),
    );
  },
};
