// ============================================================
//  main.ts — Ponto de entrada (CPU)
// ------------------------------------------------------------
//  1) Inicializa o WebGPU (GPUContext) e o Renderer;
//  2) baixa os assets (modelos GLB, texturas) mostrando o progresso;
//  3) cria o Game e liga menus/pointer lock;
//  4) roda o loop: update(dt) na CPU → render() na GPU.
//
//  Modo de teste: ?debug expõe window.__game; ?autostart=normal
//  começa direto (sem pointer lock) — usado nos testes automáticos.
// ============================================================

import { GPUContext } from "./gpu/GPUContext";
import { Renderer } from "./render/Renderer";
import { InputManager } from "./core/InputManager";
import { AudioManager } from "./audio/AudioManager";
import { loadAssets } from "./game/Assets";
import { Game } from "./game/Game";
import type { Difficulty, GameMode } from "./game/Game";
import { CELL } from "./levels/LevelData";

const $ = (id: string) => document.getElementById(id)!;

function showFatal(message: string): void {
  const el = $("fatal");
  el.textContent = message;
  el.classList.remove("hidden");
  console.error(message);
}

async function boot(): Promise<void> {
  const canvas = $("gpu-canvas") as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  let gpu: GPUContext;
  try {
    gpu = await GPUContext.create(canvas);
  } catch (err) {
    showFatal(err instanceof Error ? err.message : String(err));
    return;
  }
  const resize = () => gpu.resize();
  resize();
  window.addEventListener("resize", resize);

  const renderer = new Renderer(gpu);
  const input = new InputManager(canvas);
  const audio = new AudioManager();

  let assets;
  try {
    assets = await loadAssets(renderer, (f) => {
      ($("load-bar") as HTMLElement).style.width = `${Math.round(f * 100)}%`;
    });
  } catch (err) {
    showFatal("Falha ao carregar os assets do jogo:\n" + (err instanceof Error ? err.message : String(err)));
    return;
  }
  const game = new Game(renderer, assets, input, audio);
  $("loading").classList.add("hidden");
  $("menu-buttons").classList.remove("hidden");

  // ------------------------------------------------ telas e estados
  const screens = ["menu", "pause", "dead", "victory"];
  const show = (id: string | null) => screens.forEach((s) => $(s).classList.toggle("hidden", s !== id));
  game.onModeChange = (m: GameMode) => {
    game.hud.show(m === "playing");
    if (m === "playing") show(null);
    else if (m === "paused") show("pause");
    else if (m === "victory") {
      const s = game.stats();
      $("stats").innerHTML = `
        <tr><td>Tempo</td><td>${s.time}</td></tr>
        <tr><td>Inimigos abatidos</td><td>${s.kills}</td></tr>
        <tr><td>Segredos</td><td>${s.secrets}</td></tr>
        <tr><td>Mortes</td><td>${s.deaths}</td></tr>
        <tr><td>Precisão</td><td>${s.accuracy}</td></tr>`;
      show("victory");
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (m === "dead") {
      if (document.pointerLockElement) document.exitPointerLock();
      setTimeout(() => game.mode === "dead" && show("dead"), 1600);
    }
    game.automap.hide();
  };

  const start = (diff: Difficulty) => {
    audio.resume();
    audio.startMusic();
    game.newGame(diff);
    if (!input.unlockedPlay) input.requestLock();
  };
  document.querySelectorAll<HTMLButtonElement>("#menu-buttons button").forEach((b) =>
    b.addEventListener("click", () => start(b.dataset.diff as Difficulty)),
  );
  $("btn-resume").addEventListener("click", () => {
    audio.resume();
    game.resume();
    input.requestLock();
  });
  const restart = () => {
    game.newGame(game.difficulty);
    input.requestLock();
  };
  $("btn-restart").addEventListener("click", restart);
  $("btn-restart2").addEventListener("click", restart);
  $("btn-checkpoint").addEventListener("click", () => {
    game.respawn();
    input.requestLock();
  });
  $("btn-menu").addEventListener("click", () => {
    show("menu");
    game.mode = "menu";
    game.hud.show(false);
  });
  $("sens").addEventListener("input", (e) => (game.player.sensitivity = 0.0022 * Number((e.target as HTMLInputElement).value)));
  $("vol").addEventListener("input", (e) => audio.setVolume(Number((e.target as HTMLInputElement).value)));
  // Clicar no jogo pausado/retomando o mouse.
  canvas.addEventListener("click", () => {
    if (game.mode === "playing" && !input.isPointerLocked && !input.unlockedPlay) input.requestLock();
  });
  // Perdeu o pointer lock (ESC) → pausa.
  document.addEventListener("pointerlockchange", () => {
    if (!input.isPointerLocked && game.mode === "playing" && !input.unlockedPlay) game.pause();
  });

  // ------------------------------------------------------ modo debug
  if (params.has("debug") || params.has("autostart")) {
    (window as any).__game = {
      game,
      input,
      tp: (cx: number, cz: number, yaw = 0) => game.player.spawn((cx + 0.5) * CELL, (cz + 0.5) * CELL, yaw, game.level),
      god: (on = true) => (game.player.godMode = on),
      giveAll: () => {
        for (const id of ["mossberg", "m4", "ak47", "scar"]) game.arsenal.give(id);
        game.player.keys = new Set(["red", "blue", "yellow"]);
      },
    };
  }
  if (params.has("autostart")) {
    input.unlockedPlay = true;
    start((params.get("autostart") as Difficulty) || "normal");
  }

  // ------------------------------------------------------------ loop
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    fpsAcc += now - last;
    fpsN++;
    if (fpsAcc > 1000) {
      (window as any).__fps = Math.round((fpsN * 1000) / fpsAcc);
      fpsAcc = 0;
      fpsN = 0;
    }
    last = now;
    game.update(dt);
    document.body.classList.toggle("lowhp", game.mode === "playing" && game.player.hp <= 30);
    game.render(gpu.canvas.width / gpu.canvas.height);
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  console.info("[SETOR ZERO] pronto — WebGPU puro, sem engine.");
}

boot();
