// Capítulo 06 — O motor: tecnologias, módulos, frame, uniforms, WGSL,
// skinning e iluminação.

import type { SlideDef } from "../deck";
import { esc, fmt, loop, fitCanvas } from "../dom";
import { getGPU } from "../gpu";
import { FILES, FILE_BY_PATH, snippet, LOC, type SrcFile } from "../data/codigo";
import { codeBlock, highlightLines } from "../highlight";
import { lineChart, PAL, seqColor } from "../charts";
import { showTip, hideTip } from "../tooltip";
import { nivel } from "../data/nivel";
import { MapView, cellLabel } from "../mapview";
import { buildCellLights } from "../../world/LevelMesh";
import { Cell, CELL, ZONES } from "../../levels/LevelData";
import { goTo } from "../nav";
import { combine } from "./common";

// ------------------------------------------------------------ tecnologias
const TECH: { n: string; r: string; w: string; p: "gpu" | "cpu" | "off" | "web" }[] = [
  { n: "WebGPU", r: "API gráfica", w: "GPUDevice, buffers, texturas, pipelines, render passes — sem nenhuma camada por cima", p: "gpu" },
  { n: "WGSL", r: "linguagem de shader", w: "common, level, mesh, skinned, sprite + blit de mipmaps", p: "gpu" },
  { n: "TypeScript 5.9", r: "lógica do jogo", w: `${fmt.n0(LOC.ts)} linhas: jogo, IA, colisão, animação, filas de desenho`, p: "cpu" },
  { n: "Vite 5", r: "dev server e build", w: "compila TS, importa .wgsl com ?raw, build de 2 páginas", p: "web" },
  { n: "Web Audio API", r: "som", w: "síntese procedural + PannerNode HRTF (som 3D)", p: "cpu" },
  { n: "Pointer Lock + HTML/CSS", r: "entrada e interface", w: "mouse relativo; HUD, menus e mapa em DOM", p: "web" },
  { n: "glTF 2.0 (GLB)", r: "formato 3D", w: "leitor próprio: malhas, materiais, skins, animações", p: "cpu" },
  { n: "Blender 4.2 · bpy", r: "conversão offline", w: "abre .blend/.fbx, cria animações, exporta GLB (sem janela)", p: "off" },
  { n: "Python · Pillow · NumPy", r: "texturas e mapa", w: "24 camadas + normal maps (Sobel) + gerador do mapa", p: "off" },
  { n: "puppeteer-core", r: "testes automáticos", w: "Chrome sem janela com WebGPU: capturas e medições", p: "off" },
  { n: "GitHub Actions + Pages", r: "publicação", w: "npm ci → vite build → dist/ publicado", p: "web" },
  { n: "Claude Code", r: "desenvolvimento", w: "17 fases incrementais + 1 prompt final autônomo", p: "off" },
];

export const tecnologias: SlideDef = {
  id: "tecnologias",
  title: "Tecnologias usadas",
  lead: "Nenhuma biblioteca em tempo de execução: o <code>package.json</code> só tem TypeScript, Vite e os tipos do WebGPU. Todo o resto é código do projeto ou API do navegador.",
  body: () => `
  <div class="stack fill" style="grid-template-rows: minmax(0,1fr) auto">
    <div class="tech-grid">${TECH.map(
      (t) => `<div class="panel tech ${t.p}"><div class="row"><b>${esc(t.n)}</b><span class="spacer"></span><span class="tag ${t.p === "gpu" ? "gpu" : t.p === "cpu" ? "cpu" : ""}">${t.p === "off" ? "offline" : t.p === "web" ? "navegador" : t.p.toUpperCase()}</span></div><div class="mono small dim">${esc(t.r)}</div><p class="small">${esc(t.w)}</p></div>`,
    ).join("")}</div>
    <div class="panel tight row gpu-live"><span class="tag gpu">ao vivo</span><span class="small">GPU deste computador: <b class="gpu-name">verificando…</b></span><span class="spacer"></span><span class="mono small dim">devDependencies: @webgpu/types · typescript · vite</span></div>
  </div>`,
  mount: (root) => {
    void getGPU().then((g) => {
      (root.querySelector(".gpu-name") as HTMLElement).textContent = g ? g.adapterName || "adaptador WebGPU disponível (o navegador não expõe o nome)" : "WebGPU indisponível neste navegador";
    });
  },
};

// ------------------------------------------------------------ arquitetura
const DIRS: { dir: string; title: string; proc: "cpu" | "gpu" | "tool" }[] = [
  { dir: "src/core", title: "core · matemática e entrada", proc: "cpu" },
  { dir: "src/gpu", title: "gpu · contexto e texturas", proc: "cpu" },
  { dir: "src/assets", title: "assets · leitor GLB", proc: "cpu" },
  { dir: "src/render", title: "render · renderer e animação", proc: "cpu" },
  { dir: "src/shaders", title: "shaders · WGSL", proc: "gpu" },
  { dir: "src/world", title: "world · grade e geometria", proc: "cpu" },
  { dir: "src/levels", title: "levels · dados do mapa", proc: "cpu" },
  { dir: "src/game", title: "game · regras, jogador, itens", proc: "cpu" },
  { dir: "src/ui", title: "ui · HUD e mapa", proc: "cpu" },
  { dir: "src/audio", title: "audio · síntese", proc: "cpu" },
  { dir: "tools", title: "tools · pipeline offline", proc: "tool" },
];

export const arquitetura: SlideDef = {
  id: "arquitetura",
  title: "Arquitetura: um arquivo, uma responsabilidade",
  lead: "Cada retângulo é um arquivo; a largura é proporcional às linhas. Clique para ler o comentário de cabeçalho — todos começam explicando o que fazem e onde rodam.",
  body: () => {
    const max = Math.max(...FILES.filter((f) => f.lang !== "css").map((f) => f.lines));
    const groups = DIRS.map((d) => ({ ...d, files: FILES.filter((f) => (f.dir === d.dir || f.dir.startsWith(d.dir + "/")) && f.lang !== "css" && !f.path.endsWith("README.md")) }));
    return `
    <div class="arch fill">
      <div class="arch-map scroll">${groups
        .map(
          (g) => `<div class="arch-row"><div class="arch-dir"><span class="tag ${g.proc === "tool" ? "" : g.proc}">${g.proc === "tool" ? "offline" : g.proc.toUpperCase()}</span><b>${esc(g.title)}</b><span class="mono small dim">${fmt.n0(g.files.reduce((s, f) => s + f.lines, 0))}</span></div><div class="arch-files">${g.files
            .map((f) => `<button type="button" class="arch-f ${f.proc}" data-p="${esc(f.path)}" style="flex-grow:${Math.max(0.12, f.lines / max)}" title="${esc(f.path)} · ${f.lines} linhas"><span>${esc(f.name)}</span></button>`)
            .join("")}</div></div>`,
        )
        .join("")}</div>
      <div class="panel arch-detail scroll"></div>
    </div>`;
  },
  init: (root) => {
    const detail = root.querySelector(".arch-detail") as HTMLElement;
    const show = (p: string) => {
      const f = FILE_BY_PATH[p];
      root.querySelectorAll(".arch-f").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.p === p));
      detail.innerHTML = `<div class="h4">${esc(f.dir)}</div><h3 style="margin:0 0 6px">${esc(f.name)}</h3><div class="mono small dim">${fmt.n0(f.lines)} linhas · ${f.proc === "gpu" ? "roda na GPU" : f.proc === "tool" ? "offline" : "roda na CPU"}</div>
        <pre class="header-comment">${esc(f.header || "(sem cabeçalho)")}</pre>
        <button class="btn sm" data-open-code="${esc(f.path)}">Abrir no explorador de código →</button>`;
    };
    root.querySelector(".arch-map")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest(".arch-f") as HTMLElement | null;
      if (b) show(b.dataset.p!);
    });
    detail.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-open-code]") as HTMLElement | null;
      if (!b) return;
      openCode(b.dataset.openCode!);
    });
    show("src/render/Renderer.ts");
  },
};

// O explorador de código (capítulo 13) escuta este pedido.
export let pendingCodePath = "";
export function openCode(path: string, line?: number): void {
  pendingCodePath = path + (line ? `#${line}` : "");
  window.dispatchEvent(new CustomEvent("open-code", { detail: pendingCodePath }));
  goTo("codigo");
}
export function takePendingCode(): string {
  const p = pendingCodePath;
  pendingCodePath = "";
  return p;
}

// ------------------------------------------------------------ frame
interface Step {
  lane: "cpu" | "gpu";
  t: string;
  d: string;
  file: string;
  from: string | RegExp;
  to?: string | RegExp;
  n?: number;
}
const STEPS: Step[] = [
  { lane: "cpu", t: "Entrada", d: "Teclado por e.code, mouse relativo (Pointer Lock) acumulado e consumido uma vez por frame.", file: "src/core/InputManager.ts", from: "consumeMouse()", to: "return d;" },
  { lane: "cpu", t: "Jogador", d: "Aceleração, corrida com fôlego, gravidade, colisão círculo × grade resolvida por eixo, água e lava.", file: "src/world/Level.ts", from: "moveCircle(p:", to: "return hit;" },
  { lane: "cpu", t: "Campo de caminhos", d: "Dijkstra a partir do jogador, a cada 0,3 s ou quando ele muda de célula. Os inimigos descem o gradiente.", file: "src/game/Game.ts", from: "// Campo de caminhos", to: "lv.pathField(" },
  { lane: "cpu", t: "Armas e tiro", d: "Cadência, pente, recarga; cada projétil é um raio DDA na grade + teste contra as caixas dos inimigos.", file: "src/game/Game.ts", from: "for (let k = 0; k < w.pellets; k++)", to: "const hit = this.enemies.rayHit" },
  { lane: "cpu", t: "Inimigos", d: "Máquina de estados por inimigo; linha de visão ~5×/s; animação avançada só para quem está visível.", file: "src/game/enemies/Enemies.ts", from: "switch (e.state)", to: "case St.LURE:" },
  { lane: "cpu", t: "Ossos", d: "Para cada personagem visível: amostra o clipe (slerp), faz crossfade, percorre a hierarquia e grava global × inversa de bind.", file: "src/render/Animator.ts", from: "// Hierarquia: global", to: "offset + j * 16);" },
  { lane: "cpu", t: "Fila de desenho", d: "Frustum culling por esfera; agrupa instâncias por modelo; ordena sprites alfa de trás para frente.", file: "src/render/Renderer.ts", from: "const packGroups", to: "const vmDraws" },
  { lane: "cpu", t: "Envio", d: "Poucos writeBuffer por frame: uniform do frame, instâncias, ossos, sprites, luzes dinâmicas.", file: "src/render/Renderer.ts", from: "this.boneBuf.cpu(q.bones.length)", to: "this.vmSpriteBuf.upload" },
  { lane: "gpu", t: "Passe 1 · mapa", d: "O mapa inteiro em UM drawIndexed: texture arrays escolhem a camada por vértice; portas são instâncias.", file: "src/render/Renderer.ts", from: "pass.setPipeline(this.levelPipeline)", to: "pass.drawIndexed(this.levelIndexCount" },
  { lane: "gpu", t: "Passe 1 · modelos", d: "Um draw instanciado por modelo; personagens com skinning no vertex shader.", file: "src/render/Renderer.ts", from: "if (meshDraws.length)", to: "for (const { g, first } of skinDraws)" },
  { lane: "gpu", t: "Passe 1 · sprites", d: "Partículas, chamas e halos como quads virados para a câmera; alfa ordenado e depois aditivo.", file: "src/render/Renderer.ts", from: "if (nAlpha > 0)", to: "pass.end();" },
  { lane: "gpu", t: "Passe 2 · arma", d: "Limpa só o depth e desenha a arma com FOV 58° e near 0,02 m: ela nunca atravessa a parede. Resolve o MSAA 4× no canvas.", file: "src/render/Renderer.ts", from: "// ------------------------------------------ Pass 2", to: "vm.end();" },
  { lane: "gpu", t: "Por pixel", d: "Luzes estáticas da célula, ambiente da zona, lanterna, luzes dinâmicas, neblina, ACES, gama e dithering.", file: "src/shaders/common.wgsl", from: "fn finish(", to: "return col;" },
];

export const frame: SlideDef = {
  id: "frame",
  title: "Anatomia de um frame",
  lead: "~4 ms a cada 1/240 s no teste. À esquerda, o que a CPU faz em sequência; à direita, o que a GPU faz em paralelo com os comandos que recebeu. Clique numa etapa.",
  body: () => `
  <div class="fr fill">
    <div class="fr-lanes">
      <div class="fr-lane"><span class="tag cpu">CPU · Game.update() + render()</span>${STEPS.map((s, i) => (s.lane === "cpu" ? `<button type="button" class="fr-step cpu" data-i="${i}"><em>${i + 1}</em>${esc(s.t)}</button>` : "")).join("")}</div>
      <div class="fr-arrow mono small">queue.submit([encoder.finish()]) →</div>
      <div class="fr-lane"><span class="tag gpu">GPU · render passes</span>${STEPS.map((s, i) => (s.lane === "gpu" ? `<button type="button" class="fr-step gpu" data-i="${i}"><em>${i + 1}</em>${esc(s.t)}</button>` : "")).join("")}</div>
    </div>
    <div class="panel fr-detail"></div>
  </div>`,
  init: (root) => {
    const detail = root.querySelector(".fr-detail") as HTMLElement;
    const show = (i: number) => {
      const s = STEPS[i];
      root.querySelectorAll(".fr-step").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.i === String(i)));
      const sn = snippet(s.file, s.from, s.to, 22);
      const lang = s.file.endsWith(".wgsl") ? "wgsl" : "ts";
      detail.innerHTML = `<div class="row"><span class="tag ${s.lane}">${s.lane.toUpperCase()}</span><h3 style="margin:0">${i + 1}. ${esc(s.t)}</h3></div><p class="small">${esc(s.d)}</p><div class="mono small dim" style="margin-bottom:4px">${esc(s.file)} · linha ${sn.from}</div>${codeBlock(sn.code, lang, { from: sn.from })}`;
    };
    root.querySelector(".fr-lanes")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest(".fr-step") as HTMLElement | null;
      if (b) show(Number(b.dataset.i));
    });
    show(5);
  },
};

// ------------------------------------------------------------ uniforms
const FRAME_FIELDS: { n: string; t: string; off: number; size: number; d: string }[] = [
  { n: "viewProj", t: "mat4x4<f32>", off: 0, size: 64, d: "projeção × câmera, montada na CPU uma vez por frame" },
  { n: "camPos", t: "vec4<f32>", off: 64, size: 16, d: "xyz = posição da câmera · w = tempo (animações no shader)" },
  { n: "fogColor", t: "vec4<f32>", off: 80, size: 16, d: "cor da neblina da zona · w = densidade" },
  { n: "flashPos", t: "vec4<f32>", off: 96, size: 16, d: "origem da lanterna · w = alcance (30 m)" },
  { n: "flashDir", t: "vec4<f32>", off: 112, size: 16, d: "direção · w = cos(ângulo externo 26°)" },
  { n: "flashParams", t: "vec4<f32>", off: 128, size: 16, d: "cos(interno 11°), intensidade, nº de luzes dinâmicas, exposição" },
  { n: "camRight", t: "vec4<f32>", off: 144, size: 16, d: "eixo direito da câmera (sprites viram para ela)" },
  { n: "camUp", t: "vec4<f32>", off: 160, size: 16, d: "eixo de cima da câmera" },
  { n: "grid", t: "vec4<f32>", off: 176, size: 16, d: "largura, altura, tamanho da célula (2,5 m), multiplicador do ambiente" },
  { n: "zoneAmbient", t: "array<vec4<f32>, 8>", off: 192, size: 128, d: "luz ambiente de cada zona" },
];

export const uniforms: SlideDef = {
  id: "uniforms",
  title: "O uniform do frame, byte a byte",
  lead: "320 bytes que a CPU escreve uma vez por frame e todos os shaders leem (<code>@group(0) @binding(0)</code>). Cada quadrado é 1 byte; passe o mouse sobre um campo. O alinhamento de 16 bytes de vec4/mat4 é regra do WGSL.",
  body: () => {
    const cells: string[] = [];
    for (let b = 0; b < 320; b++) {
      const fi = FRAME_FIELDS.findIndex((f) => b >= f.off && b < f.off + f.size);
      cells.push(`<i data-f="${fi}" class="${fi % 2 ? "alt" : ""}"></i>`);
    }
    return `
    <div class="cols fill" style="grid-template-columns: 1fr 520px">
      <div class="stack">
        <div class="bytes">${cells.join("")}</div>
        <div class="tbl-wrap">
          <table class="tbl ufields"><thead><tr><th class="n">offset</th><th>campo</th><th>tipo</th><th class="n">bytes</th><th>conteúdo</th></tr></thead>
          <tbody>${FRAME_FIELDS.map((f, i) => `<tr data-f="${i}"><td class="n mono">${f.off}</td><td class="mono">${f.n}</td><td class="mono small dim">${esc(f.t)}</td><td class="n">${f.size}</td><td class="small">${esc(f.d)}</td></tr>`).join("")}</tbody></table>
        </div>
      </div>
      <div class="stack">
        <div class="panel">
          <h4>Bind groups de todos os pipelines</h4>
          <div class="bg-list small">
            <div><b class="mono">@group(0)</b> frame · por frame<ul><li><code>binding 0</code> uniform Frame (320 B)</li><li><code>binding 1</code> storage: luzes estáticas (12 floats cada)</li><li><code>binding 2</code> storage: luzes dinâmicas (≤ 16)</li><li><code>binding 3</code> storage: listas de luz por célula</li><li><code>binding 4</code> sampler (anisotrópico)</li></ul></div>
            <div><b class="mono">@group(1)</b> material · por draw<ul><li>mapa: 2 texture arrays (cor e normal) + info das camadas</li><li>modelos: textura + cor base/emissão</li></ul></div>
            <div><b class="mono">@group(2)</b> instâncias · por grupo<ul><li>storage: mat4 + cor + parâmetros (24 floats)</li><li>personagens: + storage de ossos (mat4 por osso)</li></ul></div>
          </div>
        </div>
        ${codeBlock(snippet("src/shaders/common.wgsl", "struct Frame {", "};", 14).code, "wgsl", { from: snippet("src/shaders/common.wgsl", "struct Frame {").from })}
      </div>
    </div>`;
  },
  init: (root) => {
    const hl = (i: number) => {
      root.querySelectorAll(".bytes i").forEach((c) => c.classList.toggle("on", (c as HTMLElement).dataset.f === String(i)));
      root.querySelectorAll(".ufields tr[data-f]").forEach((r) => r.classList.toggle("on", (r as HTMLElement).dataset.f === String(i)));
    };
    const onMove = (e: Event) => {
      const t = (e.target as HTMLElement).closest("[data-f]") as HTMLElement | null;
      if (!t) return;
      const i = Number(t.dataset.f);
      hl(i);
      if (t.tagName === "I") {
        const f = FRAME_FIELDS[i];
        showTip(`<b class="mono">${f.n}</b> <span class="k">${esc(f.t)}</span><div>bytes ${f.off}–${f.off + f.size - 1}</div>`, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
      }
    };
    root.querySelector(".bytes")!.addEventListener("mousemove", onMove);
    root.querySelector(".bytes")!.addEventListener("mouseleave", hideTip);
    root.querySelector(".ufields")!.addEventListener("mousemove", onMove);
    hl(0);
  },
};

// ------------------------------------------------------------ shaders
interface Note {
  at: string | RegExp;
  len: number;
  t: string;
}
const SHADERS: { path: string; label: string; notes: Note[] }[] = [
  {
    path: "src/shaders/common.wgsl",
    label: "common",
    notes: [
      { at: "fn pointLight(", len: 16, t: "Luz pontual: Lambert + especular Blinn-Phong, atenuação (1 − d/alcance)² e cintilação." },
      { at: "let a = cellLights[", len: 17, t: "Só as luzes da lista da célula (pré-calculada na CPU com linha de visão): a luz não atravessa paredes." },
      { at: "// Lanterna (spot light", len: 15, t: "Lanterna: cone com smoothstep entre os ângulos interno/externo e atenuação x²/(1 + 0,03·d²)." },
      { at: "fn aces(", len: 8, t: "Tone mapping ACES (aproximação de Narkowicz): comprime o HDR para [0, 1]." },
      { at: "fn finish(", len: 8, t: "Neblina exponencial, ACES, gama 2,2 e dithering para não formar faixas no escuro." },
    ],
  },
  {
    path: "src/shaders/level.wgsl",
    label: "level",
    notes: [
      { at: "@vertex", len: 16, t: "Uma instância para o mapa estático e uma por porta (deslocamento vertical ao abrir)." },
      { at: "let nt = textureSample(normalArr", len: 5, t: "Normal mapping: a normal da textura (espaço tangente) é levada ao mundo pela base T, B, N." },
      { at: "c += alb * (li.x", len: 2, t: "Lava pulsando: emissivo que varia com o tempo e a posição." },
    ],
  },
  {
    path: "src/shaders/skinned.wgsl",
    label: "skinned",
    notes: [
      { at: "let skin = bones[", len: 4, t: "Skinning: soma ponderada de até 4 matrizes de osso por vértice." },
      { at: "let base = u32(inst.params.z)", len: 1, t: "Todas as instâncias compartilham um storage de ossos; cada uma aponta para o seu primeiro osso." },
    ],
  },
  { path: "src/shaders/mesh.wgsl", label: "mesh", notes: [{ at: "if (inst.params.w < 0.0)", len: 3, t: "Objeto sem célula conhecida: calcula a célula no próprio pixel para achar as luzes." }] },
  { path: "src/shaders/sprite.wgsl", label: "sprite", notes: [{ at: "@vertex", len: 20, t: "Billboards: o quad é montado no vertex shader com os eixos da câmera (camRight/camUp)." }] },
  { path: "src/shaders/particle.compute.wgsl", label: "particle.compute (F16)", notes: [{ at: "@compute", len: 12, t: "Compute shader da fase 16 interrompida: ficou no projeto, mas nenhum pipeline o usa." }] },
];

function lineOf(f: SrcFile, at: string | RegExp): number {
  const lines = f.text.split("\n");
  const i = lines.findIndex((l) => (typeof at === "string" ? l.includes(at) : at.test(l)));
  return i < 0 ? 1 : i + 1;
}

export const shaders: SlideDef = {
  id: "shaders",
  title: "Os shaders WGSL",
  lead: "O código que roda na GPU, comentado em português como pedia a especificação. As notas à direita destacam os trechos mais importantes.",
  body: () => `
  <div class="sh fill">
    <div class="sh-main stack">
      <div class="seg-ctl gpu sm sh-tabs">${SHADERS.map((s, i) => `<button data-i="${i}" class="${i ? "" : "on"}">${esc(s.label)}.wgsl <span class="dim">${FILE_BY_PATH[s.path]?.lines ?? 0}</span></button>`).join("")}</div>
      <div class="sh-code scroll"></div>
    </div>
    <div class="sh-notes scroll"></div>
  </div>`,
  init: (root) => {
    const code = root.querySelector(".sh-code") as HTMLElement;
    const notes = root.querySelector(".sh-notes") as HTMLElement;
    let cur = 0;
    const render = (i: number, hl?: [number, number]) => {
      cur = i;
      const s = SHADERS[i];
      const f = FILE_BY_PATH[s.path];
      root.querySelectorAll(".sh-tabs button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.i === String(i)));
      const set = new Set<number>();
      if (hl) for (let k = hl[0]; k < hl[0] + hl[1]; k++) set.add(k);
      const lines = highlightLines(f.text, "wgsl");
      code.innerHTML = `<pre class="code">${lines.map((l, k) => `<span class="line${set.has(k + 1) ? " hl" : ""}" data-ln="${k + 1}"><span class="ln">${k + 1}</span>${l || " "}</span>`).join("")}</pre>`;
      notes.innerHTML = s.notes
        .map((n, k) => {
          const ln = lineOf(f, n.at);
          return `<button type="button" class="note ${hl && hl[0] === ln ? "on" : ""}" data-k="${k}"><span class="mono small dim">linha ${ln}</span><span class="small">${esc(n.t)}</span></button>`;
        })
        .join("");
      if (hl) {
        const target = code.querySelector(`[data-ln="${hl[0]}"]`) as HTMLElement | null;
        if (target) code.scrollTop = target.offsetTop - 40;
      }
    };
    root.querySelector(".sh-tabs")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (b) render(Number(b.dataset.i));
    });
    notes.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest(".note") as HTMLElement | null;
      if (!b) return;
      const n = SHADERS[cur].notes[Number(b.dataset.k)];
      render(cur, [lineOf(FILE_BY_PATH[SHADERS[cur].path], n.at), n.len]);
    });
    const n0 = SHADERS[0].notes[1];
    render(0, [lineOf(FILE_BY_PATH[SHADERS[0].path], n0.at), n0.len]);
  },
};

// ------------------------------------------------------------ skinning 2D
type M3 = [number, number, number, number, number, number]; // a b c d tx ty (2D afim)
const mul = (m: M3, n: M3): M3 => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const rot = (a: number, tx = 0, ty = 0): M3 => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), tx, ty];
const inv = (m: M3): M3 => {
  const det = m[0] * m[3] - m[2] * m[1];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};
const apply = (m: M3, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const m3s = (m: M3) => `<table class="m3"><tr><td>${fmt.n2(m[0])}</td><td>${fmt.n2(m[2])}</td><td>${fmt.n1(m[4])}</td></tr><tr><td>${fmt.n2(m[1])}</td><td>${fmt.n2(m[3])}</td><td>${fmt.n1(m[5])}</td></tr><tr><td>0</td><td>0</td><td>1</td></tr></table>`;

export const skinning: SlideDef = {
  id: "skinning",
  title: "Skinning, em 2D",
  lead: "A mesma conta que o <code>skinned.wgsl</code> faz para cada vértice, reduzida a dois ossos no plano. Mova os ângulos e veja a malha dobrar; com pesos rígidos aparece a quebra no cotovelo.",
  body: () => `
  <div class="skin fill">
    <div class="panel flush skin-view"><canvas class="skin-canvas"></canvas></div>
    <div class="stack">
      <div class="panel stack tight">
        <label class="ctl">Osso 1 (ombro) <span class="v sk-a1-v">10°</span><input type="range" class="sk-a1" min="-90" max="90" value="10"></label>
        <label class="ctl">Osso 2 (cotovelo) <span class="v sk-a2-v">70°</span><input type="range" class="sk-a2" min="-150" max="150" value="70"></label>
        <label class="ctl">Faixa de mistura dos pesos <span class="v sk-k-v">60</span><input type="range" class="sk-k" min="0" max="140" value="60"></label>
        <div class="row"><label class="chk"><input type="checkbox" class="sk-bind" checked> pose de bind</label><label class="chk"><input type="checkbox" class="sk-anim"> animar</label></div>
      </div>
      <div class="panel tight">
        <div class="formula mono">v′ = Σ wᵢ · (Gᵢ · IBMᵢ) · v</div>
        <div class="skin-mats small"></div>
      </div>
      <div class="panel tight">
        <div class="mono small dim" style="margin-bottom:4px">render/Animator.ts · CPU</div>
        ${codeBlock("// osso = global(junta) × inversa de bind(junta)\nmat4.multiplyInto(out, g, def.inverseBind,\n  def.joints[j] * 16, j * 16, offset + j * 16);", "ts", { numbers: false })}
        <div class="mono small dim" style="margin:8px 0 4px">shaders/skinned.wgsl · GPU, por vértice</div>
        ${codeBlock("let skin = bones[j.x] * w.x + bones[j.y] * w.y\n         + bones[j.z] * w.z + bones[j.w] * w.w;\nlet local = skin * vec4<f32>(in.pos, 1.0);", "wgsl", { numbers: false })}
      </div>
    </div>
  </div>`,
  mount: (root) => {
    const canvas = root.querySelector(".skin-canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const mats = root.querySelector(".skin-mats") as HTMLElement;
    const get = (s: string) => root.querySelector(s) as HTMLInputElement;
    const L = 320, Hh = 34, N = 32;
    const B1: M3 = rot(0, 0, 0), B2: M3 = rot(0, L / 2, 0);
    const IBM1 = inv(B1), IBM2 = inv(B2);
    let lastMat = "";
    const stop = loop((_, t) => {
      const { w, h } = fitCanvas(canvas);
      let a1 = (Number(get(".sk-a1").value) * Math.PI) / 180;
      let a2 = (Number(get(".sk-a2").value) * Math.PI) / 180;
      if (get(".sk-anim").checked) {
        a1 = Math.sin(t * 1.1) * 0.5;
        a2 = 0.2 + Math.sin(t * 1.7) * 1.2;
      }
      const k = Number(get(".sk-k").value);
      (root.querySelector(".sk-a1-v") as HTMLElement).textContent = `${Math.round((a1 * 180) / Math.PI)}°`;
      (root.querySelector(".sk-a2-v") as HTMLElement).textContent = `${Math.round((a2 * 180) / Math.PI)}°`;
      (root.querySelector(".sk-k-v") as HTMLElement).textContent = k ? String(k) : "rígido";
      const G1 = rot(a1, 0, 0);
      const G2 = mul(G1, mul(rot(0, L / 2, 0), rot(a2)));
      const S1 = mul(G1, IBM1), S2 = mul(G2, IBM2);
      const sc = Math.min(w / 560, h / 420);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0c1014";
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(sc, 0, 0, -sc, w * 0.3, h * 0.62);
      const weight2 = (x: number) => (k <= 0 ? (x > L / 2 ? 1 : 0) : Math.min(1, Math.max(0, (x - (L / 2 - k / 2)) / k)));
      const vert = (x: number, y: number): [number, number, number] => {
        const w2 = weight2(x);
        const p1 = apply(S1, x, y), p2 = apply(S2, x, y);
        return [p1[0] * (1 - w2) + p2[0] * w2, p1[1] * (1 - w2) + p2[1] * w2, w2];
      };
      if (get(".sk-bind").checked) {
        ctx.strokeStyle = "#ffffff22";
        ctx.lineWidth = 1 / sc;
        ctx.strokeRect(0, -Hh, L, 2 * Hh);
      }
      for (let i = 0; i < N; i++) {
        const xa = (L * i) / N, xb = (L * (i + 1)) / N;
        const p = [vert(xa, -Hh), vert(xb, -Hh), vert(xb, Hh), vert(xa, Hh)];
        const w2 = (p[0][2] + p[1][2]) / 2;
        const r = Math.round(57 + (217 - 57) * w2), g = Math.round(135 + (89 - 135) * w2), b = Math.round(229 + (38 - 229) * w2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.strokeStyle = "#0c1014";
        ctx.lineWidth = 1.2 / sc;
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let q = 1; q < 4; q++) ctx.lineTo(p[q][0], p[q][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // ossos
      const j0 = apply(G1, 0, 0), j1 = apply(G2, 0, 0), j2 = apply(G2, L / 2, 0);
      ctx.strokeStyle = "#ece6da";
      ctx.lineWidth = 4 / sc;
      ctx.beginPath();
      ctx.moveTo(j0[0], j0[1]);
      ctx.lineTo(j1[0], j1[1]);
      ctx.lineTo(j2[0], j2[1]);
      ctx.stroke();
      ctx.fillStyle = "#ece6da";
      for (const j of [j0, j1]) {
        ctx.beginPath();
        ctx.arc(j[0], j[1], 7 / sc, 0, Math.PI * 2);
        ctx.fill();
      }
      const mk = `${S1.map((v) => v.toFixed(2)).join()}|${S2.map((v) => v.toFixed(2)).join()}`;
      if (mk !== lastMat) {
        lastMat = mk;
        mats.innerHTML = `<div class="skin-m"><span class="tag"><i class="sw" style="background:#3987e5"></i>osso 1</span>${m3s(S1)}</div><div class="skin-m"><span class="tag"><i class="sw" style="background:#d95926"></i>osso 2</span>${m3s(S2)}</div><p class="cap dim" style="margin:6px 0 0">Gᵢ · IBMᵢ: a matriz que leva o vértice da pose de bind à pose atual. A cor da malha é o peso de cada osso.</p>`;
      }
    });
    return stop;
  },
};

// ------------------------------------------------------------ luz por célula
function lightsFor(cx: number, cz: number, visible: boolean): number[] {
  const lv = nivel();
  const S = CELL;
  const out: number[] = [];
  lv.lights.forEach((l, li) => {
    const nx = Math.max(cx * S, Math.min(l.x, (cx + 1) * S));
    const nz = Math.max(cz * S, Math.min(l.z, (cz + 1) * S));
    if (Math.hypot(nx - l.x, nz - l.z) > l.range) return;
    if (!visible) {
      out.push(li);
      return;
    }
    const pts = [[(cx + 0.5) * S, (cz + 0.5) * S], [cx * S + 0.3, cz * S + 0.3], [cx * S + S - 0.3, cz * S + 0.3], [cx * S + 0.3, cz * S + S - 0.3], [cx * S + S - 0.3, cz * S + S - 0.3]];
    let vis = cx === l.cx && cz === l.cz;
    for (let k = 0; !vis && k < pts.length; k++) vis = lv.los(l.x, l.z, pts[k][0], pts[k][1], false);
    if (vis) out.push(li);
  });
  return out;
}

let cellCounts: { vis: Uint8Array; naive: Uint8Array } | null = null;
function counts(): { vis: Uint8Array; naive: Uint8Array } {
  if (!cellCounts) {
    const lv = nivel();
    const packed = buildCellLights(lv);
    const N = lv.W * lv.H;
    const vis = new Uint8Array(N), naive = new Uint8Array(N);
    for (let c = 0; c < N; c++) {
      let n = 0;
      for (let k = 0; k < 7; k++) {
        const v = packed[c * 8 + k];
        if ((v & 0xffff) !== 0xffff) n++;
        if (v >>> 16 !== 0xffff) n++;
      }
      vis[c] = n;
    }
    lv.lights.forEach((l) => {
      const r = Math.ceil(l.range / CELL);
      for (let cz = l.cz - r; cz <= l.cz + r; cz++)
        for (let cx = l.cx - r; cx <= l.cx + r; cx++) {
          if (!lv.inBounds(cx, cz) || lv.type[lv.idx(cx, cz)] === Cell.SOLID) continue;
          const nx = Math.max(cx * CELL, Math.min(l.x, (cx + 1) * CELL)), nz = Math.max(cz * CELL, Math.min(l.z, (cz + 1) * CELL));
          if (Math.hypot(nx - l.x, nz - l.z) <= l.range) naive[lv.idx(cx, cz)]++;
        }
    });
    cellCounts = { vis, naive };
  }
  return cellCounts;
}

export const luzPorCelula: SlideDef = {
  id: "luz-por-celula",
  title: "Luz que não atravessa parede",
  lead: "Sem shadow maps: na carga do mapa, a CPU testa linha de visão (DDA na grade) de cada luz até cada célula no alcance e guarda até 14 índices por célula. Clique numa célula para ver quais luzes ela recebe.",
  body: () => `
  <div class="lc fill">
    <div class="panel flush lc-view"><canvas class="lc-canvas"></canvas></div>
    <div class="stack">
      <div class="seg-ctl sm lc-mode"><button data-m="vis" class="on">Com visibilidade (jogo)</button><button data-m="naive">Ingênuo (só distância)</button><button data-m="none">Sem calor</button></div>
      <div class="panel lc-info"><p class="small muted">Clique no mapa.</p></div>
      <div class="panel tight"><div class="legend"><span><i style="background:${seqColor(0.15)}"></i>poucas luzes</span><span><i style="background:${seqColor(0.95)}"></i>muitas luzes</span><span><i style="background:#f2a65a"></i>luz visível</span><span><i style="background:#e0564c"></i>bloqueada</span></div></div>
    </div>
  </div>`,
  mount: (root) => {
    const lv = nivel();
    const canvas = root.querySelector(".lc-canvas") as HTMLCanvasElement;
    const info = root.querySelector(".lc-info") as HTMLElement;
    const mv = new MapView(canvas, lv, { layers: ["doors", "lights"], dim: 0.15 });
    let mode = "vis";
    const cnt = counts();
    // Começa pela célula que mais perde luzes para as paredes (a mais didática).
    let sel: [number, number] | null = null;
    let bestDiff = -1;
    for (let z = 0; z < lv.H; z++)
      for (let x = 0; x < lv.W; x++) {
        const i = lv.idx(x, z);
        const d = cnt.naive[i] - cnt.vis[i];
        if (d > bestDiff && cnt.vis[i] > 0) {
          bestDiff = d;
          sel = [x, z];
        }
      }
    const draw = () =>
      mv.draw((c, m) => {
        if (mode !== "none") {
          const arr = mode === "vis" ? cnt.vis : cnt.naive;
          c.globalAlpha = 0.55;
          for (let z = 0; z < lv.H; z++)
            for (let x = 0; x < lv.W; x++) {
              const n = arr[lv.idx(x, z)];
              if (!n) continue;
              c.fillStyle = seqColor(Math.min(1, n / 14));
              c.fillRect(m.ox + x * m.cs, m.oy + z * m.cs, m.cs + 0.5, m.cs + 0.5);
            }
          c.globalAlpha = 1;
        }
        if (sel) {
          const [cx, cz] = sel;
          const vis = new Set(lightsFor(cx, cz, true));
          const all = lightsFor(cx, cz, false);
          const [X, Y] = m.px(cx, cz);
          for (const li of all) {
            const l = lv.lights[li];
            const [lx, ly] = m.mpx(l.x, l.z);
            const ok = vis.has(li);
            c.strokeStyle = ok ? "#f2a65a" : "#e0564c";
            c.lineWidth = ok ? 2 : 1.5;
            c.setLineDash(ok ? [] : [5, 4]);
            c.beginPath();
            c.moveTo(X, Y);
            c.lineTo(lx, ly);
            c.stroke();
          }
          c.setLineDash([]);
          c.strokeStyle = "#ece6da";
          c.lineWidth = 2;
          c.strokeRect(m.ox + cx * m.cs, m.oy + cz * m.cs, m.cs, m.cs);
        }
      });
    const update = () => {
      draw();
      if (!sel) return;
      const [cx, cz] = sel;
      const vis = lightsFor(cx, cz, true), all = lightsFor(cx, cz, false);
      const kinds = (ids: number[]) => {
        const k: Record<string, number> = {};
        ids.forEach((i) => (k[lv.lights[i].kind] = (k[lv.lights[i].kind] ?? 0) + 1));
        return Object.entries(k).map(([a, b]) => `${b} ${a === "torch" ? "tocha" : a === "brazier" ? "braseiro" : a === "lamp" ? "lâmpada" : a}`).join(", ") || "nenhuma";
      };
      info.innerHTML = `<div class="h4">célula (${cx}, ${cz}) · ${esc(cellLabel(lv, cx, cz))} · ${esc(ZONES[lv.zone[lv.idx(cx, cz)]].name.toLowerCase())}</div>
        <div class="cols-2" style="gap:12px;margin-top:8px"><div class="stat"><span class="v num" style="color:#e0564c">${all.length}</span><span class="l">ingênuo: no alcance</span></div><div class="stat cpu"><span class="v num">${Math.min(14, vis.length)}</span><span class="l">visíveis (vão para a GPU)</span></div></div>
        <p class="small" style="margin-top:10px">${all.length - vis.length} luz(es) cortada(s) por paredes. Visíveis: ${kinds(vis)}.</p>`;
    };
    const onClick = (e: MouseEvent) => {
      const c = mv.cellAt(e);
      if (!c || lv.type[lv.idx(c[0], c[1])] === Cell.SOLID) return;
      sel = c;
      update();
    };
    const onMove = (e: MouseEvent) => {
      const c = mv.cellAt(e);
      if (!c) return hideTip();
      const i = lv.idx(c[0], c[1]);
      showTip(`<b>(${c[0]}, ${c[1]})</b> ${esc(cellLabel(lv, c[0], c[1]))}<div class="k">luzes visíveis ${cnt.vis[i]} · no alcance ${cnt.naive[i]}</div>`, e.clientX, e.clientY);
    };
    const onMode = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-m]") as HTMLElement | null;
      if (!b) return;
      mode = b.dataset.m!;
      root.querySelectorAll(".lc-mode button").forEach((x) => x.classList.toggle("on", x === b));
      update();
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", hideTip);
    root.querySelector(".lc-mode")!.addEventListener("click", onMode);
    const ro = new ResizeObserver(() => update());
    ro.observe(canvas);
    update();
    return combine(
      () => ro.disconnect(),
      () => canvas.removeEventListener("click", onClick),
      () => canvas.removeEventListener("mousemove", onMove),
      () => root.querySelector(".lc-mode")!.removeEventListener("click", onMode),
    );
  },
};

// ------------------------------------------------------------ curvas
const aces = (x: number) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));

export const curvas: SlideDef = {
  id: "curvas",
  title: "As curvas da imagem",
  lead: "Três funções que decidem como o jogo aparece. A primeira foi corrigida no prompt final: a lanterna estourava de perto.",
  body: () => `
  <div class="cols-3 fill">
    <div class="panel stack"><h4>Lanterna: intensidade × distância</h4><div class="cv-flash"></div><p class="cap dim">x = 1 − d/30 m. Antes: 3,4·x². Depois: 2,1·x²/(1 + 0,03·d²).</p></div>
    <div class="panel stack"><h4>Tone mapping (HDR → tela)</h4><div class="cv-aces"></div><label class="ctl">Exposição <span class="v cv-exp-v">1,25</span><input type="range" class="cv-exp" min="0.5" max="3" step="0.05" value="1.25"></label></div>
    <div class="panel stack"><h4>Neblina por zona</h4><div class="seg-ctl sm cv-zone">${ZONES.map((z, i) => `<button data-z="${i}" class="${i === 2 ? "on" : ""}">${esc(z.name.split(" ")[0].toLowerCase())}</button>`).join("")}</div><div class="cv-fog"></div><p class="cap dim">f(d) = 1 − e<sup>−densidade·d</sup>. O clear da tela usa a mesma cor (o bug do retângulo preto).</p></div>
  </div>`,
  init: (root) => {
    const fl = lineChart({
      x0: 0,
      x1: 30,
      width: 440,
      height: 300,
      xLabel: "distância (m)",
      series: [
        { name: "antes", color: PAL.cat[1], fn: (d) => 3.4 * Math.pow(Math.max(0, 1 - d / 30), 2), dash: "6 5" },
        { name: "depois", color: PAL.cat[0], fn: (d) => (2.1 * Math.pow(Math.max(0, 1 - d / 30), 2)) / (1 + 0.03 * d * d) },
      ],
    });
    root.querySelector(".cv-flash")!.appendChild(fl.root);
    let exp = 1.25;
    const ac = lineChart({
      x0: 0,
      x1: 4,
      width: 440,
      height: 300,
      yMax: 1.2,
      xLabel: "luz na cena (linear)",
      series: [
        { name: "sem tone map", color: PAL.cat[1], fn: (x) => Math.min(1.2, x * exp), dash: "6 5" },
        { name: "ACES", color: PAL.cat[0], fn: (x) => aces(x * exp) },
        { name: "ACES + gama", color: PAL.cat[2], fn: (x) => Math.pow(aces(x * exp), 1 / 2.2) },
      ],
    });
    root.querySelector(".cv-aces")!.appendChild(ac.root);
    const expEl = root.querySelector(".cv-exp") as HTMLInputElement;
    expEl.addEventListener("input", () => {
      exp = Number(expEl.value);
      (root.querySelector(".cv-exp-v") as HTMLElement).textContent = fmt.n2(exp);
      ac.update();
    });
    let zi = 2;
    const fog = lineChart({
      x0: 0,
      x1: 160,
      width: 440,
      height: 300,
      yMax: 1,
      xLabel: "distância (m)",
      marks: [{ x: 90, label: "far antigo (90 m)" }],
      series: [{ name: "neblina", color: PAL.cat[0], fn: (d) => 1 - Math.exp(-ZONES[zi].fogDensity * d) }],
    });
    root.querySelector(".cv-fog")!.appendChild(fog.root);
    root.querySelector(".cv-zone")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-z]") as HTMLElement | null;
      if (!b) return;
      zi = Number(b.dataset.z);
      root.querySelectorAll(".cv-zone button").forEach((x) => x.classList.toggle("on", x === b));
      fog.update();
    });
  },
};

