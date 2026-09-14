// ============================================================
//  Camera — Câmera em primeira pessoa (CPU)
// ------------------------------------------------------------
//  Guarda o estado da câmera FPS e produz a VIEW MATRIX que será
//  combinada com projection/model e enviada à GPU.
//
//  Estado:
//    - position [x, y, z]
//    - yaw   (rotação horizontal, radianos) — olhar p/ os lados
//    - pitch (rotação vertical, radianos)   — olhar p/ cima/baixo
//    - fov, near, far (parâmetros da projeção)
//
//  Convenção de orientação:
//    yaw = 0 e pitch = 0  → olhando para -Z.
//    forward = (cos(pitch)·sin(yaw), sin(pitch), -cos(pitch)·cos(yaw))
//
//  O pitch é limitado para não "virar de cabeça para baixo".
// ============================================================

import { InputManager } from "../core/InputManager";
import { CollisionSystem } from "../collision/CollisionSystem";
import * as mat4 from "../core/math/mat4";
import { Mat4 } from "../core/math/mat4";

// Limite do pitch: ~89° para cima/baixo.
const PITCH_LIMIT = (89 * Math.PI) / 180;
// Sensibilidade do mouse (radianos por pixel).
const MOUSE_SENSITIVITY = 0.0022;
// Velocidade de deslocamento (unidades por segundo).
const MOVE_SPEED = 4.0;
// Raio de colisão do jogador (cápsula/cilindro visto de cima).
const PLAYER_RADIUS = 0.35;

export class Camera {
  position: [number, number, number];
  yaw: number;
  pitch: number;

  fov: number; // em radianos
  near: number;
  far: number;

  constructor(
    position: [number, number, number] = [0, 1.2, 4],
    yaw = 0,
    pitch = 0,
  ) {
    this.position = position;
    this.yaw = yaw;
    this.pitch = pitch;
    this.fov = (70 * Math.PI) / 180;
    this.near = 0.1;
    this.far = 100;
  }

  // Vetor "para frente" completo (inclui o pitch). Usado para o olhar.
  forward(): [number, number, number] {
    const cp = Math.cos(this.pitch);
    return [cp * Math.sin(this.yaw), Math.sin(this.pitch), -cp * Math.cos(this.yaw)];
  }

  // Atualiza a câmera a partir do input (mouse-look + WASD).
  // Se `collision` for fornecido, o deslocamento é resolvido contra
  // o mapa (o jogador não atravessa paredes). Sem gravidade ainda.
  update(dt: number, input: InputManager, collision?: CollisionSystem): void {
    // ---- Mouse-look ----
    const { dx, dy } = input.consumeMouseDelta();
    this.yaw += dx * MOUSE_SENSITIVITY;
    this.pitch -= dy * MOUSE_SENSITIVITY; // mover mouse p/ cima → olhar p/ cima

    // Limita o pitch.
    if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
    if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;

    // ---- Movimento WASD (no plano XZ, ignorando o pitch) ----
    // Direção "frente" projetada no chão.
    const flatFwd: [number, number, number] = [Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
    // Direção "direita" = (cos(yaw), 0, sin(yaw)).
    const right: [number, number, number] = [Math.cos(this.yaw), 0, Math.sin(this.yaw)];

    let mx = 0;
    let mz = 0;
    if (input.isKeyDown("KeyW")) mz += 1;
    if (input.isKeyDown("KeyS")) mz -= 1;
    if (input.isKeyDown("KeyD")) mx += 1;
    if (input.isKeyDown("KeyA")) mx -= 1;

    // Vetor de movimento combinado.
    let vx = flatFwd[0] * mz + right[0] * mx;
    let vz = flatFwd[2] * mz + right[2] * mx;

    // Normaliza para não andar mais rápido na diagonal.
    const len = Math.hypot(vx, vz);
    if (len > 0) {
      vx /= len;
      vz /= len;
      const step = MOVE_SPEED * dt;
      const dx = vx * step;
      const dz = vz * step;

      if (collision) {
        // Movimento com resolução de colisão (não atravessa paredes).
        // Faixa vertical do jogador: pés um pouco acima do chão.
        const feet = this.position[1] - 1.5;
        const head = this.position[1] + 0.2;
        collision.moveAndCollide(this.position, dx, dz, PLAYER_RADIUS, feet, head);
      } else {
        this.position[0] += dx;
        this.position[2] += dz;
      }
    }
  }

  // View matrix a partir da posição e do vetor de olhar.
  viewMatrix(): Mat4 {
    const f = this.forward();
    const target: [number, number, number] = [
      this.position[0] + f[0],
      this.position[1] + f[1],
      this.position[2] + f[2],
    ];
    return mat4.lookAt(this.position, target, [0, 1, 0]);
  }

  // Projection matrix a partir do aspect ratio atual.
  projectionMatrix(aspect: number): Mat4 {
    return mat4.perspective(this.fov, aspect, this.near, this.far);
  }
}
