// ============================================================
//  setorZero.ts — DADOS do mapa (gerado por tools/level/build_map.py)
// ------------------------------------------------------------
//  Não edite à mão: altere o gerador e rode-o de novo. A legenda
//  dos caracteres está em tools/level/build_map.py e em LevelData.ts.
// ============================================================

import type { TriggerDef } from "./LevelData";

export const MAP_W = 88;
export const MAP_H = 70;

// prettier-ignore
export const MAP_ROWS: string[] = [
  "########################################################################################",
  "########################################################################################",
  "##t.......################################################g###g###g###g###g###g###g#####",
  "#.........###########################L==============L#####L,,,,,,,,,,,L,,,,,,,,,,,,,Lg##",
  "#Q..o..o..###########################================#####,a,,,,1,,,,,,,,,3,,,,,,,r,,###",
  "#...........#########################=^^^=======^^^^=#####,,,,,,,,r,,,,,,,,,,,,,,,,,,###",
  "#4........###########################=^d^=======^hd^=#####,,,,,,,,,,,,,,,,,##,,,,,,,,###",
  "#.H..d....###########################=^^^=======^^^^=#####,,,,##,,,,,,,,,,,##,,,,,,,,###",
  "#.........#r..............###########=^^^============#####,,,,##,,,,,r,,,,,,,,,,,,,d,g##",
  "#4..o..o..#.######D######.###########================#,,,,,,,,,,,,,,,,,,,,,,^^^^^^,,,###",
  "#.........#.#L..........#.###########==========......D,t,,,,,,,,,,,,,,,,,,,,^^4^^^,,,###",
  "#m......h.#.#.........z.#.###########========....=.=.#,,,,,,,,,,,,,,,,,z,,,,^^^^^^,,,###",
  "##.......t#.#..o.....o..#..t.......##======...=.=====#####,^^^^,,,,,,,,,,,,,^^^^^^,,,###",
  "#####.......#...........#.#.z####3###====....========#####,^h^^,,,,,##,,,,,,,,,,,,2,,g##",
  "#######r##..#....^^^....#...#########==...=.=========#####,^^^^,,,,,##,,,,,,,,,,,,,,,###",
  "#######.##..D....^$^....D...........B....============#####,,,,,,,,,,,,,,,,,,,,,,##,,,###",
  "#######.###.#....^^^....#...#########==.=============#####,,,,,,,,,,,,,,,,r,,,,,##,,,###",
  "#######.###.#...........#.#.#h##d####================#####,,,,,##,,,,,,,,,,,,,,,,,,,,###",
  "#######.###.#..o.....o..#.#........##======^^^^======#####,,,,,##,,,,,,,,,,,,,,r,,,,,g##",
  "#######.###.#.z.........#.###%#%#%.##======^d^^======#####,,,,,,,z,,,,,,##,,,,,,,,,,,###",
  "#######z###2#..........L#.########.##======^^4^======#####,,,r,,,,,,,,,,##,,,T,,,,,,,###",
  "#######.###.######D######.########.##======^^^^======#####,,,,,,,,,3,,,,,,,,,,,,,,,a,###",
  "#######.###..............a########.##================#####L,,,,,,,,,,,L,,,,,,,,,,,,,L###",
  "#######.####.###############p####r.##================#######.#########,,################",
  "#######.####.##############........##L==============L#######.#########o,################",
  "#######.####.##############.#%#%#%########,EEEE,############D#########t,################",
  "###t........t##############.##############,,,,,,########cc....l#######,o################",
  "###........z.##############.################XX##########.......###,,,,,,################",
  "###..o..o.o..##############.##########======..======####...V...#m#,#####################",
  "###..........##############.#%#%#%####======..======####.......H3#,####,,,,,,,,,,,,,,###",
  "###...p......##############...t....###==L........L==####.4...4.#2#,####,L,,,,,,p,,,,4###",
  "###..o..o.o..################p.#p#####==..........==####m......###r####,,###,,,,,,,,,###",
  "###..........#####.......#####.#######==..o....o..==####D#########,####,,###,,,,&,,,,###",
  "###2.........#####.o...o.#####.#######==..........==###..#%#######,,r,,,,###,,,,,,T,,###",
  "###..o..o.o..#####...p...#####.#######==.3..K...2...Y,,.,,,,,,Z,,,,,t,,,,,,,,,,,,,,,,###",
  "###..........#####..p.z..#####.#######==.h......4...############%######,,,,,,p,,,,,,,###",
  "###.a.......1#####.o.4.o.##........###==..........==###################,,,,,,,,,##,,,###",
  "###..........#####.......##.o....o.###==..o....o..==###################,,,,,,,,,##,,,###",
  "#########.###########D#####........###==..........==###################,,,,,,,2,,,,,,###",
  "#########..........................###==L........L==###################,L,,,h,,,,,,L,###",
  "#############.....#########........###==============###################,,,,,,,,,,,,,,###",
  "#############.r.r.#########........###==============####################################",
  "#############..h..#########t......t#####################################################",
  "##############################R#########################################################",
  "#############################....t......2t.......t..p....tr......t.......t.......t...###",
  "#############################~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~###",
  "#############################..h......r.........................z.....r..............###",
  "###############################################...###########################t.....D..t#",
  "###############################################...###########################........h.#",
  "###############################################...###########################..........#",
  "##t..........t#....c###########################...###########################..~~~~~~..#",
  "##......c.....#....c#..########################...###########################..~~~~~~..#",
  "##..cc.....z..D..S..H.m######################.......#################.......#..~~~~~~..#",
  "##..c..z......#.....#2.######################.3.....#################.....2.#..~~^^~~..#",
  "##............#22.l.#########################...z...#################...Z...#..~~!^~~..#",
  "##....o..o..1.#######t........t....t....t.r...................z................~~^^~~..#",
  "##............#....l#.....1......z......................r.......r..............~~^^~~..#",
  "##.h.......c..D.....#.......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..~~~~~~..#",
  "##........cc..#..z..D...................z...................r..................~~~~~~..#",
  "##t..........t#.1...#................p.....r..........t.....t.....p............~~~~~~..#",
  "#####D###############....r..#################....z..#################..z....#..........#",
  "###......############......t#################.....h.#################.1.....#.3........#",
  "###......####################################.......#################.......#t........t#",
  "###.,,,,.######################################...#####################...##############",
  "###.,@,,.#################################a..........h.############,,,,,,t,,,,r,########",
  "###.,,,,.#################################..o.......o..############,,r,,,,,r,,,,########",
  "###.,,,,.#################################......W......############,,,,,r,,,,r,,########",
  "###......#################################...3.....3..l############2,,,,,,,,,,,m########",
  "########################################################################################",
  "########################################################################################",
];

// Zona de cada célula: c=acampamento s=esgotos k=catacumbas f=forja m=minas
// prettier-ignore
export const ZONE_ROWS: string[] = [
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmcccccccmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkfffffffffffffffffmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
  "ccccccccccccccccccccssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss",
];

// Tetos mais altos: [x0, y0, x1, y1, altura]
// prettier-ignore
export const CEIL_RECTS: [number, number, number, number, number][] = [
  [3, 26, 12, 26, 4.2],
  [3, 27, 12, 27, 4.2],
  [3, 28, 12, 28, 4.2],
  [3, 29, 12, 29, 4.2],
  [3, 30, 12, 30, 4.2],
  [3, 31, 12, 31, 4.2],
  [3, 32, 12, 32, 4.2],
  [3, 33, 12, 33, 4.2],
  [3, 34, 12, 34, 4.2],
  [3, 35, 12, 35, 4.2],
  [3, 36, 12, 36, 4.2],
  [3, 37, 12, 37, 4.2],
  [13, 10, 23, 10, 5.0],
  [13, 11, 23, 11, 5.0],
  [13, 12, 23, 12, 5.0],
  [13, 13, 23, 13, 5.0],
  [13, 14, 23, 14, 5.0],
  [13, 15, 23, 15, 5.0],
  [13, 16, 23, 16, 5.0],
  [13, 17, 23, 17, 5.0],
  [13, 18, 23, 18, 5.0],
  [13, 19, 23, 19, 5.0],
  [13, 20, 23, 20, 5.0],
  [58, 3, 84, 3, 6.5],
  [58, 4, 84, 4, 6.5],
  [58, 5, 84, 5, 6.5],
  [58, 6, 84, 6, 6.5],
  [58, 7, 84, 7, 6.5],
  [58, 8, 84, 8, 6.5],
  [58, 9, 84, 9, 6.5],
  [58, 10, 84, 10, 6.5],
  [58, 11, 84, 11, 6.5],
  [58, 12, 84, 12, 6.5],
  [58, 13, 84, 13, 6.5],
  [58, 14, 84, 14, 6.5],
  [58, 15, 84, 15, 6.5],
  [58, 16, 84, 16, 6.5],
  [58, 17, 84, 17, 6.5],
  [58, 18, 84, 18, 6.5],
  [58, 19, 84, 19, 6.5],
  [58, 20, 84, 20, 6.5],
  [58, 21, 84, 21, 6.5],
  [58, 22, 84, 22, 6.5],
  [37, 3, 52, 3, 7.0],
  [37, 4, 52, 4, 7.0],
  [37, 5, 52, 5, 7.0],
  [37, 6, 52, 6, 7.0],
  [37, 7, 52, 7, 7.0],
  [37, 8, 52, 8, 7.0],
  [37, 9, 52, 9, 7.0],
  [37, 10, 52, 10, 7.0],
  [37, 11, 52, 11, 7.0],
  [37, 12, 52, 12, 7.0],
  [37, 13, 52, 13, 7.0],
  [37, 14, 52, 14, 7.0],
  [37, 15, 52, 15, 7.0],
  [37, 16, 52, 16, 7.0],
  [37, 17, 52, 17, 7.0],
  [37, 18, 52, 18, 7.0],
  [37, 19, 52, 19, 7.0],
  [37, 20, 52, 20, 7.0],
  [37, 21, 52, 21, 7.0],
  [37, 22, 52, 22, 7.0],
  [37, 23, 52, 23, 7.0],
  [37, 24, 52, 24, 7.0],
  [38, 28, 51, 28, 8.0],
  [38, 29, 51, 29, 8.0],
  [38, 30, 51, 30, 8.0],
  [38, 31, 51, 31, 8.0],
  [38, 32, 51, 32, 8.0],
  [38, 33, 51, 33, 8.0],
  [38, 34, 51, 34, 8.0],
  [38, 35, 51, 35, 8.0],
  [38, 36, 51, 36, 8.0],
  [38, 37, 51, 37, 8.0],
  [38, 38, 51, 38, 8.0],
  [38, 39, 51, 39, 8.0],
  [38, 40, 51, 40, 8.0],
  [38, 41, 51, 41, 8.0],
];

// Gatilhos de script (sustos, emboscadas, mensagens)
export const TRIGGERS: TriggerDef[] = [
  {
    "name": "camp_shotgun",
    "rect": [
      16,
      51,
      18,
      53
    ],
    "spawn": [
      [
        "Z",
        12,
        58
      ],
      [
        "z",
        3,
        51
      ]
    ],
    "sound": "bang",
    "message": "Algo se mexe no salão..."
  },
  {
    "name": "sewer_enter",
    "rect": [
      21,
      56,
      23,
      60
    ],
    "spawn": [
      [
        "r",
        27,
        57
      ],
      [
        "r",
        27,
        58
      ],
      [
        "r",
        27,
        59
      ]
    ],
    "message": "Os esgotos...",
    "sound": "squeak",
    "once": true
  },
  {
    "name": "pump_room",
    "rect": [
      46,
      64,
      50,
      66
    ],
    "message": "Uma luz ao fundo... não chegue perto.",
    "once": true
  },
  {
    "name": "red_key",
    "rect": [
      80,
      52,
      83,
      57
    ],
    "on": "key_red",
    "lights_off": "s_cistern",
    "sound": "stinger",
    "spawn": [
      [
        "r",
        78,
        49
      ],
      [
        "r",
        79,
        48
      ],
      [
        "r",
        84,
        61
      ],
      [
        "r",
        85,
        60
      ],
      [
        "Z",
        80,
        61
      ],
      [
        "Z",
        83,
        48
      ]
    ],
    "message": "As luzes apagaram... CORRA!"
  },
  {
    "name": "cata_enter",
    "rect": [
      28,
      38,
      33,
      41
    ],
    "once": true,
    "sound": "whisper",
    "close_door": [
      30,
      43
    ],
    "spawn": [
      [
        "d",
        12,
        39
      ]
    ],
    "message": "A porta se fechou atrás de você."
  },
  {
    "name": "ossuary",
    "rect": [
      4,
      27,
      11,
      36
    ],
    "once": true,
    "sound": "whisper",
    "message": "Tem algo aqui dentro com você."
  },
  {
    "name": "blue_key",
    "rect": [
      16,
      13,
      20,
      17
    ],
    "on": "key_blue",
    "lights_off": "k",
    "sound": "stinger",
    "spawn": [
      [
        "d",
        11,
        12
      ],
      [
        "d",
        25,
        18
      ],
      [
        "d",
        18,
        22
      ],
      [
        "Z",
        11,
        22
      ]
    ],
    "message": "A escuridão acordou."
  },
  {
    "name": "lava_hall",
    "rect": [
      37,
      14,
      40,
      16
    ],
    "once": true,
    "sound": "roar_far",
    "message": "O calor é insuportável. Não caia na lava."
  },
  {
    "name": "arena",
    "rect": [
      46,
      33,
      49,
      36
    ],
    "once": true,
    "on_enter": true,
    "close_door": [
      52,
      34
    ],
    "boss": true,
    "sound": "roar",
    "message": "O REI TROLL."
  },
  {
    "name": "mine_enter",
    "rect": [
      55,
      9,
      57,
      11
    ],
    "once": true,
    "sound": "roar_far",
    "message": "As minas. Algo grande respira aqui embaixo."
  },
  {
    "name": "yellow_key",
    "rect": [
      78,
      30,
      82,
      34
    ],
    "on": "key_yellow",
    "sound": "roar",
    "wake": [
      71,
      29,
      84,
      40
    ],
    "message": "O troll acordou!"
  }
];
