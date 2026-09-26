// ============================================================
//  Animator.ts — Animação de esqueleto (CPU) → matrizes de osso
// ------------------------------------------------------------
//  Por frame, para cada personagem VISÍVEL:
//    1) amostra o(s) clipe(s) ativo(s) no tempo atual: para cada nó
//       animado acha os 2 keyframes vizinhos e interpola (lerp para
//       posição/escala, slerp para rotação);
//    2) faz CROSSFADE entre o clipe anterior e o novo (transição
//       suave de ~0,2 s, ex.: andar → atacar);
//    3) percorre a hierarquia (pai antes do filho) calculando a
//       matriz global de cada nó;
//    4) matriz do osso = global(junta) * inversa_de_bind(junta).
//  O resultado (uma mat4 por osso) vai para a GPU, que deforma os
//  vértices (ver skinned.wgsl).
// ============================================================

import type { GLBClip, GLBModel } from "../assets/GLB";
import * as mat4 from "../core/math/mat4";
import { slerpInto } from "../core/math/quat";

const POSE = 10; // t(3) + r(4) + s(3) por nó

// Dados de esqueleto compartilhados por todas as instâncias de um modelo.
export class SkeletonDef {
  readonly model: GLBModel;
  readonly nodeCount: number;
  readonly order: Int32Array; // pais antes dos filhos
  readonly parents: Int32Array;
  readonly rest: Float32Array;
  readonly joints: Int32Array;
  readonly inverseBind: Float32Array;
  readonly jointCount: number;

  constructor(model: GLBModel) {
    this.model = model;
    const n = model.nodes.length;
    this.nodeCount = n;
    this.parents = new Int32Array(n);
    this.rest = new Float32Array(n * POSE);
    model.nodes.forEach((node, i) => {
      this.parents[i] = node.parent;
      this.rest.set([...node.t, ...node.r, ...node.s], i * POSE);
    });
    const order: number[] = [];
    const visit = (i: number) => {
      order.push(i);
      for (const c of model.nodes[i].children) visit(c);
    };
    for (const r of model.roots) visit(r);
    this.order = Int32Array.from(order);
    const skin = model.skins[0];
    this.joints = Int32Array.from(skin.joints);
    this.inverseBind = skin.inverseBind;
    this.jointCount = skin.joints.length;
  }

  clip(name: string): GLBClip | undefined {
    return this.model.clips.get(name);
  }
}

// Amostra um clipe no tempo t, sobrescrevendo os canais animados em `pose`.
function sampleClip(clip: GLBClip, t: number, pose: Float32Array): void {
  for (const ch of clip.channels) {
    const times = ch.times;
    const n = times.length;
    const base = ch.node * POSE + (ch.path === "translation" ? 0 : ch.path === "rotation" ? 3 : 7);
    const comps = ch.path === "rotation" ? 4 : 3;
    const v = ch.values;
    if (t <= times[0] || n === 1) {
      for (let k = 0; k < comps; k++) pose[base + k] = v[k];
      continue;
    }
    if (t >= times[n - 1]) {
      for (let k = 0; k < comps; k++) pose[base + k] = v[(n - 1) * comps + k];
      continue;
    }
    // Busca binária do keyframe.
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const f = ch.step ? 0 : (t - times[lo]) / (times[hi] - times[lo]);
    const a = lo * comps, b = hi * comps;
    if (comps === 4) {
      slerpInto(pose, base, v[a], v[a + 1], v[a + 2], v[a + 3], v[b], v[b + 1], v[b + 2], v[b + 3], f);
    } else {
      pose[base] = v[a] + (v[b] - v[a]) * f;
      pose[base + 1] = v[a + 1] + (v[b + 1] - v[a + 1]) * f;
      pose[base + 2] = v[a + 2] + (v[b + 2] - v[a + 2]) * f;
    }
  }
}

export interface PlayOptions {
  loop?: boolean;
  speed?: number;
  fade?: number;
  restart?: boolean;
  startAt?: number; // 0..1 da duração
}

// Estado de animação de UMA instância (um inimigo).
export class AnimState {
  readonly def: SkeletonDef;
  clip: GLBClip | null = null;
  clipName = "";
  time = 0;
  speed = 1;
  loop = true;
  private prev: GLBClip | null = null;
  private prevTime = 0;
  private prevSpeed = 1;
  private prevLoop = true;
  private fade = 0;
  private fadeDur = 0;
  private readonly pose: Float32Array;
  private readonly tmp: Float32Array;
  private readonly globals: Float32Array;
  private readonly local = new Float32Array(16);

  constructor(def: SkeletonDef) {
    this.def = def;
    this.pose = new Float32Array(def.rest);
    this.tmp = new Float32Array(def.rest);
    this.globals = new Float32Array(def.nodeCount * 16);
  }

  play(name: string, o: PlayOptions = {}): void {
    const clip = this.def.clip(name);
    if (!clip) return;
    if (clip === this.clip && !o.restart) {
      this.speed = o.speed ?? this.speed;
      this.loop = o.loop ?? this.loop;
      return;
    }
    const fade = o.fade ?? 0.2;
    if (this.clip && fade > 0) {
      this.prev = this.clip;
      this.prevTime = this.time;
      this.prevSpeed = this.speed;
      this.prevLoop = this.loop;
      this.fade = fade;
      this.fadeDur = fade;
    } else {
      this.prev = null;
      this.fade = 0;
    }
    this.clip = clip;
    this.clipName = name;
    this.time = (o.startAt ?? 0) * clip.duration;
    this.speed = o.speed ?? 1;
    this.loop = o.loop ?? true;
  }

  // Fração 0..1 do clipe atual (para sincronizar golpes com a animação).
  get progress(): number {
    return this.clip && this.clip.duration > 0 ? Math.min(1, this.time / this.clip.duration) : 1;
  }

  get finished(): boolean {
    if (!this.clip || this.loop) return false;
    return this.speed < 0 ? this.time <= 0 : this.time >= this.clip.duration;
  }

  private advance(t: number, clip: GLBClip, speed: number, loop: boolean, dt: number): number {
    t += dt * speed;
    if (loop) {
      if (clip.duration > 0) t = ((t % clip.duration) + clip.duration) % clip.duration;
    } else t = Math.max(0, Math.min(t, clip.duration));
    return t;
  }

  update(dt: number): void {
    if (this.clip) this.time = this.advance(this.time, this.clip, this.speed, this.loop, dt);
    if (this.prev) {
      this.prevTime = this.advance(this.prevTime, this.prev, this.prevSpeed, this.prevLoop, dt);
      this.fade -= dt;
      if (this.fade <= 0) this.prev = null;
    }
  }

  // Calcula as matrizes de osso e grava em out[offset..] (16 floats por osso).
  writeBones(out: Float32Array, offset: number): void {
    const def = this.def;
    const pose = this.pose;
    pose.set(def.rest);
    if (this.clip) sampleClip(this.clip, this.time, pose);
    if (this.prev && this.fadeDur > 0) {
      // Mistura: pose = lerp(anterior, atual, w)
      const tmp = this.tmp;
      tmp.set(def.rest);
      sampleClip(this.prev, this.prevTime, tmp);
      const w = 1 - Math.max(0, this.fade / this.fadeDur);
      for (let i = 0; i < def.nodeCount; i++) {
        const b = i * POSE;
        for (let k = 0; k < 3; k++) pose[b + k] = tmp[b + k] + (pose[b + k] - tmp[b + k]) * w;
        slerpInto(pose, b + 3, tmp[b + 3], tmp[b + 4], tmp[b + 5], tmp[b + 6], pose[b + 3], pose[b + 4], pose[b + 5], pose[b + 6], w);
        for (let k = 7; k < 10; k++) pose[b + k] = tmp[b + k] + (pose[b + k] - tmp[b + k]) * w;
      }
    }
    // Hierarquia: global = global(pai) * local
    const g = this.globals;
    const L = this.local;
    for (let k = 0; k < def.order.length; k++) {
      const i = def.order[k];
      const b = i * POSE;
      mat4.fromTRSInto(L, 0, pose[b], pose[b + 1], pose[b + 2], pose[b + 3], pose[b + 4], pose[b + 5], pose[b + 6], pose[b + 7], pose[b + 8], pose[b + 9]);
      const p = def.parents[i];
      if (p < 0) g.set(L, i * 16);
      else mat4.multiplyInto(g, g, L, p * 16, 0, i * 16);
    }
    // Osso = global(junta) * inversaBind(junta)
    for (let j = 0; j < def.jointCount; j++) {
      mat4.multiplyInto(out, g, def.inverseBind, def.joints[j] * 16, j * 16, offset + j * 16);
    }
  }

  // Posição (no espaço do modelo) de um nó, após writeBones.
  nodePosition(node: number): [number, number, number] {
    const g = this.globals;
    return [g[node * 16 + 12], g[node * 16 + 13], g[node * 16 + 14]];
  }
}
