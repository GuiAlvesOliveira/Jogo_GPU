// ============================================================
//  level.wgsl — Geometria do MAPA (paredes, pisos, tetos, portas)
// ------------------------------------------------------------
//  Todas as superfícies do mapa usam TEXTURE ARRAYS: uma camada por
//  material (pedra, tijolo, madeira, lava...). Cada vértice diz qual
//  camada usar, então o mapa inteiro é desenhado em UM draw call.
//
//  Normal mapping: a normal do pixel vem da textura de normais,
//  convertida do espaço tangente (T, B, N) para o mundo.
//
//  Instâncias: o mapa estático é a instância 0 (sem deslocamento);
//  as PORTAS usam instâncias com deslocamento vertical (abrindo) e
//  cor (portas trancadas ganham a cor da chave).
// ============================================================

struct LevelInst {
  offset : vec4<f32>, // xyz = deslocamento, w = camada forçada (-1 = do vértice)
  tint   : vec4<f32>, // rgb = cor, a = brilho extra (emissivo)
};

@group(1) @binding(0) var albedoArr : texture_2d_array<f32>;
@group(1) @binding(1) var normalArr : texture_2d_array<f32>;
// x = emissivo, y/z = rolagem da UV (água/lava), w = especular
@group(1) @binding(2) var<uniform> layerInfo : array<vec4<f32>, 32>;
@group(2) @binding(0) var<storage, read> linst : array<LevelInst>;

struct VIn {
  @location(0) pos   : vec3<f32>,
  @location(1) nrm   : vec3<f32>,
  @location(2) tan   : vec4<f32>,
  @location(3) uv    : vec2<f32>,
  @location(4) layer : f32,
  @location(5) ao    : f32,
};

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) wpos : vec3<f32>,
  @location(1) nrm  : vec3<f32>,
  @location(2) tan  : vec4<f32>,
  @location(3) uv   : vec2<f32>,
  @location(4) @interpolate(flat) layer : i32,
  @location(5) ao   : f32,
  @location(6) tint : vec4<f32>,
};

@vertex
fn vs(in : VIn, @builtin(instance_index) ii : u32) -> VOut {
  let inst = linst[ii];
  var o : VOut;
  let wp = in.pos + inst.offset.xyz;
  o.clip = frame.viewProj * vec4<f32>(wp, 1.0);
  o.wpos = wp;
  o.nrm = in.nrm;
  o.tan = in.tan;
  o.uv = in.uv;
  o.layer = select(i32(in.layer + 0.5), i32(inst.offset.w + 0.5), inst.offset.w >= 0.0);
  o.ao = in.ao;
  o.tint = inst.tint;
  return o;
}

@fragment
fn fs(in : VOut) -> @location(0) vec4<f32> {
  let li = layerInfo[in.layer];
  let uv = in.uv + li.yz * frame.camPos.w;
  let alb = textureSample(albedoArr, samp, uv, in.layer).rgb * in.tint.rgb;
  let nt = textureSample(normalArr, samp, uv, in.layer).xyz * 2.0 - 1.0;
  let N0 = normalize(in.nrm);
  let T = normalize(in.tan.xyz);
  let B = cross(N0, T) * in.tan.w;
  let N = normalize(T * nt.x + B * nt.y + N0 * max(nt.z, 0.25));
  let cell = cellOf(in.wpos + N0 * 0.2);
  var c = shade(in.wpos, N, alb, li.w, in.ao, cell, 0.0);
  // Emissivo (lava pulsando) + brilho extra da instância.
  c += alb * (li.x * (0.8 + 0.2 * sin(frame.camPos.w * 1.7 + in.wpos.x * 0.6 + in.wpos.z * 0.4)) + in.tint.a);
  return vec4<f32>(finish(c, in.wpos, in.clip.xy), 1.0);
}
