// ============================================================
//  Renderer — Desenha a cena com WebGPU (a CPU só organiza)
// ------------------------------------------------------------
//  CPU (aqui): monta as FILAS do frame (quais modelos, com quais
//  matrizes; sprites; portas), envia tudo para a GPU em poucos
//  writeBuffer e grava os comandos.
//  GPU (shaders): transforma vértices, deforma esqueletos, ilumina
//  cada pixel, aplica neblina/tone mapping e resolve o MSAA.
//
//  Estrutura do frame (2 render passes, MSAA 4x):
//    Pass 1 — MUNDO: mapa (1 draw) + portas + modelos estáticos
//             (instanciados por modelo) + personagens (instanciados,
//             com skinning) + sprites alfa (ordenados) + aditivos.
//    Pass 2 — ARMA NA MÃO: limpa só o depth e desenha a arma com
//             outra projeção (FOV menor, near curto), para ela nunca
//             atravessar paredes; resolve o MSAA para o canvas.
// ============================================================

import { GPUContext } from "../gpu/GPUContext";
import { TextureLoader } from "../gpu/textures";
import type { GPUModel } from "./ModelGPU";
import { ModelUploader } from "./ModelGPU";
import commonSrc from "../shaders/common.wgsl?raw";
import levelSrc from "../shaders/level.wgsl?raw";
import meshSrc from "../shaders/mesh.wgsl?raw";
import skinnedSrc from "../shaders/skinned.wgsl?raw";
import spriteSrc from "../shaders/sprite.wgsl?raw";

const SAMPLES = 4;
const DEPTH: GPUTextureFormat = "depth24plus";
const FRAME_SIZE = 64 + 8 * 16 + 8 * 16; // bytes do uniform Frame
export const INST_FLOATS = 24; // mat4 + tint + params
export const SPRITE_FLOATS = 20;
export const LIGHT_FLOATS = 12;
export const MAX_DYN_LIGHTS = 16;
export const LEVEL_VERTEX_FLOATS = 14;

export type F32 = Float32Array<ArrayBuffer>;
export type U32 = Uint32Array<ArrayBuffer>;

export interface LevelGPUData {
  vertices: F32;
  indices: U32;
  doorVertices: F32;
  doorIndices: U32;
  doorRanges: { first: number; count: number }[];
  albedo: ImageBitmap[];
  normals: ImageBitmap[];
  layerInfo: F32; // 32 * 4
  staticLights: F32; // n * 12
  cellLights: U32; // células * 8
  gridW: number;
  gridH: number;
  cellSize: number;
}

export interface FrameParams {
  viewProj: Float32Array;
  vmViewProj: Float32Array;
  camPos: [number, number, number];
  camRight: [number, number, number];
  camUp: [number, number, number];
  time: number;
  fogColor: [number, number, number];
  fogDensity: number;
  flashOn: boolean;
  flashPos: [number, number, number];
  flashDir: [number, number, number];
  flashRange: number;
  flashCosInner: number;
  flashCosOuter: number;
  flashIntensity: number;
  exposure: number;
  ambientScale: number;
  zoneAmbient: F32; // 8 * 4
  dynLights: F32;
  dynCount: number;
  clearColor: [number, number, number];
  vmFlashScale: number; // a lanterna quase não ilumina a arma (está colada nela)
}

// Array de floats que cresce sob demanda (reaproveitado entre frames).
class FloatList {
  data = new Float32Array(1024);
  length = 0;
  reserve(n: number): number {
    const need = this.length + n;
    if (need > this.data.length) {
      let cap = this.data.length;
      while (cap < need) cap *= 2;
      const d = new Float32Array(cap);
      d.set(this.data.subarray(0, this.length));
      this.data = d;
    }
    const at = this.length;
    this.length = need;
    return at;
  }
  clear(): void {
    this.length = 0;
  }
}

interface Group {
  model: GPUModel;
  inst: FloatList;
  count: number;
}

// Fila de desenho de um frame (preenchida pelo jogo).
export class RenderQueue {
  readonly meshGroups = new Map<GPUModel, Group>();
  readonly skinGroups = new Map<GPUModel, Group>();
  readonly vmGroups = new Map<GPUModel, Group>();
  readonly bones = new FloatList();
  readonly spritesAdd = new FloatList();
  readonly spritesAlpha = new FloatList();
  readonly vmSprites = new FloatList();
  readonly doorInst = new Float32Array(64 * 8);
  readonly doorGeom = new Int32Array(64);
  doorCount = 0;

  clear(): void {
    for (const g of this.meshGroups.values()) (g.inst.clear(), (g.count = 0));
    for (const g of this.skinGroups.values()) (g.inst.clear(), (g.count = 0));
    for (const g of this.vmGroups.values()) (g.inst.clear(), (g.count = 0));
    this.bones.clear();
    this.spritesAdd.clear();
    this.spritesAlpha.clear();
    this.vmSprites.clear();
    this.doorCount = 0;
  }

  private group(map: Map<GPUModel, Group>, model: GPUModel): Group {
    let g = map.get(model);
    if (!g) {
      g = { model, inst: new FloatList(), count: 0 };
      map.set(model, g);
    }
    return g;
  }

  // Reserva uma instância e devolve (array, offset) para o chamador
  // escrever: [0..15] matriz model, [16..19] tint, [20..23] params.
  mesh(model: GPUModel): { d: Float32Array; o: number } {
    const g = this.group(this.meshGroups, model);
    const o = g.inst.reserve(INST_FLOATS);
    g.count++;
    return { d: g.inst.data, o };
  }

  viewModel(model: GPUModel): { d: Float32Array; o: number } {
    const g = this.group(this.vmGroups, model);
    const o = g.inst.reserve(INST_FLOATS);
    g.count++;
    return { d: g.inst.data, o };
  }

  // Personagem: reserva instância + espaço para `joints` matrizes de osso.
  skinned(model: GPUModel, joints: number): { d: Float32Array; o: number; bones: Float32Array; boneOffset: number; firstBone: number } {
    const g = this.group(this.skinGroups, model);
    const o = g.inst.reserve(INST_FLOATS);
    g.count++;
    const bo = this.bones.reserve(joints * 16);
    return { d: g.inst.data, o, bones: this.bones.data, boneOffset: bo, firstBone: bo / 16 };
  }

  sprite(
    additive: boolean,
    x: number, y: number, z: number, size: number,
    r: number, g: number, b: number, a: number,
    u0: number, v0: number, u1: number, v1: number,
    mode = 0, ax = 0, ay = 0, az = 0, rot = 0, aspect = 1, lit = 0,
    vm = false,
  ): void {
    const list = vm ? this.vmSprites : additive ? this.spritesAdd : this.spritesAlpha;
    const o = list.reserve(SPRITE_FLOATS);
    const d = list.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    d[o + 8] = u0; d[o + 9] = v0; d[o + 10] = u1; d[o + 11] = v1;
    d[o + 12] = ax; d[o + 13] = ay; d[o + 14] = az; d[o + 15] = mode;
    d[o + 16] = rot; d[o + 17] = aspect; d[o + 18] = lit; d[o + 19] = 0;
  }

  // Porta `geom` (geometria gerada pelo LevelMesh) deslocada/colorida.
  door(geom: number, ox: number, oy: number, oz: number, layer: number, r: number, g: number, b: number, glow: number): void {
    if (this.doorCount >= 64) return;
    const o = this.doorCount * 8;
    this.doorInst.set([ox, oy, oz, layer, r, g, b, glow], o);
    this.doorGeom[this.doorCount] = geom;
    this.doorCount++;
  }
}

export class Renderer {
  readonly device: GPUDevice;
  readonly gpu: GPUContext;
  readonly textures: TextureLoader;
  readonly uploader: ModelUploader;
  readonly queue = new RenderQueue();

  private readonly frameLayout: GPUBindGroupLayout;
  private readonly levelMatLayout: GPUBindGroupLayout;
  private readonly levelInstLayout: GPUBindGroupLayout;
  readonly materialLayout: GPUBindGroupLayout;
  private readonly meshInstLayout: GPUBindGroupLayout;
  private readonly skinInstLayout: GPUBindGroupLayout;
  private readonly spriteTexLayout: GPUBindGroupLayout;
  private readonly spriteInstLayout: GPUBindGroupLayout;

  private readonly levelPipeline: GPURenderPipeline;
  private readonly meshPipeline: GPURenderPipeline;
  private readonly skinPipeline: GPURenderPipeline;
  private readonly addPipeline: GPURenderPipeline;
  private readonly alphaPipeline: GPURenderPipeline;

  private readonly frameBuf: GPUBuffer;
  private readonly vmFrameBuf: GPUBuffer;
  private readonly dynLightBuf: GPUBuffer;
  private staticLightBuf: GPUBuffer | null = null;
  private cellLightBuf: GPUBuffer | null = null;
  private frameBG: GPUBindGroup | null = null;
  private vmFrameBG: GPUBindGroup | null = null;
  private readonly sampler: GPUSampler;
  private readonly frameData = new Float32Array(FRAME_SIZE / 4);

  // Mapa
  private levelVB: GPUBuffer | null = null;
  private levelIB: GPUBuffer | null = null;
  private levelIndexCount = 0;
  private doorVB: GPUBuffer | null = null;
  private doorIB: GPUBuffer | null = null;
  private doorRanges: { first: number; count: number }[] = [];
  private levelMatBG: GPUBindGroup | null = null;
  private levelInstBuf: GPUBuffer;
  private levelInstBG: GPUBindGroup;
  private grid: [number, number, number] = [1, 1, 2.5];

  // Buffers dinâmicos
  private meshInst: DynBuffer;
  private skinInst: DynBuffer;
  private boneBuf: DynBuffer;
  private addBuf: DynBuffer;
  private alphaBuf: DynBuffer;
  private vmInst: DynBuffer;
  private vmSpriteBuf: DynBuffer;
  private atlasBG: GPUBindGroup | null = null;

  private colorTex: GPUTexture | null = null;
  private depthTex: GPUTexture | null = null;
  private size: [number, number] = [0, 0];

  constructor(gpu: GPUContext) {
    this.gpu = gpu;
    const device = (this.device = gpu.device);
    this.textures = new TextureLoader(device);

    const V = GPUShaderStage.VERTEX, F = GPUShaderStage.FRAGMENT;
    this.frameLayout = device.createBindGroupLayout({
      label: "frame",
      entries: [
        { binding: 0, visibility: V | F, buffer: { type: "uniform" } },
        { binding: 1, visibility: F, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: F, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: F, buffer: { type: "read-only-storage" } },
        { binding: 4, visibility: F, sampler: { type: "filtering" } },
      ],
    });
    this.levelMatLayout = device.createBindGroupLayout({
      label: "level-mat",
      entries: [
        { binding: 0, visibility: F, texture: { viewDimension: "2d-array" } },
        { binding: 1, visibility: F, texture: { viewDimension: "2d-array" } },
        { binding: 2, visibility: F, buffer: { type: "uniform" } },
      ],
    });
    this.levelInstLayout = device.createBindGroupLayout({
      label: "level-inst",
      entries: [{ binding: 0, visibility: V, buffer: { type: "read-only-storage" } }],
    });
    this.materialLayout = device.createBindGroupLayout({
      label: "material",
      entries: [
        { binding: 0, visibility: F, texture: {} },
        { binding: 1, visibility: F, buffer: { type: "uniform" } },
      ],
    });
    this.meshInstLayout = device.createBindGroupLayout({
      label: "mesh-inst",
      entries: [{ binding: 0, visibility: V | F, buffer: { type: "read-only-storage" } }],
    });
    this.skinInstLayout = device.createBindGroupLayout({
      label: "skin-inst",
      entries: [
        { binding: 0, visibility: V | F, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: V, buffer: { type: "read-only-storage" } },
      ],
    });
    this.spriteTexLayout = device.createBindGroupLayout({
      label: "sprite-tex",
      entries: [{ binding: 0, visibility: F, texture: {} }],
    });
    this.spriteInstLayout = device.createBindGroupLayout({
      label: "sprite-inst",
      entries: [{ binding: 0, visibility: V | F, buffer: { type: "read-only-storage" } }],
    });
    this.uploader = new ModelUploader(device, this.textures, this.materialLayout);

    const format = gpu.format;
    const ms: GPUMultisampleState = { count: SAMPLES };
    const opaqueDepth: GPUDepthStencilState = { format: DEPTH, depthWriteEnabled: true, depthCompare: "less" };
    const module = (label: string, src: string) => device.createShaderModule({ label, code: commonSrc + "\n" + src });

    const levelMod = module("level", levelSrc);
    this.levelPipeline = device.createRenderPipeline({
      label: "level",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.frameLayout, this.levelMatLayout, this.levelInstLayout] }),
      vertex: {
        module: levelMod,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: LEVEL_VERTEX_FLOATS * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
              { shaderLocation: 2, offset: 24, format: "float32x4" },
              { shaderLocation: 3, offset: 40, format: "float32x2" },
              { shaderLocation: 4, offset: 48, format: "float32" },
              { shaderLocation: 5, offset: 52, format: "float32" },
            ],
          },
        ],
      },
      fragment: { module: levelMod, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "back", frontFace: "ccw" },
      depthStencil: opaqueDepth,
      multisample: ms,
    });

    const meshBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32x2" },
        ],
      },
    ];
    const meshMod = module("mesh", meshSrc);
    this.meshPipeline = device.createRenderPipeline({
      label: "mesh",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.frameLayout, this.materialLayout, this.meshInstLayout] }),
      vertex: { module: meshMod, entryPoint: "vs", buffers: meshBuffers },
      fragment: { module: meshMod, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: opaqueDepth,
      multisample: ms,
    });

    const skinMod = module("skinned", skinnedSrc);
    this.skinPipeline = device.createRenderPipeline({
      label: "skinned",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.frameLayout, this.materialLayout, this.skinInstLayout] }),
      vertex: {
        module: skinMod,
        entryPoint: "vs",
        buffers: [
          meshBuffers[0],
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 3, offset: 0, format: "uint16x4" },
              { shaderLocation: 4, offset: 8, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: { module: skinMod, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: opaqueDepth,
      multisample: ms,
    });

    const spriteMod = module("sprite", spriteSrc);
    const spriteLayout = device.createPipelineLayout({ bindGroupLayouts: [this.frameLayout, this.spriteTexLayout, this.spriteInstLayout] });
    const noWrite: GPUDepthStencilState = { format: DEPTH, depthWriteEnabled: false, depthCompare: "less" };
    this.addPipeline = device.createRenderPipeline({
      label: "sprite-add",
      layout: spriteLayout,
      vertex: { module: spriteMod, entryPoint: "vs" },
      fragment: {
        module: spriteMod,
        entryPoint: "fsAdd",
        targets: [{ format, blend: { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "zero", dstFactor: "one" } } }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: noWrite,
      multisample: ms,
    });
    this.alphaPipeline = device.createRenderPipeline({
      label: "sprite-alpha",
      layout: spriteLayout,
      vertex: { module: spriteMod, entryPoint: "vs" },
      fragment: {
        module: spriteMod,
        entryPoint: "fsAlpha",
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
              alpha: { srcFactor: "zero", dstFactor: "one" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: noWrite,
      multisample: ms,
    });

    this.frameBuf = device.createBuffer({ label: "frame", size: FRAME_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.vmFrameBuf = device.createBuffer({ label: "frame-vm", size: FRAME_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.dynLightBuf = device.createBuffer({ label: "dyn-lights", size: MAX_DYN_LIGHTS * LIGHT_FLOATS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.sampler = device.createSampler({
      label: "linear-repeat",
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      maxAnisotropy: 8,
    });

    this.levelInstBuf = device.createBuffer({ label: "level-inst", size: 65 * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.levelInstBG = device.createBindGroup({ layout: this.levelInstLayout, entries: [{ binding: 0, resource: { buffer: this.levelInstBuf } }] });

    this.meshInst = new DynBuffer(device, "mesh-inst");
    this.skinInst = new DynBuffer(device, "skin-inst");
    this.boneBuf = new DynBuffer(device, "bones");
    this.addBuf = new DynBuffer(device, "sprites-add");
    this.alphaBuf = new DynBuffer(device, "sprites-alpha");
    this.vmInst = new DynBuffer(device, "vm-inst");
    this.vmSpriteBuf = new DynBuffer(device, "vm-sprites");
  }

  // ---------------------------------------------------------- recursos
  setLevel(d: LevelGPUData): void {
    const { device } = this;
    const mk = (label: string, data: BufferSource & { byteLength: number }, usage: number) => {
      const b = device.createBuffer({ label, size: Math.max(16, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(b, 0, data);
      return b;
    };
    this.levelVB = mk("level-vb", d.vertices, GPUBufferUsage.VERTEX);
    this.levelIB = mk("level-ib", d.indices, GPUBufferUsage.INDEX);
    this.levelIndexCount = d.indices.length;
    this.doorVB = mk("door-vb", d.doorVertices, GPUBufferUsage.VERTEX);
    this.doorIB = mk("door-ib", d.doorIndices, GPUBufferUsage.INDEX);
    this.doorRanges = d.doorRanges;

    const albedo = this.textures.arrayFromBitmaps(d.albedo, true, "level-albedo");
    const normals = this.textures.arrayFromBitmaps(d.normals, false, "level-normals");
    const layerBuf = mk("layer-info", d.layerInfo, GPUBufferUsage.UNIFORM);
    this.levelMatBG = device.createBindGroup({
      layout: this.levelMatLayout,
      entries: [
        { binding: 0, resource: albedo.createView({ dimension: "2d-array" }) },
        { binding: 1, resource: normals.createView({ dimension: "2d-array" }) },
        { binding: 2, resource: { buffer: layerBuf } },
      ],
    });

    this.staticLightBuf = mk("static-lights", d.staticLights, GPUBufferUsage.STORAGE);
    this.cellLightBuf = mk("cell-lights", d.cellLights, GPUBufferUsage.STORAGE);
    this.grid = [d.gridW, d.gridH, d.cellSize];
    const bg = (buf: GPUBuffer) =>
      device.createBindGroup({
        layout: this.frameLayout,
        entries: [
          { binding: 0, resource: { buffer: buf } },
          { binding: 1, resource: { buffer: this.staticLightBuf! } },
          { binding: 2, resource: { buffer: this.dynLightBuf } },
          { binding: 3, resource: { buffer: this.cellLightBuf! } },
          { binding: 4, resource: this.sampler },
        ],
      });
    this.frameBG = bg(this.frameBuf);
    this.vmFrameBG = bg(this.vmFrameBuf);
  }

  // Atualiza algumas luzes estáticas (apagar luzes num susto).
  writeStaticLights(first: number, data: F32): void {
    if (this.staticLightBuf) this.device.queue.writeBuffer(this.staticLightBuf, first * LIGHT_FLOATS * 4, data);
  }

  setAtlas(tex: GPUTexture): void {
    this.atlasBG = this.device.createBindGroup({ layout: this.spriteTexLayout, entries: [{ binding: 0, resource: tex.createView() }] });
  }

  private ensureTargets(): void {
    const { width, height } = this.gpu.canvas;
    if (this.colorTex && this.size[0] === width && this.size[1] === height) return;
    this.colorTex?.destroy();
    this.depthTex?.destroy();
    this.colorTex = this.device.createTexture({ label: "msaa-color", size: [width, height], sampleCount: SAMPLES, format: this.gpu.format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.depthTex = this.device.createTexture({ label: "msaa-depth", size: [width, height], sampleCount: SAMPLES, format: DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.size = [width, height];
  }

  private writeFrame(buf: GPUBuffer, p: FrameParams, viewProj: Float32Array, flashScale = 1): void {
    const f = this.frameData;
    f.set(viewProj, 0);
    f.set([p.camPos[0], p.camPos[1], p.camPos[2], p.time], 16);
    f.set([p.fogColor[0], p.fogColor[1], p.fogColor[2], p.fogDensity], 20);
    f.set([p.flashPos[0], p.flashPos[1], p.flashPos[2], p.flashRange], 24);
    f.set([p.flashDir[0], p.flashDir[1], p.flashDir[2], p.flashCosOuter], 28);
    f.set([p.flashCosInner, p.flashOn ? p.flashIntensity * flashScale : 0, p.dynCount, p.exposure], 32);
    f.set([p.camRight[0], p.camRight[1], p.camRight[2], 0], 36);
    f.set([p.camUp[0], p.camUp[1], p.camUp[2], 0], 40);
    f.set([this.grid[0], this.grid[1], this.grid[2], p.ambientScale], 44);
    f.set(p.zoneAmbient.subarray(0, 32), 48);
    this.device.queue.writeBuffer(buf, 0, f);
  }

  // ------------------------------------------------------------- frame
  render(p: FrameParams): void {
    const { device } = this;
    const q = this.queue;
    this.ensureTargets();
    if (!this.frameBG || !this.levelMatBG || !this.atlasBG) return;

    this.writeFrame(this.frameBuf, p, p.viewProj);
    this.writeFrame(this.vmFrameBuf, p, p.vmViewProj, p.vmFlashScale);
    if (p.dynCount > 0) device.queue.writeBuffer(this.dynLightBuf, 0, p.dynLights, 0, p.dynCount * LIGHT_FLOATS);

    // Instâncias do mapa: 0 = estático; 1.. = portas.
    const li = new Float32Array((1 + q.doorCount) * 8);
    li.set([0, 0, 0, -1, 1, 1, 1, 0], 0);
    li.set(q.doorInst.subarray(0, q.doorCount * 8), 8);
    device.queue.writeBuffer(this.levelInstBuf, 0, li);

    // Junta as instâncias de todos os grupos num só buffer e anota onde
    // cada grupo começa (firstInstance no draw).
    const packGroups = (groups: Map<GPUModel, Group>, dyn: DynBuffer) => {
      let total = 0;
      for (const g of groups.values()) total += g.count;
      const all = dyn.cpu(total * INST_FLOATS);
      const draws: { g: Group; first: number }[] = [];
      let at = 0;
      for (const g of groups.values()) {
        if (!g.count) continue;
        all.set(g.inst.data.subarray(0, g.count * INST_FLOATS), at * INST_FLOATS);
        draws.push({ g, first: at });
        at += g.count;
      }
      dyn.upload(total * INST_FLOATS);
      return draws;
    };
    const meshDraws = packGroups(q.meshGroups, this.meshInst);
    const skinDraws = packGroups(q.skinGroups, this.skinInst);
    const vmDraws = packGroups(q.vmGroups, this.vmInst);
    this.boneBuf.cpu(q.bones.length).set(q.bones.data.subarray(0, q.bones.length));
    this.boneBuf.upload(q.bones.length);

    // Sprites alfa: do mais longe para o mais perto.
    const nAlpha = q.spritesAlpha.length / SPRITE_FLOATS;
    if (nAlpha > 1) sortSprites(q.spritesAlpha.data, nAlpha, p.camPos);
    this.alphaBuf.cpu(q.spritesAlpha.length).set(q.spritesAlpha.data.subarray(0, q.spritesAlpha.length));
    this.alphaBuf.upload(q.spritesAlpha.length);
    this.addBuf.cpu(q.spritesAdd.length).set(q.spritesAdd.data.subarray(0, q.spritesAdd.length));
    this.addBuf.upload(q.spritesAdd.length);
    this.vmSpriteBuf.cpu(q.vmSprites.length).set(q.vmSprites.data.subarray(0, q.vmSprites.length));
    this.vmSpriteBuf.upload(q.vmSprites.length);

    const enc = device.createCommandEncoder({ label: "frame" });
    const colorView = this.colorTex!.createView();
    const depthView = this.depthTex!.createView();

    // ------------------------------------------------ Pass 1: mundo
    const pass = enc.beginRenderPass({
      label: "world",
      colorAttachments: [{ view: colorView, clearValue: [p.clearColor[0], p.clearColor[1], p.clearColor[2], 1], loadOp: "clear", storeOp: "store" }],
      depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
    });
    pass.setBindGroup(0, this.frameBG);

    pass.setPipeline(this.levelPipeline);
    pass.setBindGroup(1, this.levelMatBG);
    pass.setBindGroup(2, this.levelInstBG);
    pass.setVertexBuffer(0, this.levelVB!);
    pass.setIndexBuffer(this.levelIB!, "uint32");
    pass.drawIndexed(this.levelIndexCount, 1, 0, 0, 0);
    if (q.doorCount > 0 && this.doorVB) {
      pass.setVertexBuffer(0, this.doorVB);
      pass.setIndexBuffer(this.doorIB!, "uint32");
      for (let i = 0; i < q.doorCount; i++) {
        const r = this.doorRanges[q.doorGeom[i]];
        if (r) pass.drawIndexed(r.count, 1, r.first, 0, 1 + i);
      }
    }

    if (meshDraws.length) {
      pass.setPipeline(this.meshPipeline);
      pass.setBindGroup(2, this.meshInst.bindGroup(this.meshInstLayout));
      for (const { g, first } of meshDraws) this.drawModel(pass, g.model, g.count, first);
    }
    if (skinDraws.length) {
      pass.setPipeline(this.skinPipeline);
      pass.setBindGroup(2, this.skinBindGroup());
      for (const { g, first } of skinDraws) this.drawModel(pass, g.model, g.count, first);
    }
    if (nAlpha > 0) {
      pass.setPipeline(this.alphaPipeline);
      pass.setBindGroup(1, this.atlasBG);
      pass.setBindGroup(2, this.alphaBuf.bindGroup(this.spriteInstLayout));
      pass.draw(6, nAlpha);
    }
    const nAdd = q.spritesAdd.length / SPRITE_FLOATS;
    if (nAdd > 0) {
      pass.setPipeline(this.addPipeline);
      pass.setBindGroup(1, this.atlasBG);
      pass.setBindGroup(2, this.addBuf.bindGroup(this.spriteInstLayout));
      pass.draw(6, nAdd);
    }
    pass.end();

    // ------------------------------------------ Pass 2: arma na mão
    const canvasView = this.gpu.context.getCurrentTexture().createView();
    const vm = enc.beginRenderPass({
      label: "viewmodel",
      colorAttachments: [{ view: colorView, resolveTarget: canvasView, loadOp: "load", storeOp: "discard" }],
      depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" },
    });
    vm.setBindGroup(0, this.vmFrameBG!);
    if (vmDraws.length) {
      vm.setPipeline(this.meshPipeline);
      vm.setBindGroup(2, this.vmInst.bindGroup(this.meshInstLayout));
      for (const { g, first } of vmDraws) this.drawModel(vm, g.model, g.count, first);
    }
    const nVmS = q.vmSprites.length / SPRITE_FLOATS;
    if (nVmS > 0) {
      vm.setPipeline(this.addPipeline);
      vm.setBindGroup(1, this.atlasBG);
      vm.setBindGroup(2, this.vmSpriteBuf.bindGroup(this.spriteInstLayout));
      vm.draw(6, nVmS);
    }
    vm.end();
    device.queue.submit([enc.finish()]);
  }

  private skinBG: GPUBindGroup | null = null;
  private skinBGKey: [GPUBuffer | null, GPUBuffer | null] = [null, null];
  private skinBindGroup(): GPUBindGroup {
    const a = this.skinInst.buffer, b = this.boneBuf.buffer;
    if (!this.skinBG || this.skinBGKey[0] !== a || this.skinBGKey[1] !== b) {
      this.skinBG = this.device.createBindGroup({
        layout: this.skinInstLayout,
        entries: [
          { binding: 0, resource: { buffer: a } },
          { binding: 1, resource: { buffer: b } },
        ],
      });
      this.skinBGKey = [a, b];
    }
    return this.skinBG;
  }

  private drawModel(pass: GPURenderPassEncoder, model: GPUModel, count: number, first: number): void {
    for (const prim of model.primitives) {
      pass.setBindGroup(1, prim.materialBindGroup);
      pass.setVertexBuffer(0, prim.vertexBuffer);
      if (model.skinned && prim.skinBuffer) pass.setVertexBuffer(1, prim.skinBuffer);
      pass.setIndexBuffer(prim.indexBuffer, "uint32");
      pass.drawIndexed(prim.indexCount, count, 0, 0, first);
    }
  }
}

// Storage buffer que cresce (dobra) quando precisa + cópia na CPU.
class DynBuffer {
  buffer: GPUBuffer;
  private data = new Float32Array(4096);
  private bg: GPUBindGroup | null = null;
  private bgLayout: GPUBindGroupLayout | null = null;

  constructor(private readonly device: GPUDevice, private readonly label: string) {
    this.buffer = device.createBuffer({ label, size: this.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  }

  cpu(floats: number): Float32Array {
    if (floats > this.data.length) {
      let cap = this.data.length;
      while (cap < floats) cap *= 2;
      this.data = new Float32Array(cap);
    }
    return this.data;
  }

  upload(floats: number): void {
    const bytes = Math.max(64, floats * 4);
    if (bytes > this.buffer.size) {
      this.buffer.destroy();
      let cap = this.buffer.size;
      while (cap < bytes) cap *= 2;
      this.buffer = this.device.createBuffer({ label: this.label, size: cap, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.bg = null;
    }
    if (floats > 0) this.device.queue.writeBuffer(this.buffer, 0, this.data, 0, floats);
  }

  bindGroup(layout: GPUBindGroupLayout): GPUBindGroup {
    if (!this.bg || this.bgLayout !== layout) {
      this.bg = this.device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.buffer } }] });
      this.bgLayout = layout;
    }
    return this.bg;
  }
}

// Ordena sprites (in-place) do mais distante para o mais próximo.
const sortScratch = { idx: new Uint32Array(0), dist: new Float32Array(0), copy: new Float32Array(0) };
function sortSprites(d: Float32Array, n: number, cam: [number, number, number]): void {
  if (sortScratch.idx.length < n) {
    sortScratch.idx = new Uint32Array(n * 2);
    sortScratch.dist = new Float32Array(n * 2);
  }
  if (sortScratch.copy.length < n * SPRITE_FLOATS) sortScratch.copy = new Float32Array(n * SPRITE_FLOATS * 2);
  const idx = sortScratch.idx, dist = sortScratch.dist, copy = sortScratch.copy;
  for (let i = 0; i < n; i++) {
    const o = i * SPRITE_FLOATS;
    const dx = d[o] - cam[0], dy = d[o + 1] - cam[1], dz = d[o + 2] - cam[2];
    dist[i] = dx * dx + dy * dy + dz * dz;
    idx[i] = i;
  }
  const arr = Array.from(idx.subarray(0, n)).sort((a, b) => dist[b] - dist[a]);
  copy.set(d.subarray(0, n * SPRITE_FLOATS));
  for (let i = 0; i < n; i++) d.set(copy.subarray(arr[i] * SPRITE_FLOATS, arr[i] * SPRITE_FLOATS + SPRITE_FLOATS), i * SPRITE_FLOATS);
}
