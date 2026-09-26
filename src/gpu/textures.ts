// ============================================================
//  textures.ts — Upload de imagens para a GPU + mipmaps
// ------------------------------------------------------------
//  CPU: baixa/decodifica as imagens (createImageBitmap).
//  GPU: recebe os pixels (copyExternalImageToTexture) e GERA OS
//  MIPMAPS ela mesma: cada nível é desenhado a partir do anterior
//  com um "blit" (um triângulo em tela cheia que amostra a textura
//  com filtro linear). WebGPU não gera mipmaps sozinho.
//
//  Mipmaps evitam o "chiado" (aliasing) de texturas vistas de longe
//  ou em ângulo rasante — essencial para chão e paredes.
// ============================================================

const BLIT_WGSL = /* wgsl */ `
struct VOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i : u32) -> VOut {
  // Triângulo que cobre a tela inteira.
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  var o : VOut;
  o.pos = vec4(p[i], 0.0, 1.0);
  o.uv = vec2(p[i].x * 0.5 + 0.5, 0.5 - p[i].y * 0.5);
  return o;
}
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var smp : sampler;
@fragment fn fs(in : VOut) -> @location(0) vec4<f32> {
  return textureSampleLevel(src, smp, in.uv, 0.0);
}`;

export class TextureLoader {
  private readonly device: GPUDevice;
  private readonly module: GPUShaderModule;
  private readonly sampler: GPUSampler;
  private readonly pipelines = new Map<GPUTextureFormat, GPURenderPipeline>();
  private white: GPUTexture | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
    this.module = device.createShaderModule({ label: "mip-blit", code: BLIT_WGSL });
    this.sampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
  }

  private pipeline(format: GPUTextureFormat): GPURenderPipeline {
    let p = this.pipelines.get(format);
    if (!p) {
      p = this.device.createRenderPipeline({
        label: `mip-${format}`,
        layout: "auto",
        vertex: { module: this.module, entryPoint: "vs" },
        fragment: { module: this.module, entryPoint: "fs", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
      });
      this.pipelines.set(format, p);
    }
    return p;
  }

  static mipCount(w: number, h: number): number {
    return Math.floor(Math.log2(Math.max(w, h))) + 1;
  }

  // Gera os níveis 1..N de cada camada, cada um a partir do anterior.
  generateMips(tex: GPUTexture, layers = 1): void {
    const { device } = this;
    const pipe = this.pipeline(tex.format);
    const enc = device.createCommandEncoder({ label: "mipmaps" });
    for (let layer = 0; layer < layers; layer++) {
      for (let lvl = 1; lvl < tex.mipLevelCount; lvl++) {
        const src = tex.createView({ dimension: "2d", baseMipLevel: lvl - 1, mipLevelCount: 1, baseArrayLayer: layer, arrayLayerCount: 1 });
        const dst = tex.createView({ dimension: "2d", baseMipLevel: lvl, mipLevelCount: 1, baseArrayLayer: layer, arrayLayerCount: 1 });
        const bg = device.createBindGroup({
          layout: pipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: src },
            { binding: 1, resource: this.sampler },
          ],
        });
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: dst, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
        pass.setPipeline(pipe);
        pass.setBindGroup(0, bg);
        pass.draw(3);
        pass.end();
      }
    }
    device.queue.submit([enc.finish()]);
  }

  // Cria uma textura 2D (com mipmaps) a partir de um ImageBitmap.
  fromBitmap(bmp: ImageBitmap, srgb = true, label = "tex"): GPUTexture {
    const format: GPUTextureFormat = srgb ? "rgba8unorm-srgb" : "rgba8unorm";
    const tex = this.device.createTexture({
      label,
      size: [bmp.width, bmp.height],
      format,
      mipLevelCount: TextureLoader.mipCount(bmp.width, bmp.height),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [bmp.width, bmp.height]);
    this.generateMips(tex);
    return tex;
  }

  // Texture array: várias imagens do MESMO tamanho, uma por camada.
  arrayFromBitmaps(bmps: ImageBitmap[], srgb: boolean, label: string): GPUTexture {
    const w = bmps[0].width, h = bmps[0].height;
    const format: GPUTextureFormat = srgb ? "rgba8unorm-srgb" : "rgba8unorm";
    const tex = this.device.createTexture({
      label,
      size: [w, h, bmps.length],
      format,
      mipLevelCount: TextureLoader.mipCount(w, h),
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    bmps.forEach((b, i) => {
      this.device.queue.copyExternalImageToTexture({ source: b }, { texture: tex, origin: [0, 0, i] }, [w, h]);
    });
    this.generateMips(tex, bmps.length);
    return tex;
  }

  // Textura 1x1 branca (materiais sem imagem usam só a cor base).
  whiteTexture(): GPUTexture {
    if (!this.white) {
      this.white = this.device.createTexture({
        label: "white",
        size: [1, 1],
        format: "rgba8unorm-srgb",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      this.device.queue.writeTexture({ texture: this.white }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
    }
    return this.white;
  }
}

// Baixa e decodifica uma imagem (CPU). `flipY` não é necessário: tanto
// o glTF quanto o WebGPU usam a origem da UV no canto superior esquerdo.
export async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (${res.status})`);
  const blob = await res.blob();
  return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
}
