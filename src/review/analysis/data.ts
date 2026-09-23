/**
 * 记忆分析 · 数据派生（纯函数，零 DOM，node 直测）
 *
 * 口径：只认 review.json 里真有的字段（ReviewItem：stage/phase/stability/difficulty/
 * reviewHistory/nextReviewDate/lastReviewed/lastDifficulty/completed/pendingRedo/pinned…），
 * 派生量复用域内单源——currentR（fsrs.ts）/ partitionQueue（queue.ts）/ dateKey（stats.ts），
 * 不另写第二份公式。缺字段一律 0/null/空数组，不补默认值、不造数、不崩。
 *
 * 词汇（表演层的语言，源自这里的数据形状）：
 * - 忆炭 ember：一条在册笔记的记忆余温（R）——R 高是青焰、临期是烛橙、逾期成熄红；
 * - 忘坡：FSRS 幂律遗忘曲线（主视觉母题）；S=稳定性（耐烧度）、D=难度、R=留存率；
 * - 欠账：逾期未还的复习；添柴：一次复习动作；阶石：阶梯十级；墨晶：稳定性的结晶。
 */
import type { ReviewItem } from '../data';
import { DEFAULT_W, currentR } from '../fsrs';
import { partitionQueue } from '../queue';
import { dateKey } from '../stats';

/** 评级四档键序（忘了→简单；ratingDist/lastDiffDist 统一按此序出幕） */
export const RA_RATING_ORDER = ['again', 'hard', 'good', 'easy'] as const;
export const RA_RATING_NAMES: Record<string, string> = { again: '忘了', hard: '困难', good: '一般', easy: '简单' };

/** 单条在册笔记的「忆炭」（一条炭火 = 一份记忆的当前状态） */
export interface RaEmber {
  name: string;
  /** 当前留存率 0..1（仅 FSRS 相位且可算；阶梯/缺失为 null） */
  r: number | null;
  /** 稳定性（天） */
  s: number;
  /** 难度（0.3..10；阶梯默认 0.3） */
  d: number;
  /** 阶段号（阶梯 0..8；FSRS 恒 9） */
  stage: number;
  phase: 'ladder' | 'fsrs';
  /** 逾期中 */
  overdue: boolean;
  /** 逾期天数（>0 才有意义） */
  overdueDays: number;
  /** 距上次复习的天数（无 lastReviewed 为 null）——忘坡横轴 */
  ageDays: number | null;
  /** 距到期天数（未来为正、已过为负；无排期 null） */
  dueInDays: number | null;
  done: boolean;
  missing: boolean;
  /** 待重做 */
  redo: boolean;
  pinned: boolean;
  /** 复习次数（历史条数） */
  reviews: number;
}

/** 稳定性分层桶（墨晶幕：结晶大小档） */
export interface RaBucket { label: string; n: number }

/** 全量派生（index.ts 只从这里取，不直接摸 items 的原始形状） */
export interface RaData {
  total: number;
  active: number;
  doneN: number;
  missingN: number;
  ladderN: number;
  fsrsN: number;
  /** 阶段分布：10 桶 = 阶梯 stage0..8 + FSRS（index 9） */
  stageDist: number[];
  /** 最多条目所在档（无条目 -1） */
  stagePeak: number;
  /** 在册忆炭（全部条目，含完成/缺失——各幕自己挑） */
  embers: RaEmber[];
  /** 活跃忆炭（未完成未缺失；忆炉全景/基岩等幕的数据源） */
  liveEmbers: RaEmber[];
  /** 逾期专页：按逾期天数降序 */
  overdueList: Array<{ name: string; days: number }>;
  overdueN: number;
  todayN: number;
  futureN: number;
  doneColN: number;
  /** 平均留存率（可算的 FSRS 条目均值；无可算为 null） */
  avgR: number | null;
  /** 留存率直方 10 桶（i = floor(R*10)，R=1 落第 9 桶） */
  rHist: number[];
  rAbove90: number;
  rBelow50: number;
  /** 稳定性分层（<7 天 / 7-30 / 30-90 / ≥90） */
  sBuckets: RaBucket[];
  /** 全库最大稳定性（天；无 FSRS 条目 0） */
  sMax: number;
  /** 难度分层（<2 / 2-4 / 4-6 / ≥6） */
  dBuckets: RaBucket[];
  /** 平均难度（有 FSRS 条目才有；否则 null） */
  dAvg: number | null;
  /** 最近 14 天每日添柴数（补零，键 YYYY-MM-DD，末位=今天） */
  daily14: Array<{ date: string; count: number }>;
  dailyPeak: number;
  /** 14 天添柴合计 */
  dailyTotal: number;
  /** 连续添柴天数（宽松口径，同日去重——复用 stats 语义，此处自算保持纯函数无环） */
  streak: number;
  /** 去重复习天数 */
  distinctDays: number;
  firstReviewAt: string | null;
  /** 评级分布（忘了/困难/一般/简单；键为 rating 原文） */
  ratingDist: Record<string, number>;
  /** 批改总次数（评级记录总条数） */
  verdictTotal: number;
  /** 忘了率（again / 总评级；无记录 null） */
  againRate: number | null;
  /** 基岩榜：最稳的几篇（按 S 降序，r 可能为 null） */
  bedrock: Array<{ name: string; s: number; r: number | null; reviews: number }>;
  /** 来潮：今天起 8 天排程（含今日；label「今」「+1」…） */
  next8: Array<{ date: string; label: string; count: number }>;
  tomorrowN: number;
  /** 待重做篇数 */
  redoN: number;
  /** 末次评级分布（lastDifficulty 原文计数） */
  lastDiffDist: Record<string, number>;
  /** 平均信心（0..1；全部缺省为 0） */
  confidenceAvg: number;
}

const sBucketsOf = (list: number[]): RaBucket[] => {
  const def: Array<[string, (v: number) => boolean]> = [
    ['<7 天', (v) => v < 7],
    ['7-30 天', (v) => v >= 7 && v < 30],
    ['30-90 天', (v) => v >= 30 && v < 90],
    ['≥90 天', (v) => v >= 90],
  ];
  return def.map(([label, hit]) => ({ label, n: list.filter(hit).length }));
};

const dBucketsOf = (list: number[]): RaBucket[] => {
  const def: Array<[string, (v: number) => boolean]> = [
    ['<2', (v) => v < 2],
    ['2-4', (v) => v >= 2 && v < 4],
    ['4-6', (v) => v >= 4 && v < 6],
    ['≥6', (v) => v >= 6],
  ];
  return def.map(([label, hit]) => ({ label, n: list.filter(hit).length }));
};

/** 全量派生。w = 调度权重（拟合优先，缺省回退 DEFAULT_W）；now 可注入（测试/重放）。 */
export function deriveAnalysis(
  items: ReviewItem[],
  opts?: { w?: number[]; now?: number | Date }
): RaData {
  const w = opts?.w || DEFAULT_W;
  const nowMs = opts?.now != null ? new Date(opts.now).getTime() : Date.now();

  const embers: RaEmber[] = items.map((it) => {
    const r = currentR(it, w, nowMs);
    const nextMs = it.nextReviewDate ? new Date(it.nextReviewDate).getTime() : NaN;
    const dueDays = Number.isFinite(nextMs) ? (nextMs - nowMs) / 86400000 : null;
    const lastMs = it.lastReviewed ? new Date(it.lastReviewed).getTime() : NaN;
    return {
      name: it.name || it.filePath,
      r,
      s: Number(it.stability) || 0,
      d: Number(it.difficulty) || 0,
      stage: Math.max(0, Math.min(9, Number(it.stage) || 0)),
      phase: it.phase === 'fsrs' ? 'fsrs' : 'ladder',
      overdue: !!it.isOverdue,
      overdueDays: it.isOverdue && dueDays != null ? Math.max(0, -dueDays) : 0,
      ageDays: Number.isFinite(lastMs) ? Math.max(0, (nowMs - lastMs) / 86400000) : null,
      dueInDays: dueDays == null || !Number.isFinite(dueDays) ? null : dueDays,
      done: !!(it.completed || it.isCompleted),
      missing: !!it.isMissing,
      redo: !!it.pendingRedo,
      pinned: !!it.pinned,
      reviews: Array.isArray(it.reviewHistory) ? it.reviewHistory.length : 0,
    };
  });

  const live = embers.filter((e) => !e.done && !e.missing);
  const doneN = embers.filter((e) => e.done).length;
  const missingN = embers.filter((e) => e.missing).length;
  const ladderN = live.filter((e) => e.phase === 'ladder').length;
  const fsrsN = live.filter((e) => e.phase === 'fsrs').length;

  // 阶段分布：阶梯 stage0..8 各一桶，FSRS 并入第 9 桶（index 9）
  const stageDist = new Array<number>(10).fill(0);
  for (const e of live) stageDist[e.phase === 'fsrs' ? 9 : Math.min(8, e.stage)]++;
  const stagePeak = stageDist.some((n) => n > 0) ? stageDist.indexOf(Math.max(...stageDist)) : -1;

  // 队列三区（复用 queue.partitionQueue 单源口径；rThreshold 用默认——分析层只看形状）
  const cols = partitionQueue(items, 0.9, w);

  // 留存率直方与均值（只统计可算的）
  const rs = live.map((e) => e.r).filter((v): v is number => v != null);
  const rHist = new Array<number>(10).fill(0);
  for (const v of rs) rHist[Math.max(0, Math.min(9, Math.floor(v * 10)))]++;
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;

  // 稳定性 / 难度（FSRS 相位才有意义）
  const fsrsList = live.filter((e) => e.phase === 'fsrs' && e.s > 0);
  const sBuckets = sBucketsOf(fsrsList.map((e) => e.s));
  const sMax = fsrsList.reduce((m, e) => Math.max(m, e.s), 0);
  const dAvg = fsrsList.length ? fsrsList.reduce((a, e) => a + e.d, 0) / fsrsList.length : null;

  // 添柴志：最近 14 天（含今天），按评级记录 timestamp 落日（宽松口径不与 stats 拉环）
  const daily14: Array<{ date: string; count: number }> = [];
  const dayIdx = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(nowMs - i * 86400000);
    const key = dateKey(d);
    dayIdx.set(key, daily14.length);
    daily14.push({ date: key, count: 0 });
  }
  let verdictTotal = 0;
  const ratingDist: Record<string, number> = {};
  const lastDiffDist: Record<string, number> = {};
  const distinct = new Set<string>();
  let firstMs = Infinity;
  for (const it of items) {
    const hist = Array.isArray(it.reviewHistory) ? it.reviewHistory : [];
    for (const h of hist) {
      verdictTotal++;
      const rating = String((h as any)?.rating ?? '');
      if (rating) ratingDist[rating] = (ratingDist[rating] || 0) + 1;
      const ts = (h as any)?.timestamp ? new Date((h as any).timestamp).getTime() : NaN;
      if (Number.isFinite(ts)) {
        distinct.add(dateKey(new Date(ts)));
        if (ts < firstMs) firstMs = ts;
        const slot = dayIdx.get(dateKey(new Date(ts)));
        if (slot != null) daily14[slot].count++;
      }
    }
    const ld = it.lastDifficulty ? String(it.lastDifficulty) : '';
    if (ld) lastDiffDist[ld] = (lastDiffDist[ld] || 0) + 1;
  }
  const dailyPeak = daily14.reduce((m, d) => Math.max(m, d.count), 0);
  const dailyTotal = daily14.reduce((a, d) => a + d.count, 0);

  // 连续添柴（宽松：今天没柴从昨天起算；断一天即停——与 stats.computeStats 同语义）
  let streak = 0;
  const cursor = new Date(nowMs);
  cursor.setHours(0, 0, 0, 0);
  if (!distinct.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (distinct.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 基岩榜：最稳 TOP5（活跃、FSRS、S>0）
  const bedrock = fsrsList.slice()
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((e) => ({ name: e.name, s: e.s, r: e.r, reviews: e.reviews }));

  // 来潮：今天起 8 天排程（nextReviewDate 落日；缺失/完成不计）
  const next8: Array<{ date: string; label: string; count: number }> = [];
  const tideIdx = new Map<string, number>();
  for (let i = 0; i < 8; i++) {
    const d = new Date(nowMs + i * 86400000);
    const key = dateKey(d);
    tideIdx.set(key, next8.length);
    next8.push({ date: key, label: i === 0 ? '今' : `+${i}`, count: 0 });
  }
  for (const it of items) {
    if (it.completed || it.isCompleted || it.isMissing || !it.nextReviewDate) continue;
    const key = dateKey(new Date(it.nextReviewDate));
    const slot = tideIdx.get(key);
    if (slot != null) next8[slot].count++;
  }
  const tomorrowN = next8[1]?.count ?? 0;

  const againN = ratingDist['again'] || 0;
  const redoN = live.filter((e) => e.redo).length;
  const confList = items.map((it) => Number(it.averageConfidence)).filter((v) => Number.isFinite(v) && v > 0);

  return {
    total: embers.length,    active: live.length,
    doneN,
    missingN,
    ladderN,
    fsrsN,
    stageDist,
    stagePeak,
    embers,
    liveEmbers: live,
    overdueList: live
      .filter((e) => e.overdue)
      .sort((a, b) => b.overdueDays - a.overdueDays)
      .map((e) => ({ name: e.name, days: e.overdueDays })),
    overdueN: cols.overdue.length,
    todayN: cols.today.length,
    futureN: cols.future.length,
    doneColN: cols.done.length,
    avgR,
    rHist,
    rAbove90: rs.filter((v) => v > 0.9).length,
    rBelow50: rs.filter((v) => v < 0.5).length,
    sBuckets,
    sMax,
    dBuckets: dBucketsOf(fsrsList.map((e) => e.d)),
    dAvg,
    daily14,
    dailyPeak,
    dailyTotal,
    streak,
    distinctDays: distinct.size,
    firstReviewAt: Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : null,
    ratingDist,
    verdictTotal,
    againRate: verdictTotal ? againN / verdictTotal : null,
    bedrock,
    next8,
    tomorrowN,
    redoN,
    lastDiffDist,
    confidenceAvg: confList.length ? confList.reduce((a, b) => a + b, 0) / confList.length : 0,
  };
}
