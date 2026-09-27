// ============================================================
//  sessao.ts — o prompt único de 26/09 (12:20 → 13:54, horário local)
// ------------------------------------------------------------
//  Marcos curados a partir do log da sessão (log_prompt_unico.json),
//  com as imagens que o próprio Claude gerou para se conferir.
// ============================================================

export interface Marco {
  t: string; // horário local (UTC−3)
  etapa: "assets" | "blender" | "mapa" | "motor" | "teste" | "correcao" | "fim";
  titulo: string;
  texto: string;
  imgs: string[]; // caminhos relativos a apresentacao/img/
}

export const ETAPAS: Record<Marco["etapa"], string> = {
  assets: "Análise dos assets",
  blender: "Blender headless",
  mapa: "Mapa",
  motor: "Motor novo",
  teste: "Testes automáticos",
  correcao: "Correções",
  fim: "Entrega",
};

export const MARCOS: Marco[] = [
  { t: "12:20", etapa: "assets", titulo: "O pedido", texto: "“Será em apenas 1 prompt … Quero inimigos bem feitos, armas bem feitas, munição e saúde no mapa, um mapa grande o suficiente para se divertir e tomar algum susto.”", imgs: [] },
  { t: "12:21", etapa: "assets", titulo: "Descompactar e inventariar", texto: "21 arquivos (237 MB): .blend, .fbx, .glb, .obj, GIFs e pacotes de textura. Quase nada vinha pronto para ler sem engine.", imgs: ["pipeline/pack_tileset.jpg", "pipeline/pack_wests.jpg"] },
  { t: "12:28", etapa: "blender", titulo: "Duas perguntas ao usuário", texto: "Baixar o Blender portátil para converter os .blend? → “Pode baixar”. Estrutura do mapa? → “1 mapa gigante”.", imgs: [] },
  { t: "12:31", etapa: "blender", titulo: "Blender 4.2 sem janela", texto: "O exportador glTF não carregava: caminho maior que 260 caracteres no Windows. Solução: rodar o Blender de uma unidade curta (subst B:).", imgs: [] },
  { t: "12:33", etapa: "blender", titulo: "Armas renderizadas", texto: "M4, SCAR, Mossberg, USP, M9 e faca, texturizadas. Cada .blend foi inspecionado por script (objetos, esqueletos, ações, imagens embutidas).", imgs: ["pipeline/armas_workbench_a.jpg", "pipeline/armas_workbench_b.jpg"] },
  { t: "12:34", etapa: "blender", titulo: "Prévias dos inimigos", texto: "Renderizações de conferência de cada criatura antes de mexer nos esqueletos.", imgs: ["pipeline/previa_troll.jpg", "pipeline/previa_zumbi_darsh.jpg"] },
  { t: "12:39", etapa: "teste", titulo: "Um Chrome sem janela com WebGPU", texto: "puppeteer-core + Chrome headless com WebGPU na RTX 3060: a partir daqui o Claude tira as próprias capturas de tela. A primeira foi do jogo antigo.", imgs: ["pipeline/versao_antiga_inicio.jpg"] },
  { t: "12:43", etapa: "blender", titulo: "Orientação dos modelos", texto: "Os esqueletos olham para −Y no Blender (o Darsh não). Vista lateral das armas para saber de que lado fica o cano.", imgs: ["pipeline/armas_orientacao.jpg", "pipeline/sombra_orientacao.jpg"] },
  { t: "12:46", etapa: "blender", titulo: "Armas exportadas em GLB", texto: "100–190 KB cada. Reimportadas no Blender para conferir; texturas reduzidas para 1024 px.", imgs: ["pipeline/glb_reimport.jpg", "pipeline/texturas_m4_usp.jpg"] },
  { t: "12:49", etapa: "blender", titulo: "AK-47: de 11 MB para 1,3 MB", texto: "Atributos inúteis impediam o compartilhamento de vértices. Madeira + aço preservados.", imgs: ["pipeline/ak47_pecas.jpg", "pipeline/ak47_final.jpg"] },
  { t: "12:52", etapa: "blender", titulo: "Ratazana", texto: "O .blend já tinha 6 animações: só renomear, normalizar a escala (0,62 m) e exportar a 20 fps. O sprite 2D do pacote não foi usado.", imgs: ["pipeline/clipes_rato.jpg", "pipeline/rato_sprites.jpg"] },
  { t: "12:53", etapa: "blender", titulo: "Troll: animações criadas", texto: "Só existia a pose parada. Andar (pés por IK), erguer os braços e esmagar, e cair de cara no chão foram escritos por keyframes, com o GIF como referência.", imgs: ["pipeline/clipes_troll.jpg", "pipeline/troll_gif_quadros.jpg"] },
  { t: "12:55", etapa: "blender", titulo: "Abissal", texto: "Vinha só a caminhada do GIF. Idle, bote com mordida e morte foram criados; textura, normal e specular originais.", imgs: ["pipeline/clipes_abissal.jpg", "pipeline/abissal_gif_quadros.jpg", "pipeline/abissal_textura.jpg"] },
  { t: "12:56", etapa: "blender", titulo: "Sombra e zumbi", texto: "O zumbi aparecia deitado: canais ausentes herdavam a pose de outro clipe. Todos os clipes passaram a ter todos os ossos.", imgs: ["pipeline/clipes_sombra.jpg", "pipeline/clipes_zumbi.jpg"] },
  { t: "13:03", etapa: "mapa", titulo: "Mapa gerado por script", texto: "88 × 70 células de 2,5 m, 5 zonas conectadas, chaves na ordem certa, validado por busca em largura.", imgs: ["pipeline/mapa_gerador.jpg"] },
  { t: "13:06", etapa: "motor", titulo: "Motor novo, do zero", texto: "Convenção de skinning confirmada: posição = Σ peso × (global do osso × inversa de bind) × vértice. Em 27 minutos: matemática, texturas, leitor GLB, shaders, animador, renderer, mundo, jogo, HUD, áudio.", imgs: ["pipeline/fx_atlas.jpg"] },
  { t: "13:34", etapa: "motor", titulo: "Primeiro render", texto: "Compilou depois de ajustar os tipos do TypeScript 5.9. Primeira imagem do motor novo.", imgs: ["pipeline/primeiro_render_novo_motor.jpg"] },
  { t: "13:35", etapa: "teste", titulo: "240 FPS em todas as zonas", texto: "Tour automático pelas 5 zonas com captura de tela e medição de FPS.", imgs: ["testes/t_sewer.jpg", "testes/t_lava.jpg"] },
  { t: "13:37", etapa: "correcao", titulo: "Retângulo preto", texto: "Combate funcionando de ponta a ponta, mas um retângulo preto no fim do túnel dos esgotos.", imgs: ["pipeline/bug_retangulo_preto.jpg", "pipeline/bug_retangulo_preto_aproximando.jpg"] },
  { t: "13:40", etapa: "correcao", titulo: "Corrigido", texto: "Plano distante em 160 m + cor de limpeza no espaço da tela. Lanterna com nova atenuação.", imgs: ["pipeline/bug_retangulo_corrigido.jpg"] },
  { t: "13:45", etapa: "correcao", titulo: "Armas na mão", texto: "Faca de perfil, M4 e espingarda perto demais, pente da M4 28 cm acima do lugar.", imgs: ["pipeline/bug_m4_pente.jpg", "pipeline/m4_viewmodel_ajustada.jpg"] },
  { t: "13:46", etapa: "teste", titulo: "Cada inimigo sob teste", texto: "O abissal acordando da isca, a sombra lançando raios, o troll esmagando, os ratos em bando.", imgs: ["testes/ai_angler.jpg", "testes/ai_shade.jpg", "testes/ai_troll.jpg", "testes/ai_rats.jpg"] },
  { t: "13:48", etapa: "teste", titulo: "Menu, mapa e sustos", texto: "Tela de menu, mapa automático (Tab) e o apagão das catacumbas.", imgs: ["testes/menu.jpg", "testes/m_automap.jpg", "testes/s_bluekey.jpg"] },
  { t: "13:52", etapa: "teste", titulo: "Regressão final", texto: "Início, combate, três chaves, morte e checkpoint, chefe e vitória — tudo por script.", imgs: ["testes/s_bossfire.jpg", "testes/s_victory.jpg"] },
  { t: "13:54", etapa: "fim", titulo: "Entregue", texto: "Jogável do menu à vitória, sem erros no console, pipeline documentado em tools/README.md.", imgs: ["testes/v_victory.jpg"] },
];
