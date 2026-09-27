var F=Object.defineProperty;var R=(r,e,t)=>e in r?F(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var a=(r,e,t)=>R(r,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function t(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(o){if(o.ep)return;o.ep=!0;const i=t(o);fetch(o.href,i)}})();class L{constructor(e,t,n,o,i){a(this,"adapter");a(this,"device");a(this,"context");a(this,"canvas");a(this,"format");this.adapter=e,this.device=t,this.context=n,this.canvas=o,this.format=i}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const n=await t.requestDevice();n.lost.then(s=>{console.error(`GPUDevice perdido: ${s.reason??"desconhecido"} — ${s.message}`)});const o=e.getContext("webgpu");if(!o)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const i=navigator.gpu.getPreferredCanvasFormat();return o.configure({device:n,format:i,alphaMode:"opaque"}),new L(t,n,o,e,i)}resize(){const e=window.devicePixelRatio||1,t=Math.max(1,Math.floor(this.canvas.clientWidth*e)),n=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==t||this.canvas.height!==n)&&(this.canvas.width=t,this.canvas.height=n)}}function V(){const r=new Float32Array(16);return r[0]=1,r[5]=1,r[10]=1,r[15]=1,r}function U(r,e){const t=new Float32Array(16);for(let n=0;n<4;n++)for(let o=0;o<4;o++){let i=0;for(let s=0;s<4;s++)i+=r[s*4+o]*e[n*4+s];t[n*4+o]=i}return t}function G(r,e,t){const n=V();return n[12]=r,n[13]=e,n[14]=t,n}function O(r,e,t){const n=new Float32Array(16);return n[0]=r,n[5]=e,n[10]=t,n[15]=1,n}function _(r,e,t,n){const o=1/Math.tan(r/2),i=new Float32Array(16);i[0]=o/e,i[5]=o,i[11]=-1;const s=1/(t-n);return i[10]=n*s,i[14]=n*t*s,i}function N(r,e,t){let n=r[0]-e[0],o=r[1]-e[1],i=r[2]-e[2],s=Math.hypot(n,o,i)||1;n/=s,o/=s,i/=s;let c=t[1]*i-t[2]*o,u=t[2]*n-t[0]*i,h=t[0]*o-t[1]*n;s=Math.hypot(c,u,h)||1,c/=s,u/=s,h/=s;const g=o*h-i*u,d=i*c-n*h,w=n*u-o*c,l=new Float32Array(16);return l[0]=c,l[1]=g,l[2]=n,l[3]=0,l[4]=u,l[5]=d,l[6]=o,l[7]=0,l[8]=h,l[9]=w,l[10]=i,l[11]=0,l[12]=-(c*r[0]+u*r[1]+h*r[2]),l[13]=-(g*r[0]+d*r[1]+w*r[2]),l[14]=-(n*r[0]+o*r[1]+i*r[2]),l[15]=1,l}const D=4,y=1,f=.75,p=.6,x=.45,A=new Float32Array([-.5,-.5,-.5,f,.5,.5,-.5,f,.5,-.5,-.5,f,-.5,-.5,-.5,f,-.5,.5,-.5,f,.5,.5,-.5,f,-.5,-.5,.5,f,.5,-.5,.5,f,.5,.5,.5,f,-.5,-.5,.5,f,.5,.5,.5,f,-.5,.5,.5,f,-.5,-.5,-.5,p,-.5,-.5,.5,p,-.5,.5,.5,p,-.5,-.5,-.5,p,-.5,.5,.5,p,-.5,.5,-.5,p,.5,-.5,-.5,p,.5,.5,-.5,p,.5,.5,.5,p,.5,-.5,-.5,p,.5,.5,.5,p,.5,-.5,.5,p,-.5,-.5,-.5,x,.5,-.5,-.5,x,.5,-.5,.5,x,-.5,-.5,-.5,x,.5,-.5,.5,x,-.5,-.5,.5,x,-.5,.5,-.5,y,-.5,.5,.5,y,.5,.5,.5,y,-.5,.5,-.5,y,.5,.5,.5,y,.5,.5,-.5,y]),k=A.length/D,j=`// ============================================================
//  VERTEX SHADER — cube.vert.wgsl (com INSTANCING)
// ------------------------------------------------------------
//  Executado NA GPU, uma vez por vértice DE CADA instância.
//
//  ENTRA:
//    - uniform viewProj: matriz Projection * View (câmera), igual
//      para todas as instâncias (group 0, binding 0).
//    - storage instances[]: um array com a matriz \`model\` e a cor
//      de CADA caixa do mapa (group 0, binding 1). Indexado pelo
//      @builtin(instance_index).
//    - position (vec3) e shade (f32) do vértice do cubo unitário.
//
//  A GPU calcula, em paralelo para cada vértice/instância:
//      clip = viewProj * model * position
//  ou seja, a transformação Model → View → Projection completa
//  acontece aqui, na GPU.
//
//  SAI: posição em clip space + cor (base * shade da face).
// ============================================================

struct ViewUniforms {
  viewProj : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> view : ViewUniforms;

// Dados por instância. O layout (mat4 + vec4 = 80 bytes) casa com
// o Float32Array montado pela CPU no Renderer.
struct Instance {
  model : mat4x4<f32>,
  color : vec4<f32>,
};
@group(0) @binding(1) var<storage, read> instances : array<Instance>;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) shade    : f32,
};

struct VertexOutput {
  @builtin(position) clip_position : vec4<f32>,
  @location(0)       color         : vec3<f32>,
};

@vertex
fn main(in : VertexInput, @builtin(instance_index) index : u32) -> VertexOutput {
  var out : VertexOutput;

  let inst = instances[index];

  // Model → View → Projection, tudo na GPU.
  let world = inst.model * vec4<f32>(in.position, 1.0);
  out.clip_position = view.viewProj * world;

  // Cor base da caixa modulada pelo brilho fixo da face.
  out.color = inst.color.rgb * in.shade;

  return out;
}
`,q=`// ============================================================
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
`,H=D*Float32Array.BYTES_PER_ELEMENT,M="depth24plus",W=16*4,T=20;class Y{constructor(e){a(this,"gpu");a(this,"pipeline");a(this,"vertexBuffer");a(this,"viewUniformBuffer");a(this,"instanceBuffer",null);a(this,"bindGroup",null);a(this,"instanceCount",0);a(this,"depthTexture",null);a(this,"depthView",null);a(this,"depthWidth",0);a(this,"depthHeight",0);this.gpu=e;const{device:t,format:n}=e;this.vertexBuffer=t.createBuffer({label:"cube-vertices",size:A.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.vertexBuffer,0,A),this.viewUniformBuffer=t.createBuffer({label:"view-uniform(viewProj)",size:W,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const o=t.createShaderModule({label:"cube.vert",code:j}),i=t.createShaderModule({label:"cube.frag",code:q}),s={arrayStride:H,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:3*4,format:"float32"}]};this.pipeline=t.createRenderPipeline({label:"map-pipeline",layout:"auto",vertex:{module:o,entryPoint:"main",buffers:[s]},fragment:{module:i,entryPoint:"main",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:M,depthWriteEnabled:!0,depthCompare:"less"}})}setBoxes(e){var o;const{device:t}=this.gpu;this.instanceCount=e.length;const n=new Float32Array(e.length*T);for(let i=0;i<e.length;i++){const s=e[i],c=U(G(s.center[0],s.center[1],s.center[2]),O(s.size[0],s.size[1],s.size[2])),u=i*T;n.set(c,u),n[u+16]=s.color[0],n[u+17]=s.color[1],n[u+18]=s.color[2],n[u+19]=1}(o=this.instanceBuffer)==null||o.destroy(),this.instanceBuffer=t.createBuffer({label:"map-instances",size:n.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.instanceBuffer,0,n),this.bindGroup=t.createBindGroup({label:"map-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.viewUniformBuffer}},{binding:1,resource:{buffer:this.instanceBuffer}}]})}ensureDepthTexture(){var i;const{device:e,canvas:t}=this.gpu,n=t.width,o=t.height;return(!this.depthTexture||this.depthWidth!==n||this.depthHeight!==o)&&((i=this.depthTexture)==null||i.destroy(),this.depthTexture=e.createTexture({label:"depth-texture",size:[n,o],format:M,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depthTexture.createView(),this.depthWidth=n,this.depthHeight=o),this.depthView}render(e){const{device:t,context:n}=this.gpu;if(!this.bindGroup||this.instanceCount===0)return;t.queue.writeBuffer(this.viewUniformBuffer,0,e);const o=this.ensureDepthTexture(),i=t.createCommandEncoder({label:"frame-encoder"}),s=n.getCurrentTexture().createView(),c=i.beginRenderPass({label:"map-pass",colorAttachments:[{view:s,clearValue:{r:.03,g:.03,b:.05,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:o,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});c.setPipeline(this.pipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.vertexBuffer),c.draw(k,this.instanceCount),c.end(),t.queue.submit([i.finish()])}}class K{constructor(e){a(this,"canvas");a(this,"keys",new Set);a(this,"mouseDX",0);a(this,"mouseDY",0);a(this,"pointerLocked",!1);this.canvas=e,window.addEventListener("keydown",t=>{this.keys.add(t.code),this.pointerLocked&&t.preventDefault()}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.canvas.addEventListener("click",()=>{this.pointerLocked||this.canvas.requestPointerLock()}),document.addEventListener("pointerlockchange",()=>{this.pointerLocked=document.pointerLockElement===this.canvas,this.pointerLocked||this.keys.clear()}),window.addEventListener("mousemove",t=>{this.pointerLocked&&(this.mouseDX+=t.movementX,this.mouseDY+=t.movementY)})}get isPointerLocked(){return this.pointerLocked}isKeyDown(e){return this.keys.has(e)}consumeMouseDelta(){const e={dx:this.mouseDX,dy:this.mouseDY};return this.mouseDX=0,this.mouseDY=0,e}}const b=89*Math.PI/180,B=.0022,X=4;class ${constructor(e=[0,1.2,4],t=0,n=0){a(this,"position");a(this,"yaw");a(this,"pitch");a(this,"fov");a(this,"near");a(this,"far");this.position=e,this.yaw=t,this.pitch=n,this.fov=70*Math.PI/180,this.near=.1,this.far=100}forward(){const e=Math.cos(this.pitch);return[e*Math.sin(this.yaw),Math.sin(this.pitch),-e*Math.cos(this.yaw)]}update(e,t){const{dx:n,dy:o}=t.consumeMouseDelta();this.yaw+=n*B,this.pitch-=o*B,this.pitch>b&&(this.pitch=b),this.pitch<-b&&(this.pitch=-b);const i=[Math.sin(this.yaw),0,-Math.cos(this.yaw)],s=[Math.cos(this.yaw),0,Math.sin(this.yaw)];let c=0,u=0;t.isKeyDown("KeyW")&&(u+=1),t.isKeyDown("KeyS")&&(u-=1),t.isKeyDown("KeyD")&&(c+=1),t.isKeyDown("KeyA")&&(c-=1);let h=i[0]*u+s[0]*c,g=i[2]*u+s[2]*c;const d=Math.hypot(h,g);if(d>0){h/=d,g/=d;const w=X*e;this.position[0]+=h*w,this.position[2]+=g*w}}viewMatrix(){const e=this.forward(),t=[this.position[0]+e[0],this.position[1]+e[1],this.position[2]+e[2]];return N(this.position,t,[0,1,0])}projectionMatrix(e){return _(this.fov,e,this.near,this.far)}}const m=3,v=m/2,J=[.18,.18,.22],E=[.45,.42,.5],P=[.5,.3,.3],Z={name:"Setor 01 — Corredores",playerSpawn:{position:[0,1.6,9],yaw:0},boxes:[{center:[0,-.5,0],size:[24,1,24],color:J},{center:[0,v,-12],size:[24,m,1],color:E},{center:[0,v,12],size:[24,m,1],color:E},{center:[-12,v,0],size:[1,m,24],color:E},{center:[12,v,0],size:[1,m,24],color:E},{center:[-3,v,-3],size:[1,m,12],color:E},{center:[3,v,3],size:[1,m,12],color:E},{center:[6,v,-6],size:[2,m,2],color:P},{center:[-7,v,5],size:[2,m,2],color:P},{center:[8,v,7],size:[2,m,2],color:P}]};function S(r){const e=document.getElementById("fatal");e&&(e.textContent=r,e.classList.remove("hidden")),console.error(r)}async function Q(){const r=document.getElementById("gpu-canvas");if(!r){S("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await L.create(r)}catch(d){S(d instanceof Error?d.message:String(d));return}e.resize(),window.addEventListener("resize",()=>e.resize());const t=new Y(e),n=new K(r),o=Z;t.setBoxes(o.boxes);const i=new $([...o.playerSpawn.position],o.playerSpawn.yaw);let s=performance.now();function c(d){const w=Math.min((d-s)/1e3,.1);s=d,u(w);const l=i.viewMatrix(),z=e.canvas.width/e.canvas.height,I=i.projectionMatrix(z),C=U(I,l);t.render(C),requestAnimationFrame(c)}function u(d){i.update(d,n),g()}const h=document.getElementById("hint");function g(){h&&h.classList.toggle("hidden",n.isPointerLocked)}requestAnimationFrame(c),console.info(`[Jogo GPU] FASE 4 ok — mapa "${o.name}" (${o.boxes.length} caixas via instancing).`)}Q();
