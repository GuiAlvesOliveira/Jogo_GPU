// Montagem dos capítulos (a ordem aqui é a ordem da apresentação).

import type { ChapterDef, SlideDef } from "../deck";
import { esc } from "../dom";
import { capa, convencoes } from "./abertura";
import { spec, roteiroFases, requisitos } from "./prompt";
import { linhaDoTempo, explorador, correcoes, crescimento } from "./fases";
import { promptUnico, marcos, antesDepois, git } from "./virada";
import { inventario, materialBruto, pipeline, animacoes } from "./assets";
import { galeria3d, texturas } from "./galeria";
import { tecnologias, arquitetura, frame, uniforms, shaders, skinning, luzPorCelula, curvas } from "./motor";
import { mapa, sustos, gerador } from "./mapa";
import { fsm, fichas, dijkstra, sandbox } from "./ia";
import { arsenal, dispersao, ttkSlide } from "./armas";
import { economia, vidaDano, rota, dificuldade } from "./balanco";
import { mesaDeSom } from "./audio";
import { harness, historias, correcoesFinal } from "./testes";
import { codigo } from "./codigo";
import { jogar, licoes, creditos } from "./fim";

const DESC: Record<string, string> = {
  prompt: "a especificação de 31 seções e a regra do desenvolvimento incremental",
  fases: "linha do tempo, as 17 fases rodando ao vivo, diffs e cada correção",
  virada: "o prompt único de 94 minutos, antes × depois e o git",
  assets: "21 arquivos brutos, o pipeline Blender/Python e as animações criadas",
  galeria: "os 21 modelos ao vivo em WebGPU e o normal mapping",
  motor: "tecnologias, módulos, um frame, uniforms, WGSL, skinning e luz",
  mapa: "a grade 88 × 70, a rota das chaves e os gatilhos de susto",
  ia: "máquina de estados, Dijkstra e uma sandbox no mapa real",
  armas: "arsenal, dispersão e tempo para matar",
  balanco: "munição × vida, dano, ritmo da rota e dificuldade",
  audio: "sons sintetizados, analisador e som 3D",
  testes: "o harness headless, histórias de bug e correções",
  codigo: "todo o código-fonte, pesquisável",
  fim: "jogar, lições e créditos",
};

let chaptersRef: ChapterDef[] = [];

const roteiro: SlideDef = {
  id: "roteiro",
  title: "Roteiro",
  lead: "Quinze capítulos, do primeiro prompt ao jogo final. Clique em qualquer um para ir direto; <kbd>O</kbd> abre o roteiro completo a qualquer momento.",
  body: () => `
  <div class="toc">${chaptersRef
    .slice(1)
    .map(
      (c, i) => `<button type="button" class="toc-item" data-go="${c.slides[0].id}"><span class="toc-n mono">${String(i + 1).padStart(2, "0")}</span><b>${esc(c.title)}</b><span class="small muted">${esc(DESC[c.key] ?? "")}</span><span class="mono small dim">${c.slides.length} slide${c.slides.length > 1 ? "s" : ""}</span></button>`,
    )
    .join("")}</div>`,
};

export const CHAPTERS: ChapterDef[] = [
  { key: "abertura", title: "Abertura", slides: [capa, roteiro, convencoes] },
  { key: "prompt", title: "O primeiro prompt", slides: [spec, roteiroFases, requisitos] },
  { key: "fases", title: "Evolução fase a fase", slides: [linhaDoTempo, explorador, correcoes, crescimento] },
  { key: "virada", title: "A virada: um prompt só", slides: [promptUnico, marcos, antesDepois, git] },
  { key: "assets", title: "Assets", slides: [inventario, materialBruto, pipeline, animacoes] },
  { key: "galeria", title: "Galeria 3D", slides: [galeria3d, texturas] },
  { key: "motor", title: "O motor", slides: [tecnologias, arquitetura, frame, uniforms, shaders, skinning, luzPorCelula, curvas] },
  { key: "mapa", title: "O mapa", slides: [mapa, sustos, gerador] },
  { key: "ia", title: "IA dos inimigos", slides: [fsm, fichas, dijkstra, sandbox] },
  { key: "armas", title: "Armas e combate", slides: [arsenal, dispersao, ttkSlide] },
  { key: "balanco", title: "Balanceamento", slides: [economia, vidaDano, rota, dificuldade] },
  { key: "audio", title: "Áudio", slides: [mesaDeSom] },
  { key: "testes", title: "Testes e bugs", slides: [harness, historias, correcoesFinal] },
  { key: "codigo", title: "Código", slides: [codigo] },
  { key: "fim", title: "Encerramento", slides: [jogar, licoes, creditos] },
];
chaptersRef = CHAPTERS;
