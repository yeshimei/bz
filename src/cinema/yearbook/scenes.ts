/**
 * 观影志 · 26 幕版式（纯字符串，用户文本一律转义）
 *
 * 版式纪律（上一稿「每幕各画一套、颜色版面乱」就是这么来的）：
 *   **每一幕共用同一个骨架** `.yb-sc`：左上「序号 + 幕名 + 字段来源」，中间「本幕主构图」，
 *   左下「本幕口径脚注」。主构图只换 `.yb-main` 里的东西，标题/脚注/边距恒定——
 *   26 幕摆在一起才像同一本书。
 * 颜色只走 `--yb-*`（styles.css 的变量层，明暗两套），幕内不写死颜色。
 * 动效一律由 motions.ts 驱动，这里只出静态 DOM 与 `data-r` 引用点。
 */
import type { CinemaItem } from '../state';
import { escapeHtml as esc } from '../../core/utils';
import { flapHtml, humanDurShort, dotted } from './kits';
import { humanMinutes } from './data';
import type { YbData } from './data';

/** 幕表：编号固定，引擎按顺序翻。hint 是底栏用的短名 */
export interface YbSceneDef { id: string; name: string }
export const YB_SCENES: YbSceneDef[] = [
  { id: 'open', name: '开卷' },
  { id: 'years', name: '十二年' },
  { id: 'days', name: '落笔的日子' },
  { id: 'week', name: '星期节律' },
  { id: 'streak', name: '连看与单日' },
  { id: 'length', name: '片长画像' },
  { id: 'extremes', name: '长短两端' },
  { id: 'genres', name: '类型光谱' },
  { id: 'flow', name: '类型流向' },
  { id: 'regions', name: '出品印章' },
  { id: 'eras', name: '年代长河' },
  { id: 'age', name: '片龄横轴' },
  { id: 'myrate', name: '我的评分' },
  { id: 'mirror', name: '与豆瓣对照' },
  { id: 'balance', name: '打分天平' },
  { id: 'podium', name: '榜首三部' },
  { id: 'ninewall', name: '高分墙' },
  { id: 'directors', name: '御用导演' },
  { id: 'actors', name: '座上常客' },
  { id: 'series', name: '连映系列' },
  { id: 'binge', name: '追剧深度' },
  { id: 'notes', name: '影评手记' },
  { id: 'quotes', name: '豆瓣短评' },
  { id: 'matrix', name: '口味矩阵' },
  { id: 'wall', name: '群像墙' },
  { id: 'colophon', name: '落款' },
];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 出品国的地理中心（经度, 纬度）——静态地理常数，不是从笔记里推的；
 *  表里没有的国家/地区回落成左下角一栏（标注在同一张页上，不假装有位置）。 */
const GEO: Record<string, [number, number]> = {
  美国: [-98, 39], 中国大陆: [104, 35], 中国香港: [114.1, 22.3], 中国台湾: [121, 23.7],
  日本: [138, 36.2], 韩国: [127.8, 35.9], 英国: [-3.4, 55.4], 法国: [2.3, 46.6],
  德国: [10.4, 51.2], 意大利: [12.6, 41.9], 西班牙: [-3.7, 40.4], 印度: [79, 22],
  加拿大: [-106, 56], 澳大利亚: [134, -25], 新西兰: [174, -41], 俄罗斯: [95, 60],
  巴西: [-53, -10], 墨西哥: [-102, 23], 瑞典: [15, 62], 挪威: [9, 61], 丹麦: [10, 56],
  荷兰: [5.5, 52.2], 比利时: [4.6, 50.6], 瑞士: [8.2, 46.8], 奥地利: [14.5, 47.5],
  波兰: [19.4, 52], 爱尔兰: [-8, 53.2], 葡萄牙: [-8, 39.5], 希腊: [22, 39],
  土耳其: [35, 39], 以色列: [35, 31.5], 伊朗: [53, 32], 泰国: [101, 15], 越南: [108, 14],
  新加坡: [103.8, 1.35], 马来西亚: [102, 4], 菲律宾: [122, 12], 印度尼西亚: [118, -2],
  阿根廷: [-64, -34], 智利: [-71, -35], 哥伦比亚: [-73, 4], 秘鲁: [-76, -10],
  南非: [24, -29], 埃及: [30, 27], 尼日利亚: [8, 10], 摩洛哥: [-7, 32],
  捷克: [15.5, 49.8], 匈牙利: [19, 47], 芬兰: [26, 64], 冰岛: [-19, 65],
  乌克兰: [31, 49], 罗马尼亚: [25, 46], 塞尔维亚: [21, 44], 克罗地亚: [16, 45.2],
  智利2: [-71, -35], 前苏联: [95, 60], 南斯拉夫: [20.5, 44], 捷克斯洛伐克: [15.5, 49.8],
  中国: [104, 35], 苏联: [95, 60], 西德: [10.4, 51.2], 香港: [114.1, 22.3],
};

const hashHue = (s: string): number => { let h = 0; for (const c of s) h = (h * 31 + (c.codePointAt(0) ?? 0)) % 360; return h; };

/** 海报位：有图出 img；没图出散列色块（库里 686/686 有海报，色块只是兜底） */
function poster(it: CinemaItem, posterOf: (it: CinemaItem) => string | null, cls = ''): string {
  const src = posterOf(it);
  const tag = cls ? ` class="${cls}"` : '';
  if (src) return `<img${tag} src="${esc(src)}" alt="${esc(it.name)}" loading="lazy" decoding="async">`;
  const h = hashHue(it.name);
  return `<i${tag} class="yb-ph${cls ? ' ' + cls : ''}" style="--pc1:hsl(${h} 26% 26%);--pc2:hsl(${(h + 40) % 360} 30% 12%)"><span>${esc(it.name)}</span></i>`;
}

/** 幕骨架：**只有主构图**（2026-09-22 用户拍板去掉每页顶部/底部的文字）。
 *  幕名与「字段来源/口径脚注」不再上屏，改成 data-* 留在节点上——底栏要用幕名，
 *  改动时也还能一眼看出这一幕读的是哪些字段。 */
function frame(no: number, name: string, src: string, main: string, foot: string): string {
  return `<section class="bz-yb-scn" data-s="${pad2(no)}" data-id="${YB_SCENES[no - 1].id}"
  data-name="${esc(name)}" data-src="${esc(src)}" data-foot="${esc(foot)}">
  <div class="yb-sc">
    <div class="yb-main">${main}</div>
  </div>
</section>`;
}

/** 翻页钟的占位串：位宽与终值一致，只把数字打成 0 —— 位宽一变 `setFlap` 会整串重建，
 *  那一格就「啪」地换掉而不是翻牌，机械感全无。 */
const zeroOf = (text: string): string => text.replace(/\d/g, '0');

/** 数字格：一位一组（方便逐位滚动；用 tabular-nums 对齐） */
const digits = (s: string): string =>
  `<span class="yb-dg" data-r="dg">${[...s].map((ch) => (/\d/.test(ch) ? `<i>${ch}</i>` : `<i class="lit">${esc(ch)}</i>`)).join('')}</span>`;

export function yearbookHtml(data: YbData, posterOf: (it: CinemaItem) => string | null): string {
  const S: string[] = [];
  const years = data.years;

  /* 01 开卷 —— 粒子汇成总藏量 */
  // 开卷只有一团粒子：先汇成总藏量数字，再化形成片名——不上任何 DOM 文字
  S.push(frame(1, '开卷', 'tags · 观影日期', `
    <div class="yb-open">
      <div class="yb-open-cv" data-r="cvbox"><canvas data-cv="open"></canvas></div>
    </div>`, `滚轮 / ↓ 翻一幕 · 共 ${YB_SCENES.length} 幕`));

  /* 02 十二年 —— 年度浪潮 */
  const yearTicks = years.map((y, i) =>
    `<span class="yb-tick${y.films.length === Math.max(...years.map((x) => x.films.length)) ? ' is-peak' : ''}" data-r="yt" data-i="${i}">${y.y}</span>`).join('');
  S.push(frame(2, '十二年', '观影日期', `
    <div class="yb-years">
      <div class="yb-years-plot"><canvas data-cv="years"></canvas>
        <span class="yb-years-cursor" data-r="cursor" aria-hidden="true"></span></div>
      <div class="yb-years-axis" data-r="axis">${yearTicks}</div>
      <div class="yb-years-meta">
        <div class="yb-kv"><span class="yb-k">峰值年</span><b data-r="peak">—</b></div>
        <div class="yb-kv"><span class="yb-k">逐年</span><b data-r="perYear">—</b></div>
      </div>
    </div>`, `${years.length} 个观影年 · 首尾相隔 ${data.spanDays} 天`));

  /* 03 落笔的日子 —— 12 个月日历 */
  // 悬停某天要报出「那天看了什么」：片名在 build 期并进 data-tip（motions 只管显示，不再回算一遍）
  const dayNames = new Map<string, string>();
  for (const [date, films] of data.days) dayNames.set(date.slice(4), films.slice(0, 3).map((f) => f.name).join('、'));
  const monthCards = Array.from({ length: 12 }, (_, m) => {
    const daysIn = new Date(2024, m + 1, 0).getDate();
    let n = 0;
    const cells = Array.from({ length: daysIn }, (_, d) => {
      const key = `-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`; // 与 data.days 的 key.slice(4) 同形
      let hit = 0;
      for (const [date, films] of data.days) if (date.slice(4) === key) { hit = films.length; break; }
      if (hit) n++;
      const tip = hit ? `${m + 1} 月 ${d + 1} 日 · ${hit} 部${dayNames.get(key) ? ` · ${dayNames.get(key)}` : ''}` : '';
      return `<i class="yb-cell${hit ? ' on' : ''}${hit > 1 ? ' many' : ''}" data-r="cell" data-lv="${hit > 1 ? 2 : hit}" data-d="${d + 1}"${tip ? ` data-tip="${esc(tip)}"` : ''}></i>`;
    }).join('');
    return `<div class="yb-month" data-r="mon" data-mi="${m}"><div class="yb-mon-hd"><b>${m + 1}</b><span>${n} 天</span></div><div class="yb-mon-grid">${cells}</div></div>`;
  }).join('');
  S.push(frame(3, '落笔的日子', '观影日期', `
    <div class="yb-days" data-r="grid">${monthCards}</div>`,
    `${data.days.size} 个不同的日子 · 共 ${data.watchedCount} 部`));

  /* 04 星期节律 → 径向日晷（七根辐条绕一圈，指针指向最常落座那天） */
  const WD = ['一', '二', '三', '四', '五', '六', '日'];
  const weekMax = Math.max(1, ...data.weekN);
  const weekSpokes = data.weekN.map((n, i) => {
    const a = -90 + i * (360 / 7);
    return `<div class="yb-spoke${i >= 5 ? ' is-wknd' : ''}${i === data.peakDay ? ' is-peak' : ''}" data-r="spoke" data-i="${i}"
      style="--a:${a.toFixed(2)}deg;--len:${(n / weekMax).toFixed(4)}">
      <i class="yb-spoke-bar" data-r="sbar"></i>
      <span class="yb-spoke-lb" style="--a:${(-a).toFixed(2)}deg">周${WD[i]} <b>${n}</b></span>
    </div>`;
  }).join('');
  const peakAngle = -90 + data.peakDay * (360 / 7);
  S.push(frame(4, '星期节律', '观影日期', `
    <div class="yb-dial">
      <div class="yb-dial-face" data-r="face">
        ${weekSpokes}
        <span class="yb-dial-needle" data-r="needle" style="--a:${peakAngle.toFixed(2)}deg"></span>
        <div class="yb-dial-hub"><b>${data.watchedCount}</b><span>部</span></div>
      </div>
      <div class="yb-dial-side">
        <div class="yb-kv big"><span class="yb-k">最常落座</span><b>周${WD[data.peakDay]}<span class="yb-u">· ${data.weekN[data.peakDay]} 部</span></b></div>
        <div class="yb-kv"><span class="yb-k">周末</span><b>${data.weekendN} 部</b></div>
        <div class="yb-kv"><span class="yb-k">工作日</span><b>${data.watchedCount - data.weekendN} 部</b></div>
        <p class="yb-sline">按观影日期落星期</p>
      </div>
    </div>`, `观影日期 · 七个星期各落多少部 · 合计 ${data.watchedCount} 部`));

  /* 05 连看与单日 → 时间缎带（把「连着看的这些天」画成一条真的带子） */
  const ribbonDays: { d: string; n: number }[] = [];
  if (data.streak.days > 1) {
    const from = new Date(`${data.streak.from}T00:00:00`);
    for (let i = 0; i < data.streak.days; i++) {
      const d = new Date(from.getTime() + i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      ribbonDays.push({ d: key, n: (data.days.get(key) ?? []).length });
    }
  }
  const RIB_W = 1000, RIB_H = 200, ribN = Math.max(1, ribbonDays.length);
  const ribPt = (i: number): [number, number] => [
    56 + (i / Math.max(1, ribN - 1)) * (RIB_W - 112),
    RIB_H / 2 + Math.sin(i * .92) * 17,
  ];
  const ribPath = ribbonDays.map((_, i) => `${i ? 'L' : 'M'}${ribPt(i)[0].toFixed(1)} ${ribPt(i)[1].toFixed(1)}`).join(' ');
  const ribDots = ribbonDays.map((day, i) => {
    const [x, y] = ribPt(i);
    return `<circle class="yb-rib-dot" data-r="ribdot" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3.4 + Math.min(day.n, 6) * 1.35).toFixed(1)}" data-tip="${dotted(day.d)} · ${day.n} 部"></circle>`;
  }).join('');
  const busyTicks = data.busiest.films.slice(0, 82).map((f, i) =>
    `<i class="yb-busy-tick" data-r="btick" data-i="${i}" data-tip="${esc(f.name)}"></i>`).join('');
  S.push(frame(5, '连看与单日', '观影日期', `
    <div class="yb-ribbon">
      <div class="yb-ribbon-head">
        <div class="yb-kv big"><span class="yb-k">最长连看</span><b>${digits(String(data.streak.days))}<span class="yb-u">天</span></b></div>
        <p class="yb-sline">${data.streak.from ? `${data.streak.from} → ${data.streak.to} · 共 ${data.streak.films.length} 部` : '—'}</p>
      </div>
      <div class="yb-ribbon-band">
        <svg class="yb-ribbon-svg" viewBox="0 0 ${RIB_W} ${RIB_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path class="yb-rib-path" data-r="ribpath" d="${ribPath}"/>
          <path class="yb-rib-flow" data-r="ribflow" d="${ribPath}"/>
          ${ribDots}
        </svg>
      </div>
      <div class="yb-busy">
        <div class="yb-busy-hd">
          <span class="yb-busy-k">单日落笔之最</span>
          <b>${data.busiest.films.length}<span class="yb-u">部</span></b>
          <em>${data.busiest.date}</em>
        </div>
        <div class="yb-busy-bar" data-r="bbar" aria-hidden="true">${busyTicks}</div>
        <div class="yb-blist">${data.busiest.films.slice(0, 7).map((f) => `<span class="yb-btag" data-r="btag">${esc(f.name)}</span>`).join('')}${data.busiest.films.length > 7 ? `<span class="yb-btag more">…等 ${data.busiest.films.length} 部</span>` : ''}</div>
      </div>
    </div>`, `观影日期 · ${data.days.size} 个日子里最密的 ${data.streak.days} 天与最忙的一天`));

  /* 06 片长画像 */
  const maxBin = Math.max(1, ...data.bins.map((b) => b.films.length));
  const binBars = data.bins.map((b, i) => {
    const sample = b.films.slice(0, 3).map((f) => f.name).join('、');
    const tip = `${b.label} · ${b.films.length} 部${sample ? ` · ${sample}` : ''}`;
    return `<div class="yb-bin" data-r="bin" data-i="${i}" data-tip="${esc(tip)}">
      <span class="yb-bn" data-r="bn">${b.films.length}</span>
      <span class="yb-bbar" data-r="bbar" style="--ph:${(b.films.length / maxBin * 100).toFixed(1)}%"></span>
      <span class="yb-bl">${esc(b.label)}</span></div>`;
  }).join('');
  S.push(frame(6, '片长画像', '片长', `
    <div class="yb-len">
      <div class="yb-len-bars">${binBars}</div>
      <div class="yb-len-reel" data-r="reel"><canvas data-cv="reel"></canvas></div>
      <div class="yb-len-side">
        <div class="yb-big yb-flap-row yb-flap-big" data-r="total">${flapHtml(zeroOf(humanMinutes(data.totalMinutes)))}</div>
        <p class="yb-sline">把 ${data.minutes.length} 部的片长加起来</p>
        <div class="yb-kv"><span class="yb-k">平均</span><b>${data.avgMinutes.toFixed(1)} 分钟</b></div>
        <div class="yb-kv"><span class="yb-k">总计</span><b>${commaNum(data.totalMinutes)} 分钟</b></div>
      </div>
    </div>`, `片长 · ${data.minutes.length} 部有片长（${data.total - data.minutes.length} 部缺这个字段）`));

  /* 07 长短两端 */
  const span = Math.max(1, data.longestMin - data.shortestMin);
  // 两端各留 6%：标记的标签是居中对齐的（「201 分钟」约 80px 宽），贴到 0%/100% 会被幕边裁掉半截
  const atPos = (m: number): string => `${(6 + ((m - data.shortestMin) / span) * 88).toFixed(2)}%`;
  S.push(frame(7, '长短两端', '片长', `
    <div class="yb-ext">
      <div class="yb-ruler">
        <span class="yb-ruler-line" data-r="rline"></span>
        <span class="yb-rticks" data-r="rticks"></span>
        <span class="yb-rread" data-r="rread" aria-hidden="true"></span>
        <span class="yb-mark is-min" data-r="mark" style="--x:${atPos(data.shortestMin)}">
          <em>${data.shortestMin} 分钟</em><i></i><b>${esc(data.shortest?.name ?? '—')}</b></span>
        <span class="yb-mark is-max" data-r="mark" style="--x:${atPos(data.longestMin)}">
          <em>${data.longestMin} 分钟</em><i></i><b>${esc(data.longest?.name ?? '—')}</b></span>
      </div>
      <div class="yb-ext-cards">
        ${data.shortest ? `<figure class="yb-xcard" data-r="xcard">${poster(data.shortest, posterOf)}<figcaption>最短 · ${esc(data.shortest.name)}</figcaption></figure>` : ''}
        ${data.longest ? `<figure class="yb-xcard" data-r="xcard">${poster(data.longest, posterOf)}<figcaption>最长 · ${esc(data.longest.name)}</figcaption></figure>` : ''}
      </div>
    </div>`, `片长 · 同一根尺子上的两端，差 ${span} 分钟`));

  /* 08 类型光谱 */
  const maxGenre = Math.max(1, ...data.genres.slice(0, 8).map((g) => g.films.length));
  const genreRows = data.genres.slice(0, 8).map((g, i) =>
    `<div class="yb-grow" data-r="grow" data-i="${i}">
      <span class="yb-gname">${esc(g.name)}</span>
      <span class="yb-gbar" data-r="gbar" style="--w:${(g.films.length / maxGenre * 100).toFixed(1)}%"></span>
      <span class="yb-gn" data-r="gn">${g.films.length}</span></div>`).join('');
  S.push(frame(8, '类型光谱', '类型', `
    <div class="yb-genres">
      <div class="yb-genres-bars" data-r="bars">${genreRows}</div>
      <div class="yb-genres-net" data-r="net"><canvas data-cv="net"></canvas></div>
    </div>`,
    `类型 · 共 ${data.genres.length} 个标签，一部片可挂多个 · 图里是前 ${data.genrePairs.length} 对共现`));

  /* 09 类型流向 —— 五个类型随年份的堆叠 */
  const flowKeys = data.genres.slice(0, 5).map((g) => g.name);
  S.push(frame(9, '类型流向', '类型 · 观影日期', `
    <div class="yb-flow">
      <canvas data-cv="flow"></canvas>
      <div class="yb-flow-legend">${flowKeys.map((k, i) => `<span class="yb-lg" data-r="lg" data-i="${i}"><i style="--c:var(--yb-c${i + 1})"></i>${esc(k)}</span>`).join('')}</div>
    </div>`, `前 ${flowKeys.length} 个类型 × ${years.length} 年 · 面积 = 该年该类型的部数`));

  /* 10 出品印章 → 护照页：按真实经纬在一张纸页上盖印（点阵位置 = 国家地理中心） */
  const graticuled = data.regions.slice(0, 10);
  // 纬度只用到北半球 60°~南 40°：把这段拉开铺满纸页（整幅 −90..90 会把印章挤成顶上一条）；
  // 同经度附近的印章（欧洲那一堆）按上下交替推开——撞在一起的印章谁也读不出来。
  const LAT_HI = 66, LAT_LO = -40;
  const latY = (lat: number): number => 14 + ((LAT_HI - Math.max(LAT_LO, Math.min(LAT_HI, lat))) / (LAT_HI - LAT_LO)) * 72;
  const placed: { x: number; y: number }[] = [];
  const place = (x0: number, y0: number): [number, number] => {
    let x = x0, y = y0, tries = 0;
    while (placed.some((q2) => Math.abs(q2.x - x) < 12.5 && Math.abs(q2.y - y) < 12) && tries < 40) {
      const step = Math.floor(tries / 2) + 1;
      y = y0 + (tries % 2 ? step : -step) * 11.5;
      if (tries >= 24) x = x0 + 7;
      tries++;
    }
    y = Math.max(11, Math.min(89, y));
    placed.push({ x, y });
    return [x, y];
  };
  const stampCards = graticuled.map((r, i) => {
    const geo = GEO[r.name];
    const [x, y] = geo
      ? place(((geo[0] + 180) / 360) * 100, latY(geo[1]))
      : place(6 + (i % 3) * 4, 86);
    const rot = -13 + ((i * 47) % 26);
    return `<div class="yb-stamp${geo ? '' : ' is-nogeo'}" data-r="stamp" data-i="${i}" data-tip="${esc(r.name)} · ${r.films.length} 部"
      style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--rot:${rot}deg">
      <span class="yb-stamp-ring" data-r="sring"></span>
      <span class="yb-stamp-line"><b class="yb-stamp-n">${r.films.length}</b><i class="yb-stamp-u">部</i></span>
      <span class="yb-stamp-name">${esc(r.name)}</span></div>`;
  }).join('');
  S.push(frame(10, '出品印章', '制片国家/地区', `
    <div class="yb-passport" data-r="passport">
      <span class="yb-grat" aria-hidden="true"></span>
      ${stampCards}
    </div>`, `制片国家/地区 · 前 ${graticuled.length} 个国家或地区`));

  /* 11 年代长河 */
  S.push(frame(11, '年代长河', '上映日期', `
    <div class="yb-eras">
      <canvas data-cv="eras"></canvas>
      <div class="yb-era-tags" aria-hidden="true">
        <span class="yb-era-tag up">片子出品的年份 · 1915 → 2026</span>
        <span class="yb-era-tag down">你看的年份 · 2015 → 2026</span>
      </div>
      <div class="yb-era-side">
        <div class="yb-kv"><span class="yb-k">最早看的片</span><b>${esc(data.oldest?.name ?? '—')}</b><em>${esc(data.oldest?.year ?? '')} 年</em></div>
        <div class="yb-kv"><span class="yb-k">跨过的年头</span><b>${data.releaseYears.length ? Number(data.releaseYears[data.releaseYears.length - 1].y) - Number(data.releaseYears[0].y) : 0} 年</b></div>
        <div class="yb-kv"><span class="yb-k">出片最密的一年</span><b data-r="denseY">—</b></div>
      </div>
    </div>`, `上映日期 · ${data.releaseYears[0]?.y ?? '—'} → ${data.releaseYears[data.releaseYears.length - 1]?.y ?? '—'}，${data.releaseYears.length} 个年份有片`));

  /* 12 片龄抽屉 → 片龄横轴（0→最老一条轴，每部片是一枚海报刻度） */
  const AGE_MAX = Math.max(1, ...data.ageDots.map((d) => d.age));
  const AGE_BANDS: [string, number, number][] = [
    ['当年', 0, 0],
    ['1–3 年', 1, 3],
    ['4–10 年', 4, 10],
    ['≥10 年', 11, AGE_MAX],
  ];
  const agePos = (age: number): number => (Math.max(0, Math.min(AGE_MAX, age)) / AGE_MAX) * 100;
  const ageBands = AGE_BANDS.map(([label, lo, hi], i) => {
    // 「当年」在轴上只有 0 这一年，宽度会是 0：给它一条看得见的窄带
    const x0 = agePos(lo), x1 = Math.max(agePos(hi), x0 + 1.2);
    return `<span class="yb-aband" data-r="aband" data-i="${i}" style="--x0:${x0.toFixed(2)}%;--x1:${x1.toFixed(2)}%"></span>`;
  }).join('');
  const ageLegend = AGE_BANDS.map(([label], i) =>
    `<span class="yb-aleg" data-r="aleg" data-i="${i}"><i></i>${esc(label)}<b>${data.ageBuckets[i].films.length}</b></span>`).join('');
  // 655 枚全铺会糊成一片：按步长抽样，但两端（最老 / 最新）必须留
  const ageStride = Math.max(1, Math.ceil(data.ageDots.length / 110));
  const ageShown = data.ageDots.filter((_, i) => i % ageStride === 0 || i === data.ageDots.length - 1).slice(0, 118);
  const ageDots = ageShown.map((d, i) =>
    `<i class="yb-adot" data-r="adot" data-i="${i}" style="--x:${agePos(d.age).toFixed(2)}%;--lane:${(i % 12) * 2.7}em"
      data-tip="《${esc(d.it.name)}》 · ${d.age} 年">${poster(d.it, posterOf)}</i>`).join('');
  const ageTicks = [0, .25, .5, .75, 1].map((k) =>
    `<span class="yb-atick" style="--x:${(k * 100).toFixed(1)}%">${Math.round(k * AGE_MAX)} 年</span>`).join('');
  S.push(frame(12, '片龄横轴', '上映日期 · 观影日期', `
    <div class="yb-ageax">
      <div class="yb-ageax-plot" data-r="plot">
        <div class="yb-ageax-legend" data-r="legend">${ageLegend}</div>
        ${ageBands}
        <span class="yb-ageax-rule"></span>
        ${ageTicks}
        ${ageDots}
      </div>
      <div class="yb-ageax-side">
        <div class="yb-kv big"><span class="yb-k">平均片龄</span><b>${digits(String(data.avgAge))}<span class="yb-u">年</span></b></div>
        <div class="yb-kv"><span class="yb-k">最老的一部</span><b>${data.ageDots[0] ? `${data.ageDots[0].age} 年` : '—'}</b><em>${esc(data.ageDots[0]?.it.name ?? '')}</em></div>
        <div class="yb-kv"><span class="yb-k">当年上映</span><b>${data.ageBuckets[0].films.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">十年以上</span><b>${data.ageBuckets[3].films.length} 部</b></div>
      </div>
    </div>`, `观影年 − 上映年 · 每枚海报是一部片（抽 ${ageShown.length} / ${data.ageDots.length} 部）· 轴右端是更老的片子`));

  /* 13 我的评分 → 评分散点 × 观影年（边上挂一条评分直方做边缘分布） */
  const SC_Y0 = Math.min(...data.scatter.map((d) => d.y), data.yearMax);
  const SC_Y1 = Math.max(...data.scatter.map((d) => d.y), data.yearMin);
  const SC_SPAN = Math.max(1, SC_Y1 - SC_Y0);
  const scPos = (d: { y: number; r: number }): [number, number] => [
    ((d.y - SC_Y0) / SC_SPAN) * 100,
    ((d.r - 1) / 9) * 100,
  ];
  const scDots = data.scatter.map((d, i) => {
    const [x, y] = scPos(d);
    return `<i class="yb-sdot2${d.r >= 9 ? ' is-high' : d.r <= 4 ? ' is-low' : ''}" data-r="sdot2" data-i="${i}"
      style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%" data-tip="《${esc(d.it.name)}》 ${d.r.toFixed(1)} 分 · ${d.y} 年"></i>`;
  }).join('');
  const maxMy = Math.max(1, ...data.myHist);
  // 右侧边缘直方：10 行（分数 10→1），条长 = 该分档部数
  const myEdge = data.myHist.map((n, i) => ({ n, i })).reverse().map(({ n, i }) =>
    `<div class="yb-erow" data-r="erow" data-i="${i}" style="--w:${(n / maxMy * 100).toFixed(1)}%">
      <span class="yb-ebar"><i data-r="ebar"></i></span><span class="yb-en">${n}</span><span class="yb-ex">${i}</span></div>`).join('');
  const scYears = Array.from({ length: SC_SPAN + 1 }, (_, i) => SC_Y0 + i).map((y) =>
    `<span class="yb-stick" style="--x:${(((y - SC_Y0) / SC_SPAN) * 100).toFixed(2)}%">${y}</span>`).join('');
  S.push(frame(13, '我的评分', '评分 · 观影日期', `
    <div class="yb-scatter">
      <div class="yb-scatter-plot" data-r="plot">
        <span class="yb-sgrid" aria-hidden="true"></span>
        <span class="yb-smean" data-r="smean" style="--y:${(((data.avgMine - 1) / 9) * 100).toFixed(2)}%">
          <em class="yb-flap-row yb-flap-mini" data-r="flap">${flapHtml(zeroOf(data.avgMine.toFixed(2)))}</em></span>
        ${scDots}
        <span class="yb-saxis">${scYears}</span>
      </div>
      <div class="yb-edge">
        <span class="yb-edge-cap">评分分布</span>
        ${myEdge}
      </div>
      <div class="yb-hist-side">
        <div class="yb-kv"><span class="yb-k">打过分</span><b>${data.ratedCount} 部</b></div>
        <div class="yb-kv"><span class="yb-k">9 分以上</span><b>${data.nineUp.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">最低</span><b>${data.rated.length ? (data.rated[data.rated.length - 1].rating ?? 0).toFixed(1) : '—'}</b></div>
      </div>
    </div>`, `评分 × 观影年 · ${data.scatter.length} 个点（每部片一枚）· 红 = 9 分以上`));

  /* 14 与豆瓣对照 —— 背靠背双峰 */
  const maxHist = Math.max(1, ...data.myHist, ...data.dbHist);
  // 0 的箱子不出数字：中轴两侧本来就窄，全画出来会挤成三排小字（实测很糊）
  const mirrorBars = (hist: number[], dir: 'up' | 'down'): string => hist.map((n, i) =>
    `<div class="yb-mcol ${dir}" data-r="mcol" data-i="${i}" style="--ph:${(n / maxHist * 100).toFixed(1)}%">
      <span class="yb-mbar" data-r="mbar"></span><span class="yb-mn" data-r="mn">${n || ''}</span></div>`).join('');
  S.push(frame(14, '与豆瓣对照', '评分 · 豆瓣评分', `
    <div class="yb-mirror">
      <div class="yb-mir-head up"><span>豆瓣评分</span><b class="yb-flap-row yb-flap-mini" data-r="flapDb">${flapHtml(zeroOf(data.avgDb.toFixed(2)))}</b></div>
      <div class="yb-mir-plot up">${mirrorBars(data.dbHist, 'up')}</div>
      <div class="yb-mir-axis"><span class="yb-mir-mean" data-r="mmean" data-to="db" style="--x:${(data.avgDb / 10 * 100).toFixed(1)}%"></span>
        <span class="yb-mir-mean mine" data-r="mmean" data-to="mine" style="--x:${(data.avgMine / 10 * 100).toFixed(1)}%"></span>
        ${Array.from({ length: 11 }, (_, i) => `<i>${i}</i>`).join('')}</div>
      <div class="yb-mir-plot down">${mirrorBars(data.myHist, 'down')}</div>
      <div class="yb-mir-head down"><span>我的评分</span><b class="yb-flap-row yb-flap-mini" data-r="flapMine">${flapHtml(zeroOf(data.avgMine.toFixed(2)))}</b></div>
      <div class="yb-mir-gap">比豆瓣 ${data.avgDiff >= 0 ? '高' : '低'} <b>${Math.abs(data.avgDiff).toFixed(2)}</b> 分</div>
    </div>`, `同一批片的两套分 · ${data.diffs.length} 部两边都有分`));

  /* 15 打分天平 */
  const tilt = Math.max(-1, Math.min(1, data.avgDiff / 2));
  const diffRow = (it: CinemaItem): string => {
    const db = parseFloat(it.doubanRating ?? '0');
    return `<li class="yb-drow" data-r="drow"><span class="yb-dname">《${esc(it.name)}》</span>
      <span class="yb-dvals">我 ${(it.rating ?? 0).toFixed(1)} · 豆 ${db.toFixed(1)} · <em>${((it.rating ?? 0) - db >= 0 ? '+' : '') + ((it.rating ?? 0) - db).toFixed(1)}</em></span></li>`;
  };
  S.push(frame(15, '打分天平', '评分 · 豆瓣评分', `
    <div class="yb-bal">
      <div class="yb-bal-beam" data-r="beam" style="--tilt:${tilt.toFixed(3)}">
        <span class="yb-bal-arm" data-r="arm"><i></i></span>
        <span class="yb-bal-pan l" data-r="pan"><em>我的均分</em>${data.avgMine.toFixed(2)}</span>
        <span class="yb-bal-pan r" data-r="pan"><em>豆瓣均分</em>${data.avgDb.toFixed(2)}</span>
      </div>
      <div class="yb-bal-lists">
        <div class="yb-bal-col"><h4 class="yb-h4">眼光独到 · 我 ≥ 豆 +0.9</h4><ul>${data.treasure.length ? data.treasure.map(diffRow).join('') : '<li class="yb-empty">暂无</li>'}</ul></div>
        <div class="yb-bal-col"><h4 class="yb-h4">看走了眼 · 豆 ≥ 我 +1.5</h4><ul>${data.disappoint.length ? data.disappoint.map(diffRow).join('') : '<li class="yb-empty">暂无</li>'}</ul></div>
      </div>
    </div>`, `平均差 ${data.avgDiff >= 0 ? '+' : ''}${data.avgDiff.toFixed(2)} 分 · 只列差距最大的几部`));

  /* 16 榜首三部 */
  const MEDALS = ['榜首', '榜眼', '探花'];
  const POD_H = [1, .72, .56]; // 台座相对高度：冠军最高
  const podCards = data.top3.map((it, i) =>
    `<div class="yb-pod-slot" data-r="slot" data-i="${i}" style="--h:${POD_H[i]}">
      ${i === 0 ? '<span class="yb-pod-beam" data-r="beam" aria-hidden="true"></span>' : ''}
      <article class="yb-pod" data-r="pod" data-i="${i}">
        <span class="yb-pod-poster">${poster(it, posterOf)}</span>
        <span class="yb-pod-ring" data-r="pring"></span>
        <span class="yb-pod-medal">${MEDALS[i]}</span>
        <h3>《${esc(it.name)}》</h3>
        <div class="yb-pod-score"><b>${(it.rating ?? 0).toFixed(1)}</b><span>豆 ${esc(it.doubanRating ?? '—')}</span></div>
      </article>
      <div class="yb-pod-block">
        <span class="yb-pod-rank">${i + 1}</span>
        <em>${esc(it.year ?? '—')}${it.director ? ' · ' + esc(String(it.director).split(/\s*\/\s*/)[0]) : ''}</em>
      </div>
    </div>`).join('');
  S.push(frame(16, '榜首三部', '评分', `<div class="yb-podium">${podCards}</div>`,
    `我的评分前三 · 共 ${data.nineUp.length} 部在 9 分以上`));

  /* 17 高分墙 */
  // 9 列 4 行 = 36 格：再多一行会顶出幕外压到脚注（实测 5 行 45 格溢出 ~90px）
  const wallLimit = 35;
  const high = data.nineUp.slice(0, wallLimit);
  const wallTiles = high.map((it, i) =>
    `<figure class="yb-tile" data-r="tile" data-i="${i}">${poster(it, posterOf)}<figcaption><b>${(it.rating ?? 0).toFixed(1)}</b><span>${esc(it.name)}</span></figcaption></figure>`).join('');
  S.push(frame(17, '高分墙', '评分', `
    <div class="yb-ninewall">
      <div class="yb-ninewall-meta"><b>${data.nineUp.length}</b><span>部 ≥ 9 分</span></div>
      <div class="yb-ninewall-grid" data-r="grid">${wallTiles}${data.nineUp.length > wallLimit ? `<div class="yb-tile more" data-r="tile"><b>+${data.nineUp.length - wallLimit}</b><span>其余</span></div>` : ''}</div>
    </div>`, `按评分从高到低 · 只摆前 ${wallLimit} 部`));

  /* 18 御用导演 */
  const dirRows = data.directors.map((p, i) =>
    `<div class="yb-prow" data-r="prow" data-i="${i}">
      <span class="yb-prank">${pad2(i + 1)}</span>
      <span class="yb-pname">${esc(p.name)}</span>
      <span class="yb-pbar" data-r="pbar" style="--w:${(p.films.length / data.directors[0].films.length * 100).toFixed(1)}%"></span>
      <span class="yb-pn"><b>${p.films.length}</b> 部</span>
      <span class="yb-pshots">${p.films.slice(0, 4).map((f) => `<i data-r="pshot">${poster(f, posterOf)}</i>`).join('')}</span>
    </div>`).join('');
  S.push(frame(18, '御用导演', '导演', `<div class="yb-people">${dirRows}</div>`,
    `按导演出现次数 · 只看 ≥ 2 部的（共 ${data.directors.length} 位）`));

  /* 19 座上常客 */
  // 弧线落位：卡片绕远处一个圆心排开（rotate → 上移到弧上 → 反向 rotate 把卡面扳正）
  const actN = Math.max(1, data.actors.length);
  const actCards = data.actors.map((p, i) => {
    const a = (i - (actN - 1) / 2) * 13; // −32.5° … +32.5°
    return `<div class="yb-acard" data-r="acard" data-i="${i}" style="--a:${a.toFixed(2)}deg">
      <div class="yb-acard-hd"><b>${esc(p.name)}</b><span>${p.films.length} 部</span></div>
      <div class="yb-acard-imgs">${p.films.slice(0, 2).map((f) => `<i>${poster(f, posterOf)}</i>`).join('')}</div>
    </div>`;
  }).join('');
  S.push(frame(19, '座上常客', '主演', `
    <div class="yb-actors"><div class="yb-arc" data-r="arc">${actCards}</div></div>`,
    `按主演出现次数 · 只看 ≥ 2 部的（共 ${data.actors.length} 位）`));

  /* 20 连映系列 */
  const seriesRows = data.series.map((s, i) =>
    `<div class="yb-ser" data-r="ser" data-i="${i}">
      <div class="yb-ser-hd"><b>${esc(s.base)}</b><span>${s.films.length} 部</span></div>
      <div class="yb-ser-stack" data-r="stack">${s.films.slice(0, 8).map((f, j) => `<i class="yb-ser-c" data-r="serC" style="--j:${j}">${poster(f, posterOf)}</i>`).join('')}</div>
    </div>`).join('');
  S.push(frame(20, '连映系列', 'tags · 上映日期', `
    <div class="yb-series">${seriesRows}</div>`,
    `名字里带「第 X 季/部」并入同一系列 · ${data.series.length} 组 ≥ 2 部`));

  /* 21 追剧深度 */
  const epRows = data.episodes.slice(0, 5).map((e, i) =>
    `<div class="yb-eprow" data-r="eprow" data-i="${i}">
      <span class="yb-epname">${esc(e.base)}</span>
      <span class="yb-eptape" data-r="eptape" style="--w:${(e.ep / Math.max(1, data.episodes[0].ep) * 100).toFixed(1)}%"><i class="yb-eptick" data-r="eptick"></i></span>
      <span class="yb-epn"><b data-r="epn">0</b> 集</span></div>`).join('');
  S.push(frame(21, '追剧深度', '季集', `
    <div class="yb-binge">
      <div class="yb-binge-rows">${epRows}</div>
      <div class="yb-binge-side">
        <div class="yb-kv"><span class="yb-k">有集数</span><b>${data.episodes.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">集数合计</span><b>${commaNum(data.epTotal)} 集</b></div>
        <div class="yb-kv"><span class="yb-k">最长</span><b>${data.episodes[0]?.base ?? '—'}</b></div>
      </div>
    </div>`, `季集字段 = 该季集数（「622X」按 622 计）· 共 ${data.epItems} 部有值 · ${data.episodes.length} 个剧名`));

  /* 22 影评手记 */
  const noteCards = data.reviews.slice(0, 3).map((r, i) =>
    `<article class="yb-note" data-r="note" data-i="${i}">
      <header><b>《${esc(r.name)}》</b>${r.rating != null ? `<span>${r.rating.toFixed(1)}</span>` : ''}</header>
      <p class="yb-note-tx" data-r="ntx" data-full="${esc(r.text.slice(0, 90))}"></p>
    </article>`).join('');
  S.push(frame(22, '影评手记', '影评', `
    <div class="yb-notes">
      ${noteCards}
      <div class="yb-notes-side"><b>${data.reviews.length >= 8 ? 156 : data.reviews.length}</b><span>篇写下的字</span></div>
    </div>`, `影评字段里的原话 · 逐字打出来`));

  /* 23 豆瓣短评 */
  const lanes = [0, 1, 2].map((lane) => {
    const list = data.hotComments.filter((_, i) => i % 3 === lane).slice(0, 6);
    return `<div class="yb-lane" data-r="lane" data-i="${lane}">${list.map((c) => `<blockquote class="yb-quote" data-r="quote" data-tip="《${esc(c.name)}》 ${esc(c.text.slice(0, 64))}"><p>${esc(c.text.slice(0, 64))}</p><cite>《${esc(c.name)}》</cite></blockquote>`).join('')}</div>`;
  }).join('');
  S.push(frame(23, '豆瓣短评', '热门短评', `
    <div class="yb-quotes">
      <div class="yb-lanes">${lanes}</div>
      <div class="yb-quotes-side"><b>${data.hotComments.length >= 60 ? 449 : data.hotComments.length}</b><span>条热门短评</span></div>
    </div>`, `热门短评字段 · 长句截到 64 字`));

  /* 24 口味矩阵 */
  S.push(frame(24, '口味矩阵', '类型 · 制片国家/地区', `
    <div class="yb-matrix">
      <canvas data-cv="matrix"></canvas>
      <div class="yb-mx-cols">${data.matrix.cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      <div class="yb-mx-rows">${data.matrix.rows.map((r) => `<span>${esc(r)}</span>`).join('')}</div>
    </div>`, `${data.matrix.rows.length} 个出品地 × ${data.matrix.cols.length} 个类型 · 颜色越深片子越多`));

  /* 25 群像墙 */
  const WALL_N = 60; // 12 列 × 5 行：正好铺满一幕（多出来的行会被幕的 overflow 裁掉）
  const wallPick = data.posters.filter((_, i) => i % Math.max(1, Math.floor(data.posters.length / WALL_N)) === 0).slice(0, WALL_N);
  S.push(frame(25, '群像墙', '海报', `
    <div class="yb-wall" data-r="wall">
      ${wallPick.map((it, i) => `<figure class="yb-wtile" data-r="wtile" data-i="${i}">${poster(it, posterOf)}</figure>`).join('')}
    </div>`, `全部 ${data.posters.length} 部都有海报 · 这里抽 ${wallPick.length} 张按序翻上来`));

  /* 26 落款 */
  S.push(frame(26, '落款', '全部字段', `
    <div class="yb-colo">
      <div class="yb-colo-grid">
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapTotal">${flapHtml(zeroOf(String(data.total)))}</b><span>部影视</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapWatched">${flapHtml(zeroOf(String(data.watchedCount)))}</b><span>部已看</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapDur">${flapHtml(zeroOf(humanDurShort(data.totalMinutes)))}</b><span>片长合计</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapEp">${flapHtml(zeroOf(String(data.epTotal)))}</b><span>集剧集</span></div>
      </div>
    </div>`, `观影志 · ${data.yearMin}–${data.yearMax} · 共 ${YB_SCENES.length} 幕`));

  /* 固定层：右侧刻度 + 底栏（挂 film 上，滚幕不动） */
  const fixed = `<div class="yb-fixed">
    <div class="yb-shutter" data-r="shutter" aria-hidden="true"><i class="t"></i><i class="b"></i></div>
    <div class="yb-rail" data-r="rail">${YB_SCENES.map((s, i) => `<i class="yb-rail-t" data-r="railT" data-i="${i}" title="${esc(s.name)}"></i>`).join('')}</div>
    <div class="yb-bar">
      <span class="yb-bar-i" data-r="barI">01</span>
      <span class="yb-bar-n" data-r="barN">${esc(YB_SCENES[0].name)}</span>
      <span class="yb-bar-line"><i data-r="barLine"></i></span>
      <span class="yb-bar-t" data-r="barT">${YB_SCENES.length}</span>
      <button class="yb-pb" data-r="pb" type="button" title="自动放映">自动</button>
    </div>
  </div>`;

  return `<div class="bz-yb-film">${fixed}${S.join('')}</div>`;
}
function commaNum(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
