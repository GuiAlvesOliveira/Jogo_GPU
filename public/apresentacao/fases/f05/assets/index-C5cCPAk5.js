var R=Object.defineProperty;var _=(s,e,t)=>e in s?R(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t;var a=(s,e,t)=>_(s,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function t(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(n){if(n.ep)return;n.ep=!0;const r=t(n);fetch(n.href,r)}})();class M{constructor(e,t,o,n,r){a(this,"adapter");a(this,"device");a(this,"context");a(this,"canvas");a(this,"format");this.adapter=e,this.device=t,this.context=o,this.canvas=n,this.format=r}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const o=await t.requestDevice();o.lost.then(i=>{console.error(`GPUDevice perdido: ${i.reason??"desconhecido"} — ${i.message}`)});const n=e.getContext("webgpu");if(!n)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const r=navigator.gpu.getPreferredCanvasFormat();return n.configure({device:o,format:r,alphaMode:"opaque"}),new M(t,o,n,e,r)}resize(){const e=window.devicePixelRatio||1,t=Math.max(1,Math.floor(this.canvas.clientWidth*e)),o=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==t||this.canvas.height!==o)&&(this.canvas.width=t,this.canvas.height=o)}}function F(){const s=new Float32Array(16);return s[0]=1,s[5]=1,s[10]=1,s[15]=1,s}function D(s,e){const t=new Float32Array(16);for(let o=0;o<4;o++)for(let n=0;n<4;n++){let r=0;for(let i=0;i<4;i++)r+=s[i*4+n]*e[o*4+i];t[o*4+n]=r}return t}function V(s,e,t){const o=F();return o[12]=s,o[13]=e,o[14]=t,o}function G(s,e,t){const o=new Float32Array(16);return o[0]=s,o[5]=e,o[10]=t,o[15]=1,o}function N(s,e,t,o){const n=1/Math.tan(s/2),r=new Float32Array(16);r[0]=n/e,r[5]=n,r[11]=-1;const i=1/(t-o);return r[10]=o*i,r[14]=o*t*i,r}function X(s,e,t){let o=s[0]-e[0],n=s[1]-e[1],r=s[2]-e[2],i=Math.hypot(o,n,r)||1;o/=i,n/=i,r/=i;let c=t[1]*r-t[2]*n,l=t[2]*o-t[0]*r,h=t[0]*n-t[1]*o;i=Math.hypot(c,l,h)||1,c/=i,l/=i,h/=i;const v=n*h-r*l,g=r*c-o*h,d=o*l-n*c,u=new Float32Array(16);return u[0]=c,u[1]=v,u[2]=o,u[3]=0,u[4]=l,u[5]=g,u[6]=n,u[7]=0,u[8]=h,u[9]=d,u[10]=r,u[11]=0,u[12]=-(c*s[0]+l*s[1]+h*s[2]),u[13]=-(v*s[0]+g*s[1]+d*s[2]),u[14]=-(o*s[0]+n*s[1]+r*s[2]),u[15]=1,u}const C=4,x=1,f=.75,p=.6,E=.45,B=new Float32Array([-.5,-.5,-.5,f,.5,.5,-.5,f,.5,-.5,-.5,f,-.5,-.5,-.5,f,-.5,.5,-.5,f,.5,.5,-.5,f,-.5,-.5,.5,f,.5,-.5,.5,f,.5,.5,.5,f,-.5,-.5,.5,f,.5,.5,.5,f,-.5,.5,.5,f,-.5,-.5,-.5,p,-.5,-.5,.5,p,-.5,.5,.5,p,-.5,-.5,-.5,p,-.5,.5,.5,p,-.5,.5,-.5,p,.5,-.5,-.5,p,.5,.5,-.5,p,.5,.5,.5,p,.5,-.5,-.5,p,.5,.5,.5,p,.5,-.5,.5,p,-.5,-.5,-.5,E,.5,-.5,-.5,E,.5,-.5,.5,E,-.5,-.5,-.5,E,.5,-.5,.5,E,-.5,-.5,.5,E,-.5,.5,-.5,x,-.5,.5,.5,x,.5,.5,.5,x,-.5,.5,-.5,x,.5,.5,.5,x,.5,.5,-.5,x]),k=B.length/C,Y=`// ============================================================
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
`,j=`// ============================================================
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
`,q=C*Float32Array.BYTES_PER_ELEMENT,T="depth24plus",H=16*4,S=20;class W{constructor(e){a(this,"gpu");a(this,"pipeline");a(this,"vertexBuffer");a(this,"viewUniformBuffer");a(this,"instanceBuffer",null);a(this,"bindGroup",null);a(this,"instanceCount",0);a(this,"depthTexture",null);a(this,"depthView",null);a(this,"depthWidth",0);a(this,"depthHeight",0);this.gpu=e;const{device:t,format:o}=e;this.vertexBuffer=t.createBuffer({label:"cube-vertices",size:B.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.vertexBuffer,0,B),this.viewUniformBuffer=t.createBuffer({label:"view-uniform(viewProj)",size:H,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const n=t.createShaderModule({label:"cube.vert",code:Y}),r=t.createShaderModule({label:"cube.frag",code:j}),i={arrayStride:q,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:3*4,format:"float32"}]};this.pipeline=t.createRenderPipeline({label:"map-pipeline",layout:"auto",vertex:{module:n,entryPoint:"main",buffers:[i]},fragment:{module:r,entryPoint:"main",targets:[{format:o}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:T,depthWriteEnabled:!0,depthCompare:"less"}})}setBoxes(e){var n;const{device:t}=this.gpu;this.instanceCount=e.length;const o=new Float32Array(e.length*S);for(let r=0;r<e.length;r++){const i=e[r],c=D(V(i.center[0],i.center[1],i.center[2]),G(i.size[0],i.size[1],i.size[2])),l=r*S;o.set(c,l),o[l+16]=i.color[0],o[l+17]=i.color[1],o[l+18]=i.color[2],o[l+19]=1}(n=this.instanceBuffer)==null||n.destroy(),this.instanceBuffer=t.createBuffer({label:"map-instances",size:o.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.instanceBuffer,0,o),this.bindGroup=t.createBindGroup({label:"map-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.viewUniformBuffer}},{binding:1,resource:{buffer:this.instanceBuffer}}]})}ensureDepthTexture(){var r;const{device:e,canvas:t}=this.gpu,o=t.width,n=t.height;return(!this.depthTexture||this.depthWidth!==o||this.depthHeight!==n)&&((r=this.depthTexture)==null||r.destroy(),this.depthTexture=e.createTexture({label:"depth-texture",size:[o,n],format:T,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depthTexture.createView(),this.depthWidth=o,this.depthHeight=n),this.depthView}render(e){const{device:t,context:o}=this.gpu;if(!this.bindGroup||this.instanceCount===0)return;t.queue.writeBuffer(this.viewUniformBuffer,0,e);const n=this.ensureDepthTexture(),r=t.createCommandEncoder({label:"frame-encoder"}),i=o.getCurrentTexture().createView(),c=r.beginRenderPass({label:"map-pass",colorAttachments:[{view:i,clearValue:{r:.03,g:.03,b:.05,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:n,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});c.setPipeline(this.pipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.vertexBuffer),c.draw(k,this.instanceCount),c.end(),t.queue.submit([r.finish()])}}class Z{constructor(e){a(this,"canvas");a(this,"keys",new Set);a(this,"mouseDX",0);a(this,"mouseDY",0);a(this,"pointerLocked",!1);this.canvas=e,window.addEventListener("keydown",t=>{this.keys.add(t.code),this.pointerLocked&&t.preventDefault()}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.canvas.addEventListener("click",()=>{this.pointerLocked||this.canvas.requestPointerLock()}),document.addEventListener("pointerlockchange",()=>{this.pointerLocked=document.pointerLockElement===this.canvas,this.pointerLocked||this.keys.clear()}),window.addEventListener("mousemove",t=>{this.pointerLocked&&(this.mouseDX+=t.movementX,this.mouseDY+=t.movementY)})}get isPointerLocked(){return this.pointerLocked}isKeyDown(e){return this.keys.has(e)}consumeMouseDelta(){const e={dx:this.mouseDX,dy:this.mouseDY};return this.mouseDX=0,this.mouseDY=0,e}}const P=89*Math.PI/180,U=.0022,K=4,$=.35;class J{constructor(e=[0,1.2,4],t=0,o=0){a(this,"position");a(this,"yaw");a(this,"pitch");a(this,"fov");a(this,"near");a(this,"far");this.position=e,this.yaw=t,this.pitch=o,this.fov=70*Math.PI/180,this.near=.1,this.far=100}forward(){const e=Math.cos(this.pitch);return[e*Math.sin(this.yaw),Math.sin(this.pitch),-e*Math.cos(this.yaw)]}update(e,t,o){const{dx:n,dy:r}=t.consumeMouseDelta();this.yaw+=n*U,this.pitch-=r*U,this.pitch>P&&(this.pitch=P),this.pitch<-P&&(this.pitch=-P);const i=[Math.sin(this.yaw),0,-Math.cos(this.yaw)],c=[Math.cos(this.yaw),0,Math.sin(this.yaw)];let l=0,h=0;t.isKeyDown("KeyW")&&(h+=1),t.isKeyDown("KeyS")&&(h-=1),t.isKeyDown("KeyD")&&(l+=1),t.isKeyDown("KeyA")&&(l-=1);let v=i[0]*h+c[0]*l,g=i[2]*h+c[2]*l;const d=Math.hypot(v,g);if(d>0){v/=d,g/=d;const u=K*e,b=v*u,A=g*u;o?o.moveAndCollide(this.position,b,A,$):(this.position[0]+=b,this.position[2]+=A)}}viewMatrix(){const e=this.forward(),t=[this.position[0]+e[0],this.position[1]+e[1],this.position[2]+e[2]];return X(this.position,t,[0,1,0])}projectionMatrix(e){return N(this.fov,e,this.near,this.far)}}const Q=1.5,ee=.2;class te{constructor(e){a(this,"aabbs");this.aabbs=e.map(t=>({minX:t.center[0]-t.size[0]/2,maxX:t.center[0]+t.size[0]/2,minY:t.center[1]-t.size[1]/2,maxY:t.center[1]+t.size[1]/2,minZ:t.center[2]-t.size[2]/2,maxZ:t.center[2]+t.size[2]/2}))}verticalOverlap(e,t){const o=e-Q,n=e+ee;return o<t.maxY&&n>t.minY}moveAndCollide(e,t,o,n){const r=e[1];e[0]+=t;for(const i of this.aabbs){if(!this.verticalOverlap(r,i))continue;const c=e[0]>i.minX-n&&e[0]<i.maxX+n,l=e[2]>i.minZ-n&&e[2]<i.maxZ+n;c&&l&&(t>0?e[0]=i.minX-n:t<0&&(e[0]=i.maxX+n))}e[2]+=o;for(const i of this.aabbs){if(!this.verticalOverlap(r,i))continue;const c=e[0]>i.minX-n&&e[0]<i.maxX+n,l=e[2]>i.minZ-n&&e[2]<i.maxZ+n;c&&l&&(o>0?e[2]=i.minZ-n:o<0&&(e[2]=i.maxZ+n))}}}const m=3,w=m/2,ne=[.18,.18,.22],y=[.45,.42,.5],L=[.5,.3,.3],oe={name:"Setor 01 — Corredores",playerSpawn:{position:[0,1.6,9],yaw:0},boxes:[{center:[0,-.5,0],size:[24,1,24],color:ne},{center:[0,w,-12],size:[24,m,1],color:y},{center:[0,w,12],size:[24,m,1],color:y},{center:[-12,w,0],size:[1,m,24],color:y},{center:[12,w,0],size:[1,m,24],color:y},{center:[-3,w,-3],size:[1,m,12],color:y},{center:[3,w,3],size:[1,m,12],color:y},{center:[6,w,-6],size:[2,m,2],color:L},{center:[-7,w,5],size:[2,m,2],color:L},{center:[8,w,7],size:[2,m,2],color:L}]};function z(s){const e=document.getElementById("fatal");e&&(e.textContent=s,e.classList.remove("hidden")),console.error(s)}async function ie(){const s=document.getElementById("gpu-canvas");if(!s){z("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await M.create(s)}catch(d){z(d instanceof Error?d.message:String(d));return}e.resize(),window.addEventListener("resize",()=>e.resize());const t=new W(e),o=new Z(s),n=oe;t.setBoxes(n.boxes);const r=new te(n.boxes),i=new J([...n.playerSpawn.position],n.playerSpawn.yaw);let c=performance.now();function l(d){const u=Math.min((d-c)/1e3,.1);c=d,h(u);const b=i.viewMatrix(),A=e.canvas.width/e.canvas.height,I=i.projectionMatrix(A),O=D(I,b);t.render(O),requestAnimationFrame(l)}function h(d){i.update(d,o,r),g()}const v=document.getElementById("hint");function g(){v&&v.classList.toggle("hidden",o.isPointerLocked)}requestAnimationFrame(l),console.info(`[Jogo GPU] FASE 5 ok — colisão ativa no mapa "${n.name}".`)}ie();
