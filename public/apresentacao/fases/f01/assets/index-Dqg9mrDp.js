var f=Object.defineProperty;var p=(a,e,r)=>e in a?f(a,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):a[e]=r;var i=(a,e,r)=>p(a,typeof e!="symbol"?e+"":e,r);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))o(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function r(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerPolicy&&(n.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?n.credentials="include":t.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(t){if(t.ep)return;t.ep=!0;const n=r(t);fetch(t.href,n)}})();class c{constructor(e,r,o,t,n){i(this,"adapter");i(this,"device");i(this,"context");i(this,"canvas");i(this,"format");this.adapter=e,this.device=r,this.context=o,this.canvas=t,this.format=n}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const r=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!r)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const o=await r.requestDevice();o.lost.then(s=>{console.error(`GPUDevice perdido: ${s.reason??"desconhecido"} — ${s.message}`)});const t=e.getContext("webgpu");if(!t)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const n=navigator.gpu.getPreferredCanvasFormat();return t.configure({device:o,format:n,alphaMode:"opaque"}),new c(r,o,t,e,n)}resize(){const e=window.devicePixelRatio||1,r=Math.max(1,Math.floor(this.canvas.clientWidth*e)),o=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==r||this.canvas.height!==o)&&(this.canvas.width=r,this.canvas.height=o)}}const v=`// ============================================================
//  VERTEX SHADER — triangle.vert.wgsl
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por vértice.
//
//  ENTRA (vindo do vertex buffer, preenchido pela CPU):
//    - position: posição 2D do vértice no espaço de clip.
//    - color:    cor RGB do vértice.
//
//  SAI (interpolado pela GPU antes de chegar ao fragment shader):
//    - @builtin(position): posição final em clip space (obrigatória).
//    - color:              cor repassada ao fragment shader.
//
//  Nesta FASE 1 ainda NÃO há matrizes Model/View/Projection.
//  As posições já estão em clip space (intervalo -1..1), então o
//  vertex shader apenas as repassa. As matrizes chegam na FASE 2.
// ============================================================

// Dados de um vértice, exatamente no layout do vertex buffer.
struct VertexInput {
  @location(0) position : vec2<f32>,  // x, y em clip space
  @location(1) color    : vec3<f32>,  // r, g, b
};

// Dados que saem do vertex shader e entram no fragment shader.
struct VertexOutput {
  @builtin(position) clip_position : vec4<f32>,  // posição obrigatória
  @location(0)       color         : vec3<f32>,  // cor interpolada
};

@vertex
fn main(in : VertexInput) -> VertexOutput {
  var out : VertexOutput;

  // Converte a posição 2D em vec4 (z = 0, w = 1).
  out.clip_position = vec4<f32>(in.position, 0.0, 1.0);

  // Repassa a cor; a GPU a interpola entre os três vértices.
  out.color = in.color;

  return out;
}
`,m=`// ============================================================
//  FRAGMENT SHADER — triangle.frag.wgsl
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por fragmento (≈ pixel coberto
//  pelo triângulo).
//
//  ENTRA (vindo interpolado do vertex shader):
//    - color: cor RGB interpolada entre os vértices.
//
//  SAI:
//    - @location(0): cor final RGBA escrita no framebuffer
//      (a textura da tela configurada no canvas).
//
//  A interpolação suave entre as cores dos três vértices é feita
//  automaticamente pela GPU (rasterizador) — nós só recebemos o
//  valor já interpolado aqui.
// ============================================================

// Deve casar com o VertexOutput do vertex shader (mesmos @location).
struct FragmentInput {
  @location(0) color : vec3<f32>,
};

@fragment
fn main(in : FragmentInput) -> @location(0) vec4<f32> {
  // Alpha = 1.0 (totalmente opaco).
  return vec4<f32>(in.color, 1.0);
}
`,u=5,g=u*Float32Array.BYTES_PER_ELEMENT;class h{constructor(e){i(this,"gpu");i(this,"pipeline");i(this,"vertexBuffer");i(this,"vertexCount");this.gpu=e;const{device:r,format:o}=e,t=new Float32Array([0,.6,1,.2,.2,-.6,-.6,.2,1,.2,.6,-.6,.2,.4,1]);this.vertexCount=t.length/u,this.vertexBuffer=r.createBuffer({label:"triangle-vertices",size:t.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),r.queue.writeBuffer(this.vertexBuffer,0,t);const n=r.createShaderModule({label:"triangle.vert",code:v}),s=r.createShaderModule({label:"triangle.frag",code:m}),d={arrayStride:g,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:2*4,format:"float32x3"}]};this.pipeline=r.createRenderPipeline({label:"triangle-pipeline",layout:"auto",vertex:{module:n,entryPoint:"main",buffers:[d]},fragment:{module:s,entryPoint:"main",targets:[{format:o}]},primitive:{topology:"triangle-list"}})}render(){const{device:e,context:r}=this.gpu,o=e.createCommandEncoder({label:"frame-encoder"}),t=r.getCurrentTexture().createView(),n=o.beginRenderPass({label:"triangle-pass",colorAttachments:[{view:t,clearValue:{r:.04,g:.04,b:.06,a:1},loadOp:"clear",storeOp:"store"}]});n.setPipeline(this.pipeline),n.setVertexBuffer(0,this.vertexBuffer),n.draw(this.vertexCount),n.end(),e.queue.submit([o.finish()])}}function l(a){const e=document.getElementById("fatal");e&&(e.textContent=a,e.classList.remove("hidden")),console.error(a)}async function x(){const a=document.getElementById("gpu-canvas");if(!a){l("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await c.create(a)}catch(t){l(t instanceof Error?t.message:String(t));return}e.resize(),window.addEventListener("resize",()=>e.resize());const r=new h(e);performance.now();function o(t){r.render(),requestAnimationFrame(o)}requestAnimationFrame(o),console.info("[Jogo GPU] FASE 1 ok — triângulo renderizado pela GPU.")}x();
