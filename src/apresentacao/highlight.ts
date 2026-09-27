// ============================================================
//  highlight.ts — realce de sintaxe simples (TS, WGSL, Python)
// ------------------------------------------------------------
//  Tokenizador por expressões regulares, suficiente para leitura
//  em sala. Gera uma linha HTML por linha de código (nenhum span
//  atravessa quebras de linha), o que permite numerar e destacar.
// ============================================================

import { esc } from "./dom";

export type Lang = "ts" | "wgsl" | "py" | "json" | "css" | "html" | "text";

const KW: Record<Lang, string[]> = {
  ts: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "class", "extends", "implements", "interface", "type", "enum", "export", "import", "from", "as", "async", "await", "try", "catch", "finally", "throw", "of", "in", "typeof", "instanceof", "readonly", "private", "public", "protected", "static", "get", "set", "this", "super", "null", "undefined", "true", "false", "void", "default", "declare", "keyof"],
  wgsl: ["fn", "let", "var", "const", "struct", "return", "if", "else", "for", "loop", "break", "continue", "switch", "case", "default", "discard", "true", "false", "override", "alias", "while"],
  py: ["def", "class", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "import", "from", "as", "with", "try", "except", "finally", "raise", "lambda", "None", "True", "False", "pass", "break", "continue", "global", "yield", "is", "del"],
  json: ["true", "false", "null"],
  css: [],
  html: [],
  text: [],
};

const TYPES: Record<Lang, string[]> = {
  ts: ["number", "string", "boolean", "Float32Array", "Uint32Array", "Uint16Array", "Int32Array", "Uint8Array", "Int16Array", "ArrayBuffer", "Promise", "Record", "Map", "Set", "GPUDevice", "GPUBuffer", "GPUTexture", "GPURenderPipeline", "GPUBindGroup", "GPUCommandEncoder", "GPURenderPassEncoder", "GPUAdapter", "GPUCanvasContext", "GPUSampler", "GPUTextureFormat", "GPUShaderModule", "GPUBindGroupLayout", "HTMLCanvasElement", "ImageBitmap", "AudioContext", "AudioNode", "GainNode", "OscillatorNode", "AnalyserNode"],
  wgsl: ["f32", "u32", "i32", "bool", "vec2", "vec3", "vec4", "mat4x4", "mat3x3", "array", "texture_2d", "texture_2d_array", "sampler", "atomic", "ptr", "uniform", "storage", "read", "read_write", "function", "private", "workgroup"],
  py: ["int", "float", "str", "list", "dict", "tuple", "set", "range", "len", "print", "open", "enumerate", "zip", "min", "max", "abs", "sorted"],
  json: [],
  css: [],
  html: [],
  text: [],
};

interface Rule {
  re: RegExp;
  cls: string | ((m: string) => string);
}

function rules(lang: Lang): Rule[] {
  const kw = new Set(KW[lang]);
  const ty = new Set(TYPES[lang]);
  const word = (m: string) => (kw.has(m) ? "tok-k" : ty.has(m) ? "tok-t" : "");
  if (lang === "py") {
    return [
      { re: /#[^\n]*/y, cls: "tok-c" },
      { re: /("""[\s\S]*?"""|'''[\s\S]*?''')/y, cls: "tok-s" },
      { re: /[rbfu]?("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/y, cls: "tok-s" },
      { re: /\b\d+(\.\d+)?([eE][-+]?\d+)?\b/y, cls: "tok-n" },
      { re: /@[A-Za-z_]\w*/y, cls: "tok-a" },
      { re: /[A-Za-z_]\w*(?=\s*\()/y, cls: (m) => word(m) || "tok-f" },
      { re: /[A-Za-z_]\w*/y, cls: word },
    ];
  }
  if (lang === "json") {
    return [
      { re: /"(?:\\.|[^"\\])*"(?=\s*:)/y, cls: "tok-t" },
      { re: /"(?:\\.|[^"\\])*"/y, cls: "tok-s" },
      { re: /-?\b\d+(\.\d+)?([eE][-+]?\d+)?\b/y, cls: "tok-n" },
      { re: /[A-Za-z_]\w*/y, cls: word },
    ];
  }
  if (lang === "css") {
    return [
      { re: /\/\*[\s\S]*?\*\//y, cls: "tok-c" },
      { re: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y, cls: "tok-s" },
      { re: /#[0-9a-fA-F]{3,8}\b/y, cls: "tok-n" },
      { re: /-?\b\d+(\.\d+)?(px|em|rem|%|s|ms|deg|vh|vw|fr)?\b/y, cls: "tok-n" },
      { re: /--[\w-]+/y, cls: "tok-a" },
      { re: /[a-z-]+(?=\s*:)/y, cls: "tok-t" },
      { re: /[.#][A-Za-z_][\w-]*/y, cls: "tok-f" },
      { re: /@[a-z-]+/y, cls: "tok-k" },
    ];
  }
  if (lang === "html") {
    return [
      { re: /<!--[\s\S]*?-->/y, cls: "tok-c" },
      { re: /<\/?[A-Za-z][\w-]*/y, cls: "tok-k" },
      { re: /"[^"\n]*"/y, cls: "tok-s" },
      { re: /[A-Za-z-]+(?==)/y, cls: "tok-t" },
    ];
  }
  if (lang === "text") return [];
  // ts e wgsl
  const r: Rule[] = [
    { re: /\/\/[^\n]*/y, cls: "tok-c" },
    { re: /\/\*[\s\S]*?\*\//y, cls: "tok-c" },
  ];
  if (lang === "ts") r.push({ re: /`(?:\\.|[^`\\])*`/y, cls: "tok-s" });
  r.push(
    { re: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y, cls: "tok-s" },
    { re: /\b0x[0-9a-fA-F]+[uif]?\b|\b\d+(\.\d+)?([eE][-+]?\d+)?[uif]?\b|\.\d+\b/y, cls: "tok-n" },
    { re: /@[A-Za-z_]\w*/y, cls: "tok-a" },
    { re: /[A-Za-z_$][\w$]*(?=\s*(<[^>\n]*>)?\s*\()/y, cls: (m) => word(m) || "tok-f" },
    { re: /[A-Za-z_$][\w$]*/y, cls: word },
  );
  return r;
}

// Devolve uma linha HTML por linha do código.
export function highlightLines(code: string, lang: Lang): string[] {
  const rs = rules(lang);
  const out: string[] = [];
  let cur = "";
  const push = (text: string, cls: string) => {
    const parts = text.split("\n");
    parts.forEach((p, k) => {
      if (k > 0) {
        out.push(cur);
        cur = "";
      }
      if (p) cur += cls ? `<span class="${cls}">${esc(p)}</span>` : esc(p);
    });
  };
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) push(plain, "");
    plain = "";
  };
  const src = code.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
  outer: while (i < src.length) {
    for (const rule of rs) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(src);
      if (m && m.index === i && m[0].length > 0) {
        flush();
        const cls = typeof rule.cls === "function" ? rule.cls(m[0]) : rule.cls;
        push(m[0], cls);
        i += m[0].length;
        continue outer;
      }
    }
    plain += src[i++];
  }
  flush();
  out.push(cur);
  return out;
}

export function langOf(path: string): Lang {
  if (path.endsWith(".wgsl")) return "wgsl";
  if (path.endsWith(".py")) return "py";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (/\.(ts|js|mjs)$/.test(path)) return "ts";
  return "text";
}

// <pre class="code"> com números de linha e linhas destacadas opcionais.
export function codeBlock(code: string, lang: Lang, opts: { from?: number; hl?: Set<number>; numbers?: boolean } = {}): string {
  const lines = highlightLines(code, lang);
  const from = opts.from ?? 1;
  const nums = opts.numbers ?? true;
  return `<pre class="code">${lines
    .map((l, k) => `<span class="line${opts.hl?.has(from + k) ? " hl" : ""}">${nums ? `<span class="ln">${from + k}</span>` : ""}${l || " "}</span>`)
    .join("")}</pre>`;
}
