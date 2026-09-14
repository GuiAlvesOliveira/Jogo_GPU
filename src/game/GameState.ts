// ============================================================
//  GameState — Máquina de estados do jogo (CPU)
// ------------------------------------------------------------
//  Controla em que "tela"/modo o jogo está. O loop principal usa
//  isso para decidir o que atualizar (ex.: pausar a jogabilidade
//  quando não está em PLAYING).
//
//  Estados previstos (§27). Nesta FASE 9 usamos PLAYING e GAME_OVER;
//  MENU/PAUSED/LEVEL_COMPLETE entram nas fases de telas/fases.
// ============================================================

export enum GameState {
  MENU = "MENU",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  LEVEL_COMPLETE = "LEVEL_COMPLETE",
  GAME_OVER = "GAME_OVER",
}

export class GameStateManager {
  private current: GameState;

  constructor(initial: GameState = GameState.PLAYING) {
    this.current = initial;
  }

  get state(): GameState {
    return this.current;
  }

  is(state: GameState): boolean {
    return this.current === state;
  }

  set(state: GameState): void {
    this.current = state;
  }
}
