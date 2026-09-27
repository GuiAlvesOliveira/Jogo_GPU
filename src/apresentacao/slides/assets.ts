// Capítulo 04 — Assets: inventário, material bruto, pipeline, animações.

import type { SlideDef } from "../deck";
import { esc, fmt, loop, fitCanvas } from "../dom";
import { RAW, CLIPS, CLIP_NAMES, type Uso } from "../data/assets";
import { codeBlock } from "../highlight";
import { snippet } from "../data/codigo";
import { IMG, bindTabs } from "./common";

const USO: Record<Uso, { label: string; cls: string }> = {
  usado: { label: "usado", cls: "ok" },
  referencia: { label: "referência", cls: "warn" },
  nao: { label: "não usado", cls: "" },
};

export const inventario: SlideDef = {
  id: "inventario",
  title: "O material de partida",
  lead: "A pasta <code>assets/</code> tinha 21 arquivos compactados, 237 MB. Nenhum estava no formato que o jogo lê: o motor não usa engine, então tudo precisou virar GLB e JPG por um pipeline próprio.",
  body: () => {
    const max = Math.max(...RAW.map((r) => r.bytes));
    const n = (u: Uso) => RAW.filter((r) => r.uso === u).length;
    return `
    <div class="stack fill" style="grid-template-rows:auto minmax(0,1fr)">
      <div class="row">
        <div class="seg-ctl inv-filter">
          <button data-f="all" class="on">Todos (${RAW.length})</button>
          <button data-f="usado">Usados (${n("usado")})</button>
          <button data-f="referencia">Referência (${n("referencia")})</button>
          <button data-f="nao">Não usados (${n("nao")})</button>
        </div>
        <span class="spacer"></span>
        <span class="small dim">tamanho em escala logarítmica</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl inv">
          <thead><tr><th>Arquivo</th><th>Pasta</th><th>Formato</th><th class="n">Tamanho</th><th>Conteúdo</th><th>Virou</th><th>Uso</th></tr></thead>
          <tbody>${RAW.map((r) => {
            const w = (Math.log10(r.bytes) - 3) / (Math.log10(max) - 3);
            return `<tr data-u="${r.uso}"><td class="mono small">${esc(r.arquivo)}</td><td class="small dim">${r.pasta}</td><td class="small">${esc(r.formato)}</td>
              <td class="n"><div class="sizebar"><i style="width:${Math.max(3, w * 100)}%"></i><span>${fmt.kb(r.bytes)}</span></div></td>
              <td class="small muted">${esc(r.conteudo)}</td><td class="small">${esc(r.virou)}</td><td><span class="tag ${USO[r.uso].cls}">${USO[r.uso].label}</span></td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </div>`;
  },
  init: (root) => {
    root.querySelector(".inv-filter")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-f]") as HTMLElement | null;
      if (!b) return;
      root.querySelectorAll(".inv-filter button").forEach((x) => x.classList.toggle("on", x === b));
      const f = b.dataset.f!;
      root.querySelectorAll("tbody tr").forEach((tr) => ((tr as HTMLElement).hidden = f !== "all" && (tr as HTMLElement).dataset.u !== f));
    });
  },
};

// Sprite sheet do rato 2D: 42 quadros × 8 direções, 128 px (Rat.txt).
const RAT_ANIMS: { name: string; label: string; pos: number; frames: number; ms: number; type: "loop" | "pingpong" | "once" }[] = [
  { name: "stance", label: "parado", pos: 0, frames: 4, ms: 800, type: "pingpong" },
  { name: "run", label: "correr", pos: 4, frames: 8, ms: 533, type: "loop" },
  { name: "swing", label: "atacar", pos: 12, frames: 5, ms: 800, type: "once" },
  { name: "hit", label: "dano", pos: 17, frames: 2, ms: 133, type: "once" },
  { name: "die", label: "morrer", pos: 17, frames: 11, ms: 1000, type: "once" },
  { name: "critdie", label: "morte crítica", pos: 28, frames: 9, ms: 1000, type: "once" },
  { name: "shoot", label: "lançar", pos: 38, frames: 4, ms: 800, type: "once" },
];

export const materialBruto: SlideDef = {
  id: "material-bruto",
  title: "Interagindo com o material bruto",
  lead: "Como os arquivos chegaram, antes de qualquer conversão. Os GIFs serviram de referência de movimento; o rato 2D ficou de fora porque existia a versão 3D animada.",
  body: () => `
  <div class="stack fill" style="grid-template-rows:auto minmax(0,1fr)">
    <div class="seg-ctl">
      <button data-tab="rato" class="on">Rato 2D (sprite sheet)</button>
      <button data-tab="troll">Troll (GIF)</button>
      <button data-tab="angler">Abissal (GIF)</button>
      <button data-tab="kenney">Kenney</button>
      <button data-tab="texturas">Pacotes de textura</button>
    </div>
    <div data-pane="rato" class="rat fill">
      <div class="panel rat-stage"><canvas class="rat-canvas"></canvas></div>
      <div class="stack">
        <div class="panel stack">
          <h4>Animação</h4>
          <div class="seg-ctl sm rat-anim">${RAT_ANIMS.map((a, i) => `<button data-i="${i}" class="${i === 1 ? "on" : ""}">${a.label}</button>`).join("")}</div>
          <h4 style="margin-top:6px">Direção (linha da folha)</h4>
          <div class="seg-ctl sm rat-dir">${[0, 1, 2, 3, 4, 5, 6, 7].map((d) => `<button data-d="${d}" class="${d === 0 ? "on" : ""}">${d}</button>`).join("")}</div>
          <label class="ctl">Velocidade <span class="v rat-sp-v">1,0×</span><input type="range" class="rat-sp" min="0.2" max="2" step="0.1" value="1"></label>
          <div class="mono small rat-info dim"></div>
        </div>
        <div class="panel"><h4>rat.png inteiro · 5376 × 1024 px</h4><div class="rat-sheet"><img src="apresentacao/raw/rat.png" alt="Folha de sprites do rato"><i class="rat-sel"></i></div>
        <p class="cap dim" style="margin:8px 0 0">42 quadros × 8 direções de 128 px. Formato de engine 2D (Flare): descartado em favor do rato 3D com esqueleto.</p></div>
      </div>
    </div>
    <div data-pane="troll" class="cols-2 fill" hidden>
      <figure class="panel flush gif"><img src="apresentacao/raw/troll.webp" alt="GIF do troll (referência)"><figcaption>troll.gif (convertido para WebP) — referência de movimento</figcaption></figure>
      <figure class="stack"><img src="${IMG}pipeline/troll_gif_quadros.jpg" alt="Quadros extraídos do GIF do troll" data-zoom><figcaption>Quadros extraídos para estudar a passada e o golpe → viraram keyframes no Blender</figcaption></figure>
    </div>
    <div data-pane="angler" class="cols-2 fill" hidden>
      <figure class="panel flush gif"><img src="apresentacao/raw/angler.webp" alt="GIF do abissal (referência)"><figcaption>angler.gif — a criatura com a isca luminosa</figcaption></figure>
      <figure class="stack"><img src="${IMG}pipeline/abissal_gif_quadros.jpg" alt="Quadros do GIF do abissal" data-zoom><img src="${IMG}pipeline/abissal_textura.jpg" alt="Textura do abissal" data-zoom><figcaption>Quadros do GIF e a textura original (cor, normal, specular)</figcaption></figure>
    </div>
    <div data-pane="kenney" class="cols-2 fill" hidden>
      <figure class="panel flush"><img src="apresentacao/raw/kenney_preview.jpg" alt="Kenney Animated Characters Retro" data-zoom><figcaption>Kenney · Animated Characters Retro (CC0): personagens humanos com skins de zumbi</figcaption></figure>
      <div class="panel stack"><h4>O que foi feito com ele</h4><ul class="dash small"><li>malha + esqueleto reaproveitados; as animações humanas foram <b>substituídas</b> por 6 clipes de zumbi escritos por script (arrastar os pés, braços estendidos, perna manca)</li><li>a skin <code>zombieFemaleA.png</code> virou a <b>corredora</b> (mesma malha, outra textura no <code>ModelUploader</code>)</li><li>a variante <b>caída</b> usa o clipe de morte tocado ao contrário para se levantar</li></ul><img src="${IMG}pipeline/previa_zumbi_darsh.jpg" alt="Prévias do zumbi e do Darsh" data-zoom></div>
    </div>
    <div data-pane="texturas" class="cols-2 fill" hidden>
      <figure><img src="${IMG}pipeline/pack_tileset.jpg" alt="Tileset combinado" data-zoom><figcaption>Tileset_combined_binary.zip: com normal maps prontos (lava, água, ouro, rocha)</figcaption></figure>
      <figure><img src="${IMG}pipeline/pack_wests.jpg" alt="Wests textures" data-zoom><figcaption>wests_textures.zip: madeira, pedra, metal — sem normal map (gerado por Sobel)</figcaption></figure>
    </div>
  </div>`,
  init: (root) => {
    bindTabs(root.querySelector(".slide-body") as HTMLElement);
  },
  mount: (root) => {
    const canvas = root.querySelector(".rat-canvas") as HTMLCanvasElement;
    const sel = root.querySelector(".rat-sel") as HTMLElement;
    const info = root.querySelector(".rat-info") as HTMLElement;
    const img = new Image();
    img.src = "apresentacao/raw/rat.png";
    let anim = 1, dir = 0, speed = 1, t = 0;
    const onAnim = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!b) return;
      anim = Number(b.dataset.i);
      t = 0;
      root.querySelectorAll(".rat-anim button").forEach((x) => x.classList.toggle("on", x === b));
    };
    const onDir = (e: Event) => {
      const b = (e.target as HTMLElement).closest("button[data-d]") as HTMLElement | null;
      if (!b) return;
      dir = Number(b.dataset.d);
      root.querySelectorAll(".rat-dir button").forEach((x) => x.classList.toggle("on", x === b));
    };
    const sp = root.querySelector(".rat-sp") as HTMLInputElement;
    const onSp = () => {
      speed = Number(sp.value);
      (root.querySelector(".rat-sp-v") as HTMLElement).textContent = `${fmt.n1(speed)}×`;
    };
    root.querySelector(".rat-anim")!.addEventListener("click", onAnim);
    root.querySelector(".rat-dir")!.addEventListener("click", onDir);
    sp.addEventListener("input", onSp);
    const ctx = canvas.getContext("2d")!;
    const stop = loop((dt) => {
      if (canvas.offsetParent === null || !img.complete) return;
      const { w, h } = fitCanvas(canvas);
      const a = RAT_ANIMS[anim];
      t += dt * speed;
      const ft = a.ms / 1000 / a.frames;
      let k = Math.floor(t / ft);
      if (a.type === "loop") k %= a.frames;
      else if (a.type === "pingpong") {
        const p = Math.max(1, a.frames * 2 - 2);
        k %= p;
        if (k >= a.frames) k = p - k;
      } else if (k >= a.frames + 5) {
        t = 0;
        k = 0;
      } else k = Math.min(k, a.frames - 1);
      const frame = a.pos + k;
      // fundo xadrez claro (o rato é escuro)
      const cs = 24 * (w / 600);
      for (let y = 0; y < h; y += cs) for (let x = 0; x < w; x += cs) {
        ctx.fillStyle = ((x / cs + y / cs) | 0) % 2 ? "#c9c3b6" : "#dcd6ca";
        ctx.fillRect(x, y, cs, cs);
      }
      ctx.imageSmoothingEnabled = false;
      const s = Math.min(w, h) * 0.95;
      ctx.drawImage(img, frame * 128, dir * 128, 128, 128, (w - s) / 2, (h - s) / 2, s, s);
      sel.style.left = `${(frame / 42) * 100}%`;
      sel.style.top = `${(dir / 8) * 100}%`;
      info.textContent = `[${a.name}] quadro ${k + 1}/${a.frames} · coluna ${frame}, linha ${dir} · ${Math.round(a.ms / a.frames)} ms/quadro`;
    });
    return () => {
      stop();
      root.querySelector(".rat-anim")!.removeEventListener("click", onAnim);
      root.querySelector(".rat-dir")!.removeEventListener("click", onDir);
      sp.removeEventListener("input", onSp);
    };
  },
};

interface PNode {
  id: string;
  label: string;
  sub: string;
  proc: "off" | "cpu" | "gpu";
  file?: string;
  from?: string | RegExp;
  to?: string | RegExp;
  text: string;
}

const P_NODES: PNode[][] = [
  [
    { id: "zip", label: "assets/*.zip", sub: "21 arquivos · 237 MB", proc: "off", text: "Descompactados numa pasta de trabalho (RAW). Formatos: .blend, .fbx, .glb, .obj, PNG, GIF, 7z." },
    { id: "blender", label: "Blender 4.2 sem janela", sub: "python bpy · --background", proc: "off", file: "tools/assets/bl_common.py", from: "def export_glb", to: "export_animations", text: "Baixado em modo portátil (com permissão). Roda scripts Python que abrem cada .blend, limpam, normalizam escala e orientação e exportam GLB. Precisou de subst B: por causa do limite de 260 caracteres de caminho do Windows." },
    { id: "enemies", label: "export_enemies.py", sub: "cria as animações que faltam", proc: "off", file: "tools/assets/export_enemies.py", from: "# --- WALK: pés", to: "walk = an.action", text: "Escreve keyframes em espaço da armature (andar com IK nos pés, golpe, morte), completa canais ausentes e exporta os clipes idle/walk/run/attack/hit/death." },
    { id: "glb", label: "public/game/models/*.glb", sub: "21 modelos · ~6 MB", proc: "off", text: "glTF binário: um JSON (cena, nós, malhas, materiais, skins, animações) + um bloco binário (vértices, índices, matrizes, keyframes). Texturas embutidas em JPEG." },
  ],
  [
    { id: "pillow", label: "textures.py", sub: "Python · Pillow + NumPy", proc: "off", file: "tools/assets/textures.py", from: "def normal_from_albedo", to: "return Image.fromarray", text: "Recorta e redimensiona tudo para 512×512 (texture arrays exigem o mesmo tamanho), deixa bordas repetíveis e gera normal maps a partir da luminância (Sobel) quando o pacote não tinha." },
    { id: "jpg", label: "L_*.jpg + N_*.jpg", sub: "24 camadas + fx_atlas.png", proc: "off", text: "Albedo (sRGB) e normais (linear) de cada material do mapa, mais um atlas 4×4 de efeitos gerado proceduralmente (clarão, fumaça, sangue, chama, raios)." },
    { id: "mapgen", label: "build_map.py", sub: "gerador + validador do mapa", proc: "off", file: "tools/level/build_map.py", from: "def room(", to: "def trig(", text: "Desenha o mapa com primitivas (salas, corredores, portas), valida por busca em largura que todas as chaves e áreas são alcançáveis e exporta a grade ASCII para setorZero.ts." },
    { id: "ts", label: "src/levels/setorZero.ts", sub: "88 × 70 células + gatilhos", proc: "off", text: "O mapa é código gerado: uma string por linha da grade, as zonas, as alturas de teto e os gatilhos de susto em JSON." },
  ],
  [
    { id: "fetch", label: "fetch + parseGLB", sub: "src/assets/GLB.ts", proc: "cpu", file: "src/assets/GLB.ts", from: "export async function parseGLB", to: "const bin = buf.slice", text: "Leitor de GLB feito à mão: valida o cabeçalho, separa JSON e BIN, lê os accessors (inclusive intercalados e normalizados), materiais, skins e animações." },
    { id: "upload", label: "ModelUploader", sub: "src/render/ModelGPU.ts", proc: "cpu", file: "src/render/ModelGPU.ts", from: "// 24 bytes por vértice", to: "device.queue.writeBuffer(skinBuffer", text: "Intercala posição/normal/UV (32 bytes), empacota juntas uint16×4 + pesos float32×4 (24 bytes), cria index buffer e o bind group do material." },
    { id: "mips", label: "Texturas e mipmaps", sub: "src/gpu/textures.ts", proc: "gpu", file: "src/gpu/textures.ts", from: "generateMips(tex: GPUTexture", to: "device.queue.submit", text: "copyExternalImageToTexture envia os pixels; a própria GPU gera cada nível de mipmap desenhando um triângulo de tela cheia que amostra o nível anterior." },
    { id: "skin", label: "skinned.wgsl", sub: "deformação por vértice", proc: "gpu", file: "src/shaders/skinned.wgsl", from: "@vertex", to: "return o;", text: "Cada vértice é deformado pela média ponderada de até 4 matrizes de osso — calculadas na CPU a partir da animação e enviadas num storage buffer." },
  ],
];

export const pipeline: SlideDef = {
  id: "pipeline",
  title: "O pipeline de assets",
  lead: "Offline (Blender, Python) → arquivos estáticos → runtime (CPU lê, GPU desenha). Clique em cada etapa para ver o código real que a executa.",
  body: () => `
  <div class="pl fill">
    <div class="pl-rows">
      ${P_NODES.map(
        (row, ri) => `<div class="pl-row"><span class="pl-lane mono">${["modelos", "texturas e mapa", "runtime"][ri]}</span>${row
          .map((n, i) => `${i ? `<span class="pl-arrow">→</span>` : ""}<button type="button" class="pl-node ${n.proc}" data-id="${n.id}"><b>${esc(n.label)}</b><span>${esc(n.sub)}</span><i class="tag ${n.proc === "off" ? "" : n.proc}">${n.proc === "off" ? "offline" : n.proc.toUpperCase()}</i></button>`)
          .join("")}</div>`,
      ).join("")}
    </div>
    <div class="panel pl-detail"></div>
  </div>`,
  init: (root) => {
    const detail = root.querySelector(".pl-detail") as HTMLElement;
    const all = P_NODES.flat();
    const show = (id: string) => {
      const n = all.find((x) => x.id === id)!;
      root.querySelectorAll(".pl-node").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.id === id));
      let code = "";
      if (n.file) {
        const s = snippet(n.file, n.from!, n.to, 24);
        code = `<div class="mono small dim" style="margin:8px 0 4px">${esc(n.file)} · linha ${s.from}</div>${codeBlock(s.code, n.file.endsWith(".py") ? "py" : n.file.endsWith(".wgsl") ? "wgsl" : "ts", { from: s.from })}`;
      }
      detail.innerHTML = `<div class="pl-d"><div><h3>${esc(n.label)}</h3><p class="small">${esc(n.text)}</p></div><div class="pl-code">${code || `<p class="dim small">Sem código: é um artefato (arquivo) do pipeline.</p>`}</div></div>`;
    };
    root.querySelector(".pl-rows")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest(".pl-node") as HTMLElement | null;
      if (b) show(b.dataset.id!);
    });
    show("enemies");
  },
};

export const animacoes: SlideDef = {
  id: "animacoes",
  title: "Animações: o que existia e o que foi criado",
  lead: "Só a ratazana veio com todos os clipes. Os outros ganharam animações escritas por script, keyframe a keyframe, em espaço da armature. Clique numa linha para ver as prévias renderizadas no Blender.",
  body: () => `
  <div class="cols fill" style="grid-template-columns: 1fr 1fr">
    <div class="stack anim-left">
      <div class="tbl-wrap">
        <table class="tbl clips">
          <thead><tr><th>Inimigo</th>${CLIP_NAMES.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>${CLIPS.map(
            (c, i) => `<tr class="click ${i === 1 ? "on" : ""}" data-i="${i}"><td><b>${esc(c.inimigo)}</b><div class="mono small dim">${c.modelo}</div></td>${CLIP_NAMES.map((k) => {
              const v = c.clipes[k];
              return `<td>${v === "orig" ? `<span class="tag">original</span>` : v === "criado" ? `<span class="tag cpu">criado</span>` : `<span class="dim">—</span>`}</td>`;
            }).join("")}</tr>`,
          ).join("")}</tbody>
        </table>
      </div>
      <div class="panel">
        <h4>O bug do zumbi deitado → complete_channels()</h4>
        ${codeBlock(snippet("tools/assets/bl_common.py", "def complete_channels", "fc.keyframe_points.insert", 30).code, "py", { from: snippet("tools/assets/bl_common.py", "def complete_channels").from })}
      </div>
    </div>
    <figure class="clip-fig"><img alt="" data-zoom><figcaption></figcaption></figure>
  </div>`,
  init: (root) => {
    const img = root.querySelector(".clip-fig img") as HTMLImageElement;
    const cap = root.querySelector(".clip-fig figcaption") as HTMLElement;
    const show = (i: number) => {
      const c = CLIPS[i];
      img.src = `${IMG}pipeline/${c.img}`;
      img.alt = `Clipes do ${c.inimigo}`;
      cap.textContent = `${c.inimigo}: quadros-chave de cada clipe, renderizados no Blender para conferência`;
      root.querySelectorAll("tbody tr").forEach((tr) => tr.classList.toggle("on", (tr as HTMLElement).dataset.i === String(i)));
    };
    root.querySelector("tbody")!.addEventListener("click", (e) => {
      const tr = (e.target as HTMLElement).closest("tr[data-i]") as HTMLElement | null;
      if (tr) show(Number(tr.dataset.i));
    });
    show(1);
  },
};
