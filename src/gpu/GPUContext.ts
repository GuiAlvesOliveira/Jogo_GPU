// ============================================================
//  GPUContext — Camada de inicialização do WebGPU (roda na CPU)
// ------------------------------------------------------------
//  Responsabilidade única: obter e guardar os objetos base do
//  WebGPU e configurar o canvas. NÃO desenha nada — apenas prepara
//  o "hardware" para o Renderer usar.
//
//  Objetos WebGPU inicializados aqui:
//    - GPUAdapter        → representa uma GPU física disponível.
//    - GPUDevice         → interface lógica para enviar comandos à GPU.
//    - GPUCanvasContext  → liga o <canvas> à GPU (destino do render).
//    - formato de textura preferido do canvas.
// ============================================================

export class GPUContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly canvas: HTMLCanvasElement;
  readonly format: GPUTextureFormat;

  private constructor(
    adapter: GPUAdapter,
    device: GPUDevice,
    context: GPUCanvasContext,
    canvas: HTMLCanvasElement,
    format: GPUTextureFormat,
  ) {
    this.adapter = adapter;
    this.device = device;
    this.context = context;
    this.canvas = canvas;
    this.format = format;
  }

  // Fábrica assíncrona: toda a negociação com a GPU é assíncrona,
  // por isso não pode ficar no construtor.
  static async create(canvas: HTMLCanvasElement): Promise<GPUContext> {
    // 1) O navegador expõe WebGPU em navigator.gpu.
    if (!navigator.gpu) {
      throw new Error(
        "WebGPU não está disponível neste navegador.\n" +
          "Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.",
      );
    }

    // 2) Pede um adaptador (uma GPU física). Preferimos alta performance.
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");
    }

    // 3) Pede um device: a interface lógica pela qual enviamos comandos.
    const device = await adapter.requestDevice();

    // Se o device for perdido (ex.: driver reiniciou), avisamos no console.
    device.lost.then((info) => {
      console.error(`GPUDevice perdido: ${info.reason ?? "desconhecido"} — ${info.message}`);
    });

    // 4) Obtém o contexto WebGPU do canvas — destino final do render.
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");
    }

    // 5) Formato de textura preferido do sistema (ex.: bgra8unorm).
    //    Usar o formato preferido evita conversões e melhora performance.
    const format = navigator.gpu.getPreferredCanvasFormat();

    // 6) Configura o context: associa device + formato ao canvas.
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });

    return new GPUContext(adapter, device, context, canvas, format);
  }

  // Ajusta o tamanho do framebuffer ao tamanho real em pixels do canvas,
  // considerando telas HiDPI (devicePixelRatio). Deve ser chamado no início
  // e sempre que a janela for redimensionada.
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }
}
