// ============================================================
//  InputManager — Entrada de teclado e mouse (CPU)
// ------------------------------------------------------------
//  Centraliza o estado de input. É lógica de jogo pura (CPU),
//  sem nada de GPU.
//
//  Teclado: mantém um conjunto de teclas pressionadas (por "code",
//  independente do layout — KeyW funciona em qualquer teclado).
//
//  Mouse: usa a Pointer Lock API. Quando o ponteiro está "travado"
//  no canvas, o navegador fornece movimentos relativos
//  (movementX/movementY) — ideal para câmera FPS. Acumulamos esse
//  delta e o consumimos uma vez por frame.
// ============================================================

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();

  // Delta de mouse acumulado desde o último consumo (em pixels).
  private mouseDX = 0;
  private mouseDY = 0;

  private pointerLocked = false;

  // Disparo pendente (edge-triggered): vira true no clique e é
  // consumido uma vez por frame. Também guardamos se o botão está
  // segurado, para armas automáticas na FASE 10.
  private fireQueued = false;
  private fireHeld = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // ---- Teclado ----
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      // Evita a página rolar com as setas/espaço durante o jogo.
      if (this.pointerLocked) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    // ---- Pointer Lock: clicar no canvas trava o mouse ----
    this.canvas.addEventListener("click", () => {
      if (!this.pointerLocked) void this.canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      // Ao sair do lock, zera as teclas para o jogador não "andar sozinho".
      if (!this.pointerLocked) {
        this.keys.clear();
        this.fireHeld = false;
      }
    });

    // ---- Movimento do mouse (só conta quando travado) ----
    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    // ---- Disparo (botão esquerdo, só quando travado) ----
    // Obs.: o PRIMEIRO clique apenas engata o pointer lock (ainda não
    // travado aqui), então ele não dispara — comportamento desejado.
    window.addEventListener("mousedown", (e) => {
      if (!this.pointerLocked || e.button !== 0) return;
      this.fireQueued = true;
      this.fireHeld = true;
      e.preventDefault();
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
  }

  // Consome um disparo pendente (dispara no máx. 1×/frame por clique).
  consumeFire(): boolean {
    const f = this.fireQueued;
    this.fireQueued = false;
    return f;
  }

  // Botão de disparo segurado (para armas automáticas na FASE 10).
  get isFireHeld(): boolean {
    return this.fireHeld;
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  // Retorna o delta de mouse acumulado e o zera. Deve ser chamado
  // exatamente uma vez por frame (no update da câmera).
  consumeMouseDelta(): { dx: number; dy: number } {
    const delta = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }
}
