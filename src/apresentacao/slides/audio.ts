// Capítulo 11 — Áudio: mesa de som com o AudioManager real, analisador e HRTF.

import type { SlideDef } from "../deck";
import { loop, fitCanvas } from "../dom";
import { AudioManager } from "../../audio/AudioManager";
import { codeBlock } from "../highlight";
import { snippet } from "../data/codigo";
import { combine } from "./common";

let audio: AudioManager | null = null;
let enabled = false;

const ENEMY_KINDS = ["zombie", "runner", "rat", "angler", "shade", "troll", "king"] as const;
const ENEMY_NAMES: Record<string, string> = { zombie: "zumbi", runner: "corredora", rat: "rato", angler: "abissal", shade: "sombra", troll: "troll", king: "rei" };
const EVENTS = ["idle", "alert", "attack", "hurt", "death"] as const;
const EV_NAMES: Record<string, string> = { idle: "ocioso", alert: "alerta", attack: "ataque", hurt: "dor", death: "morte", cast: "raio", slam: "impacto" };

export const mesaDeSom: SlideDef = {
  id: "audio",
  title: "Mesa de som: tudo sintetizado",
  lead: "Nenhum arquivo de áudio: cada som é montado na hora com osciladores, ruído filtrado e envelopes (Web Audio API), pelo mesmo <code>AudioManager</code> do jogo. Os sons de inimigos passam por um PannerNode HRTF.",
  body: () => `
  <div class="au fill">
    <div class="stack">
      <div class="panel tight row au-on"><button class="btn primary au-enable">🔊 Ligar o áudio</button><span class="small muted">O navegador só libera som depois de um clique.</span><span class="spacer"></span><label class="chk"><input type="checkbox" class="au-music"> drone ambiente</label></div>
      <div class="panel tight">
        <div class="h4">Armas</div>
        <div class="au-btns">${["pistol", "shotgun", "rifle", "ak", "scar", "knife"].map((k) => `<button class="btn sm" data-w="${k}">${k}</button>`).join("")}<button class="btn sm" data-x="dry">gatilho seco</button><button class="btn sm" data-x="reload">recarga</button><button class="btn sm" data-x="rack">bomba</button></div>
      </div>
      <div class="panel tight au-matrix">
        <div class="h4">Inimigos (som 3D à frente do ouvinte)</div>
        <table class="au-grid"><thead><tr><th></th>${EVENTS.map((e) => `<th>${EV_NAMES[e]}</th>`).join("")}<th>extra</th></tr></thead><tbody>${ENEMY_KINDS.map(
          (k) => `<tr><th>${ENEMY_NAMES[k]}</th>${EVENTS.map((e) => `<td><button class="au-cell" data-k="${k}" data-e="${e}" aria-label="${ENEMY_NAMES[k]} ${EV_NAMES[e]}">▶</button></td>`).join("")}<td>${k === "shade" ? `<button class="au-cell" data-k="shade" data-e="cast">raio</button>` : k === "troll" || k === "king" ? `<button class="au-cell" data-k="${k}" data-e="slam">impacto</button>` : ""}</td></tr>`,
        ).join("")}</tbody></table>
      </div>
      <div class="panel tight">
        <div class="h4">Jogo</div>
        <div class="au-btns"><button class="btn sm" data-x="stinger">susto (stinger)</button><button class="btn sm" data-x="heart">coração</button><button class="btn sm" data-x="hurt">dano</button><button class="btn sm" data-x="pickup">pegar item</button><button class="btn sm" data-x="key">chave</button><button class="btn sm" data-x="door">porta</button><button class="btn sm" data-x="locked">trancada</button><button class="btn sm" data-x="step">passo</button><button class="btn sm" data-x="victory">vitória</button></div>
      </div>
    </div>
    <div class="stack">
      <div class="panel flush au-scope"><canvas class="au-canvas"></canvas></div>
      <div class="au-bottom">
        <div class="panel flush au-pad-wrap"><canvas class="au-pad" aria-label="Posição do som 3D"></canvas></div>
        <div class="panel tight small">
          <div class="h4">Som 3D (HRTF)</div>
          <p>Clique ou arraste no quadrado: o ouvinte (centro) olha para cima. Use fone de ouvido — o rosnado vem da direção e da distância certas, como no escuro do jogo.</p>
          ${codeBlock(snippet("src/audio/AudioManager.ts", 'p.panningModel = "HRTF"', "p.rolloffFactor", 5).code, "ts", { numbers: false })}
        </div>
      </div>
    </div>
  </div>`,
  mount: (root) => {
    const scope = root.querySelector(".au-canvas") as HTMLCanvasElement;
    const pad = root.querySelector(".au-pad") as HTMLCanvasElement;
    const sctx = scope.getContext("2d")!;
    const pctx = pad.getContext("2d")!;
    let src: [number, number] = [6, -8];
    let pulse = 0;
    const enable = () => {
      if (!audio) audio = new AudioManager();
      audio.resume();
      audio.setVolume(0.8);
      enabled = true;
      (root.querySelector(".au-enable") as HTMLElement).textContent = "🔊 Áudio ligado";
      window.setTimeout(() => audio?.setListener(0, 1.6, 0, 0, 0, -1), 60);
    };
    if (enabled && audio) {
      audio.setVolume(0.8);
      (root.querySelector(".au-enable") as HTMLElement).textContent = "🔊 Áudio ligado";
    }
    const ensure = (fn: () => void) => {
      if (!enabled) {
        enable();
        window.setTimeout(fn, 120);
      } else fn();
    };
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest(".au-enable")) return enable();
      const w = t.closest("[data-w]") as HTMLElement | null;
      if (w) return ensure(() => audio!.weapon(w.dataset.w!));
      const c = t.closest("[data-k]") as HTMLElement | null;
      if (c) {
        pulse = 1;
        return ensure(() => audio!.enemy(c.dataset.k!, c.dataset.e as "idle", src[0], 1.6, src[1]));
      }
      const x = t.closest("[data-x]") as HTMLElement | null;
      if (!x) return;
      ensure(() => {
        const a = audio!;
        switch (x.dataset.x) {
          case "dry": a.dryFire(); break;
          case "reload": a.reload("out"); window.setTimeout(() => a.reload("in"), 450); break;
          case "rack": a.reload("rack"); break;
          case "stinger": a.stinger(); break;
          case "heart": a.heartbeat(); break;
          case "hurt": a.playerHurt(true); break;
          case "pickup": a.pickup("ammo"); break;
          case "key": a.pickup("key"); break;
          case "door": a.door(src[0], 1.2, src[1], false); break;
          case "locked": a.door(src[0], 1.2, src[1], true); break;
          case "step": a.footstep(false, false); break;
          case "victory": a.ui("victory"); break;
        }
      });
    };
    const music = root.querySelector(".au-music") as HTMLInputElement;
    const onMusic = () =>
      ensure(() => {
        if (music.checked) audio!.startMusic();
        audio!.setVolume(0.8);
      });
    const toPad = (e: PointerEvent): [number, number] => {
      const r = pad.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      return [(u - 0.5) * 30, (v - 0.5) * 30];
    };
    let dragging = false;
    let lastPlay = 0;
    const playAt = () => {
      const now = performance.now();
      if (now - lastPlay < 350) return;
      lastPlay = now;
      pulse = 1;
      ensure(() => audio!.enemy("zombie", "idle", src[0], 1.6, src[1]));
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      pad.setPointerCapture(e.pointerId);
      src = toPad(e);
      playAt();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      src = toPad(e);
      playAt();
    };
    const onUp = () => (dragging = false);
    root.addEventListener("click", onClick);
    music.addEventListener("change", onMusic);
    pad.addEventListener("pointerdown", onDown);
    pad.addEventListener("pointermove", onMove);
    pad.addEventListener("pointerup", onUp);
    pad.style.touchAction = "none";
    let wave = new Uint8Array(2048);
    let spec = new Uint8Array(1024);
    const stop = loop((dt) => {
      pulse = Math.max(0, pulse - dt * 1.5);
      // osciloscópio + espectro
      const { w, h } = fitCanvas(scope);
      sctx.fillStyle = "#0c1014";
      sctx.fillRect(0, 0, w, h);
      sctx.strokeStyle = "#ffffff10";
      sctx.beginPath();
      sctx.moveTo(0, h * 0.3);
      sctx.lineTo(w, h * 0.3);
      sctx.stroke();
      if (audio && enabled) {
        const an = audio.analyser();
        if (wave.length !== an.fftSize) wave = new Uint8Array(an.fftSize);
        if (spec.length !== an.frequencyBinCount) spec = new Uint8Array(an.frequencyBinCount);
        an.getByteTimeDomainData(wave);
        an.getByteFrequencyData(spec);
        sctx.strokeStyle = "#8fd1e0";
        sctx.lineWidth = 2;
        sctx.beginPath();
        for (let i = 0; i < wave.length; i++) {
          const x = (i / (wave.length - 1)) * w, y = h * 0.3 + ((wave[i] - 128) / 128) * h * 0.26;
          if (i) sctx.lineTo(x, y);
          else sctx.moveTo(x, y);
        }
        sctx.stroke();
        const bins = 96;
        const bw = w / bins;
        for (let b = 0; b < bins; b++) {
          const lo = Math.floor(Math.pow(b / bins, 2) * spec.length), hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / bins, 2) * spec.length));
          let m = 0;
          for (let k = lo; k < hi; k++) m = Math.max(m, spec[k]);
          const bh = (m / 255) * h * 0.38;
          sctx.fillStyle = "#cc7a1f";
          sctx.fillRect(b * bw + 1, h - bh, bw - 2, bh);
        }
      }
      sctx.fillStyle = "#7c8792";
      sctx.font = `${Math.round(h * 0.05)}px "IBM Plex Mono", monospace`;
      sctx.fillText("forma de onda (AnalyserNode)", 10, h * 0.07);
      sctx.fillText("espectro (FFT 2048)", 10, h * 0.6);
      // pad HRTF
      const P = fitCanvas(pad);
      const pw = P.w, ph = P.h;
      pctx.fillStyle = "#0c1014";
      pctx.fillRect(0, 0, pw, ph);
      pctx.strokeStyle = "#ffffff12";
      for (let r = 1; r <= 3; r++) {
        pctx.beginPath();
        pctx.arc(pw / 2, ph / 2, (r * pw) / 6, 0, Math.PI * 2);
        pctx.stroke();
      }
      pctx.fillStyle = "#ece6da";
      pctx.beginPath();
      pctx.moveTo(pw / 2, ph / 2 - 12);
      pctx.lineTo(pw / 2 + 9, ph / 2 + 8);
      pctx.lineTo(pw / 2 - 9, ph / 2 + 8);
      pctx.closePath();
      pctx.fill();
      const sx = (src[0] / 30 + 0.5) * pw, sy = (src[1] / 30 + 0.5) * ph;
      pctx.strokeStyle = "#f2a65a";
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.arc(sx, sy, 8 + pulse * 26, 0, Math.PI * 2);
      pctx.stroke();
      pctx.fillStyle = "#f2a65a";
      pctx.beginPath();
      pctx.arc(sx, sy, 7, 0, Math.PI * 2);
      pctx.fill();
      pctx.fillStyle = "#7c8792";
      pctx.font = `${Math.round(pw * 0.045)}px "IBM Plex Mono", monospace`;
      pctx.fillText(`${Math.round(Math.hypot(src[0], src[1]))} m`, sx + 12, sy - 10);
    });
    return combine(stop, () => {
      root.removeEventListener("click", onClick);
      music.removeEventListener("change", onMusic);
      pad.removeEventListener("pointerdown", onDown);
      pad.removeEventListener("pointermove", onMove);
      pad.removeEventListener("pointerup", onUp);
      audio?.setVolume(0);
    });
  },
};


