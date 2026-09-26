// ============================================================
//  common.wgsl — Estruturas e ILUMINAÇÃO compartilhadas (GPU)
// ------------------------------------------------------------
//  Este trecho é concatenado no início de todos os shaders de
//  cena (mapa, modelos, personagens, sprites).
//
//  Modelo de luz (tudo por pixel, no fragment shader):
//    - ambiente da ZONA (muito baixo: o jogo é escuro);
//    - LANTERNA do jogador (spot light saindo da câmera);
//    - luzes ESTÁTICAS do mapa (tochas, lâmpadas, braseiros, lava):
//      cada célula da grade guarda a lista (pré-calculada na CPU,
//      com teste de visibilidade na grade) das luzes que a enxergam.
//      Assim a luz NÃO atravessa paredes, sem precisar de sombras;
//    - luzes DINÂMICAS (clarão do tiro, raios, brilho do abissal).
//  Depois: neblina exponencial, tone mapping (ACES) e gama.
// ============================================================

struct Frame {
  viewProj    : mat4x4<f32>,
  camPos      : vec4<f32>,   // xyz = câmera, w = tempo (s)
  fogColor    : vec4<f32>,   // rgb = cor da neblina, w = densidade
  flashPos    : vec4<f32>,   // xyz = origem da lanterna, w = alcance
  flashDir    : vec4<f32>,   // xyz = direção, w = cos(ângulo externo)
  flashParams : vec4<f32>,   // x = cos(ângulo interno), y = intensidade, z = nº luzes dinâmicas, w = exposição
  camRight    : vec4<f32>,
  camUp       : vec4<f32>,
  grid        : vec4<f32>,   // x = largura, y = altura (células), z = tamanho da célula, w = multiplicador do ambiente
  zoneAmbient : array<vec4<f32>, 8>,
};

// Luz pontual: posição+alcance, cor+intensidade, parâmetros de cintilação.
struct Light {
  posRange : vec4<f32>,
  color    : vec4<f32>,
  params   : vec4<f32>,  // x = quanto cintila (0..1), y = velocidade, z = fase
};

@group(0) @binding(0) var<uniform> frame : Frame;
@group(0) @binding(1) var<storage, read> staticLights : array<Light>;
@group(0) @binding(2) var<storage, read> dynLights : array<Light>;
@group(0) @binding(3) var<storage, read> cellLights : array<vec4<u32>>;
@group(0) @binding(4) var samp : sampler;

// Índice da célula da grade que contém o ponto p (ou -1 fora do mapa).
fn cellOf(p : vec3<f32>) -> i32 {
  let cx = i32(floor(p.x / frame.grid.z));
  let cz = i32(floor(p.z / frame.grid.z));
  if (cx < 0 || cz < 0 || cx >= i32(frame.grid.x) || cz >= i32(frame.grid.y)) {
    return -1;
  }
  return cz * i32(frame.grid.x) + cx;
}

fn flicker(l : Light) -> f32 {
  if (l.params.x <= 0.0) {
    return 1.0;
  }
  let t = frame.camPos.w * l.params.y + l.params.z;
  let n = sin(t) * 0.5 + sin(t * 2.37 + 1.3) * 0.3 + sin(t * 5.13 + 0.7) * 0.2;
  return 1.0 - l.params.x * (0.5 + 0.5 * n);
}

// Contribuição de UMA luz pontual (Lambert + especular Blinn-Phong).
fn pointLight(l : Light, P : vec3<f32>, N : vec3<f32>, V : vec3<f32>, albedo : vec3<f32>, spec : f32) -> vec3<f32> {
  let Lv = l.posRange.xyz - P;
  let d = length(Lv);
  if (d >= l.posRange.w) {
    return vec3<f32>(0.0);
  }
  let L = Lv / max(d, 0.0001);
  let x = clamp(1.0 - d / l.posRange.w, 0.0, 1.0);
  let att = x * x;
  let ndl = max(dot(N, L), 0.0);
  let H = normalize(L + V);
  let sp = pow(max(dot(N, H), 0.0), 28.0) * spec;
  return (albedo * ndl + vec3<f32>(sp)) * l.color.rgb * (l.color.w * att * flicker(l));
}

// Iluminação completa de um ponto de superfície.
//   cell = célula usada para achar as luzes estáticas e o ambiente.
fn shade(P : vec3<f32>, N : vec3<f32>, albedo : vec3<f32>, spec : f32, ao : f32, cell : i32, ambBoost : f32) -> vec3<f32> {
  let V = normalize(frame.camPos.xyz - P);
  var c = vec3<f32>(0.0);
  var zoneIdx = 0u;
  if (cell >= 0) {
    let a = cellLights[u32(cell) * 2u];
    let b = cellLights[u32(cell) * 2u + 1u];
    zoneIdx = b.w & 0xFFu;
    var packed = array<u32, 7>(a.x, a.y, a.z, a.w, b.x, b.y, b.z);
    for (var k = 0u; k < 7u; k++) {
      let pk = packed[k];
      let i0 = pk & 0xFFFFu;
      if (i0 == 0xFFFFu) {
        break;
      }
      c += pointLight(staticLights[i0], P, N, V, albedo, spec);
      let i1 = pk >> 16u;
      if (i1 == 0xFFFFu) {
        break;
      }
      c += pointLight(staticLights[i1], P, N, V, albedo, spec);
    }
  }
  // Ambiente da zona (hemisférico: um pouco mais de luz vinda de cima).
  let amb = frame.zoneAmbient[zoneIdx].rgb * frame.grid.w * (1.0 + ambBoost);
  c += albedo * amb * (0.7 + 0.3 * (N.y * 0.5 + 0.5));
  c *= ao;

  // Lanterna (spot light na câmera).
  if (frame.flashParams.y > 0.0) {
    let Lv = frame.flashPos.xyz - P;
    let d = length(Lv);
    let L = Lv / max(d, 0.0001);
    let cd = dot(-L, frame.flashDir.xyz);
    var cone = smoothstep(frame.flashDir.w, frame.flashParams.x, cd);
    cone *= 0.8 + 0.2 * smoothstep(frame.flashParams.x, 1.0, cd); // "hotspot" central
    let x = clamp(1.0 - d / frame.flashPos.w, 0.0, 1.0);
    let att = x * x / (1.0 + 0.03 * d * d);
    let ndl = max(dot(N, L), 0.0);
    let H = normalize(L + V);
    let sp = pow(max(dot(N, H), 0.0), 40.0) * spec;
    c += (albedo * ndl + vec3<f32>(sp)) * vec3<f32>(1.0, 0.94, 0.82) * (frame.flashParams.y * cone * att);
  }

  // Luzes dinâmicas (sem teste de parede: são pequenas e rápidas).
  let n = u32(frame.flashParams.z);
  for (var i = 0u; i < n; i++) {
    c += pointLight(dynLights[i], P, N, V, albedo, spec);
  }
  return c;
}

fn hash12(p : vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn aces(x : vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Neblina + tone mapping + gama + dithering (evita faixas no escuro).
fn finish(c : vec3<f32>, P : vec3<f32>, frag : vec2<f32>) -> vec3<f32> {
  let d = distance(P, frame.camPos.xyz);
  let f = 1.0 - exp(-frame.fogColor.w * d);
  var col = mix(c, frame.fogColor.rgb, clamp(f, 0.0, 1.0));
  col = aces(col * frame.flashParams.w);
  col = pow(col, vec3<f32>(1.0 / 2.2));
  col += (hash12(frag + vec2<f32>(frame.camPos.w * 61.0, 0.0)) - 0.5) / 255.0;
  return col;
}

fn fogFactor(P : vec3<f32>) -> f32 {
  let d = distance(P, frame.camPos.xyz);
  return clamp(exp(-frame.fogColor.w * d), 0.0, 1.0);
}
