import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// base relativa: funciona tanto em localhost quanto em GitHub Pages (/Jogo_GPU/)
// Duas páginas: a apresentação da aula (index.html, tela inicial) e o jogo (jogo.html).
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        apresentacao: fileURLToPath(new URL("./index.html", import.meta.url)),
        jogo: fileURLToPath(new URL("./jogo.html", import.meta.url)),
      },
    },
  },
});
