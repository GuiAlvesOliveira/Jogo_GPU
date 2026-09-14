// ============================================================
//  mat4.ts — Matrizes 4x4 (CPU)
// ------------------------------------------------------------
//  Matemática de matrizes rodando na CPU. São cálculos pequenos
//  (uma matriz por objeto/câmera por frame), então fazê-los na CPU
//  é o correto — o trabalho PESADO e paralelo (multiplicar CADA
//  vértice pela matriz) acontece na GPU, dentro do vertex shader.
//
//  Convenção: COLUNA-MAJOR (column-major), igual ao WGSL/WebGPU.
//  Um Float32Array de 16 posições representa a matriz assim:
//     | m0  m4  m8   m12 |
//     | m1  m5  m9   m13 |
//     | m2  m6  m10  m14 |
//     | m3  m7  m11  m15 |
//
//  IMPORTANTE: em WebGPU o espaço de clip tem Z no intervalo [0, 1]
//  (diferente do OpenGL, que usa [-1, 1]). A projeção perspectiva
//  abaixo já mapeia para [0, 1].
// ============================================================

export type Mat4 = Float32Array<ArrayBuffer>;

// Matriz identidade.
export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

// Multiplicação de matrizes: out = a * b (column-major).
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// Multiplica uma cadeia de matrizes da esquerda p/ a direita:
// chain(A, B, C) = A * B * C.
export function chain(...mats: Mat4[]): Mat4 {
  let out = identity();
  for (const m of mats) out = multiply(out, m);
  return out;
}

// Translação.
export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

// Escala não-uniforme.
export function scaling(x: number, y: number, z: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = x;
  m[5] = y;
  m[10] = z;
  m[15] = 1;
  return m;
}

// Rotação em torno do eixo X.
export function rotationX(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

// Rotação em torno do eixo Y.
export function rotationY(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

// Projeção perspectiva (right-handed, Z de clip em [0, 1] p/ WebGPU).
//   fovY   — campo de visão vertical em radianos
//   aspect — largura / altura
//   near   — plano de corte próximo (> 0)
//   far    — plano de corte distante
export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[11] = -1;
  const nf = 1 / (near - far);
  m[10] = far * nf;
  m[14] = far * near * nf;
  return m;
}

// Câmera "olhando para": constrói a view matrix (right-handed).
//   eye    — posição da câmera [x, y, z]
//   target — ponto para onde ela olha
//   up     — vetor "para cima" (geralmente [0, 1, 0])
export function lookAt(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number],
): Mat4 {
  // z = normalize(eye - target)  (aponta para trás da câmera)
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;

  // x = normalize(cross(up, z))
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;

  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const m = new Float32Array(16);
  m[0] = xx;
  m[1] = yx;
  m[2] = zx;
  m[3] = 0;
  m[4] = xy;
  m[5] = yy;
  m[6] = zy;
  m[7] = 0;
  m[8] = xz;
  m[9] = yz;
  m[10] = zz;
  m[11] = 0;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}
