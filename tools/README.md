# Ferramentas offline (assets e mapa)

O jogo roda **sem engine**: em tempo de execução ele só lê `.glb` e imagens
de `public/game/` com código próprio (`src/assets/GLB.ts`, `src/gpu/textures.ts`)
e anima os esqueletos na GPU. Estas ferramentas são a etapa **offline** que
gera esses arquivos a partir da pasta `assets/` (zips originais).

## 1. Extrair os assets

Descompacte os zips de `assets/` numa pasta de trabalho (`RAW`), mantendo esta
estrutura (é o que os scripts esperam):

```
RAW/fpsweapons/FPSWeapons.blend      (Guns/fpsweapons.zip)
RAW/kenney/Model/…, Animations/…, Skins/…   (Enemies/kenney_animated-characters-retro.zip)
RAW/rat7z/rat.blend                  (Enemies/rat.7z)
RAW/angler_gif/angler game.blend + texture final.png   (Enemies/angler game with gif animation.zip, sem o .exr)
RAW/darsh/Darsh.glb                  (Enemies/darsh.zip)
RAW/troll.blend                      (Enemies/troll.blend)
RAW/firstaid/FirstAid.obj + .png     (Enemies/_first_aid_kit_3d_v1.1.zip)
RAW/tileset/textures/*.png           (Map/Tileset_combined_binary.zip)
RAW/wests/*.png                      (textures/wests_textures.zip)
RAW/lightning/*.png                  (textures/lightning.zip)
```

## 2. Modelos (Blender 4.2 em modo linha de comando)

```sh
blender -b RAW/fpsweapons/FPSWeapons.blend --python tools/assets/export_fpsweapons.py -- RAW public/game/models
blender -b assets/Guns/highpoly_ak47.blend    --python tools/assets/export_ak47.py        -- RAW public/game/models
blender -b                                    --python tools/assets/export_items.py       -- RAW public/game/models
blender -b                                    --python tools/assets/export_enemies.py     -- RAW public/game/models [pasta_previas] [rat troll angler shade zombie]
```

- `export_enemies.py` também **cria as animações que faltavam** (andar, atacar,
  morrer…) por keyframes em espaço da armature, normaliza escala/posição e
  exporta os clipes `idle / walk / run / attack / hit / death`.
- No Windows, se o Python do Blender falhar ao importar módulos do exportador
  glTF, o caminho está longo demais (limite de 260 caracteres): rode o Blender
  a partir de uma pasta curta (ex.: `subst B: <pasta-do-blender>`).

## 3. Texturas do mapa + atlas de efeitos (Python + Pillow + NumPy)

```sh
python tools/assets/textures.py RAW public/game/textures
```

## 4. Mapa

```sh
python tools/level/build_map.py [previa.png]
```

Gera `src/levels/setorZero.ts` (grade ASCII + zonas + tetos + gatilhos),
valida se todas as chaves e áreas são alcançáveis e, opcionalmente, desenha
uma prévia em PNG.

## Créditos dos assets

- Personagens animados: Kenney — *Animated Characters Retro* (CC0).
- Armas: pacote *FPS Weapons* (CC BY-SA 3.0).
- Troll, abissal (angler), rato, "Darsh", AK-47, kit médico, tileset e
  texturas: arquivos fornecidos em `assets/` (ver as licenças originais de
  cada pacote antes de redistribuir).
