// ============================================================
//  gpu.ts — um único GPUDevice compartilhado pela apresentação
// ------------------------------------------------------------
//  Vários canvases (galeria 3D, capa, demo de normal map) usam o
//  mesmo device: cada um só configura o próprio GPUCanvasContext.
// ============================================================

export interface GPU {
  device: GPUDevice;
  format: GPUTextureFormat;
  adapterName: string;
}

let pending: Promise<GPU | null> | null = null;

export function getGPU(): Promise<GPU | null> {
  if (!pending) {
    pending = (async () => {
      if (!("gpu" in navigator) || !navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      device.lost.then(() => {
        pending = null;
      });
      const info = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info;
      const adapterName = info ? [info.vendor, info.architecture, info.description].filter(Boolean).join(" · ") : "";
      return { device, format: navigator.gpu.getPreferredCanvasFormat(), adapterName };
    })().catch((e) => {
      console.warn("WebGPU indisponível:", e);
      return null;
    });
  }
  return pending;
}

export const NO_GPU_HTML = `<div class="fallback"><div><b>WebGPU indisponível neste navegador.</b><br>Use Chrome ou Edge 113+ (ou Firefox com WebGPU ativado).<br><span class="dim">As imagens estáticas continuam disponíveis nos outros slides.</span></div></div>`;
