// Diff de linhas (LCS) para comparar o código de uma fase com a anterior.

export interface Op {
  t: "=" | "+" | "-";
  a: number; // linha no arquivo antigo (-1 se não existe)
  b: number; // linha no arquivo novo (-1 se não existe)
}

export function diffLines(a: string[], b: string[]): Op[] {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const n = a.length - s - e;
  const m = b.length - s - e;
  const W = m + 1;
  const dp = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[s + i] === b[s + j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    }
  }
  const ops: Op[] = [];
  for (let k = 0; k < s; k++) ops.push({ t: "=", a: k, b: k });
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[s + i] === b[s + j]) {
      ops.push({ t: "=", a: s + i, b: s + j });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i * W + j + 1] >= dp[(i + 1) * W + j])) {
      ops.push({ t: "+", a: -1, b: s + j });
      j++;
    } else {
      ops.push({ t: "-", a: s + i, b: -1 });
      i++;
    }
  }
  for (let k = 0; k < e; k++) ops.push({ t: "=", a: a.length - e + k, b: b.length - e + k });
  return ops;
}

export interface Hunk {
  ops: Op[];
  a0: number;
  b0: number;
}

// Agrupa em blocos com `ctx` linhas de contexto.
export function hunks(ops: Op[], ctx = 3): Hunk[] {
  const out: Hunk[] = [];
  const changed = ops.map((o) => o.t !== "=");
  let k = 0;
  while (k < ops.length) {
    while (k < ops.length && !changed[k]) k++;
    if (k >= ops.length) break;
    let start = Math.max(0, k - ctx);
    let end = k;
    for (;;) {
      while (end < ops.length && changed[end]) end++;
      let look = end;
      while (look < ops.length && !changed[look] && look - end < ctx * 2) look++;
      if (look < ops.length && changed[look]) end = look;
      else break;
    }
    const stop = Math.min(ops.length, end + ctx);
    if (out.length && start <= prevEnd(out)) start = prevEnd(out);
    const slice = ops.slice(start, stop);
    const firstA = slice.find((o) => o.a >= 0)?.a ?? 0;
    const firstB = slice.find((o) => o.b >= 0)?.b ?? 0;
    out.push({ ops: slice, a0: firstA, b0: firstB });
    (out[out.length - 1] as Hunk & { end?: number }).end = stop;
    k = stop;
  }
  return out;
}

function prevEnd(h: Hunk[]): number {
  return (h[h.length - 1] as Hunk & { end?: number }).end ?? 0;
}

export function stat(ops: Op[]): { add: number; del: number } {
  let add = 0, del = 0;
  for (const o of ops) {
    if (o.t === "+") add++;
    else if (o.t === "-") del++;
  }
  return { add, del };
}
