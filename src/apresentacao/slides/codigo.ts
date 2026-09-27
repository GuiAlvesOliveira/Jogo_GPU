// Capítulo 13 — Explorador de código (todo o código do jogo, embutido no build).

import type { SlideDef } from "../deck";
import { esc, fmt } from "../dom";
import { FILES, FILE_BY_PATH, LOC } from "../data/codigo";
import { highlightLines } from "../highlight";
import { takePendingCode } from "./motor";

let current = "src/render/Renderer.ts";

export const codigo: SlideDef = {
  id: "codigo",
  title: "Explorador de código",
  lead: `Os ${LOC.files} arquivos do jogo e do pipeline (${fmt.n0(LOC.total)} linhas), lidos do repositório na hora do build. Busque por nome ou por conteúdo.`,
  body: () => {
    const dirs = Array.from(new Set(FILES.map((f) => f.dir)));
    return `
    <div class="cx fill">
      <div class="stack cx-side">
        <input type="search" class="cx-q" placeholder="buscar (ex.: pathField, skin, HRTF)" aria-label="Buscar no código">
        <div class="cx-tree scroll">${dirs
          .map(
            (d) => `<div class="cx-dir"><div class="h4">${esc(d)}</div>${FILES.filter((f) => f.dir === d)
              .map((f) => `<button type="button" data-p="${esc(f.path)}" class="${f.proc}"><span>${esc(f.name)}</span><small class="num">${f.lines}</small></button>`)
              .join("")}</div>`,
          )
          .join("")}</div>
      </div>
      <div class="cx-main">
        <div class="cx-head row"><b class="mono cx-path"></b><span class="spacer"></span><span class="tag cx-proc"></span><span class="mono small dim cx-lines"></span></div>
        <div class="cx-code scroll"></div>
      </div>
    </div>`;
  },
  init: (root) => {
    const code = root.querySelector(".cx-code") as HTMLElement;
    const q = root.querySelector(".cx-q") as HTMLInputElement;
    let query = "";
    const open = (path: string, line = 0) => {
      const f = FILE_BY_PATH[path];
      if (!f) return;
      current = path;
      root.querySelectorAll(".cx-tree button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.p === path));
      (root.querySelector(".cx-path") as HTMLElement).textContent = f.path;
      const proc = root.querySelector(".cx-proc") as HTMLElement;
      proc.className = `tag cx-proc ${f.proc === "tool" ? "" : f.proc}`;
      proc.textContent = f.proc === "tool" ? "offline" : f.proc.toUpperCase();
      (root.querySelector(".cx-lines") as HTMLElement).textContent = `${f.lines} linhas`;
      const lines = highlightLines(f.text, f.lang);
      const ql = query.toLowerCase();
      code.innerHTML = `<pre class="code">${lines
        .map((l, k) => {
          const raw = f.text.split("\n")[k] ?? "";
          const hit = ql && raw.toLowerCase().includes(ql);
          return `<span class="line${hit || k + 1 === line ? " hl" : ""}" data-ln="${k + 1}"><span class="ln">${k + 1}</span>${l || " "}</span>`;
        })
        .join("")}</pre>`;
      const first = line ? code.querySelector(`[data-ln="${line}"]`) : code.querySelector(".line.hl");
      code.scrollTop = first ? (first as HTMLElement).offsetTop - 60 : 0;
    };
    root.querySelector(".cx-tree")!.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button[data-p]") as HTMLElement | null;
      if (b) open(b.dataset.p!);
    });
    q.addEventListener("input", () => {
      query = q.value.trim();
      const ql = query.toLowerCase();
      root.querySelectorAll(".cx-tree button").forEach((b) => {
        const f = FILE_BY_PATH[(b as HTMLElement).dataset.p!];
        const match = !ql || f.path.toLowerCase().includes(ql) || f.text.toLowerCase().includes(ql);
        (b as HTMLElement).hidden = !match;
      });
      root.querySelectorAll(".cx-dir").forEach((d) => ((d as HTMLElement).hidden = !d.querySelector("button:not([hidden])")));
      open(current);
    });
    window.addEventListener("open-code", (e) => {
      const [p, l] = String((e as CustomEvent).detail).split("#");
      open(p, Number(l) || 0);
    });
    const pending = takePendingCode();
    if (pending) {
      const [p, l] = pending.split("#");
      open(p, Number(l) || 0);
    } else open(current);
  },
};
