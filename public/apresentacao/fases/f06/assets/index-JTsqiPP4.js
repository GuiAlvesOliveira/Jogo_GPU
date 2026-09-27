var X=Object.defineProperty;var H=(r,e,t)=>e in r?X(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var a=(r,e,t)=>H(r,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(i){if(i.ep)return;i.ep=!0;const s=t(i);fetch(i.href,s)}})();class M{constructor(e,t,n,i,s){a(this,"adapter");a(this,"device");a(this,"context");a(this,"canvas");a(this,"format");this.adapter=e,this.device=t,this.context=n,this.canvas=i,this.format=s}static async create(e){if(!navigator.gpu)throw new Error(`WebGPU não está disponível neste navegador.
Use Chrome/Edge 113+ ou Firefox recente com WebGPU habilitado.`);const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("Nenhum GPUAdapter encontrado (navigator.gpu.requestAdapter retornou null).");const n=await t.requestDevice();n.lost.then(o=>{console.error(`GPUDevice perdido: ${o.reason??"desconhecido"} — ${o.message}`)});const i=e.getContext("webgpu");if(!i)throw new Error("Não foi possível obter o contexto 'webgpu' do canvas.");const s=navigator.gpu.getPreferredCanvasFormat();return i.configure({device:n,format:s,alphaMode:"opaque"}),new M(t,n,i,e,s)}resize(){const e=window.devicePixelRatio||1,t=Math.max(1,Math.floor(this.canvas.clientWidth*e)),n=Math.max(1,Math.floor(this.canvas.clientHeight*e));(this.canvas.width!==t||this.canvas.height!==n)&&(this.canvas.width=t,this.canvas.height=n)}}function U(){const r=new Float32Array(16);return r[0]=1,r[5]=1,r[10]=1,r[15]=1,r}function z(r,e){const t=new Float32Array(16);for(let n=0;n<4;n++)for(let i=0;i<4;i++){let s=0;for(let o=0;o<4;o++)s+=r[o*4+i]*e[n*4+o];t[n*4+i]=s}return t}function q(...r){let e=U();for(const t of r)e=z(e,t);return e}function R(r,e,t){const n=U();return n[12]=r,n[13]=e,n[14]=t,n}function O(r,e,t){const n=new Float32Array(16);return n[0]=r,n[5]=e,n[10]=t,n[15]=1,n}function j(r){const e=Math.cos(r),t=Math.sin(r),n=U();return n[0]=e,n[2]=-t,n[8]=t,n[10]=e,n}function W(r,e,t,n){const i=1/Math.tan(r/2),s=new Float32Array(16);s[0]=i/e,s[5]=i,s[11]=-1;const o=1/(t-n);return s[10]=n*o,s[14]=n*t*o,s}function Z(r,e,t){let n=r[0]-e[0],i=r[1]-e[1],s=r[2]-e[2],o=Math.hypot(n,i,s)||1;n/=o,i/=o,s/=o;let u=t[1]*s-t[2]*i,c=t[2]*n-t[0]*s,h=t[0]*i-t[1]*n;o=Math.hypot(u,c,h)||1,u/=o,c/=o,h/=o;const p=i*h-s*c,v=s*u-n*h,w=n*c-i*u,l=new Float32Array(16);return l[0]=u,l[1]=p,l[2]=n,l[3]=0,l[4]=c,l[5]=v,l[6]=i,l[7]=0,l[8]=h,l[9]=w,l[10]=s,l[11]=0,l[12]=-(u*r[0]+c*r[1]+h*r[2]),l[13]=-(p*r[0]+v*r[1]+w*r[2]),l[14]=-(n*r[0]+i*r[1]+s*r[2]),l[15]=1,l}const V=4,y=1,f=.75,d=.6,E=.45,L=new Float32Array([-.5,-.5,-.5,f,.5,.5,-.5,f,.5,-.5,-.5,f,-.5,-.5,-.5,f,-.5,.5,-.5,f,.5,.5,-.5,f,-.5,-.5,.5,f,.5,-.5,.5,f,.5,.5,.5,f,-.5,-.5,.5,f,.5,.5,.5,f,-.5,.5,.5,f,-.5,-.5,-.5,d,-.5,-.5,.5,d,-.5,.5,.5,d,-.5,-.5,-.5,d,-.5,.5,.5,d,-.5,.5,-.5,d,.5,-.5,-.5,d,.5,.5,-.5,d,.5,.5,.5,d,.5,-.5,-.5,d,.5,.5,.5,d,.5,-.5,.5,d,-.5,-.5,-.5,E,.5,-.5,-.5,E,.5,-.5,.5,E,-.5,-.5,-.5,E,.5,-.5,.5,E,-.5,-.5,.5,E,-.5,.5,-.5,y,-.5,.5,.5,y,.5,.5,.5,y,-.5,.5,-.5,y,.5,.5,.5,y,.5,.5,-.5,y]),C=L.length/V,K=`// ============================================================
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
`,$=`// ============================================================
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
`,J=V*Float32Array.BYTES_PER_ELEMENT,I="depth24plus",Q=16*4,S=20,P=S*4;class ee{constructor(e){a(this,"gpu");a(this,"pipeline");a(this,"vertexBuffer");a(this,"viewUniformBuffer");a(this,"instanceBuffer",null);a(this,"bindGroup",null);a(this,"instanceCount",0);a(this,"entityBuffer",null);a(this,"entityBindGroup",null);a(this,"entityCapacityBytes",0);a(this,"depthTexture",null);a(this,"depthView",null);a(this,"depthWidth",0);a(this,"depthHeight",0);this.gpu=e;const{device:t,format:n}=e;this.vertexBuffer=t.createBuffer({label:"cube-vertices",size:L.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.vertexBuffer,0,L),this.viewUniformBuffer=t.createBuffer({label:"view-uniform(viewProj)",size:Q,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const i=t.createShaderModule({label:"cube.vert",code:K}),s=t.createShaderModule({label:"cube.frag",code:$}),o={arrayStride:J,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:3*4,format:"float32"}]};this.pipeline=t.createRenderPipeline({label:"map-pipeline",layout:"auto",vertex:{module:i,entryPoint:"main",buffers:[o]},fragment:{module:s,entryPoint:"main",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:I,depthWriteEnabled:!0,depthCompare:"less"}})}setBoxes(e){var i;const{device:t}=this.gpu;this.instanceCount=e.length;const n=new Float32Array(e.length*S);for(let s=0;s<e.length;s++){const o=e[s],u=z(R(o.center[0],o.center[1],o.center[2]),O(o.size[0],o.size[1],o.size[2])),c=s*S;n.set(u,c),n[c+16]=o.color[0],n[c+17]=o.color[1],n[c+18]=o.color[2],n[c+19]=1}(i=this.instanceBuffer)==null||i.destroy(),this.instanceBuffer=t.createBuffer({label:"map-instances",size:n.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(this.instanceBuffer,0,n),this.bindGroup=t.createBindGroup({label:"map-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.viewUniformBuffer}},{binding:1,resource:{buffer:this.instanceBuffer}}]})}ensureEntityCapacity(e){var i;if(this.entityBuffer&&e<=this.entityCapacityBytes)return;const{device:t}=this.gpu;(i=this.entityBuffer)==null||i.destroy();const n=Math.max(e,P);this.entityBuffer=t.createBuffer({label:"entity-instances",size:n,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.entityBindGroup=t.createBindGroup({label:"entity-bind-group",layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.viewUniformBuffer}},{binding:1,resource:{buffer:this.entityBuffer}}]}),this.entityCapacityBytes=n}ensureDepthTexture(){var s;const{device:e,canvas:t}=this.gpu,n=t.width,i=t.height;return(!this.depthTexture||this.depthWidth!==n||this.depthHeight!==i)&&((s=this.depthTexture)==null||s.destroy(),this.depthTexture=e.createTexture({label:"depth-texture",size:[n,i],format:I,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depthTexture.createView(),this.depthWidth=n,this.depthHeight=i),this.depthView}render(e,t,n=0){const{device:i,context:s}=this.gpu;if(!this.bindGroup||this.instanceCount===0)return;if(i.queue.writeBuffer(this.viewUniformBuffer,0,e),t&&n>0){const p=n*(P/4);this.ensureEntityCapacity(n*P),i.queue.writeBuffer(this.entityBuffer,0,t,0,p)}const o=this.ensureDepthTexture(),u=i.createCommandEncoder({label:"frame-encoder"}),c=s.getCurrentTexture().createView(),h=u.beginRenderPass({label:"map-pass",colorAttachments:[{view:c,clearValue:{r:.03,g:.03,b:.05,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:o,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});h.setPipeline(this.pipeline),h.setVertexBuffer(0,this.vertexBuffer),h.setBindGroup(0,this.bindGroup),h.draw(C,this.instanceCount),this.entityBindGroup&&t&&n>0&&(h.setBindGroup(0,this.entityBindGroup),h.draw(C,n)),h.end(),i.queue.submit([u.finish()])}}class te{constructor(e){a(this,"canvas");a(this,"keys",new Set);a(this,"mouseDX",0);a(this,"mouseDY",0);a(this,"pointerLocked",!1);this.canvas=e,window.addEventListener("keydown",t=>{this.keys.add(t.code),this.pointerLocked&&t.preventDefault()}),window.addEventListener("keyup",t=>{this.keys.delete(t.code)}),this.canvas.addEventListener("click",()=>{this.pointerLocked||this.canvas.requestPointerLock()}),document.addEventListener("pointerlockchange",()=>{this.pointerLocked=document.pointerLockElement===this.canvas,this.pointerLocked||this.keys.clear()}),window.addEventListener("mousemove",t=>{this.pointerLocked&&(this.mouseDX+=t.movementX,this.mouseDY+=t.movementY)})}get isPointerLocked(){return this.pointerLocked}isKeyDown(e){return this.keys.has(e)}consumeMouseDelta(){const e={dx:this.mouseDX,dy:this.mouseDY};return this.mouseDX=0,this.mouseDY=0,e}}const B=89*Math.PI/180,G=.0022,ne=4,ie=.35;class oe{constructor(e=[0,1.2,4],t=0,n=0){a(this,"position");a(this,"yaw");a(this,"pitch");a(this,"fov");a(this,"near");a(this,"far");this.position=e,this.yaw=t,this.pitch=n,this.fov=70*Math.PI/180,this.near=.1,this.far=100}forward(){const e=Math.cos(this.pitch);return[e*Math.sin(this.yaw),Math.sin(this.pitch),-e*Math.cos(this.yaw)]}update(e,t,n){const{dx:i,dy:s}=t.consumeMouseDelta();this.yaw+=i*G,this.pitch-=s*G,this.pitch>B&&(this.pitch=B),this.pitch<-B&&(this.pitch=-B);const o=[Math.sin(this.yaw),0,-Math.cos(this.yaw)],u=[Math.cos(this.yaw),0,Math.sin(this.yaw)];let c=0,h=0;t.isKeyDown("KeyW")&&(h+=1),t.isKeyDown("KeyS")&&(h-=1),t.isKeyDown("KeyD")&&(c+=1),t.isKeyDown("KeyA")&&(c-=1);let p=o[0]*h+u[0]*c,v=o[2]*h+u[2]*c;const w=Math.hypot(p,v);if(w>0){p/=w,v/=w;const l=ne*e,b=p*l,A=v*l;n?n.moveAndCollide(this.position,b,A,ie):(this.position[0]+=b,this.position[2]+=A)}}viewMatrix(){const e=this.forward(),t=[this.position[0]+e[0],this.position[1]+e[1],this.position[2]+e[2]];return Z(this.position,t,[0,1,0])}projectionMatrix(e){return W(this.fov,e,this.near,this.far)}}const se=1.5,re=.2;class ae{constructor(e){a(this,"aabbs");this.aabbs=e.map(t=>({minX:t.center[0]-t.size[0]/2,maxX:t.center[0]+t.size[0]/2,minY:t.center[1]-t.size[1]/2,maxY:t.center[1]+t.size[1]/2,minZ:t.center[2]-t.size[2]/2,maxZ:t.center[2]+t.size[2]/2}))}verticalOverlap(e,t){const n=e-se,i=e+re;return n<t.maxY&&i>t.minY}moveAndCollide(e,t,n,i){const s=e[1];e[0]+=t;for(const o of this.aabbs){if(!this.verticalOverlap(s,o))continue;const u=e[0]>o.minX-i&&e[0]<o.maxX+i,c=e[2]>o.minZ-i&&e[2]<o.maxZ+i;u&&c&&(t>0?e[0]=o.minX-i:t<0&&(e[0]=o.maxX+i))}e[2]+=n;for(const o of this.aabbs){if(!this.verticalOverlap(s,o))continue;const u=e[0]>o.minX-i&&e[0]<o.maxX+i,c=e[2]>o.minZ-i&&e[2]<o.maxZ+i;u&&c&&(n>0?e[2]=o.minZ-i:n<0&&(e[2]=o.maxZ+i))}}}const ce={basic:{maxHealth:30,speed:2.2,damage:8,attackRange:1.6,scoreValue:100,size:[.7,1.8,.7],color:[.8,.16,.16]}};class le{constructor(e,t,n){a(this,"type");a(this,"archetype");a(this,"position");a(this,"rotation");a(this,"health");a(this,"maxHealth");a(this,"state");this.type=e;const i=ce[e];this.archetype=i,this.position=[t,i.size[1]/2,n],this.rotation=0,this.health=i.maxHealth,this.maxHealth=i.maxHealth,this.state="IDLE"}get isAlive(){return this.state!=="DEAD"&&this.health>0}}const _=20;class ue{constructor(){a(this,"enemies",[]);a(this,"instanceData",new Float32Array(0))}spawnFromLevel(e){this.enemies=e.enemySpawns.map(t=>new le(t.type,t.position[0],t.position[1]))}get all(){return this.enemies}get aliveCount(){let e=0;for(const t of this.enemies)t.isAlive&&e++;return e}update(e){}buildInstances(){const e=this.enemies.filter(i=>i.isAlive),t=e.length*_;this.instanceData.length<t&&(this.instanceData=new Float32Array(t));const n=this.instanceData;for(let i=0;i<e.length;i++){const s=e[i],o=s.archetype,u=q(R(s.position[0],s.position[1],s.position[2]),j(s.rotation),O(o.size[0],o.size[1],o.size[2])),c=i*_;n.set(u,c),n[c+16]=o.color[0],n[c+17]=o.color[1],n[c+18]=o.color[2],n[c+19]=1}return{data:n,count:e.length}}}const m=3,g=m/2,he=[.18,.18,.22],x=[.45,.42,.5],T=[.5,.3,.3],fe={id:1,name:"Setor 01 — Corredores",playerSpawn:{position:[0,1.6,9],yaw:0},boxes:[{center:[0,-.5,0],size:[24,1,24],color:he},{center:[0,g,-12],size:[24,m,1],color:x},{center:[0,g,12],size:[24,m,1],color:x},{center:[-12,g,0],size:[1,m,24],color:x},{center:[12,g,0],size:[1,m,24],color:x},{center:[-3,g,-3],size:[1,m,12],color:x},{center:[3,g,3],size:[1,m,12],color:x},{center:[6,g,-6],size:[2,m,2],color:T},{center:[-7,g,5],size:[2,m,2],color:T},{center:[8,g,7],size:[2,m,2],color:T}],enemySpawns:[{position:[0,-8],type:"basic"},{position:[8,3],type:"basic"},{position:[-8,-6],type:"basic"}]};function F(r){const e=document.getElementById("fatal");e&&(e.textContent=r,e.classList.remove("hidden")),console.error(r)}async function de(){const r=document.getElementById("gpu-canvas");if(!r){F("Canvas #gpu-canvas não encontrado no HTML.");return}let e;try{e=await M.create(r)}catch(l){F(l instanceof Error?l.message:String(l));return}e.resize(),window.addEventListener("resize",()=>e.resize());const t=new ee(e),n=new te(r),i=fe;t.setBoxes(i.boxes);const s=new ae(i.boxes),o=new ue;o.spawnFromLevel(i);const u=new oe([...i.playerSpawn.position],i.playerSpawn.yaw);let c=performance.now();function h(l){const b=Math.min((l-c)/1e3,.1);c=l,p(b);const A=u.viewMatrix(),N=e.canvas.width/e.canvas.height,Y=u.projectionMatrix(N),k=z(Y,A),D=o.buildInstances();t.render(k,D.data,D.count),requestAnimationFrame(h)}function p(l){u.update(l,n,s),o.update(l),w()}const v=document.getElementById("hint");function w(){v&&v.classList.toggle("hidden",n.isPointerLocked)}requestAnimationFrame(h),console.info(`[Jogo GPU] FASE 6 ok — ${o.aliveCount} inimigos no mapa "${i.name}".`)}de();
