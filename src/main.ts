// ============================================================
//  main.ts — Ponto de entrada da aplicação (roda na CPU)
// ------------------------------------------------------------
//  Responsabilidades nesta FASE 1:
//    - obter o <canvas>;
//    - inicializar o WebGPU (GPUContext);
//    - criar o Renderer;
//    - rodar o game loop com requestAnimationFrame.
//
//  A separação update(dt) / render() já é preparada aqui, mesmo
//  que na FASE 1 não haja lógica de jogo para atualizar ainda.
// ============================================================

import { GPUContext } from "./gpu/GPUContext";
import { Renderer } from "./renderer/Renderer";
import { InputManager } from "./core/InputManager";
import { Camera } from "./game/Camera";
import { CollisionSystem } from "./collision/CollisionSystem";
import { EnemyManager } from "./game/enemies/EnemyManager";
import { RaycastSystem } from "./game/combat/RaycastSystem";
import { Player } from "./game/Player";
import { GameState, GameStateManager } from "./game/GameState";
import { WeaponManager } from "./game/weapons/WeaponManager";
import { Weapon } from "./game/weapons/Weapon";
import { PickupManager } from "./game/pickups/PickupManager";
import { AudioManager } from "./audio/AudioManager";
import { createLevel } from "./levels/levelFactory";
import * as mat4 from "./core/math/mat4";

// Distância para "entrar" na saída aberta.
const EXIT_REACH = 2.0;

// Exibe uma mensagem de erro em tela cheia (ex.: WebGPU indisponível).
function showFatal(message: string): void {
  const el = document.getElementById("fatal");
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
  }
  console.error(message);
}

async function boot(): Promise<void> {
  const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    showFatal("Canvas #gpu-canvas não encontrado no HTML.");
    return;
  }

  let gpu: GPUContext;
  try {
    // Inicializa adapter, device e contexto do canvas.
    gpu = await GPUContext.create(canvas);
  } catch (err) {
    showFatal(err instanceof Error ? err.message : String(err));
    return;
  }

  // Ajusta o framebuffer ao tamanho da janela agora e a cada resize.
  gpu.resize();
  window.addEventListener("resize", () => gpu.resize());

  const renderer = new Renderer(gpu);
  const input = new InputManager(canvas);
  const audio = new AudioManager();

  // Inimigos e pickups (populados por loadLevel).
  const enemies = new EnemyManager();
  const pickups = new PickupManager();

  // Estado do jogador e máquina de estados do jogo.
  // Começa em MENU: a jogabilidade só roda depois que o jogador inicia.
  const player = new Player();
  const game = new GameStateManager(GameState.MENU);
  const weapons = new WeaponManager();
  let lastHp = player.hp; // para detectar dano recebido e piscar a tela
  let prevLocked = false; // detecta a borda de perda do pointer lock (pausar)
  let elapsed = 0; // tempo acumulado (anima os pickups)
  let score = 0; // pontuação (aumenta ao abater inimigos)
  let exitOpen = false; // saída liberada quando todos os inimigos morrem

  // Nível atual (reatribuídos a cada fase por loadLevel).
  let levelNumber = 1;
  let level = createLevel(levelNumber);
  let collision = new CollisionSystem(level.boxes);

  // Câmera (posição/orientação definidas por loadLevel).
  const camera = new Camera([...level.playerSpawn.position], level.playerSpawn.yaw);

  // Carrega uma fase: monta mapa, colisão, inimigos, pickups e
  // reposiciona o jogador no spawn. Mantém HP/armas/score (progressão).
  function loadLevel(n: number): void {
    levelNumber = n;
    level = createLevel(n);
    collision = new CollisionSystem(level.boxes);
    renderer.setBoxes(level.boxes);
    enemies.spawnFromLevel(level);
    pickups.spawnFromLevel(level);
    camera.position = [...level.playerSpawn.position];
    camera.yaw = level.playerSpawn.yaw;
    camera.pitch = 0;
    exitOpen = false;
    lastHp = player.hp;
  }

  loadLevel(1);

  // ---------------------------------------------------------
  //  GAME LOOP
  //  update(dt): input + câmera FPS (WASD + mouse-look).
  //  render():   calcula viewProj (CPU); a GPU aplica model por instância.
  // ---------------------------------------------------------
  let lastTime = performance.now();

  function frame(now: number): void {
    // Limita dt para evitar "saltos" ao voltar de uma aba inativa.
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    elapsed += dt;

    update(dt);

    // --- Câmera: viewProj = Projection * View (a GPU aplica o model). ---
    const view = camera.viewMatrix();
    const aspect = gpu.canvas.width / gpu.canvas.height;
    const proj = camera.projectionMatrix(aspect);
    const viewProj = mat4.multiply(proj, view);

    // Instâncias dinâmicas: inimigos + pickups num único conjunto.
    const dyn = buildDynamicInstances(elapsed);
    renderer.render(viewProj, dyn.data, dyn.count);

    requestAnimationFrame(frame);
  }

  // Combina inimigos + pickups + a saída num só array de instâncias
  // (mesmo formato), para o Renderer desenhá-los juntos no draw dinâmico.
  let dynScratch: Float32Array<ArrayBuffer> = new Float32Array(0);
  function buildDynamicInstances(time: number): { data: Float32Array<ArrayBuffer>; count: number } {
    const e = enemies.buildInstances();
    const p = pickups.buildInstances(time);
    const FLOATS = 20;
    const total = e.count + p.count + 1; // +1 = a plataforma de saída
    if (dynScratch.length < total * FLOATS) dynScratch = new Float32Array(total * FLOATS);
    dynScratch.set(e.data.subarray(0, e.count * FLOATS), 0);
    dynScratch.set(p.data.subarray(0, p.count * FLOATS), e.count * FLOATS);

    // Plataforma de saída: pad baixo no chão. Vermelho (fechada) ou
    // verde pulsante (aberta, quando todos os inimigos morreram).
    const exitBase = (e.count + p.count) * FLOATS;
    const model = mat4.multiply(
      mat4.translation(level.exit.position[0], 0.1, level.exit.position[1]),
      mat4.scaling(3, 0.2, 3),
    );
    dynScratch.set(model, exitBase);
    if (exitOpen) {
      const glow = 0.6 + 0.4 * Math.sin(time * 4);
      dynScratch[exitBase + 16] = 0.15;
      dynScratch[exitBase + 17] = glow;
      dynScratch[exitBase + 18] = 0.35;
    } else {
      dynScratch[exitBase + 16] = 0.35;
      dynScratch[exitBase + 17] = 0.08;
      dynScratch[exitBase + 18] = 0.08;
    }
    dynScratch[exitBase + 19] = 1.0;

    return { data: dynScratch, count: total };
  }

  function update(dt: number): void {
    // Timers visuais rodam em qualquer estado (para a mira/flash sumirem).
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) crosshair?.classList.remove("shoot", "hit");
    }

    // --- Transições de estado guiadas pelo pointer lock ---
    const locked = input.isPointerLocked;
    if (game.is(GameState.MENU) || game.is(GameState.PAUSED)) {
      // Clicar no canvas engata o lock → começa/retoma o jogo.
      if (locked) game.set(GameState.PLAYING);
    } else if (game.is(GameState.PLAYING)) {
      // Perdeu o lock (ESC) → pausa (só na borda de queda).
      if (prevLocked && !locked) game.set(GameState.PAUSED);
    }
    prevLocked = locked;

    // Só há jogabilidade no estado PLAYING.
    if (!game.is(GameState.PLAYING)) {
      updateOverlays();
      return;
    }

    // Atualiza a câmera FPS (movimento resolvido contra o mapa).
    camera.update(dt, input, collision);
    // Atualiza a IA dos inimigos; eles podem causar dano ao jogador.
    enemies.update(dt, camera.position, collision, player);
    // Coleta de pickups (adiciona munição ao passar por cima).
    if (pickups.update(camera.position, weapons)) audio.playPickup();
    // Armas: troca, recarga, cadência e disparo.
    updateWeapons(dt);
    // Passos ao se mover.
    updateFootsteps(dt);

    // Recebeu dano neste frame? Pisca a tela + som de dor.
    if (player.hp < lastHp) {
      triggerDamageFlash();
      audio.playPlayerHurt();
    }
    lastHp = player.hp;

    // Morreu? → Game Over.
    if (!player.isAlive) {
      triggerGameOver();
      updateOverlays();
      return;
    }

    // Saída: abre quando todos os inimigos foram derrotados.
    exitOpen = enemies.aliveCount === 0;
    if (exitOpen) {
      const dx = camera.position[0] - level.exit.position[0];
      const dz = camera.position[2] - level.exit.position[1];
      if (Math.hypot(dx, dz) < EXIT_REACH) triggerLevelComplete();
    }

    updateOverlays();
  }

  // ---- Referências de elementos da UI (declaradas juntas p/ evitar TDZ) ----
  const damageFlash = document.getElementById("damage-flash");
  const gameoverEl = document.getElementById("gameover");
  const levelCompleteEl = document.getElementById("levelcomplete");
  const lcScore = document.getElementById("lc-score");
  const startEl = document.getElementById("start");
  const hint = document.getElementById("hint");
  const crosshair = document.getElementById("crosshair");
  const hud = document.getElementById("hud");
  const hudHp = document.getElementById("hud-hp");
  const hudArmor = document.getElementById("hud-armor");
  const hudWeapon = document.getElementById("hud-weapon");
  const hudAmmo = document.getElementById("hud-ammo");
  const hudScore = document.getElementById("hud-score");
  const hudLevel = document.getElementById("hud-level");
  const hudEnemies = document.getElementById("hud-enemies");

  function triggerDamageFlash(): void {
    if (!damageFlash) return;
    damageFlash.classList.add("active");
    // Remove no próximo tick para acionar a transição de fade-out.
    window.setTimeout(() => damageFlash.classList.remove("active"), 60);
  }

  function triggerGameOver(): void {
    game.set(GameState.GAME_OVER);
    audio.playGameOver();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Fase concluída: mostra a tela e aguarda o clique para a próxima.
  function triggerLevelComplete(): void {
    game.set(GameState.LEVEL_COMPLETE);
    audio.playLevelComplete();
    if (lcScore) lcScore.textContent = `SCORE: ${score}`;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Passos: toca em intervalos enquanto o jogador se move.
  let stepTimer = 0;
  function updateFootsteps(dt: number): void {
    const moving =
      input.isKeyDown("KeyW") ||
      input.isKeyDown("KeyS") ||
      input.isKeyDown("KeyA") ||
      input.isKeyDown("KeyD");
    if (!moving) {
      stepTimer = 0;
      return;
    }
    stepTimer -= dt;
    if (stepTimer <= 0) {
      audio.playFootstep();
      stepTimer = 0.42;
    }
  }

  // Reinício total (após morrer): volta à fase 1 com tudo zerado.
  function restart(): void {
    player.reset();
    weapons.reset();
    score = 0;
    loadLevel(1);
    game.set(GameState.PLAYING);
    void canvas!.requestPointerLock();
  }

  // Avança para a próxima fase (mantém HP/armas/score da progressão).
  function nextLevel(): void {
    loadLevel(levelNumber + 1);
    game.set(GameState.PLAYING);
    void canvas!.requestPointerLock();
  }

  // Cliques nas telas de fim reiniciam / avançam.
  gameoverEl?.addEventListener("click", () => {
    if (game.is(GameState.GAME_OVER)) restart();
  });
  levelCompleteEl?.addEventListener("click", () => {
    if (game.is(GameState.LEVEL_COMPLETE)) nextLevel();
  });

  // Solicita o pointer lock de forma segura (o retorno pode ser Promise).
  function requestLock(): void {
    const r = canvas!.requestPointerLock() as unknown;
    if (r && typeof (r as Promise<void>).catch === "function") {
      (r as Promise<void>).catch(() => {
        /* navegador pode recusar temporariamente; ignoramos */
      });
    }
  }

  // Inicia (a partir do MENU) ou retoma (a partir do PAUSE) o jogo.
  // Colocar o estado em PLAYING aqui garante que o clique SEMPRE inicia,
  // mesmo que o pointer lock demore ou seja negado; o mouse-look ativa
  // assim que o lock engatar.
  function beginPlay(): void {
    if (game.is(GameState.MENU) || game.is(GameState.PAUSED)) {
      // O clique é o gesto que autoriza o áudio no navegador.
      audio.resume();
      audio.startMusic();
      game.set(GameState.PLAYING);
      updateOverlays();
      requestLock();
    }
  }

  // As telas de início e pausa iniciam/retomam o jogo ao serem clicadas.
  startEl?.addEventListener("click", beginPlay);
  hint?.addEventListener("click", beginPlay);

  // Troca de arma, recarga, cadência e disparo.
  function updateWeapons(dt: number): void {
    weapons.update(dt);

    // Troca de arma (1/2/3). switchTo ignora índice repetido.
    if (input.isKeyDown("Digit1")) weapons.switchTo(0);
    if (input.isKeyDown("Digit2")) weapons.switchTo(1);
    if (input.isKeyDown("Digit3")) weapons.switchTo(2);
    // Recarga manual.
    if (input.isKeyDown("KeyR")) weapons.reloadCurrent();

    const w = weapons.current;

    // Intenção de disparo: automáticas usam o botão segurado;
    // semiautomáticas, o clique (edge). Sempre limpamos o edge.
    const wantFire = w.config.automatic ? input.isFireHeld : input.consumeFire();
    if (w.config.automatic) input.consumeFire();

    if (wantFire) {
      if (w.canFire) fireWeapon(w);
      else if (w.magazine === 0 && !w.isReloading) w.beginReload(); // auto-reload
    }
  }

  // Executa um disparo: consome munição e lança 1+ rays (pellets)
  // com dispersão (spread), aplicando dano ao que acertar.
  function fireWeapon(w: Weapon): void {
    w.fire();
    audio.playShot(w.config.ammoType);
    let anyHit = false;
    let anyKill = false;
    for (let p = 0; p < w.config.pellets; p++) {
      const dir = spreadDirection(w.config.spread);
      const hit = RaycastSystem.raycast(camera.position, dir, w.config.range, enemies.all, level.boxes);
      if (hit) {
        const killed = hit.enemy.takeDamage(w.config.damage);
        anyHit = true;
        if (killed) {
          anyKill = true;
          score += hit.enemy.archetype.scoreValue; // pontuação por abate
        }
      }
    }
    if (anyKill) audio.playEnemyDeath();
    else if (anyHit) audio.playEnemyHit();
    flashCrosshair(anyHit);
  }

  // Direção do tiro com dispersão aleatória em torno do "forward".
  function spreadDirection(spread: number): [number, number, number] {
    const f = camera.forward();
    if (spread <= 0) return f;

    // Eixos perpendiculares ao olhar (right e up da câmera).
    let rx = -f[2];
    let rz = f[0];
    const rlen = Math.hypot(rx, rz) || 1;
    rx /= rlen;
    rz /= rlen;
    // up = right × forward
    const ux = rz * f[1] - 0 * f[2];
    const uy = 0 * f[0] - rx * f[1];
    const uz = rx * f[2] - rz * f[0];

    const ox = (Math.random() * 2 - 1) * spread;
    const oy = (Math.random() * 2 - 1) * spread;

    let dx = f[0] + rx * ox + ux * oy;
    let dy = f[1] + uy * oy;
    let dz = f[2] + rz * ox + uz * oy;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    return [dx, dy, dz];
  }

  // Feedback visual da mira: pulso no disparo; vermelho ao acertar.
  let flashTimer = 0;
  function flashCrosshair(hit: boolean): void {
    if (!crosshair) return;
    crosshair.classList.add("shoot");
    crosshair.classList.toggle("hit", hit);
    flashTimer = 0.08; // segundos
  }

  // Mostra/esconde cada overlay conforme o estado atual do jogo.
  function updateOverlays(): void {
    const s = game.state;
    startEl?.classList.toggle("hidden", s !== GameState.MENU);
    hint?.classList.toggle("hidden", s !== GameState.PAUSED);
    gameoverEl?.classList.toggle("hidden", s !== GameState.GAME_OVER);
    levelCompleteEl?.classList.toggle("hidden", s !== GameState.LEVEL_COMPLETE);
    // Mira e HUD só quando efetivamente jogando.
    const playing = s === GameState.PLAYING;
    crosshair?.classList.toggle("hidden", !playing);
    hud?.classList.toggle("hidden", !playing);
    if (playing) updateHud();
  }

  // Atualiza todos os campos do HUD (HP/armor/arma/munição/score/fase/inimigos).
  function updateHud(): void {
    const w = weapons.current;
    if (hudHp) {
      hudHp.textContent = String(player.hp);
      // Fica vermelho quando a vida está baixa.
      hudHp.classList.toggle("low", player.hp <= 30);
    }
    if (hudArmor) hudArmor.textContent = String(player.armor);
    if (hudWeapon) hudWeapon.textContent = w.config.name;
    if (hudAmmo) {
      hudAmmo.textContent = w.isReloading ? "RECARGA..." : `${w.magazine} / ${w.reserve}`;
    }
    if (hudScore) hudScore.textContent = String(score);
    if (hudLevel) hudLevel.textContent = String(level.id);
    if (hudEnemies) hudEnemies.textContent = String(enemies.aliveCount);
  }

  updateOverlays(); // mostra a tela de início já no primeiro frame
  requestAnimationFrame(frame);
  console.info(`[Jogo GPU] FASE 17 ok — áudio sintetizado (tiros/inimigos/dano/pickup/passos/música).`);
}

boot();
