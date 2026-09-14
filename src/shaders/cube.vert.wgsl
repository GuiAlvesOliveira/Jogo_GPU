// ============================================================
//  VERTEX SHADER — cube.vert.wgsl (INSTANCING + NORMAIS)
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por vértice de cada instância.
//
//  ENTRA:
//    - uniform Globals: viewProj (câmera) + parâmetros de luz
//      (group 0, binding 0). A luz é constante, usada no fragment.
//    - storage instances[]: model + cor de cada objeto (binding 1).
//    - position (vec3) e normal (vec3) do vértice do cubo.
//
//  CALCULA:
//    - clip = viewProj * model * position   (Model→View→Projection)
//    - normal em espaço de mundo = (model * vec4(normal, 0)).xyz
//      (w=0 ignora a translação). Isso é passado ao fragment shader,
//      que faz a iluminação por-pixel.
//
//  Obs.: usamos a própria model p/ girar a normal. Para as caixas do
//  mapa (escala + translação, sem rotação) e itens (rotação em Y) o
//  resultado é adequado; a normal é renormalizada no fragment.
// ============================================================

struct Globals {
  viewProj   : mat4x4<f32>,
  lightDir   : vec4<f32>, // direção PARA a luz (xyz)
  ambient    : vec4<f32>, // cor da luz ambiente (rgb)
  lightColor : vec4<f32>, // cor/intensidade da luz direcional (rgb)
};
@group(0) @binding(0) var<uniform> g : Globals;

struct Instance {
  model : mat4x4<f32>,
  color : vec4<f32>,
};
@group(0) @binding(1) var<storage, read> instances : array<Instance>;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal   : vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clip_position : vec4<f32>,
  @location(0)       color         : vec3<f32>,
  @location(1)       world_normal  : vec3<f32>,
};

@vertex
fn main(in : VertexInput, @builtin(instance_index) index : u32) -> VertexOutput {
  var out : VertexOutput;

  let inst = instances[index];

  let world = inst.model * vec4<f32>(in.position, 1.0);
  out.clip_position = g.viewProj * world;

  out.world_normal = (inst.model * vec4<f32>(in.normal, 0.0)).xyz;
  out.color = inst.color.rgb;

  return out;
}
