// ============================================================
//  quat.ts — Quaternions (CPU)
// ------------------------------------------------------------
//  Usados na ANIMAÇÃO DE ESQUELETO: cada osso guarda sua rotação
//  como quaternion (x, y, z, w). Entre dois keyframes interpolamos
//  com SLERP (interpolação esférica), que mantém a velocidade de
//  giro constante e evita a "deformação" de interpolar matrizes.
// ============================================================

// Slerp entre (ax..aw) e (bx..bw) com peso t; escreve em out[o..o+3].
export function slerpInto(
  out: Float32Array,
  o: number,
  ax: number, ay: number, az: number, aw: number,
  bx: number, by: number, bz: number, bw: number,
  t: number,
): void {
  let cos = ax * bx + ay * by + az * bz + aw * bw;
  // Caminho mais curto: se o produto escalar é negativo, inverte um lado.
  if (cos < 0) {
    cos = -cos;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  let k0: number, k1: number;
  if (cos > 0.9995) {
    // Quase iguais: lerp normalizado é suficiente (e estável).
    k0 = 1 - t;
    k1 = t;
  } else {
    const ang = Math.acos(cos);
    const sin = Math.sin(ang);
    k0 = Math.sin((1 - t) * ang) / sin;
    k1 = Math.sin(t * ang) / sin;
  }
  let x = ax * k0 + bx * k1, y = ay * k0 + by * k1, z = az * k0 + bz * k1, w = aw * k0 + bw * k1;
  const l = Math.hypot(x, y, z, w) || 1;
  out[o] = x / l;
  out[o + 1] = y / l;
  out[o + 2] = z / l;
  out[o + 3] = w / l;
}
