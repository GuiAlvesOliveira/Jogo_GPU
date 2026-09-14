// ============================================================
//  cube.ts — Geometria de um cubo unitário (dados na CPU)
// ------------------------------------------------------------
//  Cubo unitário centrado na origem (-0.5..0.5), reutilizado por
//  INSTANCING. Cada vértice agora carrega POSIÇÃO + NORMAL.
//
//  A normal é o vetor perpendicular à face, usado pela ILUMINAÇÃO
//  (FASE 15): o shader calcula quanto de luz a face recebe pela
//  relação entre a normal e a direção da luz (N·L). Antes usávamos
//  um "shade" fixo por face — agora é iluminação de verdade.
//
//  36 vértices (6 faces × 2 triângulos × 3), não-indexado, winding
//  anti-horário visto de fora (casa com cullMode:"back").
// ============================================================

export const CUBE_FLOATS_PER_VERTEX = 6; // x,y,z, nx,ny,nz

// prettier-ignore
export const CUBE_VERTICES = new Float32Array([
  // ---- face traseira (-z), normal (0,0,-1) ----
  -0.5, -0.5, -0.5,  0, 0, -1,   0.5,  0.5, -0.5,  0, 0, -1,   0.5, -0.5, -0.5,  0, 0, -1,
  -0.5, -0.5, -0.5,  0, 0, -1,  -0.5,  0.5, -0.5,  0, 0, -1,   0.5,  0.5, -0.5,  0, 0, -1,
  // ---- face frontal (+z), normal (0,0,1) ----
  -0.5, -0.5,  0.5,  0, 0,  1,   0.5, -0.5,  0.5,  0, 0,  1,   0.5,  0.5,  0.5,  0, 0,  1,
  -0.5, -0.5,  0.5,  0, 0,  1,   0.5,  0.5,  0.5,  0, 0,  1,  -0.5,  0.5,  0.5,  0, 0,  1,
  // ---- face esquerda (-x), normal (-1,0,0) ----
  -0.5, -0.5, -0.5, -1, 0,  0,  -0.5, -0.5,  0.5, -1, 0,  0,  -0.5,  0.5,  0.5, -1, 0,  0,
  -0.5, -0.5, -0.5, -1, 0,  0,  -0.5,  0.5,  0.5, -1, 0,  0,  -0.5,  0.5, -0.5, -1, 0,  0,
  // ---- face direita (+x), normal (1,0,0) ----
   0.5, -0.5, -0.5,  1, 0,  0,   0.5,  0.5, -0.5,  1, 0,  0,   0.5,  0.5,  0.5,  1, 0,  0,
   0.5, -0.5, -0.5,  1, 0,  0,   0.5,  0.5,  0.5,  1, 0,  0,   0.5, -0.5,  0.5,  1, 0,  0,
  // ---- face inferior (-y), normal (0,-1,0) ----
  -0.5, -0.5, -0.5,  0, -1, 0,   0.5, -0.5, -0.5,  0, -1, 0,   0.5, -0.5,  0.5,  0, -1, 0,
  -0.5, -0.5, -0.5,  0, -1, 0,   0.5, -0.5,  0.5,  0, -1, 0,  -0.5, -0.5,  0.5,  0, -1, 0,
  // ---- face superior (+y), normal (0,1,0) ----
  -0.5,  0.5, -0.5,  0,  1, 0,  -0.5,  0.5,  0.5,  0,  1, 0,   0.5,  0.5,  0.5,  0,  1, 0,
  -0.5,  0.5, -0.5,  0,  1, 0,   0.5,  0.5,  0.5,  0,  1, 0,   0.5,  0.5, -0.5,  0,  1, 0,
]);

export const CUBE_VERTEX_COUNT = CUBE_VERTICES.length / CUBE_FLOATS_PER_VERTEX; // 36
