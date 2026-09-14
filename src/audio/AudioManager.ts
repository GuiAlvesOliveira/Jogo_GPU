// ============================================================
//  AudioManager — Áudio do jogo (CPU / Web Audio API)
// ------------------------------------------------------------
//  Totalmente SEPARADO do renderer (§25/§26). Usa a Web Audio API
//  para SINTETIZAR os sons em tempo real (osciladores + ruído),
//  então não precisamos de arquivos de áudio — e o resultado
//  "bip/boom" combina com a estética retrô.
//
//  Regras de autoplay dos navegadores: o AudioContext só pode
//  tocar após um gesto do usuário. Por isso chamamos `resume()`
//  no clique de iniciar o jogo.
//
//  Sons: tiros (por arma), acerto/morte de inimigo, dano no
//  jogador, pickup, fase concluída, game over, passos e uma
//  música ambiente (drone grave contínuo).
// ============================================================

import { AmmoType } from "../game/weapons/Weapon";

interface ToneOptions {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  freqTo?: number; // varredura de frequência até o fim
  delay?: number; // atraso antes de tocar (s)
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicStarted = false;

  // Cria o contexto sob demanda (após gesto do usuário).
  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);
    }
    return this.ctx;
  }

  // Retoma o áudio (chamar no clique de iniciar/continuar).
  resume(): void {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  private get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  // ---- Blocos de síntese ----

  // Oscilador com envelope percussivo (ataque rápido, decaimento).
  private tone(o: ToneOptions): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t + o.dur);

    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  // Rajada de ruído branco filtrado (para tiros/impactos).
  private noise(dur: number, gain: number, filter: BiquadFilterType, freq: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = filter;
    filt.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master!);
    src.start(t);
    src.stop(t + dur);
  }

  // ---- Sons do jogo ----

  playShot(ammo: AmmoType): void {
    if (!this.ready) return;
    if (ammo === "pistol") {
      this.noise(0.08, 0.4, "highpass", 900);
      this.tone({ freq: 180, freqTo: 60, dur: 0.09, type: "square", gain: 0.18 });
    } else if (ammo === "shotgun") {
      this.noise(0.2, 0.6, "lowpass", 1100);
      this.tone({ freq: 90, freqTo: 40, dur: 0.2, type: "sawtooth", gain: 0.25 });
    } else {
      // rifle
      this.noise(0.05, 0.3, "highpass", 1400);
      this.tone({ freq: 240, freqTo: 130, dur: 0.05, type: "square", gain: 0.14 });
    }
  }

  playEnemyHit(): void {
    if (!this.ready) return;
    this.tone({ freq: 520, freqTo: 300, dur: 0.06, type: "square", gain: 0.15 });
  }

  playEnemyDeath(): void {
    if (!this.ready) return;
    this.tone({ freq: 300, freqTo: 40, dur: 0.4, type: "sawtooth", gain: 0.28 });
    this.noise(0.3, 0.25, "lowpass", 700);
  }

  playPlayerHurt(): void {
    if (!this.ready) return;
    this.tone({ freq: 150, freqTo: 70, dur: 0.25, type: "sawtooth", gain: 0.3 });
    this.noise(0.12, 0.2, "lowpass", 500);
  }

  playPickup(): void {
    if (!this.ready) return;
    this.tone({ freq: 660, dur: 0.08, type: "square", gain: 0.18 });
    this.tone({ freq: 990, dur: 0.1, type: "square", gain: 0.18, delay: 0.07 });
  }

  playLevelComplete(): void {
    if (!this.ready) return;
    const notes = [523, 659, 784, 1047]; // C E G C (arpejo ascendente)
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: "square", gain: 0.2, delay: i * 0.12 }));
  }

  playGameOver(): void {
    if (!this.ready) return;
    this.tone({ freq: 300, freqTo: 80, dur: 0.7, type: "sawtooth", gain: 0.3 });
    this.tone({ freq: 200, freqTo: 50, dur: 0.9, type: "square", gain: 0.2, delay: 0.15 });
  }

  playFootstep(): void {
    if (!this.ready) return;
    this.noise(0.05, 0.12, "lowpass", 380);
    this.tone({ freq: 70, dur: 0.06, type: "sine", gain: 0.12 });
  }

  // ---- Música ambiente (drone grave contínuo) ----

  startMusic(): void {
    if (!this.ready || this.musicStarted) return;
    this.musicStarted = true;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    // Dois osciladores levemente desafinados dão um drone "vivo".
    const freqs = [55, 55.4, 82.5];
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 220;
    filt.connect(this.musicGain!);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.connect(filt);
      osc.start(t);
    }
    // Sobe o volume da música suavemente.
    this.musicGain!.gain.setValueAtTime(0.0001, t);
    this.musicGain!.gain.exponentialRampToValueAtTime(0.06, t + 2.0);
  }
}
