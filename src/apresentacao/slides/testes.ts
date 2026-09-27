// Capítulo 12 — Testes, desempenho e histórias de bug.

import type { SlideDef } from "../deck";
import { esc } from "../dom";
import { BUGS, CORRECOES_FINAL } from "../data/bugs";
import { codeBlock } from "../highlight";
import { IMG, beforeAfter } from "./common";

const HARNESS = `// tour.mjs — Chrome sem janela com WebGPU (puppeteer-core)
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--enable-unsafe-webgpu", "--enable-gpu",
         "--ignore-gpu-blocklist", "--use-angle=d3d11"],
});
await page.goto("http://localhost:5173/jogo.html?autostart=normal&debug");
await page.waitForFunction(() => !!window.__game);
for (const [nome, js, espera] of roteiro) {
  await page.evaluate(js);        // ex.: __game.tp(80, 54, 1.57)
  await sleep(espera);
  await page.screenshot({ path: \`\${prefixo}_\${nome}.png\` });
}`;

const GALLERY: { t: string; imgs: [string, string][] }[] = [
  { t: "Tour pelas zonas", imgs: [["t_camp", "acampamento"], ["t_sewer", "esgotos"], ["t_cistern", "cisterna"], ["t_crypt", "cripta"], ["t_ossuary", "ossário"], ["t_lava", "forja"], ["t_mine", "minas"], ["t_arena", "arena"]] },
  { t: "IA de cada inimigo", imgs: [["ai_angler", "abissal acordando"], ["ai_corpse", "zumbi levantando"], ["ai_rats", "bando de ratos"], ["ai_shade", "sombra lançando raio"], ["ai_troll", "troll esmagando"], ["p_wakeall", "63 perseguindo"]] },
  { t: "Combate", imgs: [["c_chase", "perseguição"], ["c_attack", "ataque"], ["c_m4fire", "M4 atirando"], ["c_near", "à queima-roupa"], ["w2_knifeslash", "golpe de faca"], ["w2_medkit", "kit médico"]] },
  { t: "Roteiro e sustos", imgs: [["s_redkey", "luzes apagam"], ["s_reddoor_locked", "porta trancada"], ["s_cata", "porta bate"], ["s_bluekey", "apagão nas catacumbas"], ["s_arena", "Rei Troll"], ["s_bossfire", "luta"], ["s_bossdead", "chefe caído"], ["s_elevator", "elevador"]] },
  { t: "Telas", imgs: [["menu", "menu"], ["m_automap", "mapa automático"], ["v_dead", "morte"], ["v_victory", "vitória"], ["s_victory", "estatísticas"]] },
];

export const harness: SlideDef = {
  id: "testes",
  title: "O Claude testando o próprio jogo",
  lead: "No prompt final não havia ninguém para dizer “nada acontece”. A solução foi um navegador sem janela com WebGPU de verdade: um modo <code>?debug</code> expõe o jogo, o script teleporta o jogador, simula teclas e tira capturas. Cada imagem abaixo é uma dessas capturas.",
  body: () => `
  <div class="ts fill">
    <div class="stack">
      ${codeBlock(HARNESS, "ts", { numbers: false })}
      <div class="cols-3">
        <div class="panel stat gpu"><span class="v num">240</span><span class="l">FPS em todas as zonas</span></div>
        <div class="panel stat"><span class="v num">63</span><span class="l">inimigos perseguindo ao mesmo tempo</span></div>
        <div class="panel stat cpu"><span class="v num">0</span><span class="l">erros no console</span></div>
      </div>
      <p class="cap dim">240 FPS é o teto do monitor (vsync) numa RTX 3060. O modo debug também mede FPS (<code>window.__fps</code>).</p>
    </div>
    <div class="ts-gallery scroll">${GALLERY.map((g) => `<div class="h4">${esc(g.t)}</div><div class="ts-grid">${g.imgs.map(([f, c]) => `<figure><img src="${IMG}testes/${f}.jpg" alt="${esc(c)}" loading="lazy" data-zoom><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>`).join("")}</div>
  </div>`,
};

const AREA: Record<string, string> = { render: "renderização", pipeline: "pipeline de assets", jogo: "jogo", ambiente: "ambiente", ts: "TypeScript" };

export const historias: SlideDef = {
  id: "bugs",
  title: "Histórias de bug",
  lead: "Os problemas mais instrutivos, do sintoma à lição. Nos que têm imagem, arraste a divisória entre o antes e o depois.",
  body: () => `
  <div class="bugs fill">
    <div class="bug-list scroll">${BUGS.map((b, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}"><span class="tag ${b.area === "render" ? "gpu" : b.area === "pipeline" ? "cpu" : ""}">${AREA[b.area]}</span><b>${esc(b.titulo)}</b></button>`).join("")}</div>
    <div class="panel bug-detail scroll"></div>
  </div>`,
  init: (root) => {
    const detail = root.querySelector(".bug-detail") as HTMLElement;
    const show = (i: number) => {
      const b = BUGS[i];
      root.querySelectorAll(".bug-list button").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset.i === String(i)));
      detail.innerHTML = `<h3 style="margin:0 0 12px">${esc(b.titulo)}</h3>
        <div class="bug-cols">
          <div class="stack">
            <div class="bug-step"><span class="tag bug">sintoma</span><p>${esc(b.sintoma)}</p></div>
            <div class="bug-step"><span class="tag warn">diagnóstico</span><p>${esc(b.diagnostico)}</p></div>
            <div class="bug-step"><span class="tag ok">correção</span><p>${esc(b.correcao)}</p></div>
            <div class="bug-step lesson"><span class="tag cpu">lição</span><p>${esc(b.licao)}</p></div>
          </div>
          <div class="stack bug-media"></div>
        </div>`;
      const media = detail.querySelector(".bug-media") as HTMLElement;
      if (b.antes && b.depois) media.appendChild(beforeAfter(`apresentacao/${b.antes}`, `apresentacao/${b.depois}`, "antes", "depois", 50));
      else if (b.antes) media.insertAdjacentHTML("beforeend", `<img src="apresentacao/${b.antes}" alt="" data-zoom>`);
      if (b.codigo) {
        media.insertAdjacentHTML(
          "beforeend",
          `<div class="cols-2" style="gap:10px"><div><div class="h4">antes</div>${codeBlock(b.codigo.antes, b.codigo.lang, { numbers: false })}</div><div><div class="h4">depois</div>${codeBlock(b.codigo.depois, b.codigo.lang, { numbers: false })}</div></div>`,
        );
      }
      if (!media.children.length) media.innerHTML = `<p class="dim small">(sem imagem: um problema de ambiente/tipagem)</p>`;
    };
    root.querySelector(".bug-list")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
      if (b) show(Number(b.dataset.i));
    });
    show(0);
  },
};

const TIPO: Record<string, { l: string; c: string }> = {
  compilacao: { l: "compilação", c: "bug" },
  usuario: { l: "usuário", c: "warn" },
  render: { l: "renderização", c: "gpu" },
  pipeline: { l: "pipeline", c: "cpu" },
  jogo: { l: "jogo", c: "" },
  ambiente: { l: "ambiente", c: "" },
  processo: { l: "processo", c: "" },
};

export const correcoesFinal: SlideDef = {
  id: "correcoes-final",
  title: "As 22 correções do prompt final",
  lead: "Tudo o que o Claude encontrou e corrigiu sozinho entre 12:31 e 13:52, na ordem em que aconteceu (horário de Brasília).",
  body: () => `
  <div class="tbl-wrap fill">
    <table class="tbl">
      <thead><tr><th>Hora</th><th>Área</th><th>Problema</th><th>Correção</th></tr></thead>
      <tbody>${CORRECOES_FINAL.map((c) => `<tr><td class="mono">${c.quando}</td><td><span class="tag ${TIPO[c.tipo].c}">${TIPO[c.tipo].l}</span></td><td>${esc(c.problema)}</td><td class="small muted">${esc(c.correcao)}</td></tr>`).join("")}</tbody>
    </table>
  </div>`,
};
