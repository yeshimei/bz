/**
 * 日记观察文案与判定层（ticket 077，ADR-0030）：
 * 用户拍板——日记观察从「observationText 快照 + 10 分钟去弹跳」改为**每条日记独立 10 分钟结算机制**：
 * 创建/修改日记 md → 该条日记的 10 分钟计时重置；静置（停笔超 10 分钟）→ 结算产出观察。
 * 观察是**静态快照**，只有「新增」「新增更新」两种产出（无覆盖、无引用、无动态读取）。
 * 本模块为纯函数层（可测）：解析日记 md → 条目；结算判定（首落有字门 / 累计 >50 才更新）；观察文案（首次/更新/删除）。
 *
 * 数据格式零改动：`我的/日记/YYYY-MM-DD.md` 条目标题为 `# <emoji 序列> HH:mm`，正文标题行之后全量不截断。
 * emoji → 分类名映射 **import src/diary/config 的 emojiToTagMap**（单向域间 import，对齐 movie→smartcat 先例；
 * diary/config 只依赖 diary/types，无环；若未来形成循环依赖则内置映射表并注明来源）。
 * 分类语义对齐 diary/parser.parseFile：标题行 emoji 逐个反查分类名（主/二级都列），无命中回退「日记」。
 */
import { emojiToTagMap } from '../diary/config';
import type { StructuredMeta } from './types';

/** 日记条目（smartcat 侧精简形状：只取观察所需字段） */
export interface DiaryEntryLike {
  /** 时间 HH:mm（标题行） */
  time: string;
  /** 分类名（主/二级都列，标题行 emoji 序列逐个反查） */
  tags: string[];
  /** 正文（标题行之后到下一标题行/末尾，全量不截断；仅去首尾空白） */
  body: string;
}

/** 结算静置时长（10 分钟；index 层可注入缩短——测试经 __setDiarySettleMsForTests 覆盖生产默认） */
export const DIARY_SETTLE_MS = 10 * 60 * 1000;

/** 更新观察累计字数阈值（累计 >50 字才生成更新观察；=50 不生成） */
export const DIARY_UPDATE_THRESHOLD = 50;

/** 标题行正则（与 diary/parser.parseFile 的 headingRegex 完全一致：`# <emoji+> HH:mm`） */
const HEADING_RE = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;

/** 字符数（中文按字符计：按码点切分，代理对 emoji 记 1 字；对齐 ticket「中文按字符数」语义） */
export function diaryCharCount(s: string): number {
  return Array.from(s || '').length;
}

/** 标题行 emoji 序列逐个反查分类名（grapheme 切分，对齐 diary/parser：无命中回退「日记」） */
function tagsFromEmojiSeq(seq: string): string[] {
  const tags: string[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const seg of segmenter.segment(seq)) {
    const tag = emojiToTagMap[seg.segment];
    if (tag) tags.push(tag);
  }
  return tags.length ? tags : ['日记'];
}

/** 解析日记 md → 条目数组（纯函数）。正文 = 标题行之后到下一标题行/末尾，全量不截断（仅去首尾空白）。 */
export function parseDiaryFile(content: string): DiaryEntryLike[] {
  const entries: DiaryEntryLike[] = [];
  const lines = (content || '').split('\n');
  let current: DiaryEntryLike | null = null;
  let bodyLines: string[] = [];
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      if (current) {
        current.body = bodyLines.join('\n').trim();
        entries.push(current);
        bodyLines = [];
      }
      current = { time: m[2], tags: tagsFromEmojiSeq(m[1]), body: '' };
    } else if (current) {
      bodyLines.push(line);
    }
  }
  if (current) {
    current.body = bodyLines.join('\n').trim();
    entries.push(current);
  }
  return entries;
}

// ---------------- 结算状态与判定（纯函数可测） ----------------

/** 单条日记的结算状态（index 层计时表携带：是否已产出/上次生成基线/累计字数） */
export interface DiarySettleState {
  /** 该条是否已结算产出过首次观察（重启基线有字条目视为已见，防重启后旧条目被当首次） */
  generated: boolean;
  /** 上次生成时的正文基线 */
  baseline: string;
  /** 上次生成时的分类（供更新观察括号内分类变化判断） */
  baselineTags: string[];
  /** 自上次生成以来累计字数差（每次结算累加；生成更新观察后归零） */
  accum: number;
}

/** 结算产出形态：first=新增观察 / update=新增更新观察 / none=不生成（推进累计或不落） */
export type DiarySettleResult =
  | { kind: 'first'; text: string; next: DiarySettleState }
  | { kind: 'update'; text: string; next: DiarySettleState }
  | { kind: 'none'; text: null; next: DiarySettleState };

/**
 * 结算判定纯函数（ticket 077 规则）：
 * - 首落（该条尚无观察）：正文**有字（非空）**才生成首次观察；只有标题（正文空）→ 不生成（记已见，防「标题即存」）；
 * - 已有观察：累计字数差 = 当前正文长度 − 上次生成基线长度（中文按字符数，**负值钳位 0**——删改不产生负累计，
 *   ticket 084d B4 防删改后补写被长期压制），累加进 state.accum；
 *   `累计 >50` → 生成更新观察并重置基线/累计；`累计 ≤50` → 不生成（本次补写不进记忆，但计入累计，等下次结算）。
 * - 「累计」= 自上次生成以来每次结算累计的长度变化（如基线 60 字：结算 75 字累计 +15；大改 130 字累计 +15+70=85 >50 → 更新）。
 */
export function decideDiarySettle(entry: DiaryEntryLike, date: string, state: DiarySettleState): DiarySettleResult {
  // B4（ticket 084d）：delta 钳位 ≥0——删改后的负差不再抵消补写（删 40 写 110 → 累计按补写推进而非净差 30）
  const delta = Math.max(0, diaryCharCount(entry.body) - diaryCharCount(state.baseline));
  if (!state.generated) {
    if (!entry.body) return { kind: 'none', text: null, next: state };
    const text = diaryFirstText(date, entry.time, entry.tags, entry.body);
    return { kind: 'first', text, next: { generated: true, baseline: entry.body, baselineTags: entry.tags, accum: 0 } };
  }
  const accum = state.accum + delta;
  if (accum > DIARY_UPDATE_THRESHOLD) {
    const tagsChanged = !sameTags(state.baselineTags, entry.tags);
    const text = diaryUpdateText(date, entry.time, entry.tags, entry.body, tagsChanged);
    return { kind: 'update', text, next: { generated: true, baseline: entry.body, baselineTags: entry.tags, accum: 0 } };
  }
  return { kind: 'none', text: null, next: { ...state, accum } };
}

/** 分类是否一致（数组顺序敏感；用于更新观察括号内是否带分类） */
function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

// ---------------- 观察文案（ticket 077 用户八轮拍板，措辞不得自改） ----------------

/** 首次观察文案：`你在 <YYYY-MM-DD HH:mm> 写了一篇日记（分类：<c1>、<c2>）：<正文全量不截断>` */
export function diaryFirstText(date: string, time: string, tags: string[], body: string): string {
  return `你在 ${date} ${time} 写了一篇日记（分类：${tags.join('、')}）：${body}`;
}

/** 更新观察文案：`你更新了日记（<YYYY-MM-DD HH:mm>）：<新正文全量不截断>`；分类有变化也更新进括号 */
export function diaryUpdateText(date: string, time: string, tags: string[], body: string, tagsChanged: boolean): string {
  const cat = tagsChanged ? `，分类：${tags.join('、')}` : '';
  return `你更新了日记（${date} ${time}${cat}）：${body}`;
}

/** 条目/整文件删除观察文案（条目级恒带时间）：`你删除了 <YYYY-MM-DD HH:mm> 的日记`（原观察保留） */
export function diaryDeleteText(date: string, time: string): string {
  return `你删除了 ${date} ${time} 的日记`;
}

/** 文件级删除兜底文案（整文件被删且从未跟踪过条目，无时间信息）：`你删除了 <YYYY-MM-DD> 的日记`——ticket 077 兜底允许 */
export function diaryDeleteFileText(date: string): string {
  return `你删除了 ${date} 的日记`;
}

// ---------------- 分类调整观察（ADR-0069 行为流全量盘点补齐） ----------------

/** 日记分类调整事件（diary 域 dialogs emitDomainEvent('diary:tags-changed') 载荷的观察所需面） */
export interface DiaryTagsEvent {
  /** 条目日期 YYYY-MM-DD */
  date: string;
  /** 条目时间 HH:mm */
  time: string;
  /** 旧分类名数组 */
  from: string[];
  /** 新分类名数组 */
  to: string[];
}

/**
 * 日记分类调整 → StructuredMeta（行为流，diary:tagged 路由）。
 * 载荷异常（缺 date/time）返回 null 不产观察；extras 保留 from/to 供追溯，tags 记新分类。
 */
export function buildDiaryTagsStructured(evt: DiaryTagsEvent): StructuredMeta | null {
  if (!evt || typeof evt.date !== 'string' || !evt.date || typeof evt.time !== 'string' || !evt.time) return null;
  const from = Array.isArray(evt.from) ? evt.from.map(String) : [];
  const to = Array.isArray(evt.to) ? evt.to.map(String) : [];
  return {
    entityType: 'diary_entry',
    action: 'tagged',
    name: `${evt.date} ${evt.time}`,
    tags: to,
    extras: { from, to },
  };
}