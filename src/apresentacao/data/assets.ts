// ============================================================
//  assets.ts — inventário dos assets (brutos → convertidos)
// ============================================================

export type Uso = "usado" | "referencia" | "nao";

export interface RawAsset {
  arquivo: string;
  pasta: "Enemies" | "Guns" | "Map" | "textures";
  bytes: number;
  formato: string;
  conteudo: string;
  virou: string;
  uso: Uso;
}

// Os 21 arquivos da pasta assets/ (commit c5c299e, 237 MB).
export const RAW: RawAsset[] = [
  { arquivo: "angler game with gif animation.zip", pasta: "Enemies", bytes: 58286469, formato: ".blend + PNG", conteudo: "Abissal (angler) com textura, normal e specular + animação de andar", virou: "e_angler.glb (idle, walk, attack, death)", uso: "usado" },
  { arquivo: "angler game.zip", pasta: "Enemies", bytes: 56935353, formato: ".blend + EXR", conteudo: "A mesma criatura, versão sem a animação", virou: "—  (substituída pela versão animada)", uso: "nao" },
  { arquivo: "troll.blend", pasta: "Enemies", bytes: 55714048, formato: ".blend", conteudo: "Troll com esqueleto (IK nos pés) e uma animação parada", virou: "e_troll.glb (troll e Rei Troll, escala 1,35)", uso: "usado" },
  { arquivo: "troll2.gif", pasta: "Enemies", bytes: 6851687, formato: "GIF animado", conteudo: "Vídeo de referência do troll", virou: "referência de movimento para as animações criadas", uso: "referencia" },
  { arquivo: "troll.gif", pasta: "Enemies", bytes: 5281473, formato: "GIF animado", conteudo: "Vídeo de referência do troll", virou: "referência de movimento", uso: "referencia" },
  { arquivo: "rat.7z", pasta: "Enemies", bytes: 5133663, formato: ".blend (7-Zip)", conteudo: "Ratazana 3D com 6 animações prontas", virou: "e_rat.glb (idle, walk, run, attack, hit, death)", uso: "usado" },
  { arquivo: "angler.gif", pasta: "Enemies", bytes: 1614078, formato: "GIF animado", conteudo: "Vídeo de referência do abissal", virou: "referência de movimento", uso: "referencia" },
  { arquivo: "darsh.zip", pasta: "Enemies", bytes: 1182989, formato: "GLB", conteudo: "“Darsh”, criatura humanoide com idle", virou: "e_shade.glb (a Sombra)", uso: "usado" },
  { arquivo: "kenney_animated-characters-retro.zip", pasta: "Enemies", bytes: 706472, formato: "FBX + PNG", conteudo: "Personagens low-poly da Kenney (CC0) com skins de zumbi", virou: "e_zombie.glb + skin zombieFemaleA.png (corredora)", uso: "usado" },
  { arquivo: "rat.png", pasta: "Enemies", bytes: 614709, formato: "PNG (sprite sheet)", conteudo: "Rato 2D em 8 direções, quadros de 128 px", virou: "—  (o jogo usa o rato 3D)", uso: "nao" },
  { arquivo: "rat_black.png", pasta: "Enemies", bytes: 571617, formato: "PNG (sprite sheet)", conteudo: "Variação preta do rato 2D", virou: "—", uso: "nao" },
  { arquivo: "rat_plague.png", pasta: "Enemies", bytes: 563061, formato: "PNG (sprite sheet)", conteudo: "Variação “peste” do rato 2D", virou: "—", uso: "nao" },
  { arquivo: "_first_aid_kit_3d_v1.1.zip", pasta: "Enemies", bytes: 492566, formato: "OBJ + PNG", conteudo: "Kit de primeiros socorros", virou: "i_medkit.glb (kits de 25 e 60 HP)", uso: "usado" },
  { arquivo: "ammoclipmesh.zip", pasta: "Enemies", bytes: 9555, formato: "FBX", conteudo: "Um pente genérico", virou: "—  (os pentes vieram do pacote de armas)", uso: "nao" },
  { arquivo: "rat_anim_def_file.zip", pasta: "Enemies", bytes: 1077, formato: "TXT", conteudo: "Definição das animações do sprite 2D (stance, run, swing…)", virou: "usada só para o visualizador desta apresentação", uso: "referencia" },
  { arquivo: "fpsweapons.zip", pasta: "Guns", bytes: 4349093, formato: ".blend", conteudo: "Pacote FPS Weapons (CC BY-SA 3.0): M4, SCAR, Mossberg, USP, M9, faca, pentes, cápsulas", virou: "w_knife, w_usp, w_mossberg, w_m4, w_scar, w_m9 + pentes e cápsulas", uso: "usado" },
  { arquivo: "highpoly_ak47.blend", pasta: "Guns", bytes: 1282484, formato: ".blend", conteudo: "AK-47 de alta resolução (madeira + aço)", virou: "w_ak47.glb (11 MB → 1,3 MB)", uso: "usado" },
  { arquivo: "highpoly_ak47.obj", pasta: "Guns", bytes: 842609, formato: "OBJ", conteudo: "A mesma AK-47 sem materiais", virou: "—  (o .blend tinha os materiais)", uso: "nao" },
  { arquivo: "Tileset_combined_binary.zip", pasta: "Map", bytes: 24348210, formato: "PNG", conteudo: "Tileset de masmorra com normal maps (rocha, ouro, lava, água, terra)", virou: "10 camadas do mapa com normal map original", uso: "usado" },
  { arquivo: "wests_textures.zip", pasta: "textures", bytes: 21217388, formato: "PNG", conteudo: "Texturas de madeira, pedra e metal", virou: "14 camadas do mapa (normal map gerado por Sobel)", uso: "usado" },
  { arquivo: "lightning.zip", pasta: "textures", bytes: 2148167, formato: "PNG", conteudo: "Faixas de raio elétrico", virou: "2 linhas do fx_atlas.png (raio da Sombra)", uso: "usado" },
];

export interface ModelInfo {
  id: string;
  nome: string;
  grupo: "Inimigo" | "Arma" | "Item" | "Cápsula";
  origem: string;
  uso: string;
  skinned: boolean;
}

export const MODELS: ModelInfo[] = [
  { id: "e_zombie", nome: "Zumbi", grupo: "Inimigo", origem: "Kenney Animated Characters Retro", uso: "zumbi, corredora (outra skin) e zumbi caído", skinned: true },
  { id: "e_rat", nome: "Ratazana", grupo: "Inimigo", origem: "rat.7z", uso: "bandos nos esgotos", skinned: true },
  { id: "e_angler", nome: "Abissal", grupo: "Inimigo", origem: "angler game with gif animation.zip", uso: "emboscada no escuro com isca luminosa", skinned: true },
  { id: "e_shade", nome: "Sombra", grupo: "Inimigo", origem: "darsh.zip (Darsh.glb)", uso: "raios elétricos e teleporte", skinned: true },
  { id: "e_troll", nome: "Troll", grupo: "Inimigo", origem: "troll.blend", uso: "troll das minas e Rei Troll (chefe)", skinned: true },
  { id: "w_knife", nome: "Faca M9", grupo: "Arma", origem: "FPS Weapons", uso: "slot 1", skinned: false },
  { id: "w_usp", nome: "USP .45", grupo: "Arma", origem: "FPS Weapons", uso: "slot 2", skinned: false },
  { id: "w_mossberg", nome: "Mossberg 500", grupo: "Arma", origem: "FPS Weapons", uso: "slot 3", skinned: false },
  { id: "w_m4", nome: "M4 Carbine", grupo: "Arma", origem: "FPS Weapons", uso: "slot 4", skinned: false },
  { id: "w_ak47", nome: "AK-47", grupo: "Arma", origem: "highpoly_ak47.blend", uso: "slot 5", skinned: false },
  { id: "w_scar", nome: "SCAR-H", grupo: "Arma", origem: "FPS Weapons", uso: "slot 6", skinned: false },
  { id: "w_m9", nome: "Beretta M9", grupo: "Arma", origem: "FPS Weapons", uso: "exportada, não entrou no jogo", skinned: false },
  { id: "i_medkit", nome: "Kit médico", grupo: "Item", origem: "_first_aid_kit_3d_v1.1.zip", uso: "+25 / +60 de vida", skinned: false },
  { id: "i_mag_pistol", nome: "Pente .45", grupo: "Item", origem: "FPS Weapons (USP-Magazine)", uso: "+24 .45 ACP", skinned: false },
  { id: "i_mag_rifle", nome: "Pente 5.56", grupo: "Item", origem: "FPS Weapons (M4 Magazine)", uso: "+30 5.56 mm", skinned: false },
  { id: "i_mag_heavy", nome: "Pente 7.62", grupo: "Item", origem: "FPS Weapons (Scar magazine)", uso: "+20 7.62 mm", skinned: false },
  { id: "i_shells", nome: "Cartuchos", grupo: "Item", origem: "FPS Weapons (cópias do cartucho)", uso: "+8 cartuchos 12", skinned: false },
  { id: "i_maglite", nome: "Lanterna MagLite", grupo: "Item", origem: "FPS Weapons", uso: "exportada, não entrou no jogo", skinned: false },
  { id: "c_9mm", nome: "Cápsula 9 mm", grupo: "Cápsula", origem: "FPS Weapons", uso: "ejetada pela USP", skinned: false },
  { id: "c_556", nome: "Cápsula 5.56", grupo: "Cápsula", origem: "FPS Weapons", uso: "ejetada pelos fuzis", skinned: false },
  { id: "c_shell", nome: "Cartucho 12", grupo: "Cápsula", origem: "FPS Weapons", uso: "ejetado pela Mossberg", skinned: false },
];

export interface TexLayer {
  nome: string;
  fonte: string;
  pacote: "wests" | "tileset";
  normal: "original" | "sobel";
  zona: string;
}

// Mesma ordem de LAYERS (LevelData.ts) e de tools/assets/textures.py.
export const TEX: TexLayer[] = [
  { nome: "camp_wall", fonte: "wood wall 1.png", pacote: "wests", normal: "sobel", zona: "Acampamento" },
  { nome: "camp_floor", fonte: "wood floor 2.png", pacote: "wests", normal: "sobel", zona: "Acampamento" },
  { nome: "camp_ceil", fonte: "planks.png", pacote: "wests", normal: "sobel", zona: "Acampamento" },
  { nome: "sewer_wall", fonte: "stone wall 1.png", pacote: "wests", normal: "sobel", zona: "Esgotos" },
  { nome: "sewer_floor", fonte: "paving 2.png", pacote: "wests", normal: "sobel", zona: "Esgotos" },
  { nome: "sewer_ceil", fonte: "stone 2.png", pacote: "wests", normal: "sobel", zona: "Esgotos" },
  { nome: "water", fonte: "Water.png", pacote: "tileset", normal: "original", zona: "Esgotos" },
  { nome: "cata_wall", fonte: "stone wall 6.png", pacote: "wests", normal: "sobel", zona: "Catacumbas" },
  { nome: "cata_wall2", fonte: "stone wall 7.png", pacote: "wests", normal: "sobel", zona: "Catacumbas" },
  { nome: "cata_floor", fonte: "ClaimedE.png", pacote: "tileset", normal: "original", zona: "Catacumbas" },
  { nome: "cata_ceil", fonte: "stone 1.png", pacote: "wests", normal: "sobel", zona: "Catacumbas" },
  { nome: "mine_wall", fonte: "Rock_col.png", pacote: "tileset", normal: "original", zona: "Minas" },
  { nome: "mine_floor", fonte: "Dirt_darkE.png", pacote: "tileset", normal: "original", zona: "Minas" },
  { nome: "gold", fonte: "Gold_smallerdetails.png", pacote: "tileset", normal: "original", zona: "Minas" },
  { nome: "mine_ceil", fonte: "rock 6.png", pacote: "wests", normal: "sobel", zona: "Minas" },
  { nome: "forge_wall", fonte: "Claimedwall2C.png", pacote: "tileset", normal: "original", zona: "Forja" },
  { nome: "forge_floor", fonte: "stone wall 10.png", pacote: "wests", normal: "sobel", zona: "Forja" },
  { nome: "lava", fonte: "Lava5B6.png", pacote: "tileset", normal: "original", zona: "Forja" },
  { nome: "forge_ceil", fonte: "rock 2.png", pacote: "wests", normal: "sobel", zona: "Forja" },
  { nome: "door", fonte: "planks.png (girada 90°)", pacote: "wests", normal: "sobel", zona: "Portas" },
  { nome: "crate", fonte: "wood floor 1.png", pacote: "wests", normal: "sobel", zona: "Caixotes" },
  { nome: "metal", fonte: "paneling.png", pacote: "wests", normal: "sobel", zona: "Plataformas" },
  { nome: "tile", fonte: "paving 6.png", pacote: "wests", normal: "sobel", zona: "Esgotos" },
  { nome: "cata_wall3", fonte: "stone wall 9.png", pacote: "wests", normal: "sobel", zona: "Catacumbas" },
];

// Quais clipes existiam no arquivo original × quais foram criados por script.
export type ClipOrigem = "orig" | "criado" | "-";
export const CLIP_NAMES = ["idle", "walk", "run", "attack", "hit", "death"] as const;
export const CLIPS: { inimigo: string; modelo: string; clipes: Record<(typeof CLIP_NAMES)[number], ClipOrigem>; img: string }[] = [
  { inimigo: "Ratazana", modelo: "e_rat", img: "clipes_rato.jpg", clipes: { idle: "orig", walk: "orig", run: "orig", attack: "orig", hit: "orig", death: "orig" } },
  { inimigo: "Troll", modelo: "e_troll", img: "clipes_troll.jpg", clipes: { idle: "orig", walk: "criado", run: "-", attack: "criado", hit: "-", death: "criado" } },
  { inimigo: "Abissal", modelo: "e_angler", img: "clipes_abissal.jpg", clipes: { idle: "criado", walk: "orig", run: "-", attack: "criado", hit: "-", death: "criado" } },
  { inimigo: "Sombra", modelo: "e_shade", img: "clipes_sombra.jpg", clipes: { idle: "orig", walk: "criado", run: "-", attack: "criado", hit: "-", death: "criado" } },
  { inimigo: "Zumbi", modelo: "e_zombie", img: "clipes_zumbi.jpg", clipes: { idle: "criado", walk: "criado", run: "criado", attack: "criado", hit: "criado", death: "criado" } },
];
