// ============================================================
//  AudioManager — Som do jogo (CPU / Web Audio API)
// ------------------------------------------------------------
//  Tudo SINTETIZADO em tempo real (osciladores + ruído + filtros):
//  não há arquivos de áudio. Separado do renderer.
//
//  Sons 3D: cada som posicional passa por um PannerNode (HRTF) e o
//  "ouvinte" acompanha a câmera — dá para saber de onde vem o rosnado
//  no escuro. Há também um drone ambiente por zona, gotejamento,
//  batimento cardíaco com vida baixa e "stingers" para os sustos.
// ============================================================

type Out = AudioNode;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private drone: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private tension!: GainNode;
  private ambientTimer = 0;
  private heartTimer = 0;
  volume = 0.8;
  zone = 0;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = (this.ctx = new AudioContext());
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      // Compressor: evita estourar com muitos tiros juntos.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0.0;
      this.music.connect(this.master);
      this.tension = ctx.createGain();
      this.tension.gain.value = 0;
      this.tension.connect(this.music);
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.ctx;
  }

  resume(): void {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private get ok(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  private get now(): number {
    return this.ctx!.currentTime;
  }

  // ---------------------------------------------------------- blocos
  private env(g: AudioParam, t: number, peak: number, attack: number, decay: number): void {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private osc(out: Out, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0, attack = 0.005): OscillatorNode {
    const ctx = this.ctx!;
    const t = this.now + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    this.env(g.gain, t, peak, attack, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  private noise(out: Out, type: BiquadFilterType, f0: number, f1: number, dur: number, peak: number, delay = 0, q = 1, attack = 0.003): void {
    const ctx = this.ctx!;
    const t = this.now + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g.gain, t, peak, attack, dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + attack + dur + 0.05);
  }

  // Saída posicional (HRTF) para um som no ponto (x, y, z).
  private at(x: number, y: number, z: number, gain = 1): Out {
    const ctx = this.ctx!;
    const p = ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 2.5;
    p.maxDistance = 80;
    p.rolloffFactor = 1.3;
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(p).connect(this.sfx);
    setTimeout(() => g.disconnect(), 4000);
    return g;
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    if (!this.ok) return;
    const l = this.ctx!.listener;
    if (l.positionX) {
      const t = this.now;
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      (l as any).setPosition(x, y, z);
      (l as any).setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  // ------------------------------------------------------ armas
  weapon(kind: string): void {
    if (!this.ok) return;
    const o = this.sfx;
    switch (kind) {
      case "pistol":
        this.noise(o, "bandpass", 2600, 900, 0.12, 0.9, 0, 0.8);
        this.osc(o, "sine", 150, 45, 0.12, 0.8);
        this.noise(o, "lowpass", 900, 300, 0.35, 0.18, 0.02);
        break;
      case "shotgun":
        this.noise(o, "lowpass", 3200, 400, 0.4, 1.0);
        this.osc(o, "sine", 90, 32, 0.35, 1.0);
        this.noise(o, "lowpass", 700, 200, 0.8, 0.25, 0.03);
        this.pump(0.38);
        break;
      case "rifle":
        this.noise(o, "highpass", 1800, 900, 0.07, 0.75);
        this.osc(o, "sine", 160, 55, 0.07, 0.7);
        this.noise(o, "lowpass", 800, 250, 0.25, 0.12, 0.02);
        break;
      case "ak":
        this.noise(o, "bandpass", 1300, 500, 0.11, 0.95, 0, 0.7);
        this.osc(o, "sine", 110, 42, 0.1, 0.85);
        this.noise(o, "lowpass", 700, 200, 0.3, 0.15, 0.02);
        break;
      case "scar":
        this.noise(o, "bandpass", 1600, 500, 0.14, 1.0, 0, 0.6);
        this.osc(o, "sine", 95, 36, 0.16, 1.0);
        this.noise(o, "lowpass", 600, 150, 0.6, 0.2, 0.03);
        break;
      case "knife":
        this.noise(o, "bandpass", 3500, 700, 0.18, 0.35, 0, 2);
        break;
    }
  }

  private pump(delay: number): void {
    this.noise(this.sfx, "bandpass", 1800, 1200, 0.05, 0.35, delay, 3);
    this.noise(this.sfx, "bandpass", 1400, 900, 0.06, 0.4, delay + 0.16, 3);
  }

  dryFire(): void {
    if (!this.ok) return;
    this.osc(this.sfx, "square", 1800, 1600, 0.02, 0.12);
  }

  reload(kind: "out" | "in" | "shell" | "rack"): void {
    if (!this.ok) return;
    const o = this.sfx;
    if (kind === "out") this.noise(o, "bandpass", 1200, 900, 0.05, 0.3, 0, 4);
    else if (kind === "in") {
      this.noise(o, "bandpass", 1600, 1200, 0.04, 0.4, 0, 4);
      this.noise(o, "bandpass", 2400, 2000, 0.03, 0.3, 0.12, 5);
    } else if (kind === "shell") this.noise(o, "bandpass", 2000, 1400, 0.05, 0.35, 0, 3);
    else this.pump(0);
  }

  casing(x: number, y: number, z: number): void {
    if (!this.ok) return;
    const o = this.at(x, y, z, 0.35);
    const f = rand(3800, 6200);
    this.osc(o, "sine", f, f * 0.98, 0.06, 0.25);
    this.osc(o, "sine", f * 1.5, f * 1.4, 0.04, 0.12, 0.05);
  }

  impact(x: number, y: number, z: number, flesh: boolean): void {
    if (!this.ok) return;
    const o = this.at(x, y, z, 0.6);
    if (flesh) {
      this.noise(o, "lowpass", 700, 200, 0.1, 0.6);
      this.osc(o, "sine", 110, 60, 0.08, 0.4);
    } else this.noise(o, "highpass", 2500, 1500, 0.04, 0.25);
  }

  // ------------------------------------------------------ inimigos
  enemy(kind: string, ev: "alert" | "attack" | "hurt" | "death" | "idle" | "cast" | "slam", x: number, y: number, z: number): void {
    if (!this.ok) return;
    const loud = ev === "alert" || ev === "death" ? 1.2 : 1;
    const o = this.at(x, y, z, loud);
    switch (kind) {
      case "zombie": case "runner": case "corpse": {
        const base = kind === "runner" ? rand(130, 160) : rand(85, 110);
        if (ev === "idle" || ev === "alert") this.groan(o, base, ev === "alert" ? 1.1 : 1.4, ev === "alert" ? 0.5 : 0.28);
        else if (ev === "attack") this.groan(o, base * 1.4, 0.4, 0.45);
        else if (ev === "hurt") this.groan(o, base * 1.6, 0.25, 0.4);
        else if (ev === "death") this.groan(o, base * 1.2, 1.3, 0.55, true);
        break;
      }
      case "rat":
        if (ev === "death") this.squeak(o, 3, 1.0, true);
        else if (ev === "attack") (this.squeak(o, 1, 0.8), this.noise(o, "bandpass", 1500, 800, 0.08, 0.4, 0.05, 2));
        else this.squeak(o, ev === "alert" ? 3 : 2, 0.6);
        break;
      case "angler":
        if (ev === "alert") this.shriek(o, 1.3, 1.0);
        else if (ev === "attack") (this.shriek(o, 0.4, 0.6), this.noise(o, "lowpass", 1400, 300, 0.2, 0.8, 0.25));
        else if (ev === "death") this.shriek(o, 1.6, 0.8, true);
        else if (ev === "hurt") this.shriek(o, 0.3, 0.5);
        else this.bubble(o);
        break;
      case "shade":
        if (ev === "cast") {
          this.osc(o, "sine", 180, 1400, 0.45, 0.3, 0, 0.05);
          this.osc(o, "sawtooth", 60, 55, 0.5, 0.15, 0.1);
        } else if (ev === "death") (this.whisper(o, 1.6, 0.7), this.osc(o, "sine", 600, 60, 1.2, 0.35));
        else if (ev === "hurt") this.whisper(o, 0.3, 0.5);
        else this.whisper(o, ev === "alert" ? 1.2 : 1.6, ev === "alert" ? 0.7 : 0.35);
        break;
      case "troll": case "king": {
        const k = kind === "king" ? 0.8 : 1;
        if (ev === "alert" || ev === "idle") this.roar(o, 1.8 * (ev === "idle" ? 0.6 : 1), k, ev === "alert" ? 1.1 : 0.5);
        else if (ev === "slam") (this.osc(o, "sine", 70, 28, 0.6, 1.2), this.noise(o, "lowpass", 900, 100, 0.8, 0.9));
        else if (ev === "attack") this.roar(o, 0.6, k * 1.2, 0.8);
        else if (ev === "hurt") this.roar(o, 0.35, k * 1.4, 0.5);
        else if (ev === "death") this.roar(o, 2.6, k * 0.9, 1.2, true);
        break;
      }
    }
  }

  private groan(o: Out, f: number, dur: number, peak: number, fall = false): void {
    const ctx = this.ctx!;
    const t = this.now;
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(f, t);
    src.frequency.linearRampToValueAtTime(f * (fall ? 0.55 : 0.85), t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = rand(5, 8);
    const vg = ctx.createGain();
    vg.gain.value = f * 0.06;
    vib.connect(vg).connect(src.frequency);
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = rand(500, 750);
    f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = rand(1000, 1400);
    f2.Q.value = 5;
    const g = ctx.createGain();
    this.env(g.gain, t, peak, 0.12, dur);
    src.connect(f1).connect(g);
    src.connect(f2).connect(g);
    g.connect(o);
    src.start(t);
    vib.start(t);
    src.stop(t + dur + 0.2);
    vib.stop(t + dur + 0.2);
    this.noise(o, "bandpass", 900, 500, dur * 0.8, peak * 0.25, 0.05, 2, 0.1);
  }

  private squeak(o: Out, n: number, peak: number, fall = false): void {
    for (let i = 0; i < n; i++) {
      const f = rand(2600, 4200);
      this.osc(o, "sine", f, fall ? f * 0.4 : f * 1.3, fall ? 0.35 : 0.07, peak * 0.5, i * 0.09);
    }
  }

  private shriek(o: Out, dur: number, peak: number, fall = false): void {
    const ctx = this.ctx!;
    const t = this.now;
    const car = ctx.createOscillator();
    car.type = "sawtooth";
    car.frequency.setValueAtTime(fall ? 700 : 1100, t);
    car.frequency.exponentialRampToValueAtTime(fall ? 120 : 420, t + dur);
    const mod = ctx.createOscillator();
    mod.frequency.value = 73;
    const mg = ctx.createGain();
    mg.gain.value = 380;
    mod.connect(mg).connect(car.frequency);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 500;
    const g = ctx.createGain();
    this.env(g.gain, t, peak * 0.6, 0.02, dur);
    car.connect(hp).connect(g).connect(o);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.1);
    mod.stop(t + dur + 0.1);
    this.noise(o, "highpass", 3000, 1500, dur * 0.7, peak * 0.4);
  }

  private bubble(o: Out): void {
    for (let i = 0; i < 3; i++) this.osc(o, "sine", rand(150, 250), rand(300, 500), 0.06, 0.2, i * 0.12);
  }

  private whisper(o: Out, dur: number, peak: number): void {
    const ctx = this.ctx!;
    const t = this.now;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(rand(500, 900), t);
    f.frequency.linearRampToValueAtTime(rand(1500, 2600), t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(rand(400, 800), t + dur);
    const trem = ctx.createOscillator();
    trem.frequency.value = rand(7, 13);
    const tg = ctx.createGain();
    tg.gain.value = 0.5;
    const g = ctx.createGain();
    this.env(g.gain, t, peak, dur * 0.3, dur * 0.7);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    trem.connect(tg).connect(am.gain);
    s.connect(f).connect(am).connect(g).connect(o);
    s.start(t, Math.random());
    trem.start(t);
    s.stop(t + dur + 0.1);
    trem.stop(t + dur + 0.1);
  }

  private roar(o: Out, dur: number, pitch: number, peak: number, fall = false): void {
    const ctx = this.ctx!;
    const t = this.now;
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(75 * pitch, t);
    src.frequency.linearRampToValueAtTime((fall ? 35 : 60) * pitch, t + dur);
    const am = ctx.createOscillator();
    am.frequency.value = 28;
    const ag = ctx.createGain();
    ag.gain.value = 0.5;
    const vca = ctx.createGain();
    vca.gain.value = 0.5;
    am.connect(ag).connect(vca.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ctx.createGain();
    this.env(g.gain, t, peak, 0.15, dur);
    src.connect(vca).connect(lp).connect(g).connect(o);
    src.start(t);
    am.start(t);
    src.stop(t + dur + 0.2);
    am.stop(t + dur + 0.2);
    this.noise(o, "lowpass", 600, 200, dur, peak * 0.5, 0, 1, 0.15);
  }

  // ------------------------------------------------------ mundo / UI
  door(x: number, y: number, z: number, locked: boolean): void {
    if (!this.ok) return;
    const o = this.at(x, y, z, 0.9);
    if (locked) {
      this.osc(o, "square", 110, 110, 0.12, 0.25);
      this.osc(o, "square", 90, 90, 0.18, 0.25, 0.16);
    } else {
      this.noise(o, "lowpass", 380, 220, 0.9, 0.5, 0, 1, 0.1);
      this.osc(o, "sawtooth", 42, 36, 0.9, 0.25, 0, 0.1);
      this.noise(o, "bandpass", 900, 600, 0.12, 0.35, 0.85, 3);
    }
  }

  pickup(kind: "key" | "health" | "ammo" | "weapon"): void {
    if (!this.ok) return;
    const o = this.sfx;
    if (kind === "key") [880, 1320, 1760, 2640].forEach((f, i) => this.osc(o, "sine", f, f, 0.6, 0.3, i * 0.09));
    else if (kind === "health") (this.osc(o, "sine", 523, 523, 0.4, 0.3), this.osc(o, "sine", 784, 784, 0.45, 0.25, 0.08));
    else if (kind === "ammo") (this.noise(o, "bandpass", 1500, 1200, 0.05, 0.4, 0, 3), this.osc(o, "square", 660, 660, 0.06, 0.12, 0.06));
    else (this.noise(o, "lowpass", 800, 300, 0.2, 0.6), this.osc(o, "sine", 220, 110, 0.2, 0.5), this.osc(o, "square", 880, 880, 0.08, 0.12, 0.15));
  }

  footstep(water: boolean, sprint: boolean): void {
    if (!this.ok) return;
    const o = this.sfx;
    if (water) this.noise(o, "bandpass", rand(900, 1600), 500, 0.18, 0.22, 0, 1.5);
    else {
      this.noise(o, "lowpass", rand(250, 400), 120, 0.07, sprint ? 0.3 : 0.2);
      this.osc(o, "sine", rand(60, 80), 50, 0.06, 0.12);
    }
  }

  playerHurt(big: boolean): void {
    if (!this.ok) return;
    this.osc(this.sfx, "sawtooth", big ? 160 : 200, big ? 90 : 130, big ? 0.35 : 0.2, 0.35);
    this.noise(this.sfx, "lowpass", 600, 200, 0.15, 0.3);
  }

  playerDeath(): void {
    if (!this.ok) return;
    this.osc(this.sfx, "sawtooth", 180, 55, 1.4, 0.45);
    this.stinger(0.7);
  }

  heartbeat(): void {
    if (!this.ok) return;
    this.osc(this.sfx, "sine", 58, 40, 0.12, 0.6);
    this.osc(this.sfx, "sine", 52, 38, 0.14, 0.45, 0.22);
  }

  // Acorde dissonante + swell de ruído: o "pulo" dos sustos.
  stinger(vol = 1): void {
    if (!this.ok) return;
    const o = this.sfx;
    [110, 116.5, 155.6, 233, 246.9].forEach((f) => this.osc(o, "sawtooth", f, f * 0.97, 2.2, 0.12 * vol, 0, 0.01));
    this.noise(o, "highpass", 1200, 4000, 1.2, 0.35 * vol, 0, 1, 0.02);
    this.osc(o, "sine", 60, 30, 1.0, 0.5 * vol);
  }

  bang(x: number, y: number, z: number): void {
    if (!this.ok) return;
    const o = this.at(x, y, z, 1.5);
    this.noise(o, "lowpass", 2000, 200, 0.5, 1.0);
    this.osc(o, "sine", 220, 55, 0.4, 0.8);
  }

  lightningHit(x: number, y: number, z: number): void {
    if (!this.ok) return;
    const o = this.at(x, y, z, 0.9);
    this.noise(o, "highpass", 3000, 800, 0.3, 0.7);
    this.osc(o, "square", 90, 60, 0.25, 0.2);
  }

  ui(kind: "message" | "locked" | "checkpoint" | "victory"): void {
    if (!this.ok) return;
    const o = this.sfx;
    if (kind === "message") this.osc(o, "sine", 440, 440, 0.25, 0.08);
    else if (kind === "locked") this.osc(o, "square", 140, 120, 0.3, 0.2);
    else if (kind === "checkpoint") [523, 659, 784].forEach((f, i) => this.osc(o, "triangle", f, f, 0.3, 0.12, i * 0.1));
    else [392, 523, 659, 784, 1047].forEach((f, i) => this.osc(o, "triangle", f, f, 0.7, 0.2, i * 0.18));
  }

  scripted(name: string, x: number, y: number, z: number): void {
    if (name === "stinger") this.stinger();
    else if (name === "bang") this.bang(x, y, z);
    else if (name === "whisper") this.whisper(this.at(x + rand(-4, 4), y, z + rand(-4, 4), 1.2), 2.2, 0.8);
    else if (name === "squeak") this.squeak(this.at(x + 6, y, z, 1), 4, 0.7);
    else if (name === "roar") this.roar(this.sfx, 2.2, 0.8, 1.0);
    else if (name === "roar_far") this.roar(this.at(x + rand(-30, 30), y, z - 30, 1.5), 2.6, 0.7, 0.9);
  }

  // ------------------------------------------------------ trilha
  startMusic(): void {
    if (!this.ok || this.drone) return;
    const ctx = this.ctx!;
    const t = this.now;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    filter.connect(gain).connect(this.music);
    const oscs = [0, 0.3, 1.5].map((det, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = 55 * (i === 2 ? 1.5 : 1) + det;
      o.connect(filter);
      o.start(t);
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 120;
    lfo.connect(lg).connect(filter.frequency);
    lfo.start(t);
    this.drone = { oscs, filter, gain };
    // Camada de tensão (combate): cordas agudas desafinadas.
    const tf = ctx.createBiquadFilter();
    tf.type = "bandpass";
    tf.frequency.value = 900;
    tf.Q.value = 1.5;
    tf.connect(this.tension);
    [440, 466.2, 659.3].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(tf);
      o.start(t);
    });
    this.music.gain.setValueAtTime(0.0001, t);
    this.music.gain.exponentialRampToValueAtTime(0.11, t + 3);
  }

  // Atualização contínua: zona, tensão, ambiente e coração.
  tick(dt: number, zone: number, zoneBase: number, combat: number, lowHp: boolean, px: number, py: number, pz: number): void {
    if (!this.ok || !this.drone) return;
    const t = this.now;
    if (zone !== this.zone) {
      this.zone = zone;
      this.drone.oscs.forEach((o, i) => o.frequency.setTargetAtTime(zoneBase * (i === 2 ? 1.5 : 1) + (i === 1 ? 0.3 : i === 2 ? 1.5 : 0), t, 1.5));
    }
    this.tension.gain.setTargetAtTime(combat * 0.035, t, 0.8);
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = rand(2.5, 7);
      const o = this.at(px + rand(-12, 12), py + 2, pz + rand(-12, 12), 0.5);
      if (zone === 1) this.osc(o, "sine", rand(1200, 2200), rand(700, 1100), 0.12, 0.25); // gota
      else if (zone === 2) this.whisper(o, 2, 0.12);
      else if (zone === 3) this.noise(o, "lowpass", 140, 90, 2.5, 0.3, 0, 1, 0.5); // lava
      else if (zone === 4) this.noise(o, "bandpass", 300, 200, 3, 0.1, 0, 1, 1); // vento
      else this.noise(o, "bandpass", 700, 500, 0.3, 0.08, 0, 3); // rangido
    }
    if (lowHp) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 0.85;
        this.heartbeat();
      }
    }
  }
}
