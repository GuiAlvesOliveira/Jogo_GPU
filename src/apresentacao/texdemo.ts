// ============================================================
//  texdemo.ts — demonstração de NORMAL MAPPING em WebGPU
// ------------------------------------------------------------
//  Um retângulo com a textura de uma camada do mapa, iluminado por
//  uma luz pontual que segue o mouse. À esquerda da divisória a
//  normal é a da superfície plana; à direita vem do normal map
//  (espaço tangente → mundo), como em level.wgsl.
// ============================================================

import { TextureLoader, loadBitmap } from "../gpu/textures";
import { getGPU, type GPU } from "./gpu";
import { fitCanvas } from "./dom";

const WGSL = /* wgsl */ `
struct U {
  light  : vec4<f32>,  // xy = posição (0..1 da tela), z = altura, w = intensidade
  params : vec4<f32>,  // x = divisória (0..1), y = modo (0 luz, 1 cor, 2 normal), z = repetição, w = aspecto
};
@group(0) @binding(0) var<uniform> u : U;
@group(0) @binding(1) var albedo : texture_2d<f32>;
@group(0) @binding(2) var normalMap : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;

struct VOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };

@vertex fn vs(@builtin(vertex_index) i : u32) -> VOut {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  var o : VOut;
  o.pos = vec4<f32>(p[i], 0.0, 1.0);
  o.uv = vec2<f32>(p[i].x * 0.5 + 0.5, 0.5 - p[i].y * 0.5);
  return o;
}

fn aces(x : vec3<f32>) -> vec3<f32> {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment fn fs(i : VOut) -> @location(0) vec4<f32> {
  let tuv = vec2<f32>(i.uv.x * u.params.w, i.uv.y) * u.params.z;
  let alb = textureSample(albedo, samp, tuv).rgb;
  let nt = textureSample(normalMap, samp, tuv).xyz * 2.0 - 1.0;
  if (u.params.y > 1.5) { return vec4<f32>(nt * 0.5 + 0.5, 1.0); }
  if (u.params.y > 0.5) { return vec4<f32>(pow(alb, vec3<f32>(1.0 / 2.2)), 1.0); }
  // Superfície no plano da tela: T = +x, B = +v (para baixo), N0 = para o observador.
  let isFlat = i.uv.x < u.params.x;
  var N = normalize(vec3<f32>(nt.x, -nt.y, max(nt.z, 0.25)));
  if (isFlat) { N = vec3<f32>(0.0, 0.0, 1.0); }
  let P = vec3<f32>(i.uv.x * u.params.w, -i.uv.y, 0.0);
  let Lp = vec3<f32>(u.light.x * u.params.w, -u.light.y, u.light.z);
  let Lv = Lp - P;
  let d = length(Lv);
  let L = Lv / d;
  let att = 1.0 / (1.0 + 2.2 * d * d);
  let ndl = max(dot(N, L), 0.0);
  let H = normalize(L + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(dot(N, H), 0.0), 36.0) * 0.25;
  var c = (alb * ndl + vec3<f32>(spec)) * vec3<f32>(1.0, 0.8, 0.55) * u.light.w * att + alb * 0.03;
  c = pow(aces(c), vec3<f32>(1.0 / 2.2));
  // linha da divisória
  if (abs(i.uv.x - u.params.x) < 0.0015) { c = vec3<f32>(0.95, 0.65, 0.35); }
  return vec4<f32>(c, 1.0);
}
`;

interface Shared {
  gpu: GPU;
  pipe: GPURenderPipeline;
  textures: TextureLoader;
  sampler: GPUSampler;
  cache: Map<string, Promise<[GPUTexture, GPUTexture]>>;
}

let sharedP: Promise<Shared | null> | null = null;
function shared(): Promise<Shared | null> {
  if (!sharedP) {
    sharedP = getGPU().then((gpu) => {
      if (!gpu) return null;
      const mod = gpu.device.createShaderModule({ label: "normal-demo", code: WGSL });
      return {
        gpu,
        pipe: gpu.device.createRenderPipeline({
          label: "normal-demo",
          layout: "auto",
          vertex: { module: mod, entryPoint: "vs" },
          fragment: { module: mod, entryPoint: "fs", targets: [{ format: gpu.format }] },
        }),
        textures: new TextureLoader(gpu.device),
        sampler: gpu.device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "repeat", addressModeV: "repeat", maxAnisotropy: 8 }),
        cache: new Map(),
      };
    });
  }
  return sharedP;
}

export class NormalDemo {
  split = 0.5;
  mode = 0;
  light: [number, number] = [0.62, 0.4];
  height = 0.22;
  intensity = 1.6;
  tiling = 1.5;
  private sh: Shared | null = null;
  private ctx: GPUCanvasContext | null = null;
  private ubo!: GPUBuffer;
  private bg: GPUBindGroup | null = null;
  private data = new Float32Array(8);

  constructor(readonly canvas: HTMLCanvasElement) {}

  async init(): Promise<boolean> {
    this.sh = await shared();
    if (!this.sh) return false;
    this.ctx = this.canvas.getContext("webgpu");
    if (!this.ctx) return false;
    this.ctx.configure({ device: this.sh.gpu.device, format: this.sh.gpu.format, alphaMode: "opaque" });
    this.ubo = this.sh.gpu.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    return true;
  }

  async setLayer(name: string): Promise<void> {
    const sh = this.sh;
    if (!sh) return;
    let p = sh.cache.get(name);
    if (!p) {
      p = Promise.all([loadBitmap(`game/textures/L_${name}.jpg`), loadBitmap(`game/textures/N_${name}.jpg`)]).then(([a, n]) => [
        sh.textures.fromBitmap(a, true, `L_${name}`),
        sh.textures.fromBitmap(n, false, `N_${name}`),
      ]);
      sh.cache.set(name, p);
    }
    const [alb, nor] = await p;
    this.bg = sh.gpu.device.createBindGroup({
      layout: sh.pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.ubo } },
        { binding: 1, resource: alb.createView() },
        { binding: 2, resource: nor.createView() },
        { binding: 3, resource: sh.sampler },
      ],
    });
  }

  frame(t: number): void {
    const sh = this.sh;
    if (!sh || !this.ctx || !this.bg) return;
    const { w, h } = fitCanvas(this.canvas);
    const flick = 1 + 0.06 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23.7);
    this.data.set([this.light[0], this.light[1], this.height, this.intensity * flick, this.split, this.mode, this.tiling, w / h]);
    sh.gpu.device.queue.writeBuffer(this.ubo, 0, this.data);
    const enc = sh.gpu.device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(sh.pipe);
    pass.setBindGroup(0, this.bg);
    pass.draw(3);
    pass.end();
    sh.gpu.device.queue.submit([enc.finish()]);
  }
}
