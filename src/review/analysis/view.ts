/**
 * 记忆分析 · 幕表与版式（纯字符串，用户文本一律转义）
 *
 * 版式纪律：每一幕共用同一个骨架 `.ra-sc`——中间「本幕主构图」，主构图只换 `.ra-main`
 * 里的东西；幕名走 data-name（底栏用），边距恒定，16 幕摆在一起才像同一册夜账。
 * 颜色只走 `--ra-*`（styles.css 变量层，明暗两套），幕内不写死颜色。
 * 动效一律由 motions.ts 驱动，这里只出静态 DOM 与 data-r 引用点 / data-cv 画布；
 * 排版目标量（--x / --ph / --h …）在 build 期算好写进内联——表演层逐帧只写不读。
 */
import { escapeHtml as esc } from '../../core/utils';
import type { RaData } from './data';
import { RA_RATING_NAMES, RA_RATING_ORDER } from './data';

/** 幕表：编号固定，引擎按顺序翻。name 是底栏短名 */
export interface RaSceneDef { id: string; name: string }
export const RA_SCENES: RaSceneDef[] = [
  { id: 'open', name: '点炉' },
  { id: 'field', name: '忆炉全景' },
  { id: 'slope', name: '忘坡' },
  { id: 'tide', name: '水位' },
  { id: 'debts', name: '欠账' },
  { id: 'steppath', name: '阶石' },
  { id: 'crystal', name: '墨晶' },
  { id: 'strata', name: '矿层' },
  { id: 'dailies', name: '添柴志' },
  { id: 'vigil', name: '长明' },
  { id: 'verdicts', name: '批改环' },
  { id: 'bedrock', name: '基岩' },
  { id: 'portide', name: '来潮' },
  { id: 'quarters', name: '四驻' },
  { id: 'marks', name: '批痕' },
  { id: 'keeper', name: '守夜人' },
];

const pad2 = (n: number): string => String(n).padStart(2, '0');
/** YYYY-MM-DD → MM/DD */
const slashDay = (d: string): string => d.slice(5).replace('-', '/');
/** 日期 → 「M月D日」 */
const zhDay = (d: string): string => {
  const [, m, dd] = d.split('-');
  return `${Number(m)} 月 ${Number(dd)} 日`;
};
/** 稳定性天数 → 人话（30.5 天 → 「1 个月」档的人话在这里不做，直接天数取整） */
const sText = (s: number): string => (s >= 365 ? `${(s / 365).toFixed(1)} 年` : `${Math.round(s)} 天`);

/** 幕骨架：只有主构图；幕名/口径走 data-*（底栏与排查用） */
function frame(no: number, main: string): string {
  const def = RA_SCENES[no - 1];
  return `<section class="bz-ra-scn" data-s="${pad2(no)}" data-id="${def.id}" data-name="${esc(def.name)}">
  <div class="ra-sc"><div class="ra-main">${main}</div></div>
</section>`;
}

/** 忆炭火色档（R 高低 → 色档类；与 styles.css / motions 的档位一致） */
export const emberTone = (r: number | null): 'hi' | 'mid' | 'low' | 'off' =>
  r == null ? 'off' : r >= 0.7 ? 'hi' : r >= 0.4 ? 'mid' : 'low';

export function analysisHtml(data: RaData): string {
  const S: string[] = [];

  /* 01 点炉 —— 萤群聚字（画布独占，不上 DOM 文字） */
  S.push(frame(1, `
    <div class="ra-open"><canvas data-cv="open" aria-hidden="true"></canvas></div>`));

  /* 02 忆炉全景 —— 每条在册笔记一粒忆炭，画布力场悬浮 */
  S.push(frame(2, `
    <div class="ra-field">
      <canvas data-cv="field" aria-hidden="true"></canvas>
      <div class="ra-field-side">
        <div class="ra-kv big"><span class="ra-k">在炉</span><b>${data.active}<span class="ra-u">篇</span></b></div>
        <div class="ra-legend">
          <span><i class="dot tone-hi"></i>余温足（R&gt;70%）</span>
          <span><i class="dot tone-mid"></i>渐凉（40-70%）</span>
          <span><i class="dot tone-low"></i>将熄（&lt;40%）</span>
          <span><i class="dot tone-off"></i>阶梯期（未入 FSRS）</span>
        </div>
      </div>
    </div>`));

  /* 03 忘坡 —— 遗忘曲线族（主母题）：四条参考坡 + 库内忆炭落点 */
  const slopePts = data.liveEmbers
    .filter((e) => e.r != null && e.ageDays != null && e.s > 0)
    .slice(0, 90)
    .map((e, i) => {
      // 横轴 = 龄期占稳定性的倍数（t/S）：1.0 即「到了该忘一半的年纪」；纵轴 = 当前 R
      const x = Math.min(1, (e.ageDays as number) / Math.max(0.5, e.s));
      return `<i class="ra-slope-dot tone-${emberTone(e.r)}" data-r="sdot" data-i="${i}"
        style="--x:${x.toFixed(4)};--y:${(e.r as number).toFixed(4)}"></i>`;
    }).join('');
  S.push(frame(3, `
    <div class="ra-slope">
      <div class="ra-slope-plot" data-r="plot">
        <canvas data-cv="slope" aria-hidden="true"></canvas>
        <span class="ra-slope-cursor" data-r="cursor" aria-hidden="true"></span>
        ${slopePts}
      </div>
      <div class="ra-slope-side">
        <div class="ra-kv"><span class="ra-k">在崖上</span><b data-r="oncliff">—</b></div>
        <div class="ra-kv"><span class="ra-k">已过半坡</span><b>${data.rBelow50}<span class="ra-u">篇</span></b></div>
        <div class="ra-kv"><span class="ra-k">稳住 90% 以上</span><b>${data.rAbove90}<span class="ra-u">篇</span></b></div>
        <p class="ra-sline">每篇记忆都在往坡下滑——坡的缓急由稳定性决定，添一次柴坡就缓一截。</p>
      </div>
    </div>`));

  /* 04 水位 —— 平均留存率 = 忆池水位（画布波面） */
  const tidePct = data.avgR == null ? 0 : Math.round(data.avgR * 100);
  S.push(frame(4, `
    <div class="ra-tide">
      <div class="ra-tide-plot" data-r="tplot"><canvas data-cv="tide" aria-hidden="true"></canvas>
        <span class="ra-tide-gauge" data-r="gauge"><b>0%</b></span>
      </div>
      <div class="ra-tide-side">
        <div class="ra-kv big"><span class="ra-k">平均留存</span><b>${data.avgR == null ? '—' : tidePct + '%'}<span class="ra-u">R</span></b></div>
        <div class="ra-kv"><span class="ra-k">满水位</span><b>${data.rHist[9]}<span class="ra-u">篇</span></b></div>
        <div class="ra-kv"><span class="ra-k">浅滩</span><b>${data.rHist[0] + data.rHist[1]}<span class="ra-u">篇</span></b></div>
        <p class="ra-sline">按住池面可以把水压下去，松手它回到你的真实水位。</p>
      </div>
    </div>`));

  /* 05 欠账 —— 逾期专页：红欠条逐张挂绳。
     挂点纵坐标 = 逾期天数（拖得越久绳越长挂得越低，2026-09-23 修复：原按序号伪随机
     导致「拖 0 天」比「拖 3 天」挂得低，语义颠倒）；横向按序散开防重叠 */
  const debtMaxDays = Math.max(1, ...data.overdueList.slice(0, 18).map((d) => Math.round(d.days)));
  const debtTags = data.overdueList.slice(0, 18).map((d, i) => {
    const x = 8 + ((i * 29) % 84);
    const y = 14 + (Math.round(d.days) / debtMaxDays) * 44;
    const rot = -9 + ((i * 53) % 19);
    return `<span class="ra-debt" data-r="debt" data-i="${i}" data-tip="${esc(d.name)} · 拖了 ${Math.round(d.days)} 天"
      style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--rot:${rot}deg;--sw:${((i * 17) % 10) / 10}"><b>${esc(d.name)}</b><i>拖 ${Math.round(d.days)} 天</i></span>`;
  }).join('');
  S.push(frame(5, `
    <div class="ra-debts">
      <div class="ra-debt-rope" data-r="rope"></div>
      ${debtTags}
      <div class="ra-debt-total"><b>${data.overdueList.length}</b><span>笔未还 · 最早一笔拖了 ${data.overdueList.length ? Math.round(data.overdueList[0].days) : 0} 天</span></div>
    </div>`));

  /* 06 阶石 —— 阶梯十级（含 FSRS 一档）：每级柱高 = 该级篇数，一粒萤火巡行 */
  const stepMax = Math.max(1, ...data.stageDist);
  const steps = data.stageDist.map((n, i) => {
    const last = i === 9;
    const label = last ? 'FSRS' : `${i + 1}`;
    const tip = `${last ? '自由排期' : `第 ${i + 1} 阶`} · ${n} 篇`;
    return `<div class="ra-step${last ? ' is-fsrs' : ''}${i === data.stagePeak ? ' is-peak' : ''}" data-r="step" data-i="${i}" data-tip="${esc(tip)}">
      <span class="ra-step-n" data-r="stepn">${n}</span>
      <span class="ra-step-bar" data-r="stepbar" style="--ph:${(n / stepMax * 100).toFixed(1)}%"></span>
      <span class="ra-step-lb">${label}</span></div>`;
  }).join('');
  S.push(frame(6, `
    <div class="ra-steps" data-r="steps">${steps}<i class="ra-steps-fly" data-r="fly" aria-hidden="true"></i></div>`));

  /* 07 墨晶 —— 稳定性结晶：四档晶格，档内篇数 = 晶体重量 */
  const crystalMax = Math.max(1, ...data.sBuckets.map((b) => b.n));
  const crystals = data.sBuckets.map((b, i) => {
    const w = b.n / crystalMax;
    return `<div class="ra-crystal${i === data.sBuckets.length - 1 ? ' is-last' : ''}" data-r="crystal" data-i="${i}"
      data-tip="稳定性 ${esc(b.label)} · ${b.n} 篇" style="--w:${w.toFixed(3)};--i:${i}">
      <canvas data-cv="crystal${i}" aria-hidden="true"></canvas>
      <div class="ra-crystal-meta"><b data-r="cn">${b.n}</b><span>${esc(b.label)}</span></div>
    </div>`;
  }).join('');
  S.push(frame(7, `
    <div class="ra-crystals">
      <div class="ra-crystal-row" data-r="crow">${crystals}</div>
      <div class="ra-crystal-side">
        <div class="ra-kv"><span class="ra-k">最久一块</span><b>${sText(data.sMax)}</b></div>
        <p class="ra-sline">稳定性是记忆的晶格：越久没忘，晶格越大，下一次遗忘就来得越慢。</p>
      </div>
    </div>`));

  /* 08 矿层 —— 难度分层：四条矿带，带厚 = 篇数 */
  const strataMax = Math.max(1, ...data.dBuckets.map((b) => b.n));
  const STRATA_C = ['var(--ra-jade)', 'var(--ra-indigo)', 'var(--ra-amber)', 'var(--ra-ember)'];
  const strata = data.dBuckets.map((b, i) =>
    `<div class="ra-stratum" data-r="stratum" data-i="${i}" data-tip="难度 ${esc(b.label)} · ${b.n} 篇" style="--ph:${(b.n / strataMax * 100).toFixed(1)}%;--sc:${STRATA_C[i]}">
      <span class="ra-st-name">${esc(b.label)}</span><span class="ra-st-n" data-r="stn">${b.n}</span></div>`).join('');
  S.push(frame(8, `
    <div class="ra-strata">
      <div class="ra-strata-bed" data-r="bed">${strata}</div>
      <div class="ra-strata-side">
        <div class="ra-kv"><span class="ra-k">平均难度</span><b>${data.dAvg == null ? '—' : data.dAvg.toFixed(1)}</b></div>
        <p class="ra-sline">难度是你与这些笔记的相处史：越常「忘了」，矿层越往下沉。</p>
      </div>
    </div>`));

  /* 09 添柴志 —— 最近 14 天每日添柴（柴束生长 + 顶端火苗常驻） */
  const woodMax = Math.max(1, ...data.daily14.map((d) => d.count));
  const woodRows = data.daily14.map((d, i) =>
    `<div class="ra-wood${i === 13 ? ' is-today' : ''}" data-r="wood" data-i="${i}" data-tip="${esc(zhDay(d.date))} · ${d.count} 次" style="--ph:${(d.count / woodMax * 100).toFixed(1)}%">
      <span class="ra-wood-flame" data-r="flame"></span>
      <span class="ra-wood-bar" data-r="woodbar"></span>
      <span class="ra-wood-lb">${slashDay(d.date)}</span></div>`).join('');
  S.push(frame(9, `
    <div class="ra-woods">
      <div class="ra-woods-row" data-r="wrow">${woodRows}</div>
      <div class="ra-woods-side">
        <div class="ra-kv big"><span class="ra-k">两周添柴</span><b data-r="woodTotal">0</b></div>
        <div class="ra-kv"><span class="ra-k">最勤一天</span><b>${data.dailyPeak}<span class="ra-u">次</span></b></div>
      </div>
    </div>`));

  /* 10 长明 —— 连续添柴天数：一段灯芯（连续日珠串）+ 烛焰画布 */
  const beadN = Math.min(31, Math.max(data.streak, 1));
  const beads = Array.from({ length: beadN }, (_, i) =>
    `<i class="ra-bead${i === beadN - 1 ? ' is-now' : ''}" data-r="bead" style="--i:${i}"></i>`).join('');
  S.push(frame(10, `
    <div class="ra-vigil">
      <div class="ra-vigil-lamp"><canvas data-cv="vigil" aria-hidden="true"></canvas></div>
      <div class="ra-vigil-wick" data-r="wick">${beads}</div>
      <div class="ra-vigil-side">
        <div class="ra-kv big"><span class="ra-k">连燃</span><b data-r="streakN">0</b><span class="ra-u">天</span></div>
        <div class="ra-kv"><span class="ra-k">累计</span><b>${data.distinctDays}<span class="ra-u">天</span></b></div>
        <div class="ra-kv"><span class="ra-k">起点</span><b>${data.firstReviewAt ? esc(slashDay(data.firstReviewAt.slice(0, 10))) : '—'}</b></div>
      </div>
    </div>`));

  /* 11 批改环 —— 四档评级环形（画布描画 + 扇区命中） */
  S.push(frame(11, `
    <div class="ra-verdicts">
      <div class="ra-verdicts-plot" data-r="vplot"><canvas data-cv="verdicts" aria-hidden="true"></canvas></div>
      <div class="ra-verdicts-side">
        ${RA_RATING_ORDER.map((k) => `<div class="ra-kv" data-r="vk" data-k="${k}"><span class="ra-k"><i class="dot is-${k}"></i>${RA_RATING_NAMES[k]}</span><b data-r="vn">${data.ratingDist[k] || 0}<span class="ra-u">次</span></b></div>`).join('')}
        <div class="ra-kv"><span class="ra-k">批改总计</span><b>${data.verdictTotal}<span class="ra-u">次</span></b></div>
        <div class="ra-kv"><span class="ra-k">忘了率</span><b>${data.againRate == null ? '—' : Math.round(data.againRate * 100) + '%'}</b></div>
      </div>
    </div>`));

  /* 12 基岩 —— 最稳的几篇：石柱（S 高低）+ 名牌 */
  const bedMax = Math.max(1, ...data.bedrock.map((b) => b.s));
  const bedRows = data.bedrock.map((b, i) => {
    const tone = emberTone(b.r);
    return `<div class="ra-bed" data-r="bedrow" data-i="${i}" data-tip="${esc(b.name)} · 稳 ${sText(b.s)}${b.r != null ? ` · R ${Math.round(b.r * 100)}%` : ''}" style="--ph:${(b.s / bedMax * 100).toFixed(1)}%">
      <span class="ra-bed-rank">${i + 1}</span>
      <span class="ra-bed-bar tone-${tone}" data-r="bedbar"><i class="ra-bed-shine" data-r="shine"></i></span>
      <span class="ra-bed-name">${esc(b.name)}</span>
      <span class="ra-bed-val">${sText(b.s)}</span></div>`;
  }).join('');
  S.push(frame(12, `
    <div class="ra-bedrock">
      <div class="ra-bedrock-rows" data-r="brows">${bedRows || '<p class="ra-sline">还没有进入 FSRS 的笔记——基岩要靠一次次「记得」垒起来。</p>'}</div>
      <div class="ra-bedrock-side">
        <div class="ra-kv big"><span class="ra-k">FSRS 在册</span><b>${data.fsrsN}<span class="ra-u">篇</span></b></div>
        <div class="ra-kv"><span class="ra-k">阶梯爬坡</span><b>${data.ladderN}<span class="ra-u">篇</span></b></div>
      </div>
    </div>`));

  /* 13 来潮 —— 未来 8 天排程潮汐：柱高 = 当日到期篇数，柱顶萤点预告 */
  const tideMax = Math.max(1, ...data.next8.map((d) => d.count));
  const tideBars = data.next8.map((d, i) =>
    `<div class="ra-tidebar${i === 0 ? ' is-today' : i === 1 ? ' is-tmr' : ''}" data-r="tidebar" data-i="${i}" data-tip="${esc(zhDay(d.date))} · ${d.count} 篇" style="--ph:${(d.count / tideMax * 100).toFixed(1)}%">
      <i class="ra-tidefly" data-r="tidefly"></i>
      <span class="ra-tidebar-bar" data-r="tidebar"></span>
      <span class="ra-tidebar-n" data-r="tidebarN">${d.count}</span>
      <span class="ra-tidebar-lb">${d.label}</span></div>`).join('');
  S.push(frame(13, `
    <div class="ra-portide">
      <div class="ra-portide-row" data-r="prow">${tideBars}</div>
      <div class="ra-portide-side">
        <div class="ra-kv big"><span class="ra-k">明日来潮</span><b>${data.tomorrowN}<span class="ra-u">篇</span></b></div>
        <p class="ra-sline">潮水把到期推到岸边——今晚多添一柴，明天的岸就干一分。</p>
      </div>
    </div>`));

  /* 14 四驻 —— 队列快照：逾期 / 今日 / 未来 / 已完成 四座灯塔 */
  const QCOLS: Array<[string, number, string]> = [
    ['逾期', data.overdueN, 'var(--ra-ember)'],
    ['今日', data.todayN, 'var(--ra-amber)'],
    ['未来', data.futureN, 'var(--ra-indigo)'],
    ['已完成', data.doneColN, 'var(--ra-jade)'],
  ];
  const qMax = Math.max(1, ...QCOLS.map(([, n]) => n));
  const quarters = QCOLS.map(([label, n, color], i) =>
    `<div class="ra-quarter" data-r="quarter" data-i="${i}" data-tip="${label} · ${n} 篇" style="--ph:${(n / qMax * 100).toFixed(1)}%;--qc:${color}">
      <span class="ra-quarter-lamp" data-r="qlamp"></span>
      <span class="ra-quarter-n" data-r="qn">0</span>
      <span class="ra-quarter-lb">${label}</span></div>`).join('');
  S.push(frame(14, `
    <div class="ra-quarters" data-r="qrow">${quarters}</div>`));

  /* 15 批痕 —— 末次评级分布 + 待重做：四道刻痕 */
  const markMax = Math.max(1, ...RA_RATING_ORDER.map((k) => data.lastDiffDist[k] || 0));
  const marks = RA_RATING_ORDER.map((k, i) => {
    const n = data.lastDiffDist[k] || 0;
    return `<div class="ra-mark tone-${k === 'again' ? 'low' : k === 'hard' ? 'mid' : 'hi'}" data-r="mark" data-i="${i}" data-tip="末次「${RA_RATING_NAMES[k]}」· ${n} 篇" style="--ph:${(n / markMax * 100).toFixed(1)}%;--mi:${i}">
      <span class="ra-mark-cut" data-r="cut"></span>
      <span class="ra-mark-n" data-r="markn">${n}</span>
      <span class="ra-mark-lb">${RA_RATING_NAMES[k]}</span></div>`;
  }).join('');
  S.push(frame(15, `
    <div class="ra-marks">
      <div class="ra-marks-row" data-r="mrow">${marks}</div>
      <div class="ra-marks-side">
        <div class="ra-kv big"><span class="ra-k">待重做</span><b class="${data.redoN ? 'is-hot' : ''}">${data.redoN}<span class="ra-u">篇</span></b></div>
        <p class="ra-sline">末一次批改落在哪一档，就刻哪一道痕；「忘了」的痕最深，压着下次排期。</p>
      </div>
    </div>`));

  /* 16 守夜人 —— 落款：四格账 + 一圈萤群（画布） */
  S.push(frame(16, `
    <div class="ra-colo">
      <canvas data-cv="colo" aria-hidden="true"></canvas>
      <div class="ra-colo-grid">
        <div class="ra-kv big"><b data-r="coloN">0</b><span>篇在册</span></div>
        <div class="ra-kv big"><b data-r="coloA">0</b><span>篇在炉</span></div>
        <div class="ra-kv big"><b data-r="coloD">0</b><span>篇完成</span></div>
        <div class="ra-kv big"><b data-r="coloS">0</b><span>天连燃</span></div>
      </div>
      <p class="ra-colo-line">共 ${RA_SCENES.length} 幕 · 火不灭，账不清</p>
    </div>`));

  return `<div class="ra-film">${S.join('')}</div>`;
}

/** 固定层（与幕表分离导出，2026-09-23 修复）：必须挂在**滚动容器之外**的盒子层——
    原先塞在 .ra-film 里，absolute inset:0 锚的是第一屏而不是视口：滚到第 2 幕时隔扇
    下半片（打开态停在膜下 101%）正好探进视口把上半屏盖成纸色（用户报「第二页被截断」
    的真因），灯谱也只在第 1 幕可见。现由 index.ts 挂到 .bz-ra-box（滚动口的父级）下。 */
export function analysisFixedHtml(): string {
  return `<div class="ra-fixed">
    <div class="ra-shutter" data-r="shutter" aria-hidden="true"><i class="t"></i><i class="b"></i></div>
    <div class="ra-lampcol" data-r="rail">${RA_SCENES.map((s, i) => `<i class="ra-lamp" data-r="lamp" data-i="${i}" title="${esc(s.name)}"></i>`).join('')}</div>
  </div>`;
}
