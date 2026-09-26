// ============================================================
//  GLB.ts — Leitor de modelos glTF binário (.glb), feito à mão (CPU)
// ------------------------------------------------------------
//  Um .glb tem um cabeçalho + 2 blocos ("chunks"):
//    1) JSON: descreve cenas, nós, malhas, materiais, esqueletos
//       (skins) e animações;
//    2) BIN: os dados crus (vértices, índices, matrizes, keyframes).
//  "Accessors" apontam fatias do BIN com tipo/quantidade.
//
//  Aqui só LEMOS e organizamos os dados na CPU. O envio para a GPU
//  (buffers de vértices, texturas) fica em render/ModelGPU.ts.
//
//  Suporta: malhas trianguladas com POSITION/NORMAL/TEXCOORD_0,
//  pele (JOINTS_0/WEIGHTS_0), materiais PBR básicos (cor base,
//  textura, emissão) e animações por nó (T/R/S, LINEAR/STEP).
// ============================================================

import * as mat4 from "../core/math/mat4";

export type F32 = Float32Array<ArrayBuffer>;
export type U32 = Uint32Array<ArrayBuffer>;

export interface GLBPrimitive {
  positions: F32;
  normals: F32;
  uvs: F32;
  joints: Uint16Array<ArrayBuffer> | null; // 4 por vértice
  weights: F32 | null; // 4 por vértice
  indices: U32;
  material: number;
}

export interface GLBMaterial {
  name: string;
  baseColor: [number, number, number, number];
  baseColorTexture: number; // índice de imagem, -1 = nenhuma
  emissive: [number, number, number];
}

export interface GLBNode {
  name: string;
  parent: number;
  children: number[];
  t: [number, number, number];
  r: [number, number, number, number];
  s: [number, number, number];
  mesh: number;
  skin: number;
}

export interface GLBSkin {
  joints: number[]; // índices de nós
  inverseBind: Float32Array; // 16 floats por junta
}

export interface GLBChannel {
  node: number;
  path: "translation" | "rotation" | "scale";
  times: Float32Array;
  values: Float32Array;
  step: boolean;
}

export interface GLBClip {
  name: string;
  duration: number;
  channels: GLBChannel[];
}

export interface GLBModel {
  nodes: GLBNode[];
  meshes: GLBPrimitive[][];
  materials: GLBMaterial[];
  images: ImageBitmap[];
  skins: GLBSkin[];
  clips: Map<string, GLBClip>;
  roots: number[];
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export async function loadGLB(url: string): Promise<GLBModel> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (${res.status})`);
  return parseGLB(await res.arrayBuffer(), url);
}

export async function parseGLB(buf: ArrayBuffer, label = "glb"): Promise<GLBModel> {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error(`${label}: não é um GLB`);
  // Chunk 0: JSON
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  // Chunk 1: BIN
  const binStart = 20 + jsonLen + 8;
  const binLen = dv.getUint32(20 + jsonLen, true);
  const bin = buf.slice(binStart, binStart + binLen);

  // --- accessor → array tipado (convertendo normalizados para float) ---
  const readAccessor = (index: number): { data: ArrayLike<number>; count: number; n: number; normalized: boolean; type: number } => {
    const a = json.accessors[index];
    const bv = json.bufferViews[a.bufferView];
    const n = COMPONENTS[a.type];
    const offset = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const ct = a.componentType as number;
    const size = ct === 5126 || ct === 5125 ? 4 : ct === 5123 || ct === 5122 ? 2 : 1;
    const stride = bv.byteStride ?? 0;
    const Ctor: any =
      ct === 5126 ? Float32Array : ct === 5125 ? Uint32Array : ct === 5123 ? Uint16Array : ct === 5122 ? Int16Array : ct === 5121 ? Uint8Array : Int8Array;
    let data: ArrayLike<number>;
    if (stride && stride !== n * size) {
      // Dados intercalados: copia elemento a elemento.
      const out = new Ctor(a.count * n);
      const view = new DataView(bin);
      for (let i = 0; i < a.count; i++) {
        for (let k = 0; k < n; k++) {
          const p = offset + i * stride + k * size;
          out[i * n + k] =
            ct === 5126 ? view.getFloat32(p, true) : ct === 5125 ? view.getUint32(p, true) : ct === 5123 ? view.getUint16(p, true) : ct === 5122 ? view.getInt16(p, true) : ct === 5121 ? view.getUint8(p) : view.getInt8(p);
        }
      }
      data = out;
    } else {
      data = new Ctor(bin, offset, a.count * n);
    }
    return { data, count: a.count, n, normalized: !!a.normalized, type: ct };
  };

  const toFloat = (acc: ReturnType<typeof readAccessor>): F32 => {
    const out = new Float32Array(acc.count * acc.n);
    const div = acc.normalized ? (acc.type === 5121 ? 255 : acc.type === 5123 ? 65535 : acc.type === 5120 ? 127 : acc.type === 5122 ? 32767 : 1) : 1;
    for (let i = 0; i < out.length; i++) out[i] = acc.data[i] / div;
    return out;
  };

  // --- imagens (PNG/JPEG embutidos) ---
  const images: ImageBitmap[] = await Promise.all(
    (json.images ?? []).map(async (img: any) => {
      const bv = json.bufferViews[img.bufferView];
      const bytes = new Uint8Array(bin, bv.byteOffset ?? 0, bv.byteLength);
      const blob = new Blob([bytes], { type: img.mimeType ?? "image/png" });
      return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    }),
  );

  // --- materiais ---
  const materials: GLBMaterial[] = (json.materials ?? []).map((m: any) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    const texIndex = pbr.baseColorTexture?.index;
    const strength = m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const e = m.emissiveFactor ?? [0, 0, 0];
    return {
      name: m.name ?? "",
      baseColor: (pbr.baseColorFactor ?? [1, 1, 1, 1]) as [number, number, number, number],
      baseColorTexture: texIndex !== undefined ? (json.textures[texIndex].source as number) : -1,
      emissive: [e[0] * strength, e[1] * strength, e[2] * strength] as [number, number, number],
    };
  });
  if (materials.length === 0) materials.push({ name: "default", baseColor: [1, 1, 1, 1], baseColorTexture: -1, emissive: [0, 0, 0] });

  // --- malhas ---
  const meshes: GLBPrimitive[][] = (json.meshes ?? []).map((mesh: any) =>
    mesh.primitives
      .filter((p: any) => p.mode === undefined || p.mode === 4)
      .map((p: any) => {
        const pos = toFloat(readAccessor(p.attributes.POSITION));
        const count = pos.length / 3;
        const nrm = p.attributes.NORMAL !== undefined ? toFloat(readAccessor(p.attributes.NORMAL)) : new Float32Array(count * 3).fill(0);
        const uv = p.attributes.TEXCOORD_0 !== undefined ? toFloat(readAccessor(p.attributes.TEXCOORD_0)) : new Float32Array(count * 2);
        let joints: Uint16Array<ArrayBuffer> | null = null;
        let weights: F32 | null = null;
        if (p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined) {
          const j = readAccessor(p.attributes.JOINTS_0);
          joints = new Uint16Array(count * 4);
          for (let i = 0; i < joints.length; i++) joints[i] = j.data[i];
          weights = toFloat(readAccessor(p.attributes.WEIGHTS_0));
          // Normaliza a soma dos pesos (alguns exportadores deixam ~0,99).
          for (let v = 0; v < count; v++) {
            const s = weights[v * 4] + weights[v * 4 + 1] + weights[v * 4 + 2] + weights[v * 4 + 3];
            if (s > 0) for (let k = 0; k < 4; k++) weights[v * 4 + k] /= s;
            else weights[v * 4] = 1;
          }
        }
        let indices: U32;
        if (p.indices !== undefined) {
          const ia = readAccessor(p.indices);
          indices = new Uint32Array(ia.count);
          for (let i = 0; i < ia.count; i++) indices[i] = ia.data[i];
        } else {
          indices = new Uint32Array(count);
          for (let i = 0; i < count; i++) indices[i] = i;
        }
        return { positions: pos, normals: nrm, uvs: uv, joints, weights, indices, material: p.material ?? 0 };
      }),
  );

  // --- nós (hierarquia + pose de repouso) ---
  const nodes: GLBNode[] = (json.nodes ?? []).map((n: any) => {
    let t: [number, number, number] = [0, 0, 0];
    let r: [number, number, number, number] = [0, 0, 0, 1];
    let s: [number, number, number] = [1, 1, 1];
    if (n.matrix) {
      // Decompõe a matriz (sem cisalhamento) em T/R/S.
      const m = n.matrix as number[];
      t = [m[12], m[13], m[14]];
      s = [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])];
      r = quatFromMatrix(m, s);
    } else {
      if (n.translation) t = n.translation;
      if (n.rotation) r = n.rotation;
      if (n.scale) s = n.scale;
    }
    return { name: n.name ?? "", parent: -1, children: n.children ?? [], t, r, s, mesh: n.mesh ?? -1, skin: n.skin ?? -1 };
  });
  nodes.forEach((n, i) => n.children.forEach((c) => (nodes[c].parent = i)));
  const scene = json.scenes?.[json.scene ?? 0];
  const roots: number[] = scene?.nodes ?? nodes.map((n, i) => (n.parent < 0 ? i : -1)).filter((i) => i >= 0);

  // --- esqueletos ---
  const skins: GLBSkin[] = (json.skins ?? []).map((s: any) => {
    const ibm = s.inverseBindMatrices !== undefined ? toFloat(readAccessor(s.inverseBindMatrices)) : null;
    const joints = s.joints as number[];
    const inv = new Float32Array(joints.length * 16);
    for (let i = 0; i < joints.length; i++) {
      if (ibm) inv.set(ibm.subarray(i * 16, i * 16 + 16), i * 16);
      else inv.set(mat4.create(), i * 16);
    }
    return { joints, inverseBind: inv };
  });

  // --- animações ---
  const clips = new Map<string, GLBClip>();
  for (const a of json.animations ?? []) {
    let duration = 0;
    const channels: GLBChannel[] = [];
    for (const ch of a.channels) {
      const path = ch.target.path;
      if (path !== "translation" && path !== "rotation" && path !== "scale") continue;
      const smp = a.samplers[ch.sampler];
      const times = toFloat(readAccessor(smp.input));
      let values = toFloat(readAccessor(smp.output));
      const n = path === "rotation" ? 4 : 3;
      if (smp.interpolation === "CUBICSPLINE") {
        // [tangenteEntrada, valor, tangenteSaída] por keyframe → fica só o valor.
        const v = new Float32Array(times.length * n);
        for (let k = 0; k < times.length; k++) v.set(values.subarray((k * 3 + 1) * n, (k * 3 + 2) * n), k * n);
        values = v;
      }
      duration = Math.max(duration, times[times.length - 1]);
      channels.push({ node: ch.target.node, path, times, values, step: smp.interpolation === "STEP" });
    }
    clips.set(a.name ?? `clip${clips.size}`, { name: a.name, duration, channels });
  }

  return { nodes, meshes, materials, images, skins, clips, roots };
}

function quatFromMatrix(m: number[], s: [number, number, number]): [number, number, number, number] {
  const m00 = m[0] / s[0], m01 = m[4] / s[1], m02 = m[8] / s[2];
  const m10 = m[1] / s[0], m11 = m[5] / s[1], m12 = m[9] / s[2];
  const m20 = m[2] / s[0], m21 = m[6] / s[1], m22 = m[10] / s[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const S = Math.sqrt(tr + 1) * 2;
    w = 0.25 * S; x = (m21 - m12) / S; y = (m02 - m20) / S; z = (m10 - m01) / S;
  } else if (m00 > m11 && m00 > m22) {
    const S = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / S; x = 0.25 * S; y = (m01 + m10) / S; z = (m02 + m20) / S;
  } else if (m11 > m22) {
    const S = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / S; x = (m01 + m10) / S; y = 0.25 * S; z = (m12 + m21) / S;
  } else {
    const S = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / S; x = (m02 + m20) / S; y = (m12 + m21) / S; z = 0.25 * S;
  }
  return [x, y, z, w];
}

// Matriz global (mundo do modelo) de cada nó na pose de repouso.
export function restGlobals(model: GLBModel): Float32Array {
  const out = new Float32Array(model.nodes.length * 16);
  const local = new Float32Array(16);
  const visit = (i: number, parentOffset: number) => {
    const n = model.nodes[i];
    mat4.fromTRSInto(local, 0, n.t[0], n.t[1], n.t[2], n.r[0], n.r[1], n.r[2], n.r[3], n.s[0], n.s[1], n.s[2]);
    if (parentOffset < 0) out.set(local, i * 16);
    else mat4.multiplyInto(out, out, local, parentOffset, 0, i * 16);
    for (const c of n.children) visit(c, i * 16);
  };
  for (const r of model.roots) visit(r, -1);
  return out;
}
