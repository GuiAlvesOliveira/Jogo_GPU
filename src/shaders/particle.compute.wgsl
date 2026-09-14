// ============================================================
//  COMPUTE SHADER — particle.compute.wgsl
// ------------------------------------------------------------
//  Roda NA GPU: atualiza TODAS as partículas em paralelo, uma por
//  thread. É o exemplo típico de uso de compute shader do §24 —
//  a simulação (posição/velocidade/vida) acontece inteiramente na
//  GPU; a CPU só emite partículas novas e dispara este passo.
//
//  Buffer (read_write): array de Particle. Uniform: dt e gravidade.
//
//  Layout de Particle (48 bytes) — deve casar com o CPU:
//    pos(vec3) life(f32) | vel(vec3) size(f32) | color(vec3) maxLife(f32)
// ============================================================

struct Particle {
  pos     : vec3<f32>,
  life    : f32,
  vel     : vec3<f32>,
  size    : f32,
  color   : vec3<f32>,
  maxLife : f32,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;

struct Sim {
  dt      : f32,
  gravity : f32,
  _pad0   : f32,
  _pad1   : f32,
};
@group(0) @binding(1) var<uniform> sim : Sim;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&particles)) {
    return;
  }

  var p = particles[i];
  if (p.life <= 0.0) {
    return; // partícula morta: nada a fazer
  }

  // Integração explícita (Euler): vida decai, gravidade puxa, move-se.
  p.life = p.life - sim.dt;
  p.vel.y = p.vel.y - sim.gravity * sim.dt;
  p.pos = p.pos + p.vel * sim.dt;

  particles[i] = p;
}
