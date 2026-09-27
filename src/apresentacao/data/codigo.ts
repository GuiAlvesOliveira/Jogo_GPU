// ============================================================
//  codigo.ts — o código-fonte do jogo embutido na apresentação
// ------------------------------------------------------------
//  import.meta.glob lê os arquivos NA HORA DO BUILD (Vite), então a
//  contagem de linhas e o explorador de código sempre refletem o
//  repositório atual. A própria apresentação fica de fora.
// ============================================================

import { langOf, type Lang } from "../highlight";

const RAW = import.meta.glob(
  ["/src/**/*.ts", "/src/**/*.wgsl", "/src/**/*.css", "!/src/apresentacao/**", "/tools/**/*.py", "/tools/README.md"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

export type Proc = "cpu" | "gpu" | "tool";

export interface SrcFile {
  path: string;
  dir: string;
  name: string;
  lang: Lang;
  lines: number;
  text: string;
  proc: Proc;
  header: string;
}

// Primeiro bloco de comentário do arquivo (o "cabeçalho didático").
function headerOf(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const l of lines) {
    const t = l.trim();
    if (t.startsWith("//") || t.startsWith("#")) {
      const c = t.replace(/^(\/\/|#)\s?/, "");
      if (/^[=\-]{6,}$/.test(c)) continue;
      out.push(c);
    } else if (out.length || t) break;
  }
  return out.join("\n").trim();
}

export const FILES: SrcFile[] = Object.entries(RAW)
  .map(([p, text]) => {
    const path = p.replace(/^\//, "");
    const i = path.lastIndexOf("/");
    const lang = langOf(path);
    const proc: Proc = path.startsWith("tools/") ? "tool" : lang === "wgsl" ? "gpu" : "cpu";
    return { path, dir: path.slice(0, i), name: path.slice(i + 1), lang, lines: text.split("\n").length, text, proc, header: headerOf(text) };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

export const FILE_BY_PATH: Record<string, SrcFile> = Object.fromEntries(FILES.map((f) => [f.path, f]));

export const LOC = {
  total: FILES.reduce((s, f) => s + f.lines, 0),
  ts: FILES.filter((f) => f.lang === "ts").reduce((s, f) => s + f.lines, 0),
  wgsl: FILES.filter((f) => f.lang === "wgsl").reduce((s, f) => s + f.lines, 0),
  py: FILES.filter((f) => f.lang === "py").reduce((s, f) => s + f.lines, 0),
  css: FILES.filter((f) => f.lang === "css").reduce((s, f) => s + f.lines, 0),
  files: FILES.length,
};

// Trecho de um arquivo entre dois marcadores (inclusive), para citar código real.
export function snippet(path: string, start: string | RegExp, end?: string | RegExp, maxLines = 40): { code: string; from: number } {
  const f = FILE_BY_PATH[path];
  if (!f) return { code: `// ${path} não encontrado`, from: 1 };
  const lines = f.text.split("\n");
  const match = (l: string, m: string | RegExp) => (typeof m === "string" ? l.includes(m) : m.test(l));
  let a = lines.findIndex((l) => match(l, start));
  if (a < 0) a = 0;
  let b = a + maxLines - 1;
  if (end) {
    const j = lines.findIndex((l, k) => k > a && match(l, end));
    if (j >= 0) b = j;
  }
  b = Math.min(b, lines.length - 1, a + maxLines - 1);
  return { code: lines.slice(a, b + 1).join("\n"), from: a + 1 };
}
