// ============================================================
//  skinned.wgsl — Personagens com ESQUELETO (skinning na GPU)
// ------------------------------------------------------------
//  A CPU só calcula, por frame, uma matriz por OSSO (a pose da
//  animação). A GPU faz o trabalho pesado: cada VÉRTICE é deformado
//  pela média ponderada de até 4 ossos:
//
//     skin  = Σ peso_i * ossos[junta_i]
//     local = skin * posição
//     mundo = model * local
//
//  Todos os inimigos do mesmo tipo saem num único draw instanciado;
//  cada instância aponta para o início das suas matrizes de osso
//  (params.z) dentro de um grande storage buffer.
// ============================================================

struct Inst {
  model  : mat4x4<f32>,
  tint   : vec4<f32>,
  params : vec4<f32>, // x = emissivo extra, y = flash branco, z = 1º osso na paleta, w = célula
};

struct Material {
  baseColor : vec4<f32>,
  emissive  : vec4<f32>,
};

@group(1) @binding(0) var baseTex : texture_2d<f32>;
@group(1) @binding(1) var<uniform> mat : Material;
@group(2) @binding(0) var<storage, read> insts : array<Inst>;
@group(2) @binding(1) var<storage, read> bones : array<mat4x4<f32>>;

struct VIn {
  @location(0) pos     : vec3<f32>,
  @location(1) nrm     : vec3<f32>,
  @location(2) uv      : vec2<f32>,
  @location(3) joints  : vec4<u32>,
  @location(4) weights : vec4<f32>,
};

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) wpos : vec3<f32>,
  @location(1) nrm  : vec3<f32>,
  @location(2) uv   : vec2<f32>,
  @location(3) @interpolate(flat) ii : u32,
};

@vertex
fn vs(in : VIn, @builtin(instance_index) ii : u32) -> VOut {
  let inst = insts[ii];
  let base = u32(inst.params.z);
  let skin = bones[base + in.joints.x] * in.weights.x
           + bones[base + in.joints.y] * in.weights.y
           + bones[base + in.joints.z] * in.weights.z
           + bones[base + in.joints.w] * in.weights.w;
  let local = skin * vec4<f32>(in.pos, 1.0);
  let wp = inst.model * local;
  var o : VOut;
  o.clip = frame.viewProj * wp;
  o.wpos = wp.xyz;
  o.nrm = (inst.model * (skin * vec4<f32>(in.nrm, 0.0))).xyz;
  o.uv = in.uv;
  o.ii = ii;
  return o;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  let inst = insts[in.ii];
  let tex = textureSample(baseTex, samp, in.uv);
  let alb = tex.rgb * mat.baseColor.rgb * inst.tint.rgb;
  let N = normalize(in.nrm);
  var c = shade(in.wpos, N, alb, 0.3, 1.0, i32(inst.params.w), 0.0);
  // Emissivo do material (olhos brilhando) pulsa de leve.
  c += mat.emissive.rgb * (0.85 + 0.15 * sin(frame.camPos.w * 3.0)) + alb * inst.params.x;
  c = mix(c, vec3<f32>(1.0, 0.25, 0.2), inst.params.y);
  return vec4<f32>(finish(c, in.wpos, in.clip.xy), 1.0);
}
