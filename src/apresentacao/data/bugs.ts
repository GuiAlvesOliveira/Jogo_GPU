// ============================================================
//  bugs.ts — problemas encontrados e como foram corrigidos
// ------------------------------------------------------------
//  Parte 1: histórias de bug do prompt final (26/09), com imagens.
//  Parte 2: tabela geral de correções (fases + prompt final).
// ============================================================

export interface BugStory {
  id: string;
  titulo: string;
  area: "render" | "pipeline" | "jogo" | "ambiente" | "ts";
  sintoma: string;
  diagnostico: string;
  correcao: string;
  licao: string;
  antes?: string; // imagem (public/apresentacao/img/…)
  depois?: string;
  codigo?: { lang: "ts" | "wgsl" | "py"; antes: string; depois: string };
}

export const BUGS: BugStory[] = [
  {
    id: "retangulo",
    titulo: "O retângulo preto no fim do túnel",
    area: "render",
    sintoma: "Nos esgotos, um retângulo preto aparecia sempre no fim dos túneis longos, e crescia conforme o jogador se aproximava.",
    diagnostico: "Primeiro parecia um rato visto de longe. As capturas de perto mostraram que o buraco era o plano distante (far = 90 m) cortando a geometria. Além dele não sobra nada, e o fundo era limpo com a cor da neblina em espaço linear, que sai preta porque não passa pelo tone mapping + gama do shader.",
    correcao: "O far plane foi para 160 m e a cor de limpeza passou a ser a neblina já convertida para o espaço da tela, com o mesmo ACES + gama do shader (função displayFog na CPU).",
    licao: "Tudo o que o shader faz com a cor (tone mapping, gama) precisa ser reproduzido em qualquer cor que a CPU jogue direto na tela.",
    antes: "img/pipeline/bug_retangulo_preto_aproximando.jpg",
    depois: "img/pipeline/bug_retangulo_corrigido.jpg",
    codigo: {
      lang: "ts",
      antes: `const proj = mat4.perspective(72°, aspect, 0.05, 90);
…
clearColor: zd.fog,            // cor LINEAR (sem ACES/gama)`,
      depois: `const proj = mat4.perspective(72°, aspect, 0.05, 160);
…
clearColor: displayFog(zd.fog, 1.25),

// mesma curva do shader: ACES + gama 2,2
function displayFog(c, exposure) {
  const aces = (x) => clamp((x*(2.51*x+0.03)) / (x*(2.43*x+0.59)+0.14));
  return c.map((v) => Math.pow(aces(v * exposure), 1 / 2.2));
}`,
    },
  },
  {
    id: "vazamento",
    titulo: "Luz atravessando paredes",
    area: "render",
    sintoma: "Tochas de uma sala iluminavam o corredor do outro lado da parede.",
    diagnostico: "Luz pontual só testa a distância. Sem shadow maps, nada impede a luz de atravessar a geometria.",
    correcao: "Visibilidade pré-calculada na CPU: para cada luz, cada célula no alcance só entra na lista se houver linha de visão (DDA na grade) até o centro ou a um dos 4 pontos internos. Cada célula guarda até 14 luzes (índices de 16 bits em 2 × vec4<u32>) e o fragment shader só percorre essa lista.",
    licao: "Um teste barato e estático na grade substitui sombras dinâmicas caras quando as luzes não se movem.",
    codigo: {
      lang: "wgsl",
      antes: `// ingênuo: toda luz dentro do raio contribui
for (var i = 0u; i < nLights; i++) {
  c += pointLight(lights[i], P, N, V, albedo, spec);
}`,
      depois: `// só as luzes que ENXERGAM esta célula (lista da CPU)
let a = cellLights[cell * 2u];
let b = cellLights[cell * 2u + 1u];
var packed = array<u32, 7>(a.x, a.y, a.z, a.w, b.x, b.y, b.z);
for (var k = 0u; k < 7u; k++) {
  let i0 = packed[k] & 0xFFFFu;   // 2 índices por u32
  if (i0 == 0xFFFFu) { break; }
  c += pointLight(staticLights[i0], P, N, V, albedo, spec);
  …
}`,
    },
  },
  {
    id: "lanterna",
    titulo: "Lanterna estourando de perto",
    area: "render",
    sintoma: "Paredes próximas ficavam brancas; a arma na mão brilhava demais.",
    diagnostico: "A atenuação era só x² (x = 1 − d/alcance), quase constante nos primeiros metros, com intensidade 3,4.",
    correcao: "Atenuação x² / (1 + 0,03·d²) com intensidade 2,1, e a lanterna quase não ilumina a arma (passe da arma com fator 0,12).",
    licao: "Curvas de luz precisam ser vistas num gráfico, não só no olho. Veja a curva interativa no capítulo de iluminação.",
    codigo: {
      lang: "wgsl",
      antes: `let x = clamp(1.0 - d / range, 0.0, 1.0);
c += … * (intensidade * cone * x * x);        // 3,4`,
      depois: `let x = clamp(1.0 - d / range, 0.0, 1.0);
let att = x * x / (1.0 + 0.03 * d * d);
c += … * (intensidade * cone * att);          // 2,1`,
    },
  },
  {
    id: "zumbi_deitado",
    titulo: "O zumbi que andava deitado",
    area: "pipeline",
    sintoma: "Nas prévias, o zumbi aparecia deitado no chão em clipes que deveriam ser em pé.",
    diagnostico: "Ossos que um clipe não anima herdavam a última pose de outro clipe (a morte) na exportação para glTF.",
    correcao: "complete_channels(): todo clipe recebe keyframes de todos os ossos, preenchidos com a pose de repouso.",
    licao: "Em glTF, um canal ausente significa “não mexe” — não “volta ao repouso”.",
    antes: "img/pipeline/previa_zumbi_darsh.jpg",
    depois: "img/pipeline/clipes_zumbi.jpg",
  },
  {
    id: "ak47",
    titulo: "AK-47 de 11 MB",
    area: "pipeline",
    sintoma: "O GLB da AK-47 saiu com 11 MB, vértices demais para uma arma.",
    diagnostico: "O atributo de cor por vértice (Col) e UVs padrão por face impediam o exportador de compartilhar vértices: cada canto de cada triângulo virava um vértice.",
    correcao: "Remover o atributo Col e as UVs padrão por face antes de exportar: 1,3 MB.",
    licao: "Vértice na GPU = combinação única de TODOS os atributos. Um atributo inútil multiplica a malha.",
    antes: "img/pipeline/ak47_pecas.jpg",
    depois: "img/pipeline/ak47_final.jpg",
  },
  {
    id: "m4",
    titulo: "O pente flutuante da M4",
    area: "pipeline",
    sintoma: "Na mão do jogador, a M4 tinha “partes brancas” e o pente aparecia solto.",
    diagnostico: "Extraindo as texturas do GLB: o pente estava 28 cm acima do encaixe no arquivo original.",
    correcao: "Deslocamento (OFFSET) aplicado no script de exportação; depois as pontas dos canos (de onde sai o clarão) foram recalculadas direto dos vértices.",
    licao: "Quando o centro do modelo muda, tudo que depende dele (clarão, cápsulas) precisa ser recalculado.",
    antes: "img/pipeline/bug_m4_pente.jpg",
    depois: "img/pipeline/m4_viewmodel_ajustada.jpg",
  },
  {
    id: "tanga",
    titulo: "Achado ao montar esta apresentação: a tanga do troll",
    area: "pipeline",
    sintoma: "Na galeria 3D, as bordas rasgadas do pano do troll aparecem como áreas brancas.",
    diagnostico: "A textura original tem transparência (PNG com alfa) para recortar as bordas. O script de exportação grava as imagens do GLB em JPEG, que não tem canal alfa: o recorte virou branco. O shader também não faz teste de alfa.",
    correcao: "Em aberto. Proposta: exportar só essa textura em PNG e descartar no fragment shader os pixels com alfa < 0,5 (alpha test), em skinned.wgsl e mesh.wgsl.",
    licao: "Todo formato intermediário do pipeline precisa carregar os mesmos canais que o shader espera — inclusive os que ninguém “vê”.",
    antes: "img/pipeline/troll_tanga_jpeg.jpg",
  },
  {
    id: "arraybuffer",
    titulo: "TypeScript 5.9 e os arrays genéricos",
    area: "ts",
    sintoma: "Dezenas de erros TS2345 no writeBuffer (fases 2 e 6 e de novo no motor novo).",
    diagnostico: "Float32Array virou genérico: Float32Array<ArrayBufferLike> pode ser um SharedArrayBuffer, e o WebGPU exige ArrayBuffer.",
    correcao: "Aliases F32 = Float32Array<ArrayBuffer> e U32 = Uint32Array<ArrayBuffer> em todo o código de GPU.",
    licao: "A tipagem do WebGPU é estrita de propósito: memória compartilhada entre threads não pode ir para a fila sem cuidado.",
  },
  {
    id: "mime",
    titulo: "“video/mp2t”: o jogo que não abria",
    area: "ambiente",
    sintoma: "Clicar na tela inicial não fazia nada. O console mostrava: Expected a JavaScript module script but the server responded with a MIME type of \"video/mp2t\".",
    diagnostico: "A página estava aberta pelo Live Server (5500) / Apache (8080). Eles servem o main.ts cru — e .ts é também a extensão de vídeo MPEG Transport Stream.",
    correcao: "Sempre abrir pelo Vite (localhost:5173), que compila o TypeScript e serve JavaScript.",
    licao: "Metade dos bugs de “nada acontece” está no ambiente, não no código.",
  },
  {
    id: "versao_antiga",
    titulo: "“Apareceu a versão antiga”",
    area: "ambiente",
    sintoma: "Depois do commit, rodar o jogo mostrava a versão das 17 fases.",
    diagnostico: "O commit foi feito num branch (setor-zero-completo); ao voltar para o master, que ainda apontava para o commit antigo, o disco voltou a ter os arquivos antigos.",
    correcao: "git merge --ff-only: o master avançou para o commit novo sem reescrever nada.",
    licao: "O diretório de trabalho é o reflexo do branch atual.",
  },
];

export interface CorrecaoLinha {
  quando: string; // horário local (UTC−3) em 26/09
  problema: string;
  correcao: string;
  tipo: "compilacao" | "usuario" | "render" | "pipeline" | "jogo" | "ambiente" | "processo";
}

export const CORRECOES_FINAL: CorrecaoLinha[] = [
  { quando: "12:31", problema: "Exportador glTF do Blender não importava módulos", correcao: "limite de 260 caracteres do Windows: Blender rodado de uma unidade curta (subst B:)", tipo: "ambiente" },
  { quando: "12:34", problema: "Prévia do abissal sem textura", correcao: "materiais ligados ao objeto, não à malha: script ajustado", tipo: "pipeline" },
  { quando: "12:43", problema: "Modelos virados para lados diferentes", correcao: "esqueletos olham para −Y no Blender (o Darsh não): rotação por modelo", tipo: "pipeline" },
  { quando: "12:46", problema: "M4 com dois mapas UV depois da junção", correcao: "UV renomeada para um único mapa antes de juntar", tipo: "pipeline" },
  { quando: "12:47", problema: "AK-47 com 11 MB", correcao: "sem o atributo Col e UVs padrão: 1,3 MB", tipo: "pipeline" },
  { quando: "12:53", problema: "Altura do troll errada", correcao: "normalização contava vértices soltos; a cópia 'cloth.001' foi descartada", tipo: "pipeline" },
  { quando: "12:55", problema: "Abissal na segunda cena do .blend", correcao: "objetos ligados à cena ativa antes de exportar", tipo: "pipeline" },
  { quando: "12:56", problema: "Zumbi deitado nas prévias", correcao: "complete_channels: pose de repouso nos canais ausentes", tipo: "pipeline" },
  { quando: "12:57", problema: "Rotação do Darsh ignorada", correcao: "modo de rotação dos ossos era quaternion: forçado para XYZ", tipo: "pipeline" },
  { quando: "13:03", problema: "Corredor bloqueado por colunas no mapa", correcao: "gerador ajustado; validação de alcançabilidade com chaves", tipo: "jogo" },
  { quando: "13:19", problema: "Paredes sumindo com o culling", correcao: "ordem dos cantos (winding) corrigida no gerador de geometria", tipo: "render" },
  { quando: "13:33", problema: "Erros de tipo do TypeScript 5.9", correcao: "aliases F32/U32 com ArrayBuffer", tipo: "compilacao" },
  { quando: "13:34", problema: "Arma na mão estourada pela lanterna; porta com grama", correcao: "fator da lanterna no passe da arma; textura de tábuas girada 90°", tipo: "render" },
  { quando: "13:39", problema: "Retângulo preto no fim do túnel", correcao: "far 90 → 160 m e clear com a neblina no espaço da tela", tipo: "render" },
  { quando: "13:39", problema: "Lanterna forte demais de perto", correcao: "atenuação x²/(1 + k·d²) e intensidade menor", tipo: "render" },
  { quando: "13:39", problema: "Canais de água interrompidos nas junções", correcao: "gerador do mapa: canal contínuo", tipo: "jogo" },
  { quando: "13:43", problema: "Faca de perfil, M4 e espingarda perto demais", correcao: "posição/rotação do view model por arma", tipo: "jogo" },
  { quando: "13:45", problema: "Pente da M4 28 cm acima", correcao: "OFFSET na exportação + ponta do cano recalculada dos vértices", tipo: "pipeline" },
  { quando: "13:48", problema: "Chão escuro demais no mapa automático", correcao: "cores do automap clareadas", tipo: "jogo" },
  { quando: "13:50", problema: "Portão de saída com orientação errada", correcao: "detecção do eixo das portas pelas células abertas vizinhas", tipo: "jogo" },
  { quando: "13:51", problema: "Tiros acima do zumbi caído acertavam", correcao: "hitbox baixa enquanto ele finge estar morto", tipo: "jogo" },
  { quando: "13:52", problema: "Porta 5173 ocupada após os testes", correcao: "processo filho do Vite encerrado", tipo: "ambiente" },
];
