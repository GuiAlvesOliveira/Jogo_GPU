// ============================================================
//  fases.ts — as 17 fases incrementais (14/09/2026)
// ------------------------------------------------------------
//  Resumo curado de cada fase: o conceito de Computação Gráfica
//  introduzido, o que foi feito, o que roda na CPU × GPU e as
//  correções (erros de compilação, bugs relatados pelo usuário e
//  ajustes de processo). Os prompts literais e os relatórios
//  completos vêm de historia.json (extraídos das sessões).
// ============================================================

export type TipoCorrecao = "compilacao" | "usuario" | "processo" | "nota";

export interface Correcao {
  tipo: TipoCorrecao;
  titulo: string;
  sintoma?: string;
  causa?: string;
  correcao: string;
}

export interface Fase {
  n: number;
  plano: string; // o que o §29 da especificação pedia
  titulo: string;
  conceito: string;
  fez: string[];
  cpu: string[];
  gpu: string[];
  correcoes: Correcao[];
  novos: string[];
  jogavel?: boolean;
}

export const FASES: Fase[] = [
  {
    n: 1,
    plano: "Inicializar WebGPU → canvas → pipeline → triângulo",
    titulo: "O primeiro triângulo",
    conceito: "Pipeline gráfico programável: adapter → device → contexto → shader → pipeline → comandos",
    fez: [
      "Projeto Vite + TypeScript com a estrutura modular sugerida pela especificação",
      "GPUContext: navigator.gpu → requestAdapter() → requestDevice() → context.configure()",
      "Vertex buffer com 3 vértices [x, y, r, g, b] (stride de 20 bytes) em clip space",
      "Shaders WGSL separados (vertex e fragment) e o primeiro GPURenderPipeline",
      "Game loop com requestAnimationFrame já separado em update(dt) e render()",
    ],
    cpu: ["prepara o Float32Array", "cria buffers e o pipeline", "grava o command encoder"],
    gpu: ["vertex shader por vértice", "rasterização", "fragment shader interpola a cor"],
    correcoes: [
      {
        tipo: "processo",
        titulo: "A 1ª tentativa nem começou",
        sintoma: "API Error: 401 — OAuth access token has expired",
        causa: "sessão do Claude Code com o login expirado",
        correcao: "login refeito e o mesmo prompt reenviado 1 minuto depois",
      },
    ],
    novos: ["index.html", "src/main.ts", "src/gpu/GPUContext.ts", "src/renderer/Renderer.ts", "src/shaders/triangle.vert.wgsl", "src/shaders/triangle.frag.wgsl"],
  },
  {
    n: 2,
    plano: "Matriz Model/View/Projection → cubo 3D",
    titulo: "MVP e o cubo",
    conceito: "Transformações Model → View → Projection, uniform buffer, bind group, depth buffer e culling",
    fez: [
      "mat4.ts em column-major: identity, multiply, rotações, perspective e lookAt",
      "perspective mapeia Z para [0, 1] — a convenção do WebGPU (o OpenGL usa [−1, 1])",
      "Cubo indexado: 8 vértices únicos + 36 índices (12 triângulos)",
      "Uniform buffer de 64 bytes (uma mat4) ligado por bind group ao @group(0) @binding(0)",
      "Depth texture recriada no resize, depthStencil no pipeline e cullMode \"back\"",
    ],
    cpu: ["monta P × V × M uma vez por frame", "writeBuffer da matriz"],
    gpu: ["multiplica cada vértice pela MVP", "teste de profundidade por fragmento"],
    correcoes: [
      {
        tipo: "compilacao",
        titulo: "TS2345: Mat4 não é GPUAllowSharedBufferSource",
        sintoma: "Argument of type 'Mat4' is not assignable to parameter of type 'GPUAllowSharedBufferSource'",
        causa: "no TypeScript 5.9 o Float32Array virou genérico (Float32Array<ArrayBufferLike>) e o writeBuffer exige ArrayBuffer",
        correcao: "o tipo Mat4 passou a ser Float32Array<ArrayBuffer>",
      },
    ],
    novos: ["src/core/math/mat4.ts", "src/geometry/cube.ts", "src/shaders/cube.vert.wgsl", "src/shaders/cube.frag.wgsl"],
  },
  {
    n: 3,
    plano: "Câmera FPS → WASD → mouse look",
    titulo: "Câmera em primeira pessoa",
    conceito: "Câmera yaw/pitch, Pointer Lock API e movimento relativo à direção do olhar",
    fez: [
      "InputManager: teclas por e.code (independe do layout) e movementX/Y acumulado",
      "Camera: posição, yaw, pitch limitado a ±89°, FOV, near e far",
      "WASD no plano XZ, normalizado (não corre mais na diagonal)",
      "A matriz view passa a vir da câmera; dt limitado a 0,1 s ao voltar de aba inativa",
    ],
    cpu: ["input", "yaw/pitch", "view matrix"],
    gpu: ["transforma os vértices com a nova view"],
    correcoes: [],
    novos: ["src/core/InputManager.ts", "src/game/Camera.ts"],
    jogavel: true,
  },
  {
    n: 4,
    plano: "Chão e paredes → primeiro mapa",
    titulo: "O mapa vira dado",
    conceito: "Level data + instancing: um storage buffer de instâncias e um único draw call",
    fez: [
      "levels/types.ts: Box (centro, tamanho, cor) e Level (id, nome, spawn, caixas)",
      "O primeiro mapa descrito como uma lista de caixas (sala, corredor, pilares)",
      "Vertex shader lê array<Instance> por @builtin(instance_index)",
      "Todas as caixas do mapa saem em um único draw(36, N)",
    ],
    cpu: ["converte o nível em [model(16) | cor(4)] uma vez"],
    gpu: ["model × view × projection de cada caixa em paralelo"],
    correcoes: [],
    novos: ["src/levels/types.ts", "src/levels/level1.ts"],
    jogavel: true,
  },
  {
    n: 5,
    plano: "Colisão",
    titulo: "Não atravessar paredes",
    conceito: "Círculo × AABB resolvido por eixo: o jogador desliza ao longo das paredes",
    fez: [
      "CollisionSystem com as AABBs pré-calculadas a partir dos mesmos dados do mapa",
      "Resolve X e depois Z, empurrando o jogador para fora da caixa expandida pelo raio (0,35 m)",
      "Faixa vertical do corpo: o chão fica abaixo dos pés e é ignorado automaticamente",
    ],
    cpu: ["colisão (regra de jogo)"],
    gpu: ["continua só transformando e desenhando"],
    correcoes: [
      {
        tipo: "nota",
        titulo: "Limitação consciente",
        correcao: "os cantos são tratados como quadrados (AABB expandida), colisão levemente antecipada e imperceptível",
      },
    ],
    novos: ["src/collision/CollisionSystem.ts"],
    jogavel: true,
  },
  {
    n: 6,
    plano: "Primeiro inimigo",
    titulo: "O primeiro inimigo",
    conceito: "Entidades dinâmicas: storage buffer reescrito a cada frame e que cresce sob demanda",
    fez: [
      "Enemy com os campos do §10 e o enum de estados IDLE … DEAD",
      "Arquétipo basic: 30 HP, 2,2 m/s, 8 de dano, alcance 1,6 m, 100 pontos",
      "EnemyManager: spawn a partir do nível e montagem das instâncias",
      "Dois draws no mesmo pipeline: mapa estático + entidades dinâmicas",
    ],
    cpu: ["estado dos inimigos", "reescreve o array de instâncias"],
    gpu: ["desenha todas as instâncias num draw por grupo"],
    correcoes: [
      {
        tipo: "compilacao",
        titulo: "TS2345 de novo, agora nas instâncias",
        sintoma: "Float32Array<ArrayBufferLike> is not assignable to GPUAllowSharedBufferSource",
        causa: "mesmo problema de tipagem do TypeScript 5.9 da fase 2",
        correcao: "buffers de instância tipados como Float32Array<ArrayBuffer>",
      },
    ],
    novos: ["src/game/enemies/Enemy.ts", "src/game/enemies/EnemyManager.ts"],
    jogavel: true,
  },
  {
    n: 7,
    plano: "IA básica",
    titulo: "A primeira IA",
    conceito: "Máquina de estados finita com histerese",
    fez: [
      "IDLE → ALERT (0,4 s) → CHASE → ATTACK, detecção a ~12 m",
      "Perseguição com colisão contra o mapa (moveAndCollide ficou genérico)",
      "faceTowards: rotação = atan2(dx, −dz), a mesma convenção da câmera",
      "Histerese: sai do ATTACK além de alcance × 1,25 e desiste além de detecção × 1,6",
    ],
    cpu: ["IA de alto nível (como pede o §3)"],
    gpu: ["instâncias com a nova posição/rotação"],
    correcoes: [],
    novos: [],
    jogavel: true,
  },
  {
    n: 8,
    plano: "Raycast e tiro",
    titulo: "Raycast e tiro",
    conceito: "Hitscan: raio × AABB pelo método dos slabs, com oclusão pelas paredes",
    fez: [
      "RaycastSystem: inimigo vivo mais próximo, limitado pela parede mais próxima",
      "takeDamage → HURT (flash branco por 0,18 s) ou DEAD",
      "Mira central com hit marker vermelho",
      "Disparo por borda: o clique que trava o mouse não atira",
    ],
    cpu: ["raio × caixas", "dano e estados"],
    gpu: ["flash branco via cor da instância"],
    correcoes: [],
    novos: ["src/game/combat/RaycastSystem.ts"],
    jogavel: true,
  },
  {
    n: 9,
    plano: "Vida, dano e morte",
    titulo: "Vida, dano e game over",
    conceito: "Máquina de estados do jogo: MENU, PLAYING, PAUSED, LEVEL_COMPLETE, GAME_OVER",
    fez: [
      "Player com HP; o inimigo em ATTACK causa 8 de dano ~1 vez por segundo",
      "Flash vermelho de dano desacoplado (o main percebe a queda de HP)",
      "Tela VOCÊ MORREU e reinício com clique",
    ],
    cpu: ["estados do jogo", "vida do jogador"],
    gpu: ["nada novo: o render não sabe das regras"],
    correcoes: [
      {
        tipo: "compilacao",
        titulo: "TS18047: 'canvas' is possibly 'null'",
        sintoma: "o tsc falhou (TSC_EXIT 2) mas o vite build passou",
        causa: "o TypeScript não mantém o estreitamento de tipo dentro de uma closure",
        correcao: "asserção não nula depois da verificação de existência do canvas",
      },
    ],
    novos: ["src/game/Player.ts", "src/game/GameState.ts"],
    jogavel: true,
  },
  {
    n: 10,
    plano: "Armas",
    titulo: "Pistola, shotgun e rifle",
    conceito: "Armas como dados (WeaponConfig) e dispersão em cone",
    fez: [
      "Weapon + WeaponManager com todos os campos do §13",
      "Pistola 18 de dano a 5/s · shotgun 10 × 8 pellets · rifle automático 12 a 10/s",
      "Recarga automática com pente vazio e HUD provisório (HP · ARMA · MUNIÇÃO)",
    ],
    cpu: ["cadência, pente, recarga", "N raios com dispersão"],
    gpu: ["nada novo"],
    correcoes: [
      {
        tipo: "processo",
        titulo: "Pedido: “deixe jogável para ir testando”",
        correcao: "o servidor Vite passou a ficar no ar durante o desenvolvimento (HMR recarrega a cada edição)",
      },
      {
        tipo: "processo",
        titulo: "Porta 5173 ocupada e uma edição que falhou",
        sintoma: "Port 5173 is already in use · String to replace not found",
        causa: "o Vite já estava rodando; o texto a substituir tinha o caractere “·” escapado",
        correcao: "manteve o servidor existente e reaplicou a edição",
      },
    ],
    novos: ["src/game/weapons/Weapon.ts", "src/game/weapons/WeaponManager.ts"],
    jogavel: true,
  },
  {
    n: 11,
    plano: "Munição e pickups",
    titulo: "Munição no mapa",
    conceito: "Pickups como instâncias + estados MENU/PAUSED dirigidos pelo Pointer Lock",
    fez: [
      "Itens girando e flutuando, cor por tipo (pistola, shotgun, rifle)",
      "Coleta a ≤ 1,2 m; com a reserva cheia o item fica no chão",
      "Inimigos e pickups combinados num único draw dinâmico",
    ],
    cpu: ["coleta", "animação de giro na matriz model"],
    gpu: ["mesmo draw instanciado"],
    correcoes: [
      {
        tipo: "usuario",
        titulo: "“A tela inicial ainda não inicia o jogo”",
        sintoma: "os inimigos já andavam e atacavam antes do clique",
        causa: "o jogo começava direto em PLAYING",
        correcao: "estado MENU inicial; ESC pausa; travar o mouse → PLAYING, soltar → PAUSED",
      },
    ],
    novos: ["src/game/pickups/Pickup.ts", "src/game/pickups/PickupManager.ts"],
    jogavel: true,
  },
  {
    n: 12,
    plano: "HUD",
    titulo: "HUD completo",
    conceito: "HUD em HTML/CSS por cima do canvas (a GPU só desenha o mundo)",
    fez: [
      "Quatro cantos: SCORE · FASE e INIMIGOS · HP e ARMOR · ARMA e MUNIÇÃO",
      "HP pulsa em vermelho abaixo de 30; score soma o valor do arquétipo",
    ],
    cpu: ["DOM do HUD"],
    gpu: ["nada novo"],
    correcoes: [
      {
        tipo: "usuario",
        titulo: "“Ao clicar em clique para iniciar, nada acontece”",
        sintoma: "o clique na tela inicial não iniciava",
        causa: "o início dependia do clique atravessar a tela (pointer-events: none) até o canvas para pedir o Pointer Lock",
        correcao: "#start e #hint chamam beginPlay() direto: entra em PLAYING na hora e pede o lock tratando a Promise; referências de DOM subiram para o topo (evita TDZ)",
      },
    ],
    novos: [],
    jogavel: true,
  },
  {
    n: 13,
    plano: "Sistema de fases",
    titulo: "Fases e saída",
    conceito: "Progressão: a saída abre quando INIMIGOS = 0; o mapa passa a ser gerado por número de fase",
    fez: [
      "Saída vermelha → verde pulsante; pisar nela mostra FASE CONCLUÍDA",
      "Avançar mantém HP, armas, munição e score",
      "levelFactory.createLevel(n) com ganchos para o scaling da fase 14",
    ],
    cpu: ["fluxo de fases", "fábrica de níveis"],
    gpu: ["a saída é só mais uma instância"],
    correcoes: [
      {
        tipo: "usuario",
        titulo: "MIME type “video/mp2t”",
        sintoma: "Failed to load module script: … MIME type of \"video/mp2t\"",
        causa: "a página estava aberta pelo Live Server (5500) ou pelo Apache (8080), que servem o .ts cru — e .ts também é a extensão do vídeo MPEG-TS",
        correcao: "abrir sempre pelo Vite em localhost:5173, que compila o TypeScript",
      },
    ],
    novos: ["src/levels/levelFactory.ts"],
    jogavel: true,
  },
  {
    n: 14,
    plano: "Scaling de dificuldade",
    titulo: "Dificuldade por fórmula",
    conceito: "Scaling configurável: quantidade = base + (n − 1) · k e atributo × base^(n − 1)",
    fez: [
      "5, 8, 11, 14, 17 … inimigos (limitado a 20 posições)",
      "Vida × 1,18ⁿ⁻¹, dano × 1,12ⁿ⁻¹, velocidade × 1,05ⁿ⁻¹",
      "O Enemy guarda os atributos já escalados; o resto do código não sabe da fórmula",
    ],
    cpu: ["DIFFICULTY em levelFactory.ts"],
    gpu: ["nada novo"],
    correcoes: [
      {
        tipo: "nota",
        titulo: "Aviso honesto",
        correcao: "só existia o arquétipo basic: os tipos rápido e pesado do §12 não estavam no roteiro de fases (oferecido como extra)",
      },
    ],
    novos: [],
    jogavel: true,
  },
  {
    n: 15,
    plano: "Iluminação",
    titulo: "Luz calculada na GPU",
    conceito: "Lambert por pixel: cor × (ambiente + luz · max(N·L, 0))",
    fez: [
      "Normais por vértice (stride 24 B) no lugar do brilho falso por face",
      "Uniform Globals de 112 B: viewProj por frame + luz enviada uma vez (offset 64)",
      "Normal levada ao mundo no vertex shader e renormalizada no fragment",
    ],
    cpu: ["envia os parâmetros da luz uma única vez"],
    gpu: ["iluminação por pixel no fragment shader"],
    correcoes: [],
    novos: [],
    jogavel: true,
  },
  {
    n: 16,
    plano: "Partículas",
    titulo: "Partículas (interrompida)",
    conceito: "Compute shader para simular partículas na GPU",
    fez: ["Só deu tempo de escrever o particle.compute.wgsl antes da interrupção", "O arquivo ficou no projeto, sem ninguém usá-lo"],
    cpu: [],
    gpu: ["compute shader escrito, não conectado"],
    correcoes: [
      {
        tipo: "processo",
        titulo: "Interrompida pelo usuário",
        correcao: "o usuário pulou para a fase 17; as fases 16 e 18 ficaram fora do roteiro (depois dispensadas no prompt final)",
      },
    ],
    novos: ["src/shaders/particle.compute.wgsl"],
    jogavel: true,
  },
  {
    n: 17,
    plano: "Áudio",
    titulo: "Áudio sintetizado",
    conceito: "Web Audio API: osciladores + ruído + filtros + envelopes, sem arquivos de som",
    fez: [
      "AudioManager separado do renderer (§25 e §26)",
      "Drone ambiente, tiros com timbre por arma, acerto, morte, dano, pickup e passos",
      "O clique inicial também libera o áudio (política de autoplay dos navegadores)",
    ],
    cpu: ["Web Audio (thread de áudio do navegador)"],
    gpu: ["nada"],
    correcoes: [
      {
        tipo: "processo",
        titulo: "Primeiro envio interrompido",
        correcao: "o prompt foi reenviado 15 segundos depois",
      },
    ],
    novos: ["src/audio/AudioManager.ts"],
    jogavel: true,
  },
];

export const TIPO_LABEL: Record<TipoCorrecao, { label: string; cls: string }> = {
  compilacao: { label: "Erro de compilação", cls: "bug" },
  usuario: { label: "Relatado pelo usuário", cls: "warn" },
  processo: { label: "Processo", cls: "" },
  nota: { label: "Nota", cls: "" },
};
