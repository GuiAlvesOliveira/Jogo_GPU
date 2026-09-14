// ============================================================
//  FRAGMENT SHADER — cube.frag.wgsl (ILUMINAÇÃO)
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por fragmento (pixel).
//
//  ENTRA:
//    - color: cor base da instância (interpolada).
//    - world_normal: normal da superfície em espaço de mundo.
//    - uniform Globals: luz ambiente + direcional.
//
//  MODELO DE ILUMINAÇÃO (simples, §23):
//    ambient  = luz ambiente constante (ilumina tudo um pouco)
//    diffuse  = max(dot(N, L), 0) * cor da luz  (Lambert)
//    final    = cor_base * (ambient + diffuse)
//
//  N (normal) é renormalizada aqui porque a interpolação entre
//  vértices pode encurtar o vetor. L é a direção para a luz.
// ============================================================

struct Globals {
  viewProj   : mat4x4<f32>,
  lightDir   : vec4<f32>,
  ambient    : vec4<f32>,
  lightColor : vec4<f32>,
};
@group(0) @binding(0) var<uniform> g : Globals;

struct FragmentInput {
  @location(0) color        : vec3<f32>,
  @location(1) world_normal : vec3<f32>,
};

@fragment
fn main(in : FragmentInput) -> @location(0) vec4<f32> {
  let N = normalize(in.world_normal);
  let L = normalize(g.lightDir.xyz);

  let diffuse = max(dot(N, L), 0.0);
  let lighting = g.ambient.rgb + g.lightColor.rgb * diffuse;

  return vec4<f32>(in.color * lighting, 1.0);
}
