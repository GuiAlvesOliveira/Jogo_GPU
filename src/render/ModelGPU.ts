// ============================================================
//  ModelGPU.ts — Envia um modelo GLB (já lido na CPU) para a GPU
// ------------------------------------------------------------
//  Para cada "primitive" (parte da malha com um material):
//    - vertex buffer intercalado: posição(3) normal(3) uv(2) = 32 bytes;
//    - (personagens) buffer de pele: juntas uint16x4 + pesos float32x4;
//    - index buffer (uint32);
//    - bind group do material (textura + cores).
//
//  Modelos ESTÁTICOS têm as transformações dos nós "assadas" nos
//  vértices (a CPU aplica uma vez no carregamento). Personagens
//  mantêm os vértices em espaço de repouso: quem os move é o
//  esqueleto (skinning na GPU).
// ============================================================

import type { GLBModel } from "../assets/GLB";
import { restGlobals } from "../assets/GLB";
import { TextureLoader } from "../gpu/textures";

export interface GPUPrimitive {
  vertexBuffer: GPUBuffer;
  skinBuffer: GPUBuffer | null;
  indexBuffer: GPUBuffer;
  indexCount: number;
  materialBindGroup: GPUBindGroup;
}

export interface GPUModel {
  name: string;
  skinned: boolean;
  primitives: GPUPrimitive[];
  radius: number; // raio envolvente (culling)
  min: [number, number, number];
  max: [number, number, number];
}

export class ModelUploader {
  constructor(
    private readonly device: GPUDevice,
    private readonly textures: TextureLoader,
    private readonly materialLayout: GPUBindGroupLayout,
  ) {}

  private textureCache = new Map<ImageBitmap, GPUTexture>();

  materialBindGroup(tex: GPUTexture, baseColor: number[], emissive: number[]): GPUBindGroup {
    const ubo = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(ubo, 0, new Float32Array([...baseColor.slice(0, 4), emissive[0], emissive[1], emissive[2], 0]));
    return this.device.createBindGroup({
      layout: this.materialLayout,
      entries: [
        { binding: 0, resource: tex.createView() },
        { binding: 1, resource: { buffer: ubo } },
      ],
    });
  }

  upload(name: string, model: GLBModel, overrideTexture?: GPUTexture): GPUModel {
    const { device } = this;
    const skinned = model.skins.length > 0;
    const globals = restGlobals(model);
    const primitives: GPUPrimitive[] = [];
    const mn: [number, number, number] = [Infinity, Infinity, Infinity];
    const mx: [number, number, number] = [-Infinity, -Infinity, -Infinity];

    model.nodes.forEach((node, ni) => {
      if (node.mesh < 0) return;
      const g = globals.subarray(ni * 16, ni * 16 + 16);
      for (const prim of model.meshes[node.mesh]) {
        const count = prim.positions.length / 3;
        const v = new Float32Array(count * 8);
        for (let i = 0; i < count; i++) {
          let px = prim.positions[i * 3], py = prim.positions[i * 3 + 1], pz = prim.positions[i * 3 + 2];
          let nx = prim.normals[i * 3], ny = prim.normals[i * 3 + 1], nz = prim.normals[i * 3 + 2];
          if (!skinned) {
            // "Assa" a transformação do nó nos vértices.
            const x = g[0] * px + g[4] * py + g[8] * pz + g[12];
            const y = g[1] * px + g[5] * py + g[9] * pz + g[13];
            const z = g[2] * px + g[6] * py + g[10] * pz + g[14];
            px = x; py = y; pz = z;
            const a = g[0] * nx + g[4] * ny + g[8] * nz;
            const b = g[1] * nx + g[5] * ny + g[9] * nz;
            const c = g[2] * nx + g[6] * ny + g[10] * nz;
            const l = Math.hypot(a, b, c) || 1;
            nx = a / l; ny = b / l; nz = c / l;
          }
          v.set([px, py, pz, nx, ny, nz, prim.uvs[i * 2], prim.uvs[i * 2 + 1]], i * 8);
          if (px < mn[0]) mn[0] = px; if (py < mn[1]) mn[1] = py; if (pz < mn[2]) mn[2] = pz;
          if (px > mx[0]) mx[0] = px; if (py > mx[1]) mx[1] = py; if (pz > mx[2]) mx[2] = pz;
        }
        const vertexBuffer = device.createBuffer({ label: `${name}-vb`, size: v.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(vertexBuffer, 0, v);

        let skinBuffer: GPUBuffer | null = null;
        if (skinned && prim.joints && prim.weights) {
          // 24 bytes por vértice: 4 x uint16 (juntas) + 4 x float32 (pesos).
          const buf = new ArrayBuffer(count * 24);
          const u16 = new Uint16Array(buf);
          const f32 = new Float32Array(buf);
          for (let i = 0; i < count; i++) {
            for (let k = 0; k < 4; k++) {
              u16[i * 12 + k] = prim.joints[i * 4 + k];
              f32[i * 6 + 2 + k] = prim.weights[i * 4 + k];
            }
          }
          skinBuffer = device.createBuffer({ label: `${name}-skin`, size: buf.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
          device.queue.writeBuffer(skinBuffer, 0, buf);
        }

        const indexBuffer = device.createBuffer({ label: `${name}-ib`, size: prim.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(indexBuffer, 0, prim.indices);

        const mat = model.materials[prim.material] ?? model.materials[0];
        let tex: GPUTexture;
        if (overrideTexture) tex = overrideTexture;
        else if (mat.baseColorTexture >= 0) {
          const bmp = model.images[mat.baseColorTexture];
          let t = this.textureCache.get(bmp);
          if (!t) {
            t = this.textures.fromBitmap(bmp, true, `${name}-tex`);
            this.textureCache.set(bmp, t);
          }
          tex = t;
        } else tex = this.textures.whiteTexture();

        primitives.push({
          vertexBuffer,
          skinBuffer,
          indexBuffer,
          indexCount: prim.indices.length,
          materialBindGroup: this.materialBindGroup(tex, mat.baseColor, mat.emissive),
        });
      }
    });

    const radius = Math.max(Math.hypot(mn[0], mn[1], mn[2]), Math.hypot(mx[0], mx[1], mx[2]));
    return { name, skinned, primitives, radius, min: mn, max: mx };
  }

  // Cubo unitário (-0.5..0.5) com UV por face: chaves e marcadores.
  cube(name: string, color: number[], emissive: number[]): GPUModel {
    const { device } = this;
    const faces: [number[], number[], number[]][] = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const v: number[] = [];
    const idx: number[] = [];
    faces.forEach(([n, u, w], f) => {
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of corners) {
        v.push(
          n[0] * 0.5 + u[0] * a * 0.5 + w[0] * b * 0.5,
          n[1] * 0.5 + u[1] * a * 0.5 + w[1] * b * 0.5,
          n[2] * 0.5 + u[2] * a * 0.5 + w[2] * b * 0.5,
          n[0], n[1], n[2], (a + 1) / 2, (1 - b) / 2,
        );
      }
      idx.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
    });
    const vb = device.createBuffer({ size: v.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, new Float32Array(v));
    const ib = device.createBuffer({ size: idx.length * 4, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, new Uint32Array(idx));
    return {
      name,
      skinned: false,
      primitives: [{ vertexBuffer: vb, skinBuffer: null, indexBuffer: ib, indexCount: idx.length, materialBindGroup: this.materialBindGroup(this.textures.whiteTexture(), color, emissive) }],
      radius: 0.9,
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    };
  }
}
