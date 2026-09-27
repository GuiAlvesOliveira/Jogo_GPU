// ============================================================
//  Apresentação — Setor Zero (aula de Programação Gráfica)
// ------------------------------------------------------------
//  Página inicial do site (index.html); o jogo fica em jogo.html, no mesmo build do
//  Vite. Importa o código do próprio jogo (leitor GLB, animador,
//  mapa, tabelas de inimigos/armas/itens, áudio) para demonstrá-lo.
// ============================================================

import "./style.css";
import "./slides.css";
import { Deck } from "./deck";
import { CHAPTERS } from "./slides";
import { initLightbox } from "./slides/common";
import { setNav } from "./nav";

const app = document.getElementById("app")!;
const deck = new Deck(app, CHAPTERS);
setNav((id) => deck.goTo(id));
initLightbox();
(window as unknown as { __deck: Deck }).__deck = deck;
