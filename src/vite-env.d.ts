/// <reference types="vite/client" />

// Permite importar arquivos .wgsl como string crua via `import src from './x.wgsl?raw'`.
declare module "*.wgsl?raw" {
  const src: string;
  export default src;
}
