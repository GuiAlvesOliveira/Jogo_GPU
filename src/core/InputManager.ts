// ============================================================
//  InputManager — Teclado e mouse (CPU)
// ------------------------------------------------------------
//  Teclado: conjunto de teclas pressionadas (por "code", independente
//  do layout) + teclas que acabaram de ser pressionadas neste frame.
//  Mouse: Pointer Lock (movimento relativo para a câmera FPS),
//  botões esquerdo/direito e roda (troca de arma).
// ============================================================

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private locked = false;
  private fireDown = false;
  private firePressed = false;
  private aimDown = false;
  // Modo de teste automatizado: aceita input sem pointer lock.
  unlockedPlay = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.active && (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow"))) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.keys.clear();
        this.fireDown = false;
        this.aimDown = false;
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener("mousedown", (e) => {
      if (!this.active) return;
      if (e.button === 0) {
        this.fireDown = true;
        this.firePressed = true;
      } else if (e.button === 2) this.aimDown = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireDown = false;
      else if (e.button === 2) this.aimDown = false;
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener(
      "wheel",
      (e) => {
        if (this.active) this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
  }

  private get active(): boolean {
    return this.locked || this.unlockedPlay;
  }

  get isPointerLocked(): boolean {
    return this.locked;
  }

  requestLock(): void {
    const r = this.canvas.requestPointerLock() as unknown;
    if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  // Tecla pressionada NESTE frame (borda de subida).
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  get fire(): boolean {
    return this.fireDown;
  }

  get firePressedNow(): boolean {
    return this.firePressed;
  }

  get aim(): boolean {
    return this.aimDown;
  }

  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  // Chamado no fim de cada frame: limpa as bordas.
  endFrame(): void {
    this.pressed.clear();
    this.firePressed = false;
  }

  // Simulação (testes): pressiona/solta teclas via código.
  simulate(code: string, down: boolean): void {
    if (down) {
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    } else this.keys.delete(code);
  }
  simulateFire(down: boolean): void {
    this.fireDown = down;
    if (down) this.firePressed = true;
  }
  simulateMouse(dx: number, dy: number): void {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }
}
