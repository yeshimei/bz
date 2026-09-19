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
 *
 * 特别篇并入（2026-09-20 用户拍板「只按前缀认」）：
 *   「<剧名>：<副标题>」这类电影版 / 特别篇 / 外传并入同名剧集的合并卡（specials），
 *   不看组、不看豆瓣「相关书影音」、不做 is_tv 落盘兜底——片名前缀是唯一信号。
 *   同一套「≥2 季才建卡」的门槛：库内没有同名 ≥2 季剧集的孤立特别篇照旧出普通卡。
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

/**
 * 特别篇前缀分隔符（片名余下部分必须以它开头才认作「剧名 + 副标题」）。
 * **刻意不含「之」**：「我的三体之章北海传」「X之王」这类复合词既可能是独立作品、
 * 也是汉语里最黏的连接词，误合比漏合更伤——漏合改个名（「：」）就能补，误合会悄悄吞掉一部片。
 * 冒号（全角/半角）、空格、连字符、间隔号是「系列名：分支」的惯用写法。
 */
const SPECIAL_SEP_RE = /^[\s:：·\-—－]+/;

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
  /**
   * 特别篇 / 电影版 / 外传（片名前缀 = 本剧 + 分隔符的条目）：**不占季号、不进季圆点**，
   * 只在合并卡详情弹窗里单独一段列出（它们是各自独立的一篇笔记，不是一个「季」）。
   * 顺序 = 原列表顺序（与卡片落位同一口径，不做二次排序）。
   */
  specials: CinemaItem[];
  /** 卡片正脸（海报/年份/导演/抓取遮罩）：观影日期最新的一季 */
  face: CinemaItem;
  /** 卡片评分：最新已评条目（各季 + 特别篇）的分数；全未评 = null */
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
 * 最新已评条目的评分（各季 + 特别篇同一口径：口径含特别篇，badge 与卡片评分读作
 * 「你最近在追的那部」——电影版特别篇刚看完打了分，正脸季还在看不评分，取特别篇的才不空）。
 */
function latestRated(items: CinemaItem[]): number | null {
  const rated = items.filter((it) => it.rating != null && it.rating > 0);
  if (!rated.length) return null;
  return rated.reduce((best, it) => (watchTs(it) >= watchTs(best) ? it : best), rated[0]).rating;
}

/**
 * 前缀命中判定：`name` = `<剧名> + 分隔符 + 副标题` 时返回命中的合并卡（否则 null）。
 * 卡片名更长的优先（最长 base 优先）——「瑞克和莫蒂」与「瑞克和莫蒂 外传」两张卡同时在库时，
 * 「瑞克和莫蒂 外传：花絮」归后者。同长并列取先建卡者（入参顺序稳定）。
 */
function specialHostOf(name: string, cards: SeriesCard[]): SeriesCard | null {
  let hit: SeriesCard | null = null;
  for (const c of cards) {
    if (!c.name || name.length <= c.name.length) continue;
    if (hit && c.name.length <= hit.name.length) continue;
    if (!name.startsWith(c.name)) continue;
    const rest = name.slice(c.name.length);
    const sep = SPECIAL_SEP_RE.exec(rest);
    // 分隔符后必须有非空副标题：「老友记：」（光秃秃一个冒号）不算
    if (!sep || !rest.slice(sep[0].length).trim()) continue;
    hit = c;
  }
  return hit;
}

/**
 * 条目列表 → 卡片条目。
 * - 合并关闭：一一对应（恒 single），顺序与入参完全一致；
 * - 合并开启：同组 + 归一名称相同 + ≥2 季 → 一张合并卡，**落位 = 该剧首季在原列表中的位置**
 *   （排序语义不变：首季排到哪，合并卡就在哪）；其余同剧条目不再单独出卡；
 *   片名前缀命中的特别篇并入该卡（`specials`），**不再单独出卡**。
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
    merged.set(key, {
      kind: 'series',
      key,
      name: parseSeasonName(slots[0].item.name)!.base,
      group: slots[0].item.group,
      seasons: slots,
      specials: [],
      face: pickFace(slots),
      rating: null, // 统一在特别篇并入后算（口径含特别篇）
    });
  }

  // 第二遍半：特别篇前缀并入（最长 base 优先）
  // 候选 = **没走季路径**的条目：非剧集/动漫组的一切（电影版/纪录片版特别篇），
  // 以及剧集/动漫组里认不出「第X季」的（如「老友记 特别篇」）——认得出季号的条目一律归季路径
  // （它们已在第一遍入表，哪怕因季号重复被去重丢掉也不当特别篇）。
  const cards = [...merged.values()];
  const absorbed = new Set<CinemaItem>();
  for (const it of list) {
    if (MERGE_GROUPS.includes(it.group) && parseSeasonName(it.name)) continue;
    const host = specialHostOf(it.name, cards);
    if (!host) continue;
    host.specials.push(it);
    absorbed.add(it);
  }

  // 卡片评分：最新已评条目（各季 + 特别篇）
  const allItemsOf = (c: SeriesCard): CinemaItem[] => c.seasons.map((s) => s.item).concat(c.specials);
  for (const c of cards) c.rating = latestRated(allItemsOf(c));

  // 第三遍：按原序装配（并入的特别篇已挂在卡上，跳过、不再出普通卡）
  const out: CardEntry[] = [];
  const emitted = new Set<string>();
  for (const it of list) {
    if (absorbed.has(it)) continue;
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
