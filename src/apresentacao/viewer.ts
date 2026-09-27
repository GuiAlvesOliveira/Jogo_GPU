// ============================================================
//  viewer.ts — visualizador 3D de GLB em WebGPU (apresentação)
// ------------------------------------------------------------
//  Reaproveita o código do JOGO para ler e enviar os modelos:
//    - assets/GLB.ts        (leitor de .glb feito à mão, CPU)
//    - render/ModelGPU.ts   (buffers de vértice/pele/índice, CPU→GPU)
//    - render/Animator.ts   (amostragem de clipes + matrizes de osso)
//  e acrescenta shaders próprios de inspeção: iluminação de estúdio,
//  arame (line-list), normais, e o ESQUELETO desenhado por cima com
//  segmentos expandidos em tela no vertex shader.
// ============================================================

import { parseGLB, type GLBModel } from "../assets/GLB";
import { ModelUploader, type GPUModel } from "../render/ModelGPU";
import { TextureLoader } from "../gpu/textures";
import { SkeletonDef, AnimState } from "../render/Animator";
import * as mat4 from "../core/math/mat4";
import { getGPU, type GPU } from "./gpu";
import { fitCanvas, type Cleanup } from "./dom";

const HEADER = /* wgsl */ `
struct U {
  viewProj : mat4x4<f32>,
  model    : mat4x4<f32>,
  cam      : vec4<f32>,   // xyz = câmera, w = tempo
  params   : vec4<f32>,   // x = modo (0 luz, 1 cor base, 2 normais), y = exposição
  light    : vec4<f32>,   // direção da luz principal
  screen   : vec4<f32>,   // largura, altura (px)
};
@group(0) @binding(0) var<uniform> u : U;
`;

const MESH_WGSL = HEADER + /* wgsl */ `
@group(0) @binding(1) var<storage, read> bones : array<mat4x4<f32>>;
@group(0) @binding(2) var samp : sampler;
struct Material { baseColor : vec4<f32>, emissive : vec4<f32> };
@group(1) @binding(0) var baseTex : texture_2d<f32>;
@group(1) @binding(1) var<uniform> mat : Material;

struct SIn { @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>, @location(2) uv : vec2<f32> };
struct KIn {
  @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>, @location(2) uv : vec2<f32>,
  @location(3) joints : vec4<u32>, @location(4) weights : vec4<f32>,
};
struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) wpos : vec3<f32>,
  @location(1) nrm : vec3<f32>,
  @location(2) uv : vec2<f32>,
};

fn outp(p : vec4<f32>, n : vec3<f32>, uv : vec2<f32>) -> VOut {
  var o : VOut;
  let wp = u.model * p;
  o.clip = u.viewProj * wp;
  o.wpos = wp.xyz;
  o.nrm = (u.model * vec4<f32>(n, 0.0)).xyz;
  o.uv = uv;
  return o;
}

@vertex fn vs_static(i : SIn) -> VOut {
  return outp(vec4<f32>(i.pos, 1.0), i.nrm, i.uv);
}

// Skinning: a mesma conta do jogo (skinned.wgsl).
@vertex fn vs_skin(i : KIn) -> VOut {
  let skin = bones[i.joints.x] * i.weights.x + bones[i.joints.y] * i.weights.y
           + bones[i.joints.z] * i.weights.z + bones[i.joints.w] * i.weights.w;
  return outp(skin * vec4<f32>(i.pos, 1.0), (skin * vec4<f32>(i.nrm, 0.0)).xyz, i.uv);
}

fn aces(x : vec3<f32>) -> vec3<f32> {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment fn fs_lit(i : VOut) -> @location(0) vec4<f32> {
  let tex = textureSample(baseTex, samp, i.uv);
  let alb = tex.rgb * mat.baseColor.rgb;
  var N = normalize(i.nrm);
  let V = normalize(u.cam.xyz - i.wpos);
  if (dot(N, V) < 0.0) { N = -N; }
  if (u.params.x > 1.5) { return vec4<f32>(N * 0.5 + 0.5, 1.0); }
  if (u.params.x > 0.5) { return vec4<f32>(pow(alb, vec3<f32>(1.0 / 2.2)), 1.0); }
  let L = normalize(u.light.xyz);
  let key = max(dot(N, L), 0.0) * vec3<f32>(1.0, 0.85, 0.68) * 2.4;
  let fill = max(dot(N, normalize(vec3<f32>(-0.7, 0.35, -0.4))), 0.0) * vec3<f32>(0.45, 0.6, 0.85) * 0.7;
  let amb = vec3<f32>(0.09, 0.1, 0.12) * (0.65 + 0.35 * N.y);
  let H = normalize(L + V);
  let spec = pow(max(dot(N, H), 0.0), 40.0) * 0.35;
  let rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * vec3<f32>(0.5, 0.75, 1.0) * 0.6;
  var c = alb * (amb + key + fill) + vec3<f32>(spec) + rim * (0.3 + alb) + mat.emissive.rgb;
  c = aces(c * u.params.y);
  return vec4<f32>(pow(c, vec3<f32>(1.0 / 2.2)), 1.0);
}

@fragment fn fs_wire(i : VOut) -> @location(0) vec4<f32> {
  return vec4<f32>(0.56, 0.82, 0.88, 0.45);
}
`;

const SEG_WGSL = HEADER + /* wgsl */ `
struct Seg { a : vec4<f32>, b : vec4<f32>, color : vec4<f32> };  // a.w = meia espessura (px)
@group(1) @binding(0) var<storage, read> segs : array<Seg>;
struct SOut { @builtin(position) clip : vec4<f32>, @location(0) @interpolate(flat) color : vec4<f32> };

// Cada segmento vira um retângulo de 6 vértices com espessura fixa em
// PIXELS: as pontas são projetadas e o deslocamento é feito na tela.
@vertex fn vs_seg(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> SOut {
  let s = segs[ii];
  var ends = array<f32, 6>(0.0, 1.0, 1.0, 0.0, 1.0, 0.0);
  var sides = array<f32, 6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  let e = ends[vi];
  let sd = sides[vi];
  let pa = u.viewProj * u.model * vec4<f32>(s.a.xyz, 1.0);
  let pb = u.viewProj * u.model * vec4<f32>(s.b.xyz, 1.0);
  let half = u.screen.xy * 0.5;
  var dir = (pb.xy / pb.w - pa.xy / pa.w) * half;
  let len = length(dir);
  let isPt = len < 0.5;
  if (isPt) { dir = vec2<f32>(1.0, 0.0); } else { dir = dir / len; }
  let nrm = vec2<f32>(-dir.y, dir.x);
  var p = mix(pa, pb, e);
  var off = nrm * sd * s.a.w;
  if (isPt) { off += dir * (e * 2.0 - 1.0) * s.a.w; }
  p = vec4<f32>(p.xy + off / half * p.w, p.z, p.w);
  var o : SOut;
  o.clip = p;
  o.color = s.color;
  return o;
}

@fragment fn fs_seg(i : SOut) -> @location(0) vec4<f32> {
  return i.color;
}
`;

const SAMPLES = 4;
const MAX_SEGS = 1024;
const SEG_FLOATS = 12;

export interface ModelStats {
  id: string;
  vertices: number;
  triangles: number;
  joints: number;
  clips: { name: string; duration: number }[];
  materials: string[];
  textures: string[];
  bytes: number;
  size: [number, number, number];
  primitives: number;
}

interface Loaded {
  id: string;
  glb: GLBModel;
  model: GPUModel;
  skel: SkeletonDef | null;
  edges: { buf: GPUBuffer; count: number }[];
  stats: ModelStats;
}

interface Shared {
  gpu: GPU;
  frameLayout: GPUBindGroupLayout;
  segLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  uploader: ModelUploader;
  pipes: Record<"static" | "skin" | "wireStatic" | "wireSkin" | "segTop" | "segDepth", GPURenderPipeline>;
  dummyBones: GPUBuffer;
  cache: Map<string, Promise<Loaded>>;
}

let sharedP: Promise<Shared | null> | null = null;

function getShared(): Promise<Shared | null> {
  if (!sharedP) {
    sharedP = getGPU().then((gpu) => {
      if (!gpu) return null;
      const { device, format } = gpu;
      const V = GPUShaderStage.VERTEX, F = GPUShaderStage.FRAGMENT;
      const frameLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: V | F, buffer: { type: "uniform" } },
          { binding: 1, visibility: V, buffer: { type: "read-only-storage" } },
          { binding: 2, visibility: F, sampler: { type: "filtering" } },
        ],
      });
      // Mesmo layout de material que o jogo usa (ModelUploader cria os bind groups).
      const matLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: F, texture: {} },
          { binding: 1, visibility: F, buffer: { type: "uniform" } },
        ],
      });
      const segLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: V, buffer: { type: "read-only-storage" } }] });
      const meshMod = device.createShaderModule({ label: "viewer-mesh", code: MESH_WGSL });
      const segMod = device.createShaderModule({ label: "viewer-seg", code: SEG_WGSL });
      const meshLayout = device.createPipelineLayout({ bindGroupLayouts: [frameLayout, matLayout] });
      const segPL = device.createPipelineLayout({ bindGroupLayouts: [frameLayout, segLayout] });
      const vb0: GPUVertexBufferLayout = {
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32x2" },
        ],
      };
      const vb1: GPUVertexBufferLayout = {
        arrayStride: 24,
        attributes: [
          { shaderLocation: 3, offset: 0, format: "uint16x4" },
          { shaderLocation: 4, offset: 8, format: "float32x4" },
        ],
      };
      const ms = { count: SAMPLES };
      const mk = (skin: boolean, wire: boolean): GPURenderPipeline =>
        device.createRenderPipeline({
          label: `viewer-${skin ? "skin" : "static"}${wire ? "-wire" : ""}`,
          layout: meshLayout,
          vertex: { module: meshMod, entryPoint: skin ? "vs_skin" : "vs_static", buffers: skin ? [vb0, vb1] : [vb0] },
          fragment: {
            module: meshMod,
            entryPoint: wire ? "fs_wire" : "fs_lit",
            // O arame é semitransparente para não esconder a superfície.
            targets: [wire ? { format, blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } } : { format }],
          },
          primitive: { topology: wire ? "line-list" : "triangle-list", cullMode: "none" },
          depthStencil: wire
            ? { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less-equal" }
            : { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less", depthBias: 2, depthBiasSlopeScale: 1.5 },
          multisample: ms,
        });
      const mkSeg = (top: boolean): GPURenderPipeline =>
        device.createRenderPipeline({
          label: `viewer-seg-${top ? "top" : "depth"}`,
          layout: segPL,
          vertex: { module: segMod, entryPoint: "vs_seg" },
          fragment: { module: segMod, entryPoint: "fs_seg", targets: [{ format }] },
          primitive: { topology: "triangle-list", cullMode: "none" },
          depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: top ? "always" : "less" },
          multisample: ms,
        });
      const textures = new TextureLoader(device);
      return {
        gpu,
        frameLayout,
        segLayout,
        sampler: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "repeat", addressModeV: "repeat", maxAnisotropy: 8 }),
        uploader: new ModelUploader(device, textures, matLayout),
        pipes: { static: mk(false, false), skin: mk(true, false), wireStatic: mk(false, true), wireSkin: mk(true, true), segTop: mkSeg(true), segDepth: mkSeg(false) },
        dummyBones: device.createBuffer({ size: 64 * 4, usage: GPUBufferUsage.STORAGE }),
        cache: new Map(),
      };
    });
  }
  return sharedP;
}

async function loadModel(sh: Shared, id: string): Promise<Loaded> {
  let p = sh.cache.get(id);
  if (!p) {
    p = (async () => {
      const res = await fetch(`game/models/${id}.glb`);
      if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const glb = await parseGLB(buf, id);
      const model = sh.uploader.upload(id, glb);
      const skel = glb.skins.length ? new SkeletonDef(glb) : null;
      // Arestas únicas de cada primitive (mesma ordem do ModelUploader).
      const edges: { buf: GPUBuffer; count: number }[] = [];
      let vertices = 0, triangles = 0, prims = 0;
      glb.nodes.forEach((node) => {
        if (node.mesh < 0) return;
        for (const prim of glb.meshes[node.mesh]) {
          prims++;
          vertices += prim.positions.length / 3;
          triangles += prim.indices.length / 3;
          const seen = new Set<number>();
          const out: number[] = [];
          const nv = prim.positions.length / 3;
          const idx = prim.indices;
          for (let t = 0; t < idx.length; t += 3) {
            for (let k = 0; k < 3; k++) {
              const a = idx[t + k], b = idx[t + ((k + 1) % 3)];
              const lo = Math.min(a, b), hi = Math.max(a, b);
              const key = lo * nv + hi;
              if (seen.has(key)) continue;
              seen.add(key);
              out.push(a, b);
            }
          }
          const arr = new Uint32Array(out);
          const eb = sh.gpu.device.createBuffer({ size: Math.max(4, arr.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
          sh.gpu.device.queue.writeBuffer(eb, 0, arr);
          edges.push({ buf: eb, count: arr.length });
        }
      });
      const stats: ModelStats = {
        id,
        vertices,
        triangles,
        joints: skel ? skel.jointCount : 0,
        clips: Array.from(glb.clips.values()).map((c) => ({ name: c.name, duration: c.duration })),
        materials: glb.materials.map((m) => m.name),
        textures: glb.images.map((im) => `${im.width}×${im.height}`),
        bytes: buf.byteLength,
        size: [model.max[0] - model.min[0], model.max[1] - model.min[1], model.max[2] - model.min[2]],
        primitives: prims,
      };
      return { id, glb, model, skel, edges, stats };
    })();
    sh.cache.set(id, p);
    p.catch(() => sh.cache.delete(id));
  }
  return p;
}

export type ViewMode = "lit" | "albedo" | "normals";
export type WireMode = "solid" | "both" | "wire";

export class ModelViewer {
  mode: ViewMode = "lit";
  wire: WireMode = "solid";
  skeleton = false;
  grid = true;
  autoRotate = true;
  speed = 1;
  playing = true;
  exposure = 1.1;
  yaw = 0.7;
  pitch = 0.18;
  dist = 3;
  zoom = 1;
  clip = "";
  onStats: ((s: ModelStats) => void) | null = null;

  private sh: Shared | null = null;
  private ctx: GPUCanvasContext | null = null;
  private cur: Loaded | null = null;
  private anim: AnimState | null = null;
  private ubo!: GPUBuffer;
  private boneBuf: GPUBuffer | null = null;
  private boneData = new Float32Array(16);
  private frameBG: GPUBindGroup | null = null;
  private segBuf!: GPUBuffer;
  private segBG!: GPUBindGroup;
  private segData = new Float32Array(MAX_SEGS * SEG_FLOATS);
  private color: GPUTexture | null = null;
  private depth: GPUTexture | null = null;
  private target: [number, number, number] = [0, 0.5, 0];
  private radius = 1;
  private floorY = 0;
  private time = 0;
  private holdTimer = 0;
  private loadToken = 0;
  private readonly uData = new Float32Array(48);

  constructor(readonly canvas: HTMLCanvasElement) {}

  async init(): Promise<boolean> {
    this.sh = await getShared();
    if (!this.sh) return false;
    const { device, format } = this.sh.gpu;
    this.ctx = this.canvas.getContext("webgpu");
    if (!this.ctx) return false;
    this.ctx.configure({ device, format, alphaMode: "opaque" });
    this.ubo = device.createBuffer({ size: this.uData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.segBuf = device.createBuffer({ size: this.segData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.segBG = device.createBindGroup({ layout: this.sh.segLayout, entries: [{ binding: 0, resource: { buffer: this.segBuf } }] });
    return true;
  }

  get stats(): ModelStats | null {
    return this.cur?.stats ?? null;
  }

  async show(id: string, opts: { yaw?: number; pitch?: number; clip?: string; frame?: number } = {}): Promise<ModelStats | null> {
    if (!this.sh) return null;
    const token = ++this.loadToken;
    const m = await loadModel(this.sh, id);
    if (token !== this.loadToken) return null;
    this.cur = m;
    const { min, max } = m.model;
    // frame: altura do alvo da câmera como fração da caixa (0,5 = centro).
    this.target = [(min[0] + max[0]) / 2, min[1] + (max[1] - min[1]) * (opts.frame ?? 0.5), (min[2] + max[2]) / 2];
    this.radius = Math.max(0.05, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    this.floorY = min[1];
    this.dist = this.radius * 2.6;
    this.zoom = 1;
    if (opts.yaw !== undefined) this.yaw = opts.yaw;
    if (opts.pitch !== undefined) this.pitch = opts.pitch;
    const { device } = this.sh.gpu;
    if (m.skel) {
      this.anim = new AnimState(m.skel);
      const need = m.skel.jointCount * 16;
      if (this.boneData.length < need) this.boneData = new Float32Array(need);
      if (!this.boneBuf || this.boneBuf.size < need * 4) {
        this.boneBuf?.destroy();
        this.boneBuf = device.createBuffer({ size: Math.max(256, need * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.frameBG = null;
      }
      const clips = m.stats.clips.map((c) => c.name);
      this.play(opts.clip && clips.includes(opts.clip) ? opts.clip : clips.includes("idle") ? "idle" : clips[0] ?? "");
    } else {
      this.anim = null;
      this.clip = "";
    }
    this.onStats?.(m.stats);
    return m.stats;
  }

  play(name: string): void {
    if (!this.anim || !name) return;
    this.clip = name;
    const once = name === "death" || name === "attack" || name === "hit";
    this.anim.play(name, { loop: !once, fade: 0.15, restart: true });
    this.holdTimer = 0;
  }

  private ensureTargets(w: number, h: number): void {
    const { device, format } = this.sh!.gpu;
    if (this.color && this.color.width === w && this.color.height === h) return;
    this.color?.destroy();
    this.depth?.destroy();
    this.color = device.createTexture({ size: [w, h], sampleCount: SAMPLES, format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.depth = device.createTexture({ size: [w, h], sampleCount: SAMPLES, format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }

  // Um frame: anima, calcula matrizes e desenha.
  frame(dt: number): void {
    const sh = this.sh;
    if (!sh || !this.ctx || !this.cur) return;
    const { device } = sh.gpu;
    const { w, h } = fitCanvas(this.canvas);
    if (w < 4 || h < 4) return;
    this.ensureTargets(w, h);
    this.time += dt;
    if (this.autoRotate) this.yaw += dt * 0.35;

    // --- esqueleto (CPU) → ossos (GPU)
    const m = this.cur;
    if (this.anim && m.skel) {
      if (this.playing) this.anim.update(dt * this.speed);
      if (this.anim.finished) {
        this.holdTimer += dt;
        if (this.holdTimer > 1.2) this.play(this.clip);
      }
      this.anim.writeBones(this.boneData, 0);
      device.queue.writeBuffer(this.boneBuf!, 0, this.boneData, 0, m.skel.jointCount * 16);
    }
    if (!this.frameBG) {
      this.frameBG = device.createBindGroup({
        layout: sh.frameLayout,
        entries: [
          { binding: 0, resource: { buffer: this.ubo } },
          { binding: 1, resource: { buffer: this.boneBuf ?? sh.dummyBones } },
          { binding: 2, resource: sh.sampler },
        ],
      });
    }
    const bg = m.skel ? this.frameBG : this.staticBG();

    // --- câmera orbital
    const d = this.dist * this.zoom;
    const cp = Math.cos(this.pitch);
    const eye: mat4.Vec3 = [this.target[0] + Math.sin(this.yaw) * cp * d, this.target[1] + Math.sin(this.pitch) * d, this.target[2] + Math.cos(this.yaw) * cp * d];
    const proj = mat4.perspective((38 * Math.PI) / 180, w / h, Math.max(0.005, d * 0.02), d * 20 + 10);
    const view = mat4.lookAt(eye, this.target, [0, 1, 0]);
    const vp = mat4.multiply(proj, view);
    const U = this.uData;
    U.set(vp, 0);
    U.set(mat4.identity(), 16);
    U.set([eye[0], eye[1], eye[2], this.time], 32);
    U.set([this.mode === "lit" ? 0 : this.mode === "albedo" ? 1 : 2, this.exposure, 0, 0], 36);
    const ly = 0.9, lx = Math.sin(this.yaw + 0.9), lz = Math.cos(this.yaw + 0.9);
    U.set([lx, ly, lz, 0], 40);
    U.set([w, h, 0, 0], 44);
    device.queue.writeBuffer(this.ubo, 0, U);

    // --- segmentos: grade do chão + ossos
    let n = 0;
    const seg = (a: number[], b: number[], half: number, c: number[]) => {
      if (n >= MAX_SEGS) return;
      this.segData.set([a[0], a[1], a[2], half, b[0], b[1], b[2], 0, c[0], c[1], c[2], 1], n * SEG_FLOATS);
      n++;
    };
    let gridN = 0;
    if (this.grid) {
      const step = this.radius > 1.2 ? 0.5 : this.radius > 0.35 ? 0.1 : 0.05;
      const ext = Math.ceil((this.radius * 1.6) / step) * step;
      const cx = Math.round(this.target[0] / step) * step, cz = Math.round(this.target[2] / step) * step;
      const y = this.floorY;
      for (let v = -ext; v <= ext + 1e-6; v += step) {
        const major = Math.abs(Math.round(v / step)) % 5 === 0;
        const c = major ? [0.22, 0.26, 0.3] : [0.14, 0.17, 0.2];
        seg([cx + v, y, cz - ext], [cx + v, y, cz + ext], 0.6, c);
        seg([cx - ext, y, cz + v], [cx + ext, y, cz + v], 0.6, c);
      }
      gridN = n;
    }
    if (this.skeleton && this.anim && m.skel) {
      const sk = m.skel;
      const isJoint = new Set(Array.from(sk.joints));
      for (let j = 0; j < sk.jointCount; j++) {
        const node = sk.joints[j];
        const p = this.anim.nodePosition(node);
        const par = m.glb.nodes[node].parent;
        if (par >= 0 && isJoint.has(par)) seg(this.anim.nodePosition(par), p, 1.6, [0.95, 0.65, 0.35]);
        seg(p, p, 3.2, [1.0, 0.85, 0.55]);
      }
    }
    if (n) device.queue.writeBuffer(this.segBuf, 0, this.segData, 0, n * SEG_FLOATS);

    // --- passe de render (MSAA 4x → resolve no canvas)
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.color!.createView(), resolveTarget: this.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "discard", clearValue: [0.047, 0.063, 0.078, 1] }],
      depthStencilAttachment: { view: this.depth!.createView(), depthLoadOp: "clear", depthStoreOp: "discard", depthClearValue: 1 },
    });
    pass.setBindGroup(0, bg);
    if (gridN) {
      pass.setPipeline(sh.pipes.segDepth);
      pass.setBindGroup(1, this.segBG);
      pass.draw(6, gridN, 0, 0);
    }
    const skinned = m.model.skinned;
    if (this.wire !== "wire") {
      pass.setPipeline(skinned ? sh.pipes.skin : sh.pipes.static);
      for (const prim of m.model.primitives) {
        pass.setBindGroup(1, prim.materialBindGroup);
        pass.setVertexBuffer(0, prim.vertexBuffer);
        if (skinned && prim.skinBuffer) pass.setVertexBuffer(1, prim.skinBuffer);
        pass.setIndexBuffer(prim.indexBuffer, "uint32");
        pass.drawIndexed(prim.indexCount);
      }
    }
    if (this.wire !== "solid") {
      pass.setPipeline(skinned ? sh.pipes.wireSkin : sh.pipes.wireStatic);
      m.model.primitives.forEach((prim, k) => {
        const e = m.edges[k];
        if (!e) return;
        pass.setBindGroup(1, prim.materialBindGroup);
        pass.setVertexBuffer(0, prim.vertexBuffer);
        if (skinned && prim.skinBuffer) pass.setVertexBuffer(1, prim.skinBuffer);
        pass.setIndexBuffer(e.buf, "uint32");
        pass.drawIndexed(e.count);
      });
    }
    if (n > gridN) {
      pass.setPipeline(sh.pipes.segTop);
      pass.setBindGroup(0, bg);
      pass.setBindGroup(1, this.segBG);
      pass.draw(6, n - gridN, 0, gridN);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  private staticBGCache: GPUBindGroup | null = null;
  private staticBG(): GPUBindGroup {
    if (!this.staticBGCache) {
      const sh = this.sh!;
      this.staticBGCache = sh.gpu.device.createBindGroup({
        layout: sh.frameLayout,
        entries: [
          { binding: 0, resource: { buffer: this.ubo } },
          { binding: 1, resource: { buffer: sh.dummyBones } },
          { binding: 2, resource: sh.sampler },
        ],
      });
    }
    return this.staticBGCache;
  }

  // Arrastar gira, roda aproxima, duplo clique volta ao início.
  bindControls(): Cleanup {
    const c = this.canvas;
    c.style.touchAction = "none";
    let drag: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
      this.autoRotate = false;
      c.dispatchEvent(new CustomEvent("viewer-autorotate", { detail: false }));
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.yaw -= (e.clientX - drag.x) * 0.01;
      this.pitch = Math.max(-1.2, Math.min(1.35, this.pitch + (e.clientY - drag.y) * 0.008));
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const up = () => (drag = null);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoom = Math.max(0.25, Math.min(4, this.zoom * Math.pow(1.12, Math.sign(e.deltaY))));
    };
    const dbl = () => {
      this.zoom = 1;
      this.pitch = 0.18;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", wheel, { passive: false });
    c.addEventListener("dblclick", dbl);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.removeEventListener("wheel", wheel);
      c.removeEventListener("dblclick", dbl);
    };
  }
}
