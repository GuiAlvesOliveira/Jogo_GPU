// ============================================================
//  Renderer — Desenha a cena usando WebGPU
// ------------------------------------------------------------
//  FASE 4: desenha o MAPA como muitas caixas via INSTANCING.
//  A geometria (um cubo unitário) é enviada UMA vez; cada caixa é
//  uma "instância" com sua própria matriz model e cor, lidas de um
//  STORAGE BUFFER pelo vertex shader (indexado por instance_index).
//
//  Assim, todas as caixas do mapa são desenhadas em UM único draw
//  call (pass.draw(36, numInstances)) e a GPU faz a transformação
//  Model→View→Projection de cada uma em paralelo.
//
//  Divisão CPU x GPU:
//    CPU: monta a matriz da câmera (viewProj) e, uma vez, o array
//         de instâncias (model+cor) a partir do level data.
//    GPU: transforma vértices por instância, faz depth test,
//         rasteriza e colore.
// ============================================================

import { GPUContext } from "../gpu/GPUContext";
import { Mat4 } from "../core/math/mat4";
import * as mat4 from "../core/math/mat4";
import { CUBE_VERTICES, CUBE_VERTEX_COUNT, CUBE_FLOATS_PER_VERTEX } from "../geometry/cube";
import { Box } from "../levels/types";
import cubeVertSrc from "../shaders/cube.vert.wgsl?raw";
import cubeFragSrc from "../shaders/cube.frag.wgsl?raw";

const VERTEX_STRIDE_BYTES = CUBE_FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT; // 24 bytes
const DEPTH_FORMAT: GPUTextureFormat = "depth24plus";
// Uniform global: viewProj (mat4=64) + lightDir/ambient/lightColor (3× vec4=48) = 112 bytes.
const GLOBALS_SIZE = 64 + 3 * 16;
const FLOATS_PER_INSTANCE = 20; // mat4 (16) + cor vec4 (4)
const INSTANCE_STRIDE_BYTES = FLOATS_PER_INSTANCE * 4; // 80 bytes

// Parâmetros de iluminação (constantes; enviados uma vez à GPU).
// Ambiente baixo + direcional forte = atmosfera escura e dramática (§9).
// prettier-ignore
const LIGHTING = new Float32Array([
  0.4, 0.9, 0.35, 0.0,   // lightDir (direção PARA a luz; shader normaliza)
  0.16, 0.16, 0.20, 0.0, // ambient
  1.0, 0.95, 0.85, 0.0,  // lightColor (intensidade ~0.9)
]);

export class Renderer {
  private readonly gpu: GPUContext;
  private readonly pipeline: GPURenderPipeline;
  private readonly vertexBuffer: GPUBuffer;
  private readonly viewUniformBuffer: GPUBuffer;

  private instanceBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private instanceCount = 0;

  // Conjunto de instâncias DINÂMICO (inimigos e, depois, pickups etc.),
  // reenviado à GPU a cada frame. O buffer cresce sob demanda.
  private entityBuffer: GPUBuffer | null = null;
  private entityBindGroup: GPUBindGroup | null = null;
  private entityCapacityBytes = 0;

  private depthTexture: GPUTexture | null = null;
  private depthView: GPUTextureView | null = null;
  private depthWidth = 0;
  private depthHeight = 0;

  constructor(gpu: GPUContext) {
    this.gpu = gpu;
    const { device, format } = gpu;

    // ---- Geometria base (cubo unitário), enviada uma única vez ----
    this.vertexBuffer = device.createBuffer({
      label: "cube-vertices",
      size: CUBE_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, CUBE_VERTICES);

    // ---- Uniform global: viewProj (por frame) + luz (uma vez) ----
    this.viewUniformBuffer = device.createBuffer({
      label: "globals(viewProj + luz)",
      size: GLOBALS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // A iluminação é constante: escrita uma única vez, no offset 64
    // (logo após a matriz viewProj).
    device.queue.writeBuffer(this.viewUniformBuffer, 64, LIGHTING);

    // ---- Shaders ----
    const vertexModule = device.createShaderModule({ label: "cube.vert", code: cubeVertSrc });
    const fragmentModule = device.createShaderModule({ label: "cube.frag", code: cubeFragSrc });

    // ---- Layout do vertex buffer (posição + normal) ----
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: VERTEX_STRIDE_BYTES,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
        { shaderLocation: 1, offset: 3 * 4, format: "float32x3" }, // normal
      ],
    };

    // ---- Pipeline ----
    this.pipeline = device.createRenderPipeline({
      label: "map-pipeline",
      layout: "auto",
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "main",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }

  // Recebe as caixas do mapa (level data) e monta o storage buffer
  // de instâncias na GPU. Chamado uma vez ao carregar um nível.
  setBoxes(boxes: Box[]): void {
    const { device } = this.gpu;
    this.instanceCount = boxes.length;

    // Monta, na CPU, o array intercalado: [model(16) | cor(4)] por caixa.
    const data = new Float32Array(boxes.length * FLOATS_PER_INSTANCE);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      // model = translação(centro) * escala(tamanho)
      const model = mat4.multiply(
        mat4.translation(b.center[0], b.center[1], b.center[2]),
        mat4.scaling(b.size[0], b.size[1], b.size[2]),
      );
      const base = i * FLOATS_PER_INSTANCE;
      data.set(model, base); // 16 floats
      data[base + 16] = b.color[0];
      data[base + 17] = b.color[1];
      data[base + 18] = b.color[2];
      data[base + 19] = 1.0; // alpha/padding
    }

    // Recria o buffer com o tamanho exato do nível atual.
    this.instanceBuffer?.destroy();
    this.instanceBuffer = device.createBuffer({
      label: "map-instances",
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.instanceBuffer, 0, data);

    // Bind group liga o uniform da câmera (0) e as instâncias (1).
    this.bindGroup = device.createBindGroup({
      label: "map-bind-group",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.viewUniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
      ],
    });

    void INSTANCE_STRIDE_BYTES; // documenta o stride esperado no shader
  }

  // Garante que o buffer dinâmico de entidades comporta `bytes` e
  // recria o bind group quando necessário. Compartilha o mesmo uniform
  // de câmera (viewProj) que o mapa.
  private ensureEntityCapacity(bytes: number): void {
    if (this.entityBuffer && bytes <= this.entityCapacityBytes) return;
    const { device } = this.gpu;
    this.entityBuffer?.destroy();
    const size = Math.max(bytes, INSTANCE_STRIDE_BYTES); // ao menos 1 instância
    this.entityBuffer = device.createBuffer({
      label: "entity-instances",
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.entityBindGroup = device.createBindGroup({
      label: "entity-bind-group",
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.viewUniformBuffer } },
        { binding: 1, resource: { buffer: this.entityBuffer } },
      ],
    });
    this.entityCapacityBytes = size;
  }

  private ensureDepthTexture(): GPUTextureView {
    const { device, canvas } = this.gpu;
    const w = canvas.width;
    const h = canvas.height;
    if (!this.depthTexture || this.depthWidth !== w || this.depthHeight !== h) {
      this.depthTexture?.destroy();
      this.depthTexture = device.createTexture({
        label: "depth-texture",
        size: [w, h],
        format: DEPTH_FORMAT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.depthView = this.depthTexture.createView();
      this.depthWidth = w;
      this.depthHeight = h;
    }
    return this.depthView!;
  }

  // Desenha um frame. Recebe a matriz viewProj (Projection * View) e,
  // opcionalmente, as instâncias dinâmicas (inimigos): `entityData`
  // contém `entityCount` instâncias de 20 floats cada.
  render(viewProj: Mat4, entityData?: Float32Array<ArrayBuffer>, entityCount = 0): void {
    const { device, context } = this.gpu;
    if (!this.bindGroup || this.instanceCount === 0) return;

    device.queue.writeBuffer(this.viewUniformBuffer, 0, viewProj);

    // Envia as instâncias dinâmicas (se houver) ANTES de abrir a pass.
    if (entityData && entityCount > 0) {
      const usedFloats = entityCount * (INSTANCE_STRIDE_BYTES / 4);
      this.ensureEntityCapacity(entityCount * INSTANCE_STRIDE_BYTES);
      device.queue.writeBuffer(this.entityBuffer!, 0, entityData, 0, usedFloats);
    }

    const depthView = this.ensureDepthTexture();
    const encoder = device.createCommandEncoder({ label: "frame-encoder" });
    const colorView = context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      label: "map-pass",
      colorAttachments: [
        {
          view: colorView,
          clearValue: { r: 0.03, g: 0.03, b: 0.05, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);

    // Draw 1: mapa estático (uma instância por caixa).
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(CUBE_VERTEX_COUNT, this.instanceCount);

    // Draw 2: inimigos (instâncias dinâmicas), se houver.
    if (this.entityBindGroup && entityData && entityCount > 0) {
      pass.setBindGroup(0, this.entityBindGroup);
      pass.draw(CUBE_VERTEX_COUNT, entityCount);
    }

    pass.end();

    device.queue.submit([encoder.finish()]);
  }
}
