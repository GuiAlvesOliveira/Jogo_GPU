// Capítulo 03 — A virada: o prompt único de 26/09.

import type { SlideDef } from "../deck";
import { esc, brTime } from "../dom";
import { MARCOS, ETAPAS, type Marco } from "../data/sessao";
import LOG from "../data/log_prompt_unico.json";
import { HIST } from "./fases";
import { IMG, beforeAfter, setBA } from "./common";

const FINAL = HIST.find((h) => /apenas 1 prompt/.test(h.prompt))!;

export const promptUnico: SlideDef = {
  id: "prompt-unico",
  title: "Doze dias depois: um prompt só",
  lead: "26/09, 12:20. Em vez de “avançar para a fase 18”, um pedido aberto: terminar o jogo com os assets da pasta <code>assets/</code>. O Claude fez duas perguntas e trabalhou sozinho por 94 minutos.",
  body: () => `
  <div class="cols fill" style="grid-template-columns: 1.15fr 1fr">
    <div class="stack">
      <blockquote class="prompt-quote big">${esc(FINAL.prompt)}</blockquote>
      <div class="cols-2">
        <div class="panel qa">
          <h4>Pergunta 1</h4>
          <p>Quase todos os modelos estão em <code>.blend</code>/<code>.fbx</code>. Posso baixar o <b>Blender portátil</b> (pasta temporária) para converter tudo para GLB?</p>
          <p class="ans">→ “Pode baixar (Recomendado)”</p>
        </div>
        <div class="panel qa">
          <h4>Pergunta 2</h4>
          <p>Estrutura do mundo: várias fases pequenas (como o roteiro antigo) ou <b>um mapa grande contínuo</b>?</p>
          <p class="ans">→ “1 mapa gigante (Recomendado)”</p>
        </div>
      </div>
    </div>
    <div class="stack">
      <div class="panel">
        <h4>O que mudou no jeito de trabalhar</h4>
        <ul class="dash small">
          <li>de <b>1 fase por prompt</b> com aprovação → <b>1 prompt para tudo</b></li>
          <li>o Claude passou a <b>se testar sozinho</b>: Chrome sem janela + WebGPU + capturas de tela</li>
          <li>as restrições continuaram: WebGPU direto, sem engine, código comentado em português</li>
          <li>fases 16 (partículas) e 18 (otimização) dispensadas pelo usuário</li>
        </ul>
      </div>
      <div class="cols-2">
        <div class="panel stat cpu"><span class="v num">94<small>min</small></span><span class="l">12:20 → 13:54</span></div>
        <div class="panel stat"><span class="v num">${LOG.length}</span><span class="l">mensagens de progresso</span></div>
        <div class="panel stat"><span class="v num">237<small>MB</small></span><span class="l">assets brutos (21 arquivos)</span></div>
        <div class="panel stat gpu"><span class="v num">12<small>MB</small></span><span class="l">assets do jogo (GLB + JPG)</span></div>
      </div>
      <button class="btn" data-go="marcos">Ver os 94 minutos passo a passo →</button>
    </div>
  </div>`,
};

const ETAPA_COLOR: Record<Marco["etapa"], string> = {
  assets: "#aab3bc",
  blender: "#f2a65a",
  mapa: "#c98500",
  motor: "#8fd1e0",
  teste: "#3987e5",
  correcao: "#e0564c",
  fim: "#5fd35f",
};

export const marcos: SlideDef = {
  id: "marcos",
  title: "Os 94 minutos, marco a marco",
  lead: "Cada imagem abaixo foi gerada pelo próprio Claude para conferir o próprio trabalho: prévias no Blender, capturas do jogo em Chrome sem janela, recortes de bugs. Clique para ampliar.",
  body: () => `
  <div class="mk fill">
    <ol class="mk-list scroll">${MARCOS.map(
      (m, i) => `<li><button type="button" data-i="${i}" class="${i === 1 ? "on" : ""}"><span class="mono">${m.t}</span><i style="background:${ETAPA_COLOR[m.etapa]}"></i><span>${esc(m.titulo)}</span></button></li>`,
    ).join("")}
      <li class="mk-log-btn"><button type="button" data-log>Log completo (${LOG.length} mensagens)</button></li>
    </ol>
    <div class="panel mk-view"></div>
  </div>`,
  init: (root) => {
    const view = root.querySelector(".mk-view") as HTMLElement;
    const show = (i: number) => {
      const m = MARCOS[i];
      root.querySelectorAll(".mk-list button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.i === String(i)));
      view.innerHTML = `
        <div class="row"><span class="tag" style="color:${ETAPA_COLOR[m.etapa]};border-color:${ETAPA_COLOR[m.etapa]}">${ETAPAS[m.etapa]}</span><span class="mono dim">${m.t}</span></div>
        <h3 style="margin:10px 0 6px">${esc(m.titulo)}</h3>
        <p class="lead-small">${esc(m.texto)}</p>
        <div class="mk-imgs n${Math.min(4, m.imgs.length)}">${m.imgs.map((s) => `<img src="${IMG}${s}" alt="${esc(m.titulo)}" data-zoom loading="lazy">`).join("")}</div>`;
    };
    const showLog = () => {
      root.querySelectorAll(".mk-list button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.log !== undefined));
      view.innerHTML = `<h4>Mensagens de progresso do Claude durante o prompt único (horário de Brasília)</h4><ol class="log scroll">${(LOG as { ts: string; text: string }[])
        .map((l) => `<li><span class="mono dim">${brTime(l.ts)}</span><span>${esc(l.text)}</span></li>`)
        .join("")}</ol>`;
    };
    root.querySelector(".mk-list")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button") as HTMLElement | null;
      if (!b) return;
      if (b.dataset.log !== undefined) showLog();
      else show(Number(b.dataset.i));
    });
    show(1);
  },
};

const PAIRS: { a: string; b: string; la: string; lb: string; t: string }[] = [
  { a: "fases/f17.jpg", b: "testes/t_camp.jpg", la: "Fase 17 (14/09)", lb: "Jogo final (26/09)", t: "A primeira sala" },
  { a: "fases/f11.jpg", b: "testes/menu.jpg", la: "Tela inicial · F11", lb: "Menu final", t: "Tela inicial" },
  { a: "fases/f15.jpg", b: "testes/t_crypt.jpg", la: "Lambert · F15", lb: "Tochas + lanterna + normal map", t: "Iluminação" },
  { a: "fases/f13.jpg", b: "testes/c_chase.jpg", la: "Inimigo = caixa vermelha", lb: "Zumbi com esqueleto", t: "Inimigos" },
  { a: "fases/f12.jpg", b: "testes/w_m4.jpg", la: "HUD em texto · F12", lb: "HUD + arma na mão", t: "HUD e armas" },
  { a: "pipeline/versao_antiga_inicio.jpg", b: "pipeline/primeiro_render_novo_motor.jpg", la: "Motor antigo", lb: "Primeiro render do motor novo", t: "Motor" },
];

export const antesDepois: SlideDef = {
  id: "antes-depois",
  title: "Antes × depois dos assets",
  lead: "Arraste a divisória. À esquerda, o fim das 17 fases (geometria de caixas, cor por instância); à direita, o jogo final com os assets convertidos.",
  body: () => `
  <div class="stack fill" style="grid-template-rows:auto minmax(0,1fr)">
    <div class="seg-ctl ba-pick">${PAIRS.map((p, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}">${esc(p.t)}</button>`).join("")}</div>
    <div class="ba-host"></div>
  </div>`,
  init: (root) => {
    const host = root.querySelector(".ba-host") as HTMLElement;
    const p = PAIRS[0];
    const ba = beforeAfter(IMG + p.a, IMG + p.b, p.la, p.lb, 50);
    host.appendChild(ba);
    root.querySelector(".ba-pick")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (!b) return;
      root.querySelectorAll(".ba-pick button").forEach((x) => x.classList.toggle("on", x === b));
      const q = PAIRS[Number(b.dataset.i)];
      setBA(ba, IMG + q.a, IMG + q.b, q.la, q.lb);
    });
  },
};

export const git: SlideDef = {
  id: "git",
  title: "O histórico no git",
  lead: "Quatro commits contam a história. O susto de “apareceu a versão antiga” foi o diretório de trabalho refletindo um branch que tinha ficado para trás.",
  body: () => `
  <div class="cols fill" style="grid-template-columns: 1.25fr 1fr">
    <div class="panel git">
      <div class="git-row"><i class="c"></i><div><b class="mono">9123a85</b> <span class="dim mono small">14/09 11:49</span><div>FPS 3D retrô em WebGPU — fases 1–15 + 17</div><div class="small muted">30 arquivos · <code>git init</code> + repositório público criado no GitHub às 11:50</div></div></div>
      <div class="git-gap small dim">12 dias</div>
      <div class="git-row"><i class="c final"></i><div><b class="mono">fccf38f</b> <span class="dim mono small">26/09 15:56</span><div>SETOR ZERO: jogo completo (mapa gigante, inimigos animados, 6 armas)</div><div class="small muted">104 arquivos novos, 16 removidos, 7 modificados · feito no branch <code>setor-zero-completo</code></div></div></div>
      <div class="git-row warn"><i class="c"></i><div><b>16:18 · “tentei rodar o jogo, apareceu a antiga versão”</b><div class="small muted">O <code>master</code> ainda apontava para <code>9123a85</code>: ao voltar para ele, o disco voltou a ter o jogo antigo. Correção: <code>git merge --ff-only</code> (o master avança sem reescrever nada).</div></div></div>
      <div class="git-row"><i class="c"></i><div><b class="mono">c5c299e</b> <span class="dim mono small">26/09 16:30</span><div>Adiciona os assets originais (fonte do pipeline de conversão)</div><div class="small muted">21 arquivos, 237 MB · três passam de 50 MB (aviso do GitHub, aceito)</div></div></div>
      <div class="git-row"><i class="c gpu"></i><div><b class="mono">61bd3a9</b> <span class="dim mono small">26/09 16:40</span><div>Deploy no GitHub Pages via Actions</div><div class="small muted"><code>vite.config.ts</code> com <code>base: "./"</code> + workflow que builda e publica <code>dist/</code></div></div></div>
    </div>
    <div class="stack">
      <div class="panel">
        <h4>Por que o jogo roda no GitHub Pages sem servidor</h4>
        <p class="small">O Vite compila o TypeScript e empacota os módulos; o resultado em <code>dist/</code> é HTML + JS + arquivos estáticos. Os modelos <code>.glb</code> e as texturas ficam em <code>public/game/</code> e são lidos com <code>fetch</code> em tempo de execução.</p>
        <p class="small">Esta apresentação é a página inicial do mesmo build (<code>index.html</code>); o jogo é a segunda página (<code>jogo.html</code>).</p>
      </div>
      <div class="panel">
        <h4>Lição do “não abre”</h4>
        <p class="small">Duas vezes o problema estava fora do código: o servidor errado (Live Server servindo <code>.ts</code> cru) e o branch errado. Nas duas, a correção foi olhar o ambiente antes de mexer no código.</p>
      </div>
    </div>
  </div>`,
};
