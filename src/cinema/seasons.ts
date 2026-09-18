/**
 * 影院（cinema）域·剧集按季合并（设置 cinemaMergeSeasons，2026-09-18 用户选定「D1 分段条」）。
 *
 * 纯加工层：条目列表 + 合并开关显式入参，**不读设置、不读 M、不碰盘**——合并是渲染层分组，
 * 不新增任何存储、不改笔记、不动数据契约（ADR-0168）。
 * 与渲染纯层同口径（ADR-0104）：只 import 域内类型，import 图不含 obsidian/core 服务，
 * 故 shared.ts / layouts 可直接消费本模块产出的 CardEntry。
 *
 * 判定口径（唯一真理源，禁第二套）：
 *   可合并组 = 剧集 / 动漫；名称剥掉「第X季 / Season N」后**完全相同**才归一部；
 *   ≥2 季才合并，单季回退普通卡（不为了统一而把单季塞进合集里）。
 */
import type { CinemaItem } from './state';

/** 参与合并的组（电影/纪录片/公开课不参与——它们没有「季」语义） */
const MERGE_GROUPS: readonly string[] = ['剧集', '动漫'];

/** 中文数字（一~九） */
const CN_NUM: Record<string, number> = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 中文/阿拉伯数字 → 数值（只认 0~99；认不出返回 null） */
export function seasonNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === '十') return 10;
  const m = raw.match(/^(.)?十(.)?$/); // 十 / 十一 / 二十 / 二十三
  if (m) {
    const tens = m[1] ? CN_NUM[m[1]] : 1;
    const ones = m[2] ? CN_NUM[m[2]] : 0;
    return tens == null || ones == null ? null : tens * 10 + ones;
  }
  return raw.length === 1 && CN_NUM[raw] != null ? CN_NUM[raw] : null;
}

/**
 * 季标记：「第X季」或「Season N」（大小写不敏感）。
 * 刻意**不认** S1 / EP1 / 第N部 这类缩写：片名里出现 S1 的误伤概率远高于收益，
 * 而「第N部」是电影续集语义、不是剧集的一季。
 */
const SEASON_RE = /(?:第\s*([0-9]+|[零一二三四五六七八九十]+)\s*季)|(?:season\s*([0-9]+))/i;

/** 名称归一结果：base = 剥掉季标记后的片名，season = 季号 */
export interface SeasonNameParts {
  base: string;
  season: number;
}

/**
 * 名称归一：剥掉「第X季 / Season N」→ { base, season }；不含季标记（或季号不可识别）返回 null。
 * 「老友记 第一季」→ { base: '老友记', season: 1 }；「Friends Season 3」→ { base: 'Friends', season: 3 }。
 */
export function parseSeasonName(name: string): SeasonNameParts | null {
  const m = SEASON_RE.exec(name);
  if (!m) return null;
  const season = seasonNumber(m[1] ?? m[2] ?? '');
  if (season == null || season <= 0) return null;
  const base = (name.slice(0, m.index) + name.slice(m.index + m[0].length))
    .replace(/[\s\-–—·:：]+$/, '') // 剥掉「瑞克和莫蒂 - 第一季」留下的尾部分隔符
    .replace(/[\s\-–—·:：]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return base ? { base, season } : null;
}

/** 合并卡内的一季 */
export interface SeasonSlot {
  /** 季号（由片名推出） */
  no: number;
  item: CinemaItem;
}

/** 合并卡（剧集：库内 ≥2 季） */
export interface SeriesCard {
  kind: 'series';
  /** 稳定键（渲染层 data-cinema-key；`series:` 前缀与条目键 file.path / new:name 不相交） */
  key: string;
  /** 归一名称（卡片标题） */
  name: string;
  /** 所属组（剧集/动漫；rail 计数与类型筛选用） */
  group: string;
  /** 各季（季号升序） */
  seasons: SeasonSlot[];
  /** 卡片正脸（海报/年份/导演/抓取遮罩）：观影日期最新的一季 */
  face: CinemaItem;
  /** 卡片评分：最新已评季（评分>0）的分数；全未评 = null */
  rating: number | null;
}

/** 普通卡（电影/单季剧/未参与合并的一切条目） */
export interface SingleCard {
  kind: 'single';
  item: CinemaItem;
}

export type CardEntry = SeriesCard | SingleCard;

/** 合并卡稳定键（组 + 归一名称；组进键避免同名剧集/动漫互相吞并） */
export function seriesKeyOf(group: string, base: string): string {
  return `series:${group}:${base}`;
}

/** 是否合并卡稳定键（ui.ts 点击分流用） */
export function isSeriesKey(key: string | undefined | null): boolean {
  return !!key && key.startsWith('series:');
}

/** 卡片正脸条目（海报/抓取遮罩解析的入参） */
export function cardFace(e: CardEntry): CinemaItem {
  return e.kind === 'series' ? e.face : e.item;
}

/** 卡片所属组（rail 计数） */
export function cardGroup(e: CardEntry): string {
  return e.kind === 'series' ? e.group : e.item.group;
}

/** 观影日期时间戳（无日期 → 0；与 data.ts::dateVal 同口径，此处本地化避免纯层引入 data.ts 的模块态） */
function watchTs(it: CinemaItem): number {
  if (!it.watchDate) return 0;
  const t = new Date(it.watchDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** 正脸 = 观影日期最新的一季（并列取季号大者） */
function pickFace(slots: SeasonSlot[]): CinemaItem {
  let best = slots[0];
  for (const s of slots) {
    const t = watchTs(s.item);
    const bt = watchTs(best.item);
    if (t > bt || (t === bt && s.no > best.no)) best = s;
  }
  return best.item;
}

/**
 * 条目列表 → 卡片条目。
 * - 合并关闭：一一对应（恒 single），顺序与入参完全一致；
 * - 合并开启：同组 + 归一名称相同 + ≥2 季 → 一张合并卡，**落位 = 该剧首季在原列表中的位置**
 *   （排序语义不变：首季排到哪，合并卡就在哪）；其余同剧条目不再单独出卡。
 * 季号重复（「老友记 第一季」/「老友记 第1季」两种写法并存）时保留先出现的那条——
 * 进度条「一段 = 一季」的语义优先，且同目录下同名笔记本就只能存在一个。
 */
export function mergeSeasonCards(list: CinemaItem[], merge: boolean): CardEntry[] {
  if (!merge) return list.map((item) => ({ kind: 'single', item }));

  // 第一遍：按「组 + 归一名称」聚季（保持首现顺序，稳定）
  const grouped = new Map<string, SeasonSlot[]>();
  for (const it of list) {
    if (!MERGE_GROUPS.includes(it.group)) continue;
    const parsed = parseSeasonName(it.name);
    if (!parsed) continue;
    const key = seriesKeyOf(it.group, parsed.base);
    const slots = grouped.get(key);
    if (slots) {
      if (!slots.some((s) => s.no === parsed.season)) slots.push({ no: parsed.season, item: it });
    } else {
      grouped.set(key, [{ no: parsed.season, item: it }]);
    }
  }

  // 第二遍：≥2 季的组装合并卡（单季不进表 → 自然回退普通卡）
  const merged = new Map<string, SeriesCard>();
  for (const [key, slots] of grouped) {
    if (slots.length < 2) continue;
    slots.sort((a, b) => a.no - b.no);
    const rated = slots.filter((s) => s.item.rating != null && s.item.rating > 0);
    const latestRated = rated.length
      ? rated.reduce((best, s) => (watchTs(s.item) >= watchTs(best.item) ? s : best), rated[0])
      : null;
    merged.set(key, {
      kind: 'series',
      key,
      name: parseSeasonName(slots[0].item.name)!.base,
      group: slots[0].item.group,
      seasons: slots,
      face: pickFace(slots),
      rating: latestRated ? latestRated.item.rating : null,
    });
  }

  // 第三遍：按原序装配
  const out: CardEntry[] = [];
  const emitted = new Set<string>();
  for (const it of list) {
    let key: string | null = null;
    if (MERGE_GROUPS.includes(it.group)) {
      const parsed = parseSeasonName(it.name);
      key = parsed ? seriesKeyOf(it.group, parsed.base) : null;
    }
    const card = key ? merged.get(key) : undefined;
    if (card) {
      if (!emitted.has(card.key)) {
        out.push(card);
        emitted.add(card.key);
      }
      continue;
    }
    out.push({ kind: 'single', item: it });
  }
  return out;
}
