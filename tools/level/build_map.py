# ============================================================
#  build_map.py — Gera o mapa "Setor Zero" (src/levels/setorZero.ts)
# ------------------------------------------------------------
#  Uso: python tools/level/build_map.py [preview.png]
#
#  O mapa é uma GRADE de células de 2,5 m. Aqui ele é desenhado com
#  primitivas (salas, corredores, portas) e depois:
#    - validado (alcançabilidade respeitando portas/chaves);
#    - exportado como ASCII (um caractere por célula) para o jogo;
#    - opcionalmente desenhado num PNG para conferência.
#
#  Legenda (estrutura):  # parede   . chão   , chão alternativo
#    ~ água (piso rebaixado)  = lava  ^ plataforma elevada  o coluna
#    c caixote  g parede com veio de ouro  % parede alternativa
#    D porta  R/B/Y portas trancadas (vermelha/azul/amarela)
#    X portão de saída  H passagem secreta
#  Entidades:  @ jogador  z zumbi  Z zumbi corredor  p zumbi "morto"
#    r rato  a abissal (angler)  d sombra  T troll  K rei troll
#    h kit pequeno  m kit grande  1 .45  2 cartuchos  3 5.56  4 7.62
#    S espingarda  W M4  Q AK-47  V SCAR   ! $ & chaves (verm/azul/amar)
#    t tocha  l lâmpada  L braseiro   E elevador (saída)
# ============================================================
import sys, json, os
sys.stdout.reconfigure(encoding='utf-8')
from collections import deque

W, H = 88, 70
G = [['#'] * W for _ in range(H)]
ZONE = [['c'] * W for _ in range(H)]
CEIL = {}      # (x,y) → altura do teto
TRIG = []      # gatilhos de script


def room(x0, y0, x1, y1, ch='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            G[y][x] = ch


def put(x, y, ch):
    G[y][x] = ch


def puts(pts, ch):
    for x, y in pts:
        G[y][x] = ch


def zone(x0, y0, x1, y1, z):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ZONE[y][x] = z


def ceil(x0, y0, x1, y1, h):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            CEIL[(x, y)] = h


def trig(name, x0, y0, x1, y1, **actions):
    TRIG.append(dict(name=name, rect=[x0, y0, x1, y1], **actions))


# ---------------------------------------------------------------- zonas
zone(0, 46, 21, 69, 'c')     # acampamento
zone(20, 43, 87, 69, 's')    # esgotos
zone(0, 0, 37, 43, 'k')      # catacumbas
zone(36, 0, 52, 43, 'f')     # forja
zone(53, 0, 87, 43, 'm')     # minas

# =========================================================== ACAMPAMENTO
room(3, 61, 8, 67)                       # poço do elevador (início)
room(4, 63, 7, 66, ',')                  # plataforma metálica
put(5, 64, '@')
put(5, 60, 'D')                          # porta para o salão
room(2, 50, 13, 59)                      # salão principal
puts([(4, 52), (4, 53), (5, 52), (11, 57), (11, 58), (10, 58), (8, 51)], 'c')
puts([(6, 55), (9, 55)], 'o')            # esteios de madeira
puts([(2, 50), (13, 50), (2, 59), (13, 59)], 't')
put(7, 53, 'z'); put(11, 52, 'z'); put(3, 57, 'h'); put(12, 55, '1')
room(15, 50, 19, 54)                     # depósito (espingarda)
put(14, 52, 'D')
put(17, 52, 'S'); put(19, 50, 'c'); put(19, 51, 'c'); put(15, 54, '2'); put(16, 54, '2')
put(18, 54, 'l')
put(20, 52, 'H')                         # secreto: armário
room(21, 51, 22, 53); put(22, 52, 'm'); put(21, 53, '2')
room(15, 56, 19, 59)                     # escritório
put(14, 57, 'D')
put(19, 56, 'l'); put(16, 59, '1'); put(17, 58, 'z')
put(20, 58, 'D')                         # saída para os esgotos
trig('camp_shotgun', 16, 51, 18, 53, spawn=[['Z', 12, 58], ['z', 3, 51]], sound='bang',
     message='Algo se mexe no salão...')

# =============================================================== ESGOTOS
room(21, 55, 27, 61)                     # câmara de entrada
put(21, 58, '.'); put(20, 58, 'D')
puts([(21, 55), (27, 61)], 't')
put(25, 60, 'r'); put(26, 56, '1')
trig('sewer_enter', 21, 56, 23, 60, spawn=[['r', 27, 57], ['r', 27, 58], ['r', 27, 59]],
     message='Os esgotos...', sound='squeak', once=True)

# túnel principal (3 faixas: calçada / canal / calçada)
def tunnel(x0, x1):
    room(x0, 55, x1, 59)
    room(x0, 57, x1, 57, '~')


tunnel(28, 44); tunnel(52, 68); tunnel(76, 84)
room(45, 52, 51, 62); room(45, 57, 51, 57, '~')     # junção J1
room(69, 52, 75, 62); room(69, 57, 75, 57, '~')     # junção J2
for x in range(30, 44, 5):
    put(x, 55, 't')
for x in range(54, 68, 6):
    put(x, 59, 't')
put(78, 55, 't')
puts([(33, 56), (40, 58)], 'z'); put(37, 59, 'p'); put(42, 55, 'r'); put(43, 59, 'r')
put(48, 54, 'z'); put(49, 60, 'z'); put(46, 53, '3'); put(50, 61, 'h')
puts([(56, 56), (60, 58), (64, 56)], 'r'); put(66, 59, 'p'); put(62, 55, 'z')
put(72, 54, 'Z'); put(71, 60, 'z'); put(74, 53, '2'); put(70, 61, '1')
puts([(78, 56), (80, 58)], 'z')

# ramal sul de J1 → casa de bombas (M4)
room(47, 63, 49, 63)
room(42, 64, 54, 67)
puts([(44, 65), (52, 65)], 'o')
put(48, 66, 'W'); put(45, 67, '3'); put(51, 67, '3'); put(53, 64, 'h')
put(42, 64, 'a')                          # abissal escondido no canto escuro
put(54, 67, 'l')
trig('pump_room', 46, 64, 50, 66, message='Uma luz ao fundo... não chegue perto.', once=True)

# ramal sul de J2 → transbordo (ninho de ratos)
room(71, 63, 73, 63)
room(67, 64, 79, 67, ',')
puts([(69, 65), (72, 66), (75, 65), (77, 66), (78, 64)], 'r')
put(79, 67, 'm'); put(67, 67, '2'); put(73, 64, 't')

# cisterna (chave vermelha)
room(85, 55, 85, 59)
room(77, 47, 86, 62)
room(79, 50, 84, 59, '~')
room(81, 53, 82, 56, '^')
put(81, 54, '!')
puts([(77, 47), (86, 47), (77, 62), (86, 62)], 't')
put(78, 61, '3'); put(85, 48, 'h')
trig('red_key', 80, 52, 83, 57, on='key_red', lights_off='s_cistern', sound='stinger',
     spawn=[['r', 78, 49], ['r', 79, 48], ['r', 84, 61], ['r', 85, 60], ['Z', 80, 61], ['Z', 83, 48]],
     message='As luzes apagaram... CORRA!')
zone(77, 47, 86, 62, 's')

# galeria norte (volta para oeste) + ramal de J1
room(29, 44, 84, 46)
room(29, 45, 84, 45, '~')
room(47, 47, 49, 51)
room(83, 47, 83, 47); put(83, 47, 'D')
for x in range(33, 84, 8):
    put(x, 44, 't')
puts([(38, 46), (58, 44), (70, 46)], 'r'); put(64, 46, 'z'); put(52, 44, 'p'); put(40, 44, '2')
put(30, 43, 'R')                          # porta vermelha → catacumbas
put(31, 46, 'h')

# ============================================================ CATACUMBAS
room(27, 36, 34, 42)                      # hall de entrada
puts([(28, 37), (33, 37)], 'o'); puts([(27, 42), (34, 42)], 't')
put(30, 42, '.')
trig('cata_enter', 28, 38, 33, 41, once=True, sound='whisper', close_door=[30, 43],
     spawn=[['d', 12, 39]], message='A porta se fechou atrás de você.')
room(10, 39, 26, 39)                      # corredor oeste
room(18, 32, 24, 37)                      # cripta 1
put(21, 38, 'D')
puts([(19, 33), (23, 33), (19, 36), (23, 36)], 'o')
put(21, 34, 'p'); put(20, 35, 'p'); put(22, 35, 'z'); put(21, 36, '4')
room(13, 40, 17, 42)                      # nicho sul
put(15, 40, '.'); put(15, 42, 'h'); put(14, 41, 'r'); put(16, 41, 'r')
room(3, 26, 12, 37)                       # ossuário (colunas)
for x in (5, 8, 10):
    for y in (28, 31, 34):
        put(x, y, 'o')
put(9, 39, '.'); room(9, 38, 9, 39)
put(4, 36, 'a'); put(11, 27, 'z'); put(6, 30, 'p'); put(3, 33, '2'); put(12, 36, '1')
puts([(3, 26), (12, 26)], 't')
trig('ossuary', 4, 27, 11, 36, once=True, sound='whisper', message='Tem algo aqui dentro com você.')
# galerias leste (zigue-zague com nichos)
room(27, 30, 34, 30); room(27, 24, 27, 30); room(27, 24, 34, 24); room(34, 18, 34, 24)
room(27, 18, 34, 18); room(27, 12, 27, 18); room(27, 12, 34, 12); room(30, 31, 30, 35)
for x in (29, 31, 33):
    put(x, 29, '%'); put(x, 25, '%'); put(x, 19, '%')
puts([(29, 31), (32, 31)], 'p'); put(28, 23, 'p'); put(33, 23, 'r'); put(32, 17, 'd')
put(28, 13, 'z'); put(33, 13, '3'); put(29, 17, 'h')
put(30, 30, 't'); put(27, 12, 't')
# claustro em volta da cripta central
room(11, 8, 25, 8); room(11, 22, 25, 22); room(11, 8, 11, 22); room(25, 8, 25, 22)
room(12, 23, 12, 25); room(26, 12, 26, 12)
room(13, 10, 23, 20)                      # cripta central (chave azul)
room(17, 14, 19, 16, '^')
put(18, 15, '$')
puts([(15, 12), (21, 12), (15, 18), (21, 18)], 'o')
put(18, 9, 'D'); put(18, 21, 'D'); put(12, 15, 'D'); put(24, 15, 'D')
puts([(13, 10), (23, 20)], 'L')
put(14, 19, 'z'); put(22, 11, 'z'); put(11, 8, 'r'); put(25, 22, 'a'); put(11, 20, '2')
trig('blue_key', 16, 13, 20, 17, on='key_blue', lights_off='k', sound='stinger',
     spawn=[['d', 11, 12], ['d', 25, 18], ['d', 18, 22], ['Z', 11, 22]],
     message='A escuridão acordou.')
# capela noroeste (secreto: AK-47)
room(2, 2, 9, 12)
room(10, 5, 10, 5); put(10, 5, 'D')
room(10, 5, 11, 5)
puts([(4, 4), (7, 4), (4, 9), (7, 9)], 'o')
put(5, 7, 'd'); put(8, 11, 'h'); put(2, 2, 't'); put(9, 12, 't')
put(2, 7, 'H')
room(0 + 1, 7, 1, 7, '.')
room(1, 3, 1, 11); put(1, 4, 'Q'); put(1, 6, '4'); put(1, 9, '4'); put(1, 11, 'm')
# ligação ossuário ↔ claustro
room(7, 13, 7, 25); put(7, 14, 'r'); put(7, 20, 'z'); room(7, 13, 10, 13); room(10, 13, 10, 15); room(10, 15, 11, 15)
room(5, 13, 6, 13)
# saída leste → porta azul
room(26, 14, 26, 16); room(27, 15, 35, 15)
put(36, 15, 'B')
ceil(3, 26, 12, 37, 4.2)
ceil(13, 10, 23, 20, 5.0)

# ================================================================= FORJA
# salão de lava com passarela (lado norte)
room(37, 3, 52, 24, '=')
path = [(37, 15), (38, 15), (39, 15), (39, 14), (40, 14), (41, 14), (41, 13), (42, 13), (43, 13), (43, 12),
        (44, 12), (45, 12), (45, 11), (46, 11), (47, 11), (47, 10), (48, 10), (49, 10), (50, 10), (51, 10), (52, 10)]
for x, y in path:
    put(x, y, '.')
    if (x + y) % 2 == 0 and y + 1 <= 24:
        put(x, y + 1, '.') if G[y + 1][x] == '=' and x > 38 else None
room(43, 18, 46, 21, '^'); room(48, 5, 51, 7, '^'); room(38, 5, 40, 8, '^')
put(44, 19, 'd'); put(50, 6, 'd'); put(39, 6, 'd'); put(45, 20, '4'); put(49, 6, 'h')
puts([(37, 3), (52, 3), (37, 24), (52, 24)], 'L')
put(53, 10, 'D')
ceil(37, 3, 52, 24, 7.0)
trig('lava_hall', 37, 14, 40, 16, once=True, sound='roar_far', message='O calor é insuportável. Não caia na lava.')
# sala do elevador (saída) + arena do chefe
room(42, 25, 47, 26, ',')
puts([(43, 25), (44, 25), (45, 25), (46, 25)], 'E')
put(44, 27, 'X'); put(45, 27, 'X')
room(38, 28, 51, 41)
room(38, 28, 51, 29, '='); room(38, 40, 51, 41, '=')
room(38, 28, 39, 41, '='); room(50, 28, 51, 41, '=')
room(44, 28, 45, 29, '.')                  # passagem até o portão
room(50, 34, 51, 35, '.')                  # entrada (porta amarela)
puts([(42, 32), (47, 32), (42, 37), (47, 37)], 'o')
put(44, 34, 'K')
puts([(40, 30), (49, 30), (40, 39), (49, 39)], 'L')
put(41, 35, 'h'); put(48, 35, '4'); put(41, 34, '3'); put(48, 34, '2')
put(52, 34, 'Y'); put(52, 35, '#')
ceil(38, 28, 51, 41, 8.0)
trig('arena', 46, 33, 49, 36, once=True, on_enter=True, close_door=[52, 34], boss=True, sound='roar',
     message='O REI TROLL.')

# ================================================================= MINAS
room(54, 9, 57, 11, ',')                  # túnel de entrada
put(55, 10, 't')
room(58, 3, 84, 22, ',')                  # grande caverna
# pilares naturais (2x2) e plataformas
for (x, y) in [(62, 7), (68, 13), (75, 6), (80, 15), (63, 17), (72, 19)]:
    room(x, y, x + 1, y + 1, '#')
room(76, 9, 81, 12, '^'); room(59, 12, 62, 14, '^')
put(78, 10, '4'); put(60, 13, 'h')
for x in range(58, 85, 4):
    G[2][x] = 'g'
for y in range(3, 23, 5):
    G[y][85] = 'g'
puts([(58, 3), (84, 3), (58, 22), (84, 22), (70, 3), (70, 22)], 'L')
puts([(66, 5), (69, 8), (79, 18), (82, 4), (61, 20), (74, 16)], 'r')
puts([(71, 11), (65, 19)], 'z'); put(83, 21, 'a'); put(59, 4, 'a'); put(77, 20, 'T'); put(83, 8, 'd')
puts([(67, 21), (74, 4)], '3'); put(82, 13, '2'); put(64, 4, '1')
ceil(58, 3, 84, 22, 6.5)
trig('mine_enter', 55, 9, 57, 11, once=True, sound='roar_far', message='As minas. Algo grande respira aqui embaixo.')
# escritório do capataz (SCAR) — madeira
room(56, 26, 62, 31)
zone(56, 26, 62, 31, 'c')
put(60, 23, '.'); room(60, 23, 60, 25); put(60, 25, 'D')
put(59, 28, 'V'); put(61, 30, '4'); put(57, 30, '4'); put(62, 26, 'l'); put(56, 31, 'm')
puts([(56, 26), (57, 26)], 'c')
put(63, 29, 'H')                          # secreto: depósito atrás do escritório
room(64, 28, 64, 30); put(64, 28, 'm'); put(64, 29, '3'); put(64, 30, '2')
# túnel de mina (suportes de madeira) até a caverna do troll
room(70, 23, 71, 27, ','); room(66, 27, 71, 27, ',')
room(66, 27, 66, 33, ','); room(66, 33, 70, 33, ',')
puts([(70, 24), (71, 26)], 'o')
put(66, 31, 'r'); put(68, 33, 'r'); put(70, 25, 't')
room(71, 29, 84, 40, ',')                 # caverna do troll
room(73, 31, 75, 33, '#'); room(80, 36, 81, 37, '#')
put(80, 32, '&')
put(82, 33, 'T')
puts([(72, 30), (83, 39), (72, 39)], 'L')
put(76, 39, 'h'); put(84, 30, '4'); put(78, 38, '2')
puts([(79, 30), (77, 35)], 'p')
trig('yellow_key', 78, 30, 82, 34, on='key_yellow', sound='roar', wake=[71, 29, 84, 40],
     message='O troll acordou!')
# ligação da mina para a porta amarela
room(55, 34, 70, 34, ','); room(53, 34, 54, 34, ',')
room(55, 33, 55, 34)
puts([(58, 33), (64, 35)], '%')
put(62, 34, 'Z'); put(68, 34, 't')
room(56, 32, 56, 33); put(56, 32, 'D')

# ========================================================== validação
FLOORS = set('.,~=^@zZprad TKhm1234SWQV!$&tlLE')
PASS = FLOORS | set('DRBYXH')


def reachable(start, keys):
    sx, sy = start
    seen = {start}
    q = deque([start])
    locked = {'R': 'red', 'B': 'blue', 'Y': 'yellow'}
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in seen:
                continue
            c = G[ny][nx]
            if c not in PASS or c == 'X':
                continue
            if c in locked and locked[c] not in keys:
                continue
            seen.add((nx, ny))
            q.append((nx, ny))
    return seen


def find(ch):
    return [(x, y) for y in range(H) for x in range(W) if G[y][x] == ch]


# bordas sempre sólidas
for x in range(W):
    G[0][x] = '#' if G[0][x] not in 'g' else G[0][x]
    G[H - 1][x] = '#'
for y in range(H):
    G[y][0] = '#'
    G[y][W - 1] = '#'

start = find('@')[0]
keys = set()
order = [('!', 'red'), ('$', 'blue'), ('&', 'yellow')]
problems = []
for ch, name in order:
    r = reachable(start, keys)
    k = find(ch)[0]
    if k not in r:
        problems.append(f'chave {name} inalcançável com {sorted(keys)}')
    keys.add(name)
r = reachable(start, keys)
for ch in 'KE':
    for p in find(ch):
        if p not in r and ch != 'E':
            problems.append(f'{ch} em {p} inalcançável')
unreach = [(x, y, G[y][x]) for y in range(H) for x in range(W) if G[y][x] in FLOORS and (x, y) not in r and G[y][x] != 'E']
# células de entidades inalcançáveis (ignora as dentro de áreas secretas ok)
if unreach:
    problems.append(f'{len(unreach)} células de chão inalcançáveis: {unreach[:12]}')
counts = {}
for y in range(H):
    for x in range(W):
        counts[G[y][x]] = counts.get(G[y][x], 0) + 1
print('contagem:', {k: v for k, v in sorted(counts.items()) if k not in '#.'})
print('problemas:', problems or 'nenhum')

# ================================================================ export
rows = [''.join(r) for r in G]
zrows = [''.join(r) for r in ZONE]
ceil_list = sorted(set(CEIL.values()))
ceil_rects = []
for h in ceil_list:  # compacta por linhas
    for y in range(H):
        x = 0
        while x < W:
            if CEIL.get((x, y)) == h:
                x0 = x
                while x < W and CEIL.get((x, y)) == h:
                    x += 1
                ceil_rects.append([x0, y, x - 1, y, h])
            else:
                x += 1
out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'levels', 'setorZero.ts')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// ============================================================\n')
    f.write('//  setorZero.ts — DADOS do mapa (gerado por tools/level/build_map.py)\n')
    f.write('// ------------------------------------------------------------\n')
    f.write('//  Não edite à mão: altere o gerador e rode-o de novo. A legenda\n')
    f.write('//  dos caracteres está em tools/level/build_map.py e em LevelData.ts.\n')
    f.write('// ============================================================\n\n')
    f.write('import type { TriggerDef } from "./LevelData";\n\n')
    f.write(f'export const MAP_W = {W};\nexport const MAP_H = {H};\n\n')
    f.write('// prettier-ignore\nexport const MAP_ROWS: string[] = [\n')
    for r_ in rows:
        f.write('  ' + json.dumps(r_) + ',\n')
    f.write('];\n\n// Zona de cada célula: c=acampamento s=esgotos k=catacumbas f=forja m=minas\n')
    f.write('// prettier-ignore\nexport const ZONE_ROWS: string[] = [\n')
    for r_ in zrows:
        f.write('  ' + json.dumps(r_) + ',\n')
    f.write('];\n\n// Tetos mais altos: [x0, y0, x1, y1, altura]\n')
    f.write('// prettier-ignore\nexport const CEIL_RECTS: [number, number, number, number, number][] = [\n')
    for c_ in ceil_rects:
        f.write('  ' + json.dumps(c_) + ',\n')
    f.write('];\n\n// Gatilhos de script (sustos, emboscadas, mensagens)\n')
    f.write('export const TRIGGERS: TriggerDef[] = ' + json.dumps(TRIG, ensure_ascii=False, indent=2) + ';\n')
print('ok →', os.path.normpath(out))

# ================================================================ preview
if len(sys.argv) > 1:
    from PIL import Image, ImageDraw
    S = 10
    im = Image.new('RGB', (W * S, H * S), (0, 0, 0))
    d = ImageDraw.Draw(im)
    ZC = {'c': (120, 90, 60), 's': (70, 100, 90), 'k': (90, 90, 110), 'f': (130, 70, 50), 'm': (110, 100, 70)}
    for y in range(H):
        for x in range(W):
            c = G[y][x]
            base = ZC[ZONE[y][x]]
            if c in '#g%':
                col = (35, 35, 38) if c == '#' else ((150, 130, 30) if c == 'g' else (55, 50, 60))
            elif c == '~':
                col = (40, 90, 160)
            elif c == '=':
                col = (230, 90, 20)
            elif c == '^':
                col = tuple(min(255, v + 50) for v in base)
            elif c in 'DRBYXH':
                col = {'D': (200, 200, 200), 'R': (230, 30, 30), 'B': (40, 80, 240), 'Y': (240, 220, 40), 'X': (255, 255, 255), 'H': (120, 60, 160)}[c]
            elif c == 'o' or c == 'c':
                col = (80, 60, 40) if c == 'c' else (60, 60, 60)
            else:
                col = base
            d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=col)
            if c in 'zZprad TK':
                d.ellipse([x * S + 2, y * S + 2, x * S + S - 3, y * S + S - 3], fill=(255, 40, 40) if c not in 'TK' else (255, 0, 255))
            elif c in 'hm':
                d.rectangle([x * S + 3, y * S + 3, x * S + 6, y * S + 6], fill=(255, 255, 255))
            elif c in '1234':
                d.rectangle([x * S + 3, y * S + 3, x * S + 6, y * S + 6], fill=(255, 220, 0))
            elif c in 'SWQV':
                d.rectangle([x * S + 1, y * S + 3, x * S + 8, y * S + 6], fill=(0, 255, 120))
            elif c in '!$&':
                d.polygon([(x * S + 5, y * S), (x * S + 9, y * S + 5), (x * S + 5, y * S + 9), (x * S + 1, y * S + 5)], fill={'!': (255, 0, 0), '$': (0, 100, 255), '&': (255, 230, 0)}[c])
            elif c in 'tlL':
                d.ellipse([x * S + 3, y * S + 3, x * S + 6, y * S + 6], fill=(255, 180, 60))
            elif c == '@':
                d.ellipse([x * S + 1, y * S + 1, x * S + 8, y * S + 8], fill=(0, 255, 0))
    for t in TRIG:
        x0, y0, x1, y1 = t['rect']
        d.rectangle([x0 * S, y0 * S, x1 * S + S - 1, y1 * S + S - 1], outline=(255, 0, 255))
    im.save(sys.argv[1])
    print('preview →', sys.argv[1])
