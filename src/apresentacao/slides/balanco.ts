// Capítulo 10 — Balanceamento: métricas calculadas dos dados do jogo.

import type { SlideDef } from "../deck";
import { esc, fmt } from "../dom";
import { barChart, PAL } from "../charts";
import {
  AMMO,
  AMMO_LABEL,
  AMMO_WEAPON,
  AMMO_DAMAGE,
  HP_POOL,
  HEAL,
  KITS,
  DIFFS,
  DIFF_LABEL,
  DIFF_MULT,
  KINDS,
  KIND_LABEL,
  hitsToDie,
  enemyDmg,
  SEG_STATS,
  GROUPS,
  OLD_SCALING,
  ENEMIES,
  WEAPON_BY,
} from "../data/balance";

const AMMO_COLORS = PAL.cat.slice(4, 8); // slots 5–8 (validados para empilhar)
const HP_GRAY = "#8b949d";

export const economia: SlideDef = {
  id: "economia",
  title: "Munição do mapa × vida dos inimigos",
  lead: "Toda a munição que uma partida oferece (inicial + chão + armas coletadas + o que os zumbis costumam soltar), convertida em dano, contra a soma da vida de todos os inimigos (mapa + emboscadas + reforços do chefe).",
  body: () => {
    const ratio = (d: (typeof DIFFS)[number]) => AMMO_DAMAGE / HP_POOL[d];
    return `
    <div class="cols fill" style="grid-template-columns: 1fr 380px">
      <div class="stack">
        <div class="panel eco-chart"></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Calibre</th><th class="n">inicial</th><th class="n">no chão</th><th class="n">das armas</th><th class="n">drops (esperado)</th><th class="n">total</th><th class="n">máx. carregável</th><th>convertido com</th></tr></thead>
            <tbody>${AMMO.map((a) => `<tr><td>${AMMO_LABEL[a.type]}</td><td class="n">${a.inicial}</td><td class="n">${a.chao}</td><td class="n">${a.armas}</td><td class="n">${fmt.n0(a.drops)}</td><td class="n"><b>${fmt.n0(a.total)}</b></td><td class="n">${a.max}</td><td class="small">${esc(WEAPON_BY[AMMO_WEAPON[a.type]].name)} (${WEAPON_BY[AMMO_WEAPON[a.type]].damage}${WEAPON_BY[AMMO_WEAPON[a.type]].pellets > 1 ? ` × ${WEAPON_BY[AMMO_WEAPON[a.type]].pellets}` : ""})</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="stack">
        ${DIFFS.map((d) => `<div class="panel stat ${d === "normal" ? "cpu" : ""}"><span class="v num">${fmt.n1(ratio(d))}×</span><span class="l">folga de munição · ${DIFF_LABEL[d]}</span></div>`).join("")}
        <p class="small muted">Folga = dano potencial ÷ vida total. Acima de 1 sobra munição <b>se todo tiro acertar</b>; como ninguém acerta tudo (e a faca é infinita), a folga real é bem menor. É o que mantém o jogador procurando pentes sem travar a partida.</p>
      </div>
    </div>`;
  },
  init: (root) => {
    const cats = ["Munição (dano potencial)", ...DIFFS.map((d) => `Vida dos inimigos · ${DIFF_LABEL[d]}`)];
    const series = [
      ...AMMO.map((a, i) => ({ name: AMMO_LABEL[a.type], color: AMMO_COLORS[i], values: [a.dano, 0, 0, 0] })),
      { name: "vida dos inimigos", color: HP_GRAY, values: [0, ...DIFFS.map((d) => HP_POOL[d])] },
    ];
    root.querySelector(".eco-chart")!.appendChild(
      barChart({ categories: cats, series, stacked: true, total: true, width: 1000, labelW: 250, rowH: 46, unit: "pontos", ariaLabel: "Munição versus vida" }),
    );
  },
};

export const vidaDano: SlideDef = {
  id: "vida-dano",
  title: "Quanto o jogador aguenta",
  lead: `Golpes de cada inimigo para derrubar 100 de vida, por dificuldade. O mapa tem ${KITS.small} kits pequenos (+25) e ${KITS.big} grandes (+60): ${HEAL} pontos de cura, ou ${fmt.n0(HEAL + 100)} de “vida total” contando a inicial.`,
  body: () => `
  <div class="cols fill" style="grid-template-columns: 1fr 400px">
    <div class="panel vd-chart"></div>
    <div class="stack">
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dificuldade</th><th class="n">vida ×</th><th class="n">dano ×</th><th class="n">vida total</th></tr></thead>
      <tbody>${DIFFS.map((d) => `<tr><td>${DIFF_LABEL[d]}</td><td class="n">${fmt.n2(DIFF_MULT[d].hp)}</td><td class="n">${fmt.n2(DIFF_MULT[d].dmg)}</td><td class="n">${fmt.n0(HP_POOL[d])}</td></tr>`).join("")}</tbody></table></div>
      <div class="panel small">
        <div class="h4">Leitura</div>
        <p>No <b>difícil</b>, um golpe do Rei Troll (${fmt.n0(enemyDmg("king", "hard"))}) tira mais de metade da vida; no <b>fácil</b>, são necessários ${hitsToDie("king", "easy")} golpes.</p>
        <p>O multiplicador de dano varia mais (0,55 → 1,45) que o de vida (0,8 → 1,25): a dificuldade muda principalmente <b>quanto o jogador pode errar</b>, não quanto tempo cada luta dura.</p>
      </div>
    </div>
  </div>`,
  init: (root) => {
    root.querySelector(".vd-chart")!.appendChild(
      barChart({
        categories: KINDS.map((k) => KIND_LABEL[k]),
        series: DIFFS.map((d, i) => ({ name: DIFF_LABEL[d], color: PAL.diff[i], values: KINDS.map((k) => hitsToDie(k, d)) })),
        width: 980,
        labelW: 140,
        total: true,
        unit: "golpes",
        catTips: KINDS.map((k) => DIFFS.map((d) => `${DIFF_LABEL[d]}: ${fmt.n1(enemyDmg(k, d))} por golpe`).join(" · ")),
      }),
    );
  },
};

export const rota: SlideDef = {
  id: "rota",
  title: "Ritmo ao longo da rota",
  lead: "Os seis trechos na ordem em que o jogador passa. Ameaça e recursos crescem juntos: cada trecho difícil vem com cura e munição à altura.",
  body: () => `
  <div class="stack fill" style="grid-template-rows: auto auto">
    <div class="panel rota-a"><h4>Inimigos por trecho (incluindo emboscadas e reforços do chefe)</h4></div>
    <div class="cols-3">
      <div class="panel rota-b"><h4>Vida dos inimigos (normal)</h4></div>
      <div class="panel rota-c"><h4>Cura nos kits</h4></div>
      <div class="panel rota-d"><h4>Munição no chão (dano)</h4></div>
    </div>
  </div>`,
  init: (root) => {
    const cats = SEG_STATS.map((s) => s.name);
    root.querySelector(".rota-a")!.appendChild(
      barChart({
        categories: cats,
        series: GROUPS.map((g, i) => ({ name: g, color: PAL.cat[i], values: SEG_STATS.map((s) => s.byGroup[g]) })),
        stacked: true,
        total: true,
        width: 1400,
        labelW: 130,
        rowH: 30,
        unit: "inimigos",
      }),
    );
    const small = (sel: string, vals: number[], unit: string) =>
      root.querySelector(sel)!.appendChild(barChart({ categories: cats, series: [{ name: unit, color: PAL.cat[0], values: vals }], width: 440, labelW: 110, rowH: 24, total: true, unit }));
    small(".rota-b", SEG_STATS.map((s) => s.hp), "HP");
    small(".rota-c", SEG_STATS.map((s) => s.heal), "HP");
    small(".rota-d", SEG_STATS.map((s) => s.ammoDmg), "de dano");
  },
};

export const dificuldade: SlideDef = {
  id: "dificuldade",
  title: "Duas formas de dificuldade",
  lead: "Nas fases, a dificuldade era uma fórmula (fase 14). No jogo final, virou três modos de dificuldade + o ritmo do mapa. A escala mudou muito: um único Setor Zero tem mais vida inimiga que as cinco primeiras fases antigas somadas.",
  body: () => {
    const sumOld = OLD_SCALING.reduce((s, o) => s + o.pool, 0);
    return `
    <div class="cols fill" style="grid-template-columns: 1.1fr 1fr">
      <div class="stack">
        <div class="panel">
          <h4>Fórmula da fase 14 (levelFactory.ts)</h4>
          <div class="formula mono">inimigos = 5 + (n − 1) · 3<br>vida = 30 · 1,18<sup>n−1</sup> · dano = 8 · 1,12<sup>n−1</sup> · velocidade × 1,05<sup>n−1</sup></div>
          <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Fase</th><th class="n">inimigos</th><th class="n">vida</th><th class="n">dano</th><th class="n">vida total</th></tr></thead>
          <tbody>${OLD_SCALING.map((o) => `<tr><td>${o.n}</td><td class="n">${o.count}</td><td class="n">${fmt.n1(o.hp)}</td><td class="n">${fmt.n1(o.dmg)}</td><td class="n">${fmt.n0(o.pool)}</td></tr>`).join("")}</tbody></table></div>
        </div>
        <div class="panel dif-chart"><h4>Vida inimiga total: fases antigas × Setor Zero (normal)</h4></div>
      </div>
      <div class="stack">
        <div class="panel">
          <h4>Jogo final: <code>DIFFICULTY_MULT</code> (Game.ts)</h4>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Modo</th><th class="n">vida ×</th><th class="n">dano ×</th></tr></thead><tbody>${DIFFS.map((d) => `<tr><td>${DIFF_LABEL[d]}</td><td class="n">${fmt.n2(DIFF_MULT[d].hp)}</td><td class="n">${fmt.n2(DIFF_MULT[d].dmg)}</td></tr>`).join("")}</tbody></table></div>
        </div>
        <div class="panel small">
          <h4>O que mudou na prática</h4>
          <ul class="dash">
            <li><b>${ENEMIES.length}</b> inimigos numa partida (${ENEMIES.filter((e) => e.origem === "mapa").length} no mapa, ${ENEMIES.filter((e) => e.origem === "gatilho").length} em emboscadas, 8 reforços do chefe) contra 5–17 por fase antes</li>
            <li>8 tipos com papéis distintos em vez de 1 arquétipo escalado</li>
            <li>a curva vem do <b>lugar</b>: ratos nos esgotos, sombras no escuro, troll nas minas, chefe no fim</li>
            <li>checkpoints na entrada de cada zona: morrer volta ao começo da zona, não do jogo</li>
          </ul>
          <p class="cap dim">Vida total das fases 1–5 somadas: ${fmt.n0(sumOld)} · Setor Zero (normal): ${fmt.n0(HP_POOL.normal)}.</p>
        </div>
      </div>
    </div>`;
  },
  init: (root) => {
    root.querySelector(".dif-chart")!.appendChild(
      barChart({
        categories: [...OLD_SCALING.map((o) => `Fase ${o.n} (antiga)`), "Setor Zero"],
        series: [{ name: "vida total", color: PAL.cat[0], values: [...OLD_SCALING.map((o) => o.pool), HP_POOL.normal] }],
        width: 700,
        labelW: 150,
        rowH: 26,
        total: true,
        unit: "HP",
      }),
    );
  },
};
