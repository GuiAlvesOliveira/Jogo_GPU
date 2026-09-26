// ============================================================
//  mat4.ts — Matrizes 4x4 (CPU)
// ------------------------------------------------------------
//  Matemática de matrizes rodando na CPU. São cálculos pequenos
//  (uma matriz por objeto/osso/câmera por frame), então fazê-los na
//  CPU é o correto — o trabalho PESADO e paralelo (multiplicar CADA
//  vértice pela matriz) acontece na GPU, dentro do vertex shader.
//
//  Convenção: COLUNA-MAJOR (column-major), igual ao WGSL/WebGPU.
//     | m0  m4  m8   m12 |
//     | m1  m5  m9   m13 |
//     | m2  m6  m10  m14 |
//     | m3  m7  m11  m15 |
//
//  IMPORTANTE: em WebGPU o espaço de clip tem Z em [0, 1].
//
//  Há versões "Into" que escrevem num array de saída já alocado:
//  usadas no caminho quente (animação de esqueletos, instâncias) para
//  não gerar lixo para o coletor a cada frame.
// ============================================================

export type Mat4 = Float32Array<ArrayBuffer>;
export type Vec3 = [number, number, number];

export function create(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function identity(): Mat4 {
  return create();
}

export function copy(out: Mat4, a: ArrayLike<number>): Mat4 {
  for (let i = 0; i < 16; i++) out[i] = a[i];
  return out;
}

// out = a * b (column-major). `out` pode ser o próprio `a` ou `b`.
export function multiplyInto(out: Float32Array, a: ArrayLike<number>, b: ArrayLike<number>, ao = 0, bo = 0, oo = 0): void {
  const a00 = a[ao], a01 = a[ao + 1], a02 = a[ao + 2], a03 = a[ao + 3];
  const a10 = a[ao + 4], a11 = a[ao + 5], a12 = a[ao + 6], a13 = a[ao + 7];
  const a20 = a[ao + 8], a21 = a[ao + 9], a22 = a[ao + 10], a23 = a[ao + 11];
  const a30 = a[ao + 12], a31 = a[ao + 13], a32 = a[ao + 14], a33 = a[ao + 15];
  for (let c = 0; c < 4; c++) {
    const b0 = b[bo + c * 4], b1 = b[bo + c * 4 + 1], b2 = b[bo + c * 4 + 2], b3 = b[bo + c * 4 + 3];
    out[oo + c * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[oo + c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[oo + c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[oo + c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  multiplyInto(out, a, b);
  return out;
}

export function translation(x: number, y: number, z: number): Mat4 {
  const m = create();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function scaling(x: number, y: number, z: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = x;
  m[5] = y;
  m[10] = z;
  m[15] = 1;
  return m;
}

export function rotationX(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = create();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function rotationY(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = create();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function rotationZ(rad: number): Mat4 {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = create();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

// Matriz a partir de translação, rotação (quaternion x,y,z,w) e escala.
export function fromTRSInto(
  out: Float32Array,
  o: number,
  tx: number, ty: number, tz: number,
  qx: number, qy: number, qz: number, qw: number,
  sx: number, sy: number, sz: number,
): void {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  out[o] = (1 - (yy + zz)) * sx;
  out[o + 1] = (xy + wz) * sx;
  out[o + 2] = (xz - wy) * sx;
  out[o + 3] = 0;
  out[o + 4] = (xy - wz) * sy;
  out[o + 5] = (1 - (xx + zz)) * sy;
  out[o + 6] = (yz + wx) * sy;
  out[o + 7] = 0;
  out[o + 8] = (xz + wy) * sz;
  out[o + 9] = (yz - wx) * sz;
  out[o + 10] = (1 - (xx + yy)) * sz;
  out[o + 11] = 0;
  out[o + 12] = tx;
  out[o + 13] = ty;
  out[o + 14] = tz;
  out[o + 15] = 1;
}

// Composição usada para entidades: T(pos) * Ry(yaw) * S(scale).
export function fromYawInto(out: Float32Array, o: number, x: number, y: number, z: number, yaw: number, s: number): void {
  const c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s;
  out[o] = c;
  out[o + 1] = 0;
  out[o + 2] = -sn;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = s;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = sn;
  out[o + 9] = 0;
  out[o + 10] = c;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

export function invert(a: ArrayLike<number>): Mat4 {
  const out = new Float32Array(16);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return create();
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

// Transforma um ponto (w=1).
export function transformPoint(m: ArrayLike<number>, x: number, y: number, z: number, o = 0): Vec3 {
  return [
    m[o] * x + m[o + 4] * y + m[o + 8] * z + m[o + 12],
    m[o + 1] * x + m[o + 5] * y + m[o + 9] * z + m[o + 13],
    m[o + 2] * x + m[o + 6] * y + m[o + 10] * z + m[o + 14],
  ];
}

// Projeção perspectiva (right-handed, Z de clip em [0, 1] p/ WebGPU).
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

// View matrix "olhando para" (right-handed).
export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx; m[3] = 0;
  m[4] = xy; m[5] = yy; m[6] = zy; m[7] = 0;
  m[8] = xz; m[9] = yz; m[10] = zz; m[11] = 0;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}

// Extrai os 6 planos do frustum de uma matriz viewProj (Z em [0,1]).
// Cada plano = [a, b, c, d] normalizado; ponto dentro se a*x+b*y+c*z+d >= 0.
export function frustumPlanes(m: ArrayLike<number>): Float32Array {
  const p = new Float32Array(24);
  const r = (i: number) => [m[i], m[i + 4], m[i + 8], m[i + 12]];
  const r0 = r(0), r1 = r(1), r2 = r(2), r3 = r(3);
  const planes = [
    [r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]],
    [r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]],
    [r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]],
    [r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]],
    [r2[0], r2[1], r2[2], r2[3]],
    [r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]],
  ];
  for (let i = 0; i < 6; i++) {
    const [a, b, c, d] = planes[i];
    const l = Math.hypot(a, b, c) || 1;
    p[i * 4] = a / l;
    p[i * 4 + 1] = b / l;
    p[i * 4 + 2] = c / l;
    p[i * 4 + 3] = d / l;
  }
  return p;
}

// Esfera (centro, raio) intersecta o frustum?
export function sphereInFrustum(planes: Float32Array, x: number, y: number, z: number, r: number): boolean {
  for (let i = 0; i < 6; i++) {
    if (planes[i * 4] * x + planes[i * 4 + 1] * y + planes[i * 4 + 2] * z + planes[i * 4 + 3] < -r) return false;
  }
  return true;
}
