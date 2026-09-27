var A=Object.defineProperty;var T=(i,e,t)=>e in i?A(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var a=(i,e,t)=>T(i,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&r(s)}).observe(document,{childList:!0,subtree:!0});function t(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(n){if(n.ep)return;n.ep=!0;const o=t(n);fetch(n.href,o)}})();class g{constructor(e,t,r,n,o){a(this,"adapter");a(this,"device");a(this,"context");a(this,"canvas");a(this,"format");this.adapter=e,this.device=t,this.context=r,this.canvas=n,this.format=o}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const r=await t.requestDevice();r.lost.then(s=>{console.error(`GPUDevice perdido: ${s.reason??"desconhecido"} — ${s.message}`)});const n=e.getContext("webgpu");if(!n)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const o=navigator.gpu.getPreferredCanvasFormat();return n.configure({device:r,format:o,alphaMode:"opaque"}),new g(t,r,n,e,o)}resize(){const e=window.devicePixelRatio||1,t=Math.max(1,Math.floor(this.canvas.clientWidth*e)),r=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==t||this.canvas.height!==r)&&(this.canvas.width=t,this.canvas.height=r)}}const D=6,w=new Float32Array([-.5,-.5,-.5,.9,.2,.2,.5,-.5,-.5,.2,.9,.2,.5,.5,-.5,.2,.4,.9,-.5,.5,-.5,.9,.9,.2,-.5,-.5,.5,.9,.2,.9,.5,-.5,.5,.2,.9,.9,.5,.5,.5,.95,.6,.2,-.5,.5,.5,.7,.7,.9]),v=new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,0,1,5,0,5,4,3,7,6,3,6,2]),L=`// ============================================================
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
`,U=D*Float32Array.BYTES_PER_ELEMENT,E="depth24plus",C=16*Float32Array.BYTES_PER_ELEMENT;class I{constructor(e){a(this,"gpu");a(this,"pipeline");a(this,"vertexBuffer");a(this,"indexBuffer");a(this,"indexCount");a(this,"uniformBuffer");a(this,"bindGroup");a(this,"depthTexture",null);a(this,"depthView",null);a(this,"depthWidth",0);a(this,"depthHeight",0);this.gpu=e;const{device:t,format:r}=e;this.vertexBuffer=t.createBuffer({label:"cube-vertices",size:w.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.vertexBuffer,0,w),this.indexCount=v.length,this.indexBuffer=t.createBuffer({label:"cube-indices",size:v.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.indexBuffer,0,v),this.uniformBuffer=t.createBuffer({label:"cube-uniforms(mvp)",size:C,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const n=t.createShaderModule({label:"cube.vert",code:L}),o=t.createShaderModule({label:"cube.frag",code:S}),s={arrayStride:U,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:3*4,format:"float32x3"}]};this.pipeline=t.createRenderPipeline({label:"cube-pipeline",layout:"auto",vertex:{module:n,entryPoint:"main",buffers:[s]},fragment:{module:o,entryPoint:"main",targets:[{format:r}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:E,depthWriteEnabled:!0,depthCompare:"less"}}),this.bindGroup=t.createBindGroup({label:"cube-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})}ensureDepthTexture(){var o;const{device:e,canvas:t}=this.gpu,r=t.width,n=t.height;return(!this.depthTexture||this.depthWidth!==r||this.depthHeight!==n)&&((o=this.depthTexture)==null||o.destroy(),this.depthTexture=e.createTexture({label:"depth-texture",size:[r,n],format:E,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depthTexture.createView(),this.depthWidth=r,this.depthHeight=n),this.depthView}render(e){const{device:t,context:r}=this.gpu;t.queue.writeBuffer(this.uniformBuffer,0,e);const n=this.ensureDepthTexture(),o=t.createCommandEncoder({label:"frame-encoder"}),s=r.getCurrentTexture().createView(),c=o.beginRenderPass({label:"cube-pass",colorAttachments:[{view:s,clearValue:{r:.04,g:.04,b:.06,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:n,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});c.setPipeline(this.pipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.vertexBuffer),c.setIndexBuffer(this.indexBuffer,"uint16"),c.drawIndexed(this.indexCount),c.end(),t.queue.submit([o.finish()])}}class R{constructor(e){a(this,"canvas");a(this,"keys",new Set);a(this,"mouseDX",0);a(this,"mouseDY",0);a(this,"pointerLocked",!1);this.canvas=e,window.addEventListener("keydown",t=>{this.keys.add(t.code),this.pointerLocked&&t.preventDefault()}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.canvas.addEventListener("click",()=>{this.pointerLocked||this.canvas.requestPointerLock()}),document.addEventListener("pointerlockchange",()=>{this.pointerLocked=document.pointerLockElement===this.canvas,this.pointerLocked||this.keys.clear()}),window.addEventListener("mousemove",t=>{this.pointerLocked&&(this.mouseDX+=t.movementX,this.mouseDY+=t.movementY)})}get isPointerLocked(){return this.pointerLocked}isKeyDown(e){return this.keys.has(e)}consumeMouseDelta(){const e={dx:this.mouseDX,dy:this.mouseDY};return this.mouseDX=0,this.mouseDY=0,e}}function b(){const i=new Float32Array(16);return i[0]=1,i[5]=1,i[10]=1,i[15]=1,i}function F(i,e){const t=new Float32Array(16);for(let r=0;r<4;r++)for(let n=0;n<4;n++){let o=0;for(let s=0;s<4;s++)o+=i[s*4+n]*e[r*4+s];t[r*4+n]=o}return t}function O(...i){let e=b();for(const t of i)e=F(e,t);return e}function V(i,e,t,r){const n=1/Math.tan(i/2),o=new Float32Array(16);o[0]=n/e,o[5]=n,o[11]=-1;const s=1/(t-r);return o[10]=r*s,o[14]=r*t*s,o}function G(i,e,t){let r=i[0]-e[0],n=i[1]-e[1],o=i[2]-e[2],s=Math.hypot(r,n,o)||1;r/=s,n/=s,o/=s;let c=t[1]*o-t[2]*n,h=t[2]*r-t[0]*o,f=t[0]*n-t[1]*r;s=Math.hypot(c,h,f)||1,c/=s,h/=s,f/=s;const l=n*f-o*h,d=o*c-r*f,p=r*h-n*c,u=new Float32Array(16);return u[0]=c,u[1]=l,u[2]=r,u[3]=0,u[4]=h,u[5]=d,u[6]=n,u[7]=0,u[8]=f,u[9]=p,u[10]=o,u[11]=0,u[12]=-(c*i[0]+h*i[1]+f*i[2]),u[13]=-(l*i[0]+d*i[1]+p*i[2]),u[14]=-(r*i[0]+n*i[1]+o*i[2]),u[15]=1,u}const m=89*Math.PI/180,x=.0022,_=4;class k{constructor(e=[0,1.2,4],t=0,r=0){a(this,"position");a(this,"yaw");a(this,"pitch");a(this,"fov");a(this,"near");a(this,"far");this.position=e,this.yaw=t,this.pitch=r,this.fov=70*Math.PI/180,this.near=.1,this.far=100}forward(){const e=Math.cos(this.pitch);return[e*Math.sin(this.yaw),Math.sin(this.pitch),-e*Math.cos(this.yaw)]}update(e,t){const{dx:r,dy:n}=t.consumeMouseDelta();this.yaw+=r*x,this.pitch-=n*x,this.pitch>m&&(this.pitch=m),this.pitch<-m&&(this.pitch=-m);const o=[Math.sin(this.yaw),0,-Math.cos(this.yaw)],s=[Math.cos(this.yaw),0,Math.sin(this.yaw)];let c=0,h=0;t.isKeyDown("KeyW")&&(h+=1),t.isKeyDown("KeyS")&&(h-=1),t.isKeyDown("KeyD")&&(c+=1),t.isKeyDown("KeyA")&&(c-=1);let f=o[0]*h+s[0]*c,l=o[2]*h+s[2]*c;const d=Math.hypot(f,l);if(d>0){f/=d,l/=d;const p=_*e;this.position[0]+=f*p,this.position[2]+=l*p}}viewMatrix(){const e=this.forward(),t=[this.position[0]+e[0],this.position[1]+e[1],this.position[2]+e[2]];return G(this.position,t,[0,1,0])}projectionMatrix(e){return V(this.fov,e,this.near,this.far)}}function y(i){const e=document.getElementById("fatal");e&&(e.textContent=i,e.classList.remove("hidden")),console.error(i)}async function z(){const i=document.getElementById("gpu-canvas");if(!i){y("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await g.create(i)}catch(d){y(d instanceof Error?d.message:String(d));return}e.resize(),window.addEventListener("resize",()=>e.resize());const t=new I(e),r=new R(i),n=new k([0,1.2,4]);let o=performance.now();const s=b();function c(d){const p=Math.min((d-o)/1e3,.1);o=d,h(p);const u=n.viewMatrix(),P=e.canvas.width/e.canvas.height,M=n.projectionMatrix(P),B=O(M,u,s);t.render(B),requestAnimationFrame(c)}function h(d){n.update(d,r),l()}const f=document.getElementById("hint");function l(){f&&f.classList.toggle("hidden",r.isPointerLocked)}requestAnimationFrame(c),console.info("[Jogo GPU] FASE 3 ok — câmera FPS (WASD + mouse-look).")}z();
