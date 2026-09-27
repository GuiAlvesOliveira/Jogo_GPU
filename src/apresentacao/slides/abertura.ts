// Capítulo 00 — Abertura: capa, convenções.

import type { SlideDef } from "../deck";
import { loop, fmt } from "../dom";
import { ModelViewer } from "../viewer";
import { LOC } from "../data/codigo";
import { MODELS, TEX } from "../data/assets";
import { IMG } from "./common";

let coverViewer: ModelViewer | null = null;
let coverReady: Promise<boolean> | null = null;

export const capa: SlideDef = {
  id: "capa",
  title: "Setor Zero",
  head: false,
  cls: "slide-cover",
  body: () => `
  <div class="cover">
    <div class="cover-text">
      <div class="kicker">Programação Gráfica · WebGPU + WGSL · 2026</div>
      <h1 class="cover-title">Setor<br>Zero</h1>
      <p class="lead-text">Um FPS retrô de horror feito com <b>WebGPU puro</b> — sem engine — do primeiro prompt ao jogo final.</p>
      <div class="row" style="margin-top:6px">
        <button class="btn primary" data-go="roteiro">Começar a apresentação →</button>
        <a class="btn" href="./jogo.html" target="_blank" rel="noopener">Jogar ↗</a>
      </div>
      <div class="cover-stats">
        <div class="stat"><span class="v num">${fmt.n0(LOC.total)}</span><span class="l">linhas de código</span></div>
        <div class="stat"><span class="v num">17<small>+1</small></span><span class="l">fases + prompt final</span></div>
        <div class="stat"><span class="v num">${MODELS.length}</span><span class="l">modelos GLB</span></div>
        <div class="stat"><span class="v num">${TEX.length}</span><span class="l">camadas de textura</span></div>
        <div class="stat"><span class="v num">0</span><span class="l">engines</span></div>
      </div>
    </div>
    <div class="cover-3d">
      <canvas class="cover-canvas" aria-label="Troll renderizado em WebGPU"></canvas>
      <img class="cover-fallback" src="${IMG}testes/s_arena.jpg" alt="Arena do Rei Troll" hidden>
      <div class="cover-cap mono">e_troll.glb · renderizado agora, na sua GPU, pelo mesmo leitor de GLB do jogo</div>
    </div>
  </div>`,
  mount: (root) => {
    const canvas = root.querySelector(".cover-canvas") as HTMLCanvasElement;
    if (!coverViewer) {
      coverViewer = new ModelViewer(canvas);
      coverViewer.grid = false;
      coverViewer.exposure = 1.0;
      coverReady = coverViewer.init().then(async (ok) => {
        if (!ok) return false;
        await coverViewer!.show("e_troll", { yaw: 0.5, pitch: 0.12, clip: "idle", frame: 0.7 });
        coverViewer!.zoom = 0.6;
        return true;
      });
    }
    let stop: (() => void) | null = null;
    let alive = true;
    coverReady!.then((ok) => {
      if (!alive) return;
      if (!ok) {
        canvas.hidden = true;
        (root.querySelector(".cover-fallback") as HTMLElement).hidden = false;
        return;
      }
      stop = loop((dt) => {
        coverViewer!.yaw = 0.5 + Math.sin(performance.now() / 4000) * 0.45;
        coverViewer!.autoRotate = false;
        coverViewer!.frame(dt);
      });
    });
    return () => {
      alive = false;
      stop?.();
    };
  },
};

export const convencoes: SlideDef = {
  id: "convencoes",
  title: "Como ler esta apresentação",
  lead: "A especificação original pedia uma arquitetura que deixasse <b>explícito o que roda na CPU e o que roda na GPU</b>. Essa divisão vira a legenda de cores de toda a apresentação.",
  body: () => `
  <div class="cols-3 fill">
    <div class="panel stack">
      <span class="tag cpu">CPU · âmbar (a tocha)</span>
      <h3>Lógica, sequencial</h3>
      <ul class="dash small">
        <li>entrada, regras, estados do jogo</li>
        <li>IA, campo de caminhos (Dijkstra), colisão</li>
        <li>amostragem das animações (pose dos ossos)</li>
        <li>montagem das filas de desenho e poucos <code>writeBuffer</code></li>
        <li>áudio (Web Audio) e HUD (HTML/CSS)</li>
      </ul>
    </div>
    <div class="panel stack">
      <span class="tag gpu">GPU · ciano (a lanterna)</span>
      <h3>Paralelo, por vértice e por pixel</h3>
      <ul class="dash small">
        <li>transformação de vértices (Model → View → Projection)</li>
        <li>skinning: cada vértice deformado por até 4 ossos</li>
        <li>iluminação por pixel: tochas, lanterna, luzes dinâmicas</li>
        <li>normal mapping, neblina, ACES, gama, dithering</li>
        <li>MSAA 4× e geração de mipmaps</li>
      </ul>
    </div>
    <div class="panel stack">
      <span class="tag bug">Vermelho · erro e correção</span>
      <h3>Tudo aqui é real</h3>
      <ul class="dash small">
        <li>tabelas e gráficos importam os <b>dados do próprio jogo</b> (inimigos, armas, itens, mapa)</li>
        <li>os visualizadores 3D usam o <b>leitor de GLB e o animador do jogo</b></li>
        <li>as 17 fases foram <b>reconstruídas das conversas</b> e rodam aqui, ao vivo</li>
      </ul>
      <div class="keys small">
        <div><kbd>←</kbd> <kbd>→</kbd> navegar</div>
        <div><kbd>O</kbd> roteiro completo</div>
        <div><kbd>F</kbd> tela cheia</div>
        <div><kbd>Esc</kbd> fechar</div>
      </div>
    </div>
  </div>`,
};
