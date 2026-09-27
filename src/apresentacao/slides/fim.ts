// Capítulo 14 — Encerramento: jogar, lições, créditos.

import type { SlideDef } from "../deck";
import { fmt } from "../dom";
import { LOC } from "../data/codigo";
import { MODELS, TEX, RAW } from "../data/assets";
import { ENEMIES, PICKUPS } from "../data/balance";
import { IMG } from "./common";
import { HIST } from "./fases";

export const jogar: SlideDef = {
  id: "jogar",
  title: "Hora de jogar",
  lead: "O jogo está no mesmo site desta apresentação. Precisa de um navegador com WebGPU (Chrome ou Edge 113+).",
  body: () => `
  <div class="cols fill" style="grid-template-columns: 1.3fr 1fr">
    <div class="panel flush play-shot"><img src="${IMG}testes/s_arena.jpg" alt="A arena do Rei Troll" data-zoom></div>
    <div class="stack">
      <a class="btn primary play-cta" href="./jogo.html" target="_blank" rel="noopener">▶ Jogar o Setor Zero</a>
      <div class="panel small">
        <div class="h4">Controles</div>
        <div class="keys-grid">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>mover · <kbd>Shift</kbd> correr</span>
          <span>mouse</span><span>olhar · clique atira · botão direito mira</span>
          <span><kbd>1</kbd>–<kbd>6</kbd></span><span>armas (ou roda do mouse)</span>
          <span><kbd>R</kbd></span><span>recarregar</span>
          <span><kbd>E</kbd></span><span>portas e passagens secretas</span>
          <span><kbd>F</kbd></span><span>lanterna</span>
          <span><kbd>Tab</kbd></span><span>mapa automático</span>
          <span><kbd>Esc</kbd></span><span>pausa (sensibilidade e volume)</span>
        </div>
      </div>
      <div class="panel small">
        <div class="h4">Rodar localmente</div>
        <pre class="code" style="font-size:14px">npm install
npm run dev     # http://localhost:5173 → esta apresentação
# jogo: http://localhost:5173/jogo.html (não use Live Server)</pre>
      </div>
    </div>
  </div>`,
};

export const licoes: SlideDef = {
  id: "licoes",
  title: "O que fica",
  body: () => `
  <div class="lessons fill">
    <div class="panel lesson"><b>01</b><h3>Incremental ensina, prompt único entrega</h3><p>As 17 fases construíram o entendimento peça por peça (triângulo → MVP → câmera → …). O prompt final reaproveitou esse vocabulário e produziu o jogo completo em 94 minutos — mas só porque as regras do projeto já estavam claras.</p></div>
    <div class="panel lesson"><b>02</b><h3>CPU pensa, GPU pinta</h3><p>Lógica sequencial e barata (IA, colisão, Dijkstra, poses) na CPU; trabalho massivo e paralelo (vértices, skinning, luz por pixel) na GPU. A fronteira é um punhado de <code>writeBuffer</code> por frame.</p></div>
    <div class="panel lesson"><b>03</b><h3>Metade do trabalho é o pipeline</h3><p>Sem engine, cada asset precisou de conversão, limpeza, animação e verificação. Os bugs mais estranhos (zumbi deitado, AK de 11 MB, pente flutuante) nasceram ali, não no renderer.</p></div>
    <div class="panel lesson"><b>04</b><h3>Quem testa, enxerga</h3><p>O navegador sem janela com WebGPU deixou o Claude ver o próprio jogo: foi assim que o retângulo preto, a lanterna estourada e a luz atravessando paredes apareceram e foram corrigidos.</p></div>
    <div class="panel lesson"><b>05</b><h3>Dado, não código</h3><p>Mapa, inimigos, armas, itens e sustos são tabelas. Por isso esta apresentação consegue importá-las e calcular o balanceamento a partir delas.</p></div>
    <div class="panel lesson"><b>06</b><h3>Olhe o ambiente primeiro</h3><p>“Nada acontece” foi o servidor errado; “voltou a versão antiga” foi o branch errado. Nos dois casos, o código estava certo.</p></div>
    <div class="lessons-nums">
      <div class="stat"><span class="v num">${fmt.n0(LOC.total)}</span><span class="l">linhas</span></div>
      <div class="stat"><span class="v num">${RAW.length} → ${MODELS.length + TEX.length * 2 + 2}</span><span class="l">arquivos brutos → do jogo</span></div>
      <div class="stat"><span class="v num">${ENEMIES.length}</span><span class="l">inimigos por partida</span></div>
      <div class="stat"><span class="v num">${PICKUPS.length}</span><span class="l">itens no mapa</span></div>
      <div class="stat"><span class="v num">${HIST.length}</span><span class="l">prompts no total</span></div>
    </div>
  </div>`,
};

export const creditos: SlideDef = {
  id: "creditos",
  title: "Créditos",
  body: () => `
  <div class="cols-3 fill">
    <div class="panel">
      <div class="h4">Projeto</div>
      <p><b>Setor Zero</b> — FPS retrô em WebGPU puro.<br>Repositório: <span class="mono">github.com/GuiAlvesOliveira/Jogo_GPU</span></p>
      <p class="small">Desenvolvido com <b>Claude Code</b> a partir de uma especificação de 31 seções, em 17 fases incrementais (14/09/2026) e um prompt final (26/09/2026).</p>
      <p class="small muted">Esta apresentação é a página inicial do repositório (<span class="mono">index.html</span>; o jogo fica em <span class="mono">jogo.html</span>) e importa o código do jogo diretamente.</p>
    </div>
    <div class="panel">
      <div class="h4">Assets de terceiros</div>
      <ul class="dash small">
        <li>Personagens: Kenney — <i>Animated Characters Retro</i> (CC0)</li>
        <li>Armas, pentes e cápsulas: pacote <i>FPS Weapons</i> (CC BY-SA 3.0)</li>
        <li>Troll, abissal (angler), ratazana, “Darsh”, AK-47, kit médico, tileset, wests textures, raios: arquivos fornecidos na pasta <span class="mono">assets/</span> — conferir a licença original de cada pacote antes de redistribuir</li>
        <li>Fontes: Big Shoulders Display, IBM Plex Sans e Mono (SIL OFL)</li>
      </ul>
    </div>
    <div class="panel">
      <div class="h4">Ferramentas</div>
      <ul class="dash small">
        <li>WebGPU · WGSL · TypeScript · Vite</li>
        <li>Web Audio API (síntese + HRTF)</li>
        <li>Blender 4.2 (bpy, sem janela) · Python · Pillow · NumPy</li>
        <li>puppeteer-core + Chrome headless</li>
        <li>GitHub Actions + GitHub Pages</li>
      </ul>
      <p class="small muted" style="margin-top:14px">Obrigado! Perguntas?</p>
    </div>
  </div>`,
};
