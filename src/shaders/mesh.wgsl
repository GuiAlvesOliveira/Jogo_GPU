// ============================================================
//  mesh.wgsl — Modelos ESTÁTICOS texturizados (armas, itens, cápsulas)
// ------------------------------------------------------------
//  INSTANCING: vários objetos do mesmo modelo num único draw call.
//  Cada instância (storage buffer) traz sua matriz model, uma cor
//  multiplicadora e parâmetros (emissivo, flash de dano, reforço de
//  ambiente, célula para iluminação).
// ============================================================

struct Inst {
  model  : mat4x4<f32>,
  tint   : vec4<f32>,
  params : vec4<f32>, // x = emissivo extra, y = flash branco, z = reforço do ambiente, w = célula (-1 = calcula)
};

struct Material {
  baseColor : vec4<f32>,
  emissive  : vec4<f32>,
};

@group(1) @binding(0) var baseTex : texture_2d<f32>;
@group(1) @binding(1) var<uniform> mat : Material;
@group(2) @binding(0) var<storage, read> insts : array<Inst>;

struct VIn {
  @location(0) pos : vec3<f32>,
  @location(1) nrm : vec3<f32>,
  @location(2) uv  : vec2<f32>,
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
  var o : VOut;
  let wp = inst.model * vec4<f32>(in.pos, 1.0);
  o.clip = frame.viewProj * wp;
  o.wpos = wp.xyz;
  o.nrm = (inst.model * vec4<f32>(in.nrm, 0.0)).xyz;
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
  var cell = i32(inst.params.w);
  if (inst.params.w < 0.0) {
    cell = cellOf(in.wpos + N * 0.2);
  }
  var c = shade(in.wpos, N, alb, 0.35, 1.0, cell, inst.params.z);
  c += mat.emissive.rgb + alb * inst.params.x;
  c = mix(c, vec3<f32>(1.0, 0.95, 0.9), inst.params.y);
  return vec4<f32>(finish(c, in.wpos, in.clip.xy), 1.0);
}
