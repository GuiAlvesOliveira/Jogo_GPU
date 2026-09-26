// ============================================================
//  sprite.wgsl — Partículas, clarões, raios e marcas (decals)
// ------------------------------------------------------------
//  Cada sprite é um quadrado (6 vértices gerados no próprio shader,
//  sem vertex buffer) posicionado conforme o MODO:
//    0 = billboard (sempre de frente para a câmera)
//    1 = deitado no chão (poças de sangue)
//    2 = feixe entre dois pontos (raios, rastros de bala)
//    3 = billboard só no eixo vertical (chamas)
//    4 = orientado por uma normal (marcas de bala nas paredes)
//  A textura é um ATLAS: uv = retângulo dentro dele.
//  Duas pipelines usam este shader: ADITIVA (fogo, faíscas, raios)
//  e ALFA (fumaça, sangue, marcas), sem escrever no depth buffer.
// ============================================================

struct Sprite {
  pos   : vec4<f32>, // xyz = posição (ou início do feixe), w = tamanho
  color : vec4<f32>, // rgba (a = opacidade)
  uv    : vec4<f32>, // retângulo no atlas: u0, v0, u1, v1
  axis  : vec4<f32>, // xyz = eixo/normal/fim do feixe, w = modo
  extra : vec4<f32>, // x = rotação, y = proporção largura/altura, z = iluminado (0/1)
};

@group(1) @binding(0) var atlas : texture_2d<f32>;
@group(2) @binding(0) var<storage, read> sprites : array<Sprite>;

struct VOut {
  @builtin(position) clip : vec4<f32>,
  @location(0) uv   : vec2<f32>,
  @location(1) wpos : vec3<f32>,
  @location(2) @interpolate(flat) ii : u32,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VOut {
  var corners = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
    vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  let s = sprites[ii];
  let c0 = corners[vi];
  let rot = s.extra.x;
  let cr = cos(rot);
  let sr = sin(rot);
  let c = vec2<f32>(c0.x * cr - c0.y * sr, c0.x * sr + c0.y * cr);
  let size = s.pos.w;
  let mode = i32(s.axis.w + 0.5);
  var wp = s.pos.xyz;
  if (mode == 0) {
    wp += (frame.camRight.xyz * c.x * s.extra.y + frame.camUp.xyz * c.y) * size;
  } else if (mode == 1) {
    wp += (vec3<f32>(1.0, 0.0, 0.0) * c.x + vec3<f32>(0.0, 0.0, 1.0) * c.y) * size + vec3<f32>(0.0, 0.015, 0.0);
  } else if (mode == 2) {
    let a = s.axis.xyz - s.pos.xyz;
    let len = length(a);
    let along = a / max(len, 0.0001);
    let center = s.pos.xyz + a * 0.5;
    let side = normalize(cross(along, frame.camPos.xyz - center));
    wp = center + along * c0.x * len * 0.5 + side * c0.y * size;
  } else if (mode == 3) {
    let toCam = frame.camPos.xyz - s.pos.xyz;
    let right = normalize(vec3<f32>(toCam.z, 0.0, -toCam.x));
    wp += right * c0.x * size * s.extra.y + vec3<f32>(0.0, 1.0, 0.0) * c0.y * size;
  } else {
    let n = normalize(s.axis.xyz);
    var t = cross(n, vec3<f32>(0.0, 1.0, 0.0));
    if (length(t) < 0.01) {
      t = vec3<f32>(1.0, 0.0, 0.0);
    }
    t = normalize(t);
    let b = cross(t, n);
    wp += (t * c.x + b * c.y) * size + n * 0.012;
  }
  var o : VOut;
  o.clip = frame.viewProj * vec4<f32>(wp, 1.0);
  let t01 = c0 * 0.5 + 0.5;
  o.uv = vec2<f32>(mix(s.uv.x, s.uv.z, t01.x), mix(s.uv.w, s.uv.y, t01.y));
  o.wpos = wp;
  o.ii = ii;
  return o;
}

// Aditivo: cor já em espaço de tela (sem luz), apagada pela neblina.
@fragment
fn fsAdd(in : VOut) -> @location(0) vec4<f32> {
  let s = sprites[in.ii];
  let t = textureSample(atlas, samp, in.uv);
  let a = t.a * s.color.a * fogFactor(in.wpos);
  let col = aces(t.rgb * s.color.rgb * a * frame.flashParams.w);
  return vec4<f32>(pow(col, vec3<f32>(1.0 / 2.2)), 0.0);
}

// Alfa: opcionalmente iluminado (sangue, fumaça e marcas recebem luz).
@fragment
fn fsAlpha(in : VOut) -> @location(0) vec4<f32> {
  let s = sprites[in.ii];
  let t = textureSample(atlas, samp, in.uv);
  var base = t.rgb * s.color.rgb;
  var col : vec3<f32>;
  if (s.extra.z > 0.5) {
    let N = normalize(frame.camPos.xyz - in.wpos);
    col = finish(shade(in.wpos, N, base, 0.1, 1.0, cellOf(in.wpos + N * 0.2), 0.0), in.wpos, in.clip.xy);
  } else {
    col = finish(base, in.wpos, in.clip.xy);
  }
  return vec4<f32>(col, t.a * s.color.a);
}
