# PROJETO: FPS 3D RETRÔ COM WEBGPU

Quero desenvolver um jogo FPS 3D completo para navegador, inspirado na sensação e estrutura dos clássicos FPS dos anos 90, especialmente jogos como DOOM, mas com identidade visual e código próprios.

O projeto deve ser desenvolvido utilizando **WebGPU como API gráfica principal**, com forte utilização da GPU através de **shaders WGSL**.

## 1. OBJETIVO

Criar um jogo de tiro em primeira pessoa 3D com:

* Câmera em primeira pessoa.
* Mundo/mapa 3D.
* Movimento livre do jogador.
* Mouse para olhar ao redor.
* Teclado para movimentação.
* Armas.
* Munição espalhada pelo mapa.
* Inimigos.
* Sistema de vida/dano.
* Combate em tempo real.
* Sistema de fases.
* Cada fase deve aumentar a dificuldade.
* Número de inimigos crescente.
* Inimigos progressivamente mais resistentes.
* Sistema de pontuação.
* HUD.
* Tela de início.
* Tela de Game Over.
* Tela de conclusão da fase.
* Progressão entre fases.

A experiência deve lembrar um FPS retrô rápido e agressivo, com mapas labirínticos, corredores, salas, inimigos e recursos espalhados pelo cenário.

---

# 2. RESTRIÇÃO PRINCIPAL: WEBGPU

A implementação gráfica deve utilizar **WebGPU diretamente**.

Não quero que o projeto utilize uma engine 3D pronta como:

* Unity
* Unreal Engine
* Godot
* Three.js
* Babylon.js
* PlayCanvas

Também não quero simplesmente criar uma abstração que esconda o funcionamento da GPU.

O objetivo deste projeto é aprender e demonstrar programação gráfica utilizando WebGPU.

Utilize:

* GPUDevice
* GPUAdapter
* GPUCanvasContext
* GPUBuffer
* GPUTexture
* GPUSampler
* GPUBindGroup
* GPURenderPipeline
* GPUCommandEncoder
* GPURenderPassEncoder
* Compute shaders quando fizer sentido
* Vertex shaders
* Fragment shaders
* WGSL

A arquitetura deve deixar explícito o que está sendo executado na CPU e o que está sendo executado na GPU.

---

# 3. FILOSOFIA DO PROJETO

Quero que a GPU seja utilizada de maneira significativa.

Não faça um projeto onde o JavaScript calcula praticamente tudo e a WebGPU apenas desenha triângulos.

Sempre que tecnicamente fizer sentido, utilizar a GPU para:

* Transformações de vértices.
* Matrizes de transformação.
* Iluminação.
* Cálculos de visibilidade.
* Processamento de partículas.
* Efeitos visuais.
* Atualização de grandes quantidades de entidades.
* Cálculos paralelizáveis.
* Processamento de dados através de compute shaders.

Entretanto, não force o uso de compute shaders onde isso torne a arquitetura desnecessariamente complexa.

A CPU continuará responsável pela lógica de alto nível do jogo:

* Input.
* Estado das fases.
* Regras do jogo.
* Spawn de inimigos.
* IA de alto nível.
* Colisões quando for mais apropriado.
* Gerenciamento de recursos.
* Progressão.
* Pontuação.

A renderização e operações matemáticas adequadas devem ser realizadas pela GPU.

---

# 4. TECNOLOGIAS

Utilize inicialmente:

* HTML5
* CSS3
* JavaScript ou TypeScript
* WebGPU
* WGSL

Se TypeScript proporcionar uma arquitetura significativamente melhor, prefira TypeScript.

O projeto deve ser executado localmente através de um servidor de desenvolvimento.

Estruture o projeto de maneira modular.

Sugestão:

src/
core/
renderer/
gpu/
shaders/
game/
player/
enemies/
weapons/
world/
collision/
ui/
audio/
levels/
assets/

Não crie todos os arquivos imediatamente.

Construa o projeto incrementalmente.

---

# 5. RENDERIZADOR 3D

Criar um renderer próprio utilizando WebGPU.

O renderer deverá possuir:

* Inicialização do WebGPU.
* Configuração do canvas.
* Render loop.
* Depth buffer.
* Camera.
* View matrix.
* Projection matrix.
* Model matrix.
* Vertex buffers.
* Index buffers.
* Uniform buffers.
* Bind groups.
* Pipelines.
* Texturas.
* Samplers.
* Shaders WGSL.

Utilizar uma matriz de transformação tradicional:

Model → View → Projection.

A câmera deve funcionar como uma câmera FPS.

---

# 6. CÂMERA

Implementar câmera em primeira pessoa.

Variáveis principais:

* posição X/Y/Z
* yaw
* pitch
* FOV
* near plane
* far plane

Controles:

W = frente
S = trás
A = esquerda
D = direita

Mouse:

* movimento horizontal → yaw
* movimento vertical → pitch

O pitch deve possuir limite para impedir rotação excessiva.

Implementar Pointer Lock API para permitir controle de mouse típico de FPS.

---

# 7. MOVIMENTAÇÃO

O jogador deve possuir:

* velocidade
* aceleração opcional
* gravidade
* colisão
* altura
* raio/cápsula de colisão

O jogador não pode atravessar paredes.

Inicialmente não é necessário implementar um sistema extremamente sofisticado de física.

Priorizar:

* estabilidade
* simplicidade
* bom funcionamento
* código compreensível

---

# 8. MAPA

O jogo terá mapas 3D compostos por:

* corredores
* salas
* paredes
* pisos
* tetos
* portas
* obstáculos

Quero que o mapa seja definido através de dados, e não completamente codificado manualmente em chamadas de renderização.

Criar um sistema de level data.

Por exemplo:

Level {
id
name
playerSpawn
rooms
walls
doors
enemySpawns
ammoSpawns
pickups
exit
}

Inicialmente podemos utilizar formas geométricas simples:

* cubos
* planos
* prismas

Posteriormente o sistema poderá evoluir para mapas mais complexos.

---

# 9. ESTILO VISUAL

A estética deve ser inspirada em FPS retrô.

Características:

* ambientes escuros
* iluminação dramática
* texturas de baixa resolução
* geometria relativamente simples
* alto contraste
* efeitos de sangue/faíscas
* HUD retrô
* atmosfera de horror/sci-fi

Porém, NÃO copiar personagens, mapas, armas ou assets específicos de DOOM.

Criar uma identidade própria.

---

# 10. INIMIGOS

Criar sistema genérico de inimigos.

Cada inimigo deverá possuir:

* posição
* rotação
* vida
* vida máxima
* velocidade
* dano
* distância de ataque
* estado
* pontuação concedida
* modelo/mesh
* textura

Estados iniciais:

IDLE
ALERT
CHASE
ATTACK
HURT
DEAD

Comportamento básico:

1. Inimigo está parado.
2. Detecta o jogador.
3. Começa a persegui-lo.
4. Aproxima-se.
5. Ataca quando estiver dentro do alcance.
6. Recebe dano.
7. Morre quando HP <= 0.

---

# 11. DIFICULDADE DAS FASES

O jogo deve ser dividido em fases.

Exemplo inicial:

FASE 1:

* 5 inimigos
* HP baixo
* dano baixo

FASE 2:

* 8 inimigos
* HP aumentado
* dano aumentado

FASE 3:

* 12 inimigos
* HP aumentado
* inimigos mais rápidos

FASE 4:

* 16 inimigos
* maior resistência
* maior dano

FASE 5:

* 22 inimigos
* combinação de tipos de inimigos
* dificuldade elevada

Não limitar o sistema a esses números.

Criar um sistema matemático de scaling.

Por exemplo:

enemyCount = baseCount + level * scaling

enemyHealth = baseHealth * healthMultiplier

enemyDamage = baseDamage * damageMultiplier

enemySpeed = baseSpeed * speedMultiplier

Esses valores devem ser configuráveis.

---

# 12. TIPOS DE INIMIGOS

Criar inicialmente pelo menos 3 arquétipos.

## Inimigo básico

* HP baixo
* velocidade média
* ataque corpo a corpo

## Inimigo rápido

* HP baixo
* velocidade alta
* pouco dano

## Inimigo pesado

* HP alto
* velocidade baixa
* dano alto

Posteriormente poderemos adicionar inimigos com ataques à distância.

---

# 13. ARMAS

Criar sistema de armas modular.

Inicialmente implementar:

## Pistola

* dano moderado
* munição comum
* disparo rápido

## Shotgun

* alto dano próximo
* múltiplos projéteis
* munição limitada

## Rifle

* dano médio
* alta cadência

O sistema deverá permitir adicionar armas futuramente.

Cada arma deverá possuir:

* damage
* fireRate
* magazineSize
* ammoType
* reloadTime
* pellets
* spread

---

# 14. SISTEMA DE TIRO

O tiro inicialmente pode utilizar ray casting.

Ao pressionar o botão esquerdo do mouse:

1. Criar ray a partir da câmera.
2. Determinar direção.
3. Detectar primeiro inimigo atingido.
4. Aplicar dano.
5. Gerar efeito visual.
6. Atualizar munição.
7. Atualizar score.

O sistema deve separar:

Weapon
→ Shooting
→ Raycast
→ Damage
→ Enemy
→ Score

---

# 15. MUNIÇÃO

Espalhar pickups de munição pelo mapa.

Exemplos:

* Ammo Pistol
* Ammo Shotgun
* Ammo Rifle

Cada pickup deve possuir:

* posição
* tipo
* quantidade

Quando o jogador passa sobre o pickup:

* adicionar munição
* remover pickup
* atualizar HUD

A quantidade de munição deve ser limitada.

---

# 16. VIDA DO JOGADOR

O jogador deverá possuir:

* HP máximo
* HP atual

Ao sofrer dano:

HP -= damage

Se:

HP <= 0

→ Game Over.

Adicionar posteriormente:

* armadura
* pickups de vida
* power-ups

---

# 17. HUD

Criar HUD em HTML/CSS ou renderização 2D separada.

Exibir:

* HP
* Armor
* Munição atual
* Munição reserva
* Arma atual
* Score
* Fase
* Inimigos restantes

Exemplo:

HP: 100
ARMOR: 50
AMMO: 12 / 48
SCORE: 1250
LEVEL: 3
ENEMIES: 7

---

# 18. SCORE

Sistema de pontuação.

Exemplo:

Inimigo básico = 100 pontos
Inimigo rápido = 150 pontos
Inimigo pesado = 300 pontos

Adicionar bônus posteriormente para:

* headshots
* combos
* tempo
* completar fase sem morrer

---

# 19. SISTEMA DE FASE

Fluxo:

MENU
↓
FASE 1
↓
DERROTAR TODOS OS INIMIGOS
↓
ABRIR SAÍDA
↓
TELA DE CONCLUSÃO
↓
FASE 2
↓
FASE 3
↓
...

A saída da fase inicialmente só deve ficar disponível quando todos os inimigos forem derrotados.

---

# 20. GAME LOOP

Criar um game loop utilizando requestAnimationFrame.

Separar claramente:

update(deltaTime)

e

render()

O fluxo deverá ser aproximadamente:

Input
↓
Game Update
↓
Player Update
↓
Enemy Update
↓
Physics / Collision
↓
Weapon Update
↓
GPU Commands
↓
Render

Evitar misturar lógica de jogo diretamente com código de renderização.

---

# 21. PERFORMANCE

O projeto deve ser pensado para GPU desde o início.

Implementar futuramente:

* instanced rendering
* frustum culling
* batching
* depth testing
* texture atlases
* object pooling
* GPU buffers reutilizáveis

Não implementar otimizações complexas antes de existir uma versão funcional.

Primeiro fazer funcionar.

Depois medir.

Depois otimizar.

---

# 22. SHADERS WGSL

Criar shaders separados e organizados.

Exemplo:

shaders/
basic.vert.wgsl
basic.frag.wgsl
textured.vert.wgsl
textured.frag.wgsl
lighting.vert.wgsl
lighting.frag.wgsl
particle.compute.wgsl

Os shaders devem ser comentados.

Quero entender claramente:

* quais dados entram no shader
* quais buffers são utilizados
* quais cálculos acontecem na GPU
* quais dados retornam

---

# 23. ILUMINAÇÃO

Implementar inicialmente iluminação simples.

Começar com:

* ambient light
* directional light

Depois evoluir para:

* point lights
* attenuation
* emissive materials
* muzzle flash
* iluminação dinâmica

A iluminação deverá ser calculada nos shaders.

---

# 24. EFEITOS

Adicionar posteriormente:

* muzzle flash
* partículas
* sangue
* impacto de tiro
* fumaça
* explosões
* partículas de morte
* iluminação temporária

Sempre que adequado, utilizar GPU/compute shaders para partículas.

---

# 25. ÁUDIO

Adicionar posteriormente:

* tiros
* passos
* inimigos
* dano
* morte
* pickups
* música ambiente

O sistema de áudio deve ser separado do renderer.

---

# 26. ARQUITETURA

Quero uma arquitetura modular.

Evitar criar um único arquivo gigante como:

game.js

Separar responsabilidades.

Exemplo:

Game
Renderer
GPUContext
Camera
InputManager
Player
Enemy
EnemyManager
Weapon
WeaponManager
Level
LevelManager
CollisionSystem
RaycastSystem
Pickup
HUD
AudioManager
GameState

---

# 27. ESTADOS DO JOGO

Criar uma máquina de estados simples:

MENU
PLAYING
PAUSED
LEVEL_COMPLETE
GAME_OVER

Posteriormente:

SETTINGS
CREDITS

---

# 28. DEBUG

Criar modo de debug ativável.

Quando ativado, mostrar:

* FPS
* número de objetos
* número de inimigos
* posição do jogador
* rotação da câmera
* draw calls
* informações básicas da GPU

Adicionar também ferramentas visuais opcionais:

* bounding boxes
* collision shapes
* enemy detection radius
* raycast

---

# 29. DESENVOLVIMENTO INCREMENTAL

IMPORTANTE:

Não tente construir o jogo inteiro de uma vez.

Quero desenvolvimento incremental.

A ordem inicial deve ser:

FASE 1
→ Inicializar WebGPU
→ Criar canvas
→ Criar pipeline
→ Renderizar um triângulo

FASE 2
→ Criar matriz Model/View/Projection
→ Renderizar um cubo 3D

FASE 3
→ Criar câmera FPS
→ Movimento WASD
→ Mouse look

FASE 4
→ Criar chão e paredes
→ Criar primeiro mapa

FASE 5
→ Implementar colisão

FASE 6
→ Criar primeiro inimigo

FASE 7
→ IA básica

FASE 8
→ Raycast e tiro

FASE 9
→ Vida/dano/morte

FASE 10
→ Armas

FASE 11
→ Munição e pickups

FASE 12
→ HUD

FASE 13
→ Sistema de fases

FASE 14
→ Scaling de dificuldade

FASE 15
→ Iluminação

FASE 16
→ Partículas

FASE 17
→ Áudio

FASE 18
→ Otimização

---

# 30. REGRA IMPORTANTE PARA O CLAUDE CODE

Antes de implementar qualquer sistema grande:

1. Analise a arquitetura atual.
2. Explique brevemente o que será alterado.
3. Implemente apenas a próxima etapa.
4. Execute/teste o projeto.
5. Corrija erros.
6. Verifique se a etapa realmente funciona.
7. Só então avance.

Não reescreva partes funcionais sem necessidade.

Não substitua WebGPU por Canvas 2D, WebGL ou engine 3D.

Não esconda a implementação gráfica atrás de bibliotecas de alto nível.

Sempre priorize código didático, modular e compreensível.

---

# 31. PRIMEIRA TAREFA

Comece SOMENTE pela FASE 1.

Crie a estrutura inicial do projeto e implemente:

* HTML
* CSS
* TypeScript
* WebGPU initialization
* Adapter
* Device
* Canvas context
* Shader WGSL
* Render pipeline
* Vertex buffer
* Command encoder
* Render pass
* Renderização de um triângulo

O resultado deve abrir no navegador e apresentar um triângulo renderizado pela GPU.

Não implemente ainda:

* jogador
* mapa
* inimigos
* armas
* fases
* HUD
* colisão
* IA

Depois de finalizar a primeira etapa, explique quais arquivos foram criados, qual é a responsabilidade de cada arquivo e como o pipeline WebGPU está funcionando.

A partir daí, aguardaremos a próxima etapa antes de implementar novos sistemas.