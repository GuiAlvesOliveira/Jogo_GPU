var T=Object.defineProperty;var U=(i,e,t)=>e in i?T(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var c=(i,e,t)=>U(i,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function t(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(r){if(r.ep)return;r.ep=!0;const o=t(r);fetch(r.href,o)}})();class g{constructor(e,t,n,r,o){c(this,"adapter");c(this,"device");c(this,"context");c(this,"canvas");c(this,"format");this.adapter=e,this.device=t,this.context=n,this.canvas=r,this.format=o}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const n=await t.requestDevice();n.lost.then(a=>{console.error(`GPUDevice perdido: ${a.reason??"desconhecido"} — ${a.message}`)});const r=e.getContext("webgpu");if(!r)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const o=navigator.gpu.getPreferredCanvasFormat();return r.configure({device:n,format:o,alphaMode:"opaque"}),new g(t,n,r,e,o)}resize(){const e=window.devicePixelRatio||1,t=Math.max(1,Math.floor(this.canvas.clientWidth*e)),n=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==t||this.canvas.height!==n)&&(this.canvas.width=t,this.canvas.height=n)}}const y=6,x=new Float32Array([-.5,-.5,-.5,.9,.2,.2,.5,-.5,-.5,.2,.9,.2,.5,.5,-.5,.2,.4,.9,-.5,.5,-.5,.9,.9,.2,-.5,-.5,.5,.9,.2,.9,.5,-.5,.5,.2,.9,.9,.5,.5,.5,.95,.6,.2,-.5,.5,.5,.7,.7,.9]),m=new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,0,1,5,0,5,4,3,7,6,3,6,2]),M=`// ============================================================
//  VERTEX SHADER — cube.vert.wgsl
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por vértice.
//
//  ENTRA:
//    - uniform mvp: matriz Model*View*Projection (vinda de um
//      uniform buffer preenchido pela CPU a cada frame).
//    - position: posição 3D do vértice (espaço do modelo).
//    - color:    cor RGB do vértice.
//
//  O CÁLCULO PESADO ACONTECE AQUI: a GPU multiplica CADA vértice
//  pela matriz MVP em paralelo. É a etapa Model → View → Projection.
//
//  SAI:
//    - @builtin(position): posição em clip space.
//    - color: repassada (será interpolada) ao fragment shader.
// ============================================================

// Bloco de uniforms (group 0, binding 0). Deve casar com o
// bind group criado no Renderer (CPU).
struct Uniforms {
  mvp : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) color    : vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clip_position : vec4<f32>,
  @location(0)       color         : vec3<f32>,
};

@vertex
fn main(in : VertexInput) -> VertexOutput {
  var out : VertexOutput;

  // Transforma o vértice do espaço do modelo direto para clip space.
  out.clip_position = u.mvp * vec4<f32>(in.position, 1.0);
  out.color = in.color;

  return out;
}
`,S=`// ============================================================
//  FRAGMENT SHADER — cube.frag.wgsl
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por fragmento (pixel do cubo).
//
//  ENTRA: cor RGB interpolada entre os vértices da face.
//  SAI:   cor final RGBA no framebuffer.
//
//  Ainda sem iluminação (FASE 15). As cores por vértice servem
//  apenas para enxergar a forma 3D e a profundidade.
// ============================================================

struct FragmentInput {
  @location(0) color : vec3<f32>,
};

@fragment
fn main(in : FragmentInput) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color, 1.0);
}
`,C=y*Float32Array.BYTES_PER_ELEMENT,b="depth24plus",R=16*Float32Array.BYTES_PER_ELEMENT;class G{constructor(e){c(this,"gpu");c(this,"pipeline");c(this,"vertexBuffer");c(this,"indexBuffer");c(this,"indexCount");c(this,"uniformBuffer");c(this,"bindGroup");c(this,"depthTexture",null);c(this,"depthView",null);c(this,"depthWidth",0);c(this,"depthHeight",0);this.gpu=e;const{device:t,format:n}=e;this.vertexBuffer=t.createBuffer({label:"cube-vertices",size:x.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.vertexBuffer,0,x),this.indexCount=m.length,this.indexBuffer=t.createBuffer({label:"cube-indices",size:m.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.indexBuffer,0,m),this.uniformBuffer=t.createBuffer({label:"cube-uniforms(mvp)",size:R,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const r=t.createShaderModule({label:"cube.vert",code:M}),o=t.createShaderModule({label:"cube.frag",code:S}),a={arrayStride:C,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:3*4,format:"float32x3"}]};this.pipeline=t.createRenderPipeline({label:"cube-pipeline",layout:"auto",vertex:{module:r,entryPoint:"main",buffers:[a]},fragment:{module:o,entryPoint:"main",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:b,depthWriteEnabled:!0,depthCompare:"less"}}),this.bindGroup=t.createBindGroup({label:"cube-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})}ensureDepthTexture(){var o;const{device:e,canvas:t}=this.gpu,n=t.width,r=t.height;return(!this.depthTexture||this.depthWidth!==n||this.depthHeight!==r)&&((o=this.depthTexture)==null||o.destroy(),this.depthTexture=e.createTexture({label:"depth-texture",size:[n,r],format:b,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depthTexture.createView(),this.depthWidth=n,this.depthHeight=r),this.depthView}render(e){const{device:t,context:n}=this.gpu;t.queue.writeBuffer(this.uniformBuffer,0,e);const r=this.ensureDepthTexture(),o=t.createCommandEncoder({label:"frame-encoder"}),a=n.getCurrentTexture().createView(),u=o.beginRenderPass({label:"cube-pass",colorAttachments:[{view:a,clearValue:{r:.04,g:.04,b:.06,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:r,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});u.setPipeline(this.pipeline),u.setBindGroup(0,this.bindGroup),u.setVertexBuffer(0,this.vertexBuffer),u.setIndexBuffer(this.indexBuffer,"uint16"),u.drawIndexed(this.indexCount),u.end(),t.queue.submit([o.finish()])}}function v(){const i=new Float32Array(16);return i[0]=1,i[5]=1,i[10]=1,i[15]=1,i}function w(i,e){const t=new Float32Array(16);for(let n=0;n<4;n++)for(let r=0;r<4;r++){let o=0;for(let a=0;a<4;a++)o+=i[a*4+r]*e[n*4+a];t[n*4+r]=o}return t}function V(...i){let e=v();for(const t of i)e=w(e,t);return e}function F(i){const e=Math.cos(i),t=Math.sin(i),n=v();return n[5]=e,n[6]=t,n[9]=-t,n[10]=e,n}function O(i){const e=Math.cos(i),t=Math.sin(i),n=v();return n[0]=e,n[2]=-t,n[8]=t,n[10]=e,n}function I(i,e,t,n){const r=1/Math.tan(i/2),o=new Float32Array(16);o[0]=r/e,o[5]=r,o[11]=-1;const a=1/(t-n);return o[10]=n*a,o[14]=n*t*a,o}function D(i,e,t){let n=i[0]-e[0],r=i[1]-e[1],o=i[2]-e[2],a=Math.hypot(n,r,o)||1;n/=a,r/=a,o/=a;let u=t[1]*o-t[2]*r,l=t[2]*n-t[0]*o,f=t[0]*r-t[1]*n;a=Math.hypot(u,l,f)||1,u/=a,l/=a,f/=a;const d=r*f-o*l,p=o*u-n*f,h=n*l-r*u,s=new Float32Array(16);return s[0]=u,s[1]=d,s[2]=n,s[3]=0,s[4]=l,s[5]=p,s[6]=r,s[7]=0,s[8]=f,s[9]=h,s[10]=o,s[11]=0,s[12]=-(u*i[0]+l*i[1]+f*i[2]),s[13]=-(d*i[0]+p*i[1]+h*i[2]),s[14]=-(n*i[0]+r*i[1]+o*i[2]),s[15]=1,s}function E(i){const e=document.getElementById("fatal");e&&(e.textContent=i,e.classList.remove("hidden")),console.error(i)}async function L(){const i=document.getElementById("gpu-canvas");if(!i){E("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await g.create(i)}catch(d){E(d instanceof Error?d.message:String(d));return}e.resize(),window.addEventListener("resize",()=>e.resize());const t=new G(e);let n=performance.now(),r=0;const o=[0,1.2,3.2],a=[0,0,0],u=[0,1,0];function l(d){const p=(d-n)/1e3;n=d,f(p);const h=w(O(r),F(r*.5)),s=D(o,a,u),B=e.canvas.width/e.canvas.height,P=I(60*Math.PI/180,B,.1,100),A=V(P,s,h);t.render(A),requestAnimationFrame(l)}function f(d){r+=d*.8}requestAnimationFrame(l),console.info("[Jogo GPU] FASE 2 ok — cubo 3D com MVP renderizado pela GPU.")}L();
