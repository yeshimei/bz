/**
 * 旧「一天一文件」日记格式解析（`YYYY-MM-DD.md`，`# emoji空格HH:mm` 切块）。
 *
 * 背景：ADR-0130 之前日记是一天一个文件、一天多篇，每篇以一级标题
 * `# 📖 12:23` 开头，标签只写 emoji。2026-11 用户要求日记本重新支持这种格式
 * （Obsidian 日记原生文件名），并与新格式（`YYMMDDHHmm.md`）互转。
 *
 * 本模块只做纯解析/序列化，不碰 vault：
 * - parseLegacyDayFile：按头行切块，记录每块的行号范围（写层按块删改、跳转滚行要用）；
 * - serializeLegacyBlock：把一条日记写成旧格式块；
 * - 首块前的游离正文、时间越界头行计入 unparsed（转换时绝不静默丢）。
 *
 * emoji 反查：先查**用户当前类型表**（config 的 emojiToTagMap），查不到再查 LEGACY 旧表——
 * 旧表只服务「读懂历史文件」，不参与 UI 默认值；用户删掉某个类型后，旧日记仍能还原标签。
 */
import { diaryDateFromLegacyPath, isValidDiaryTime, parseDiaryEntryFile } from '../core/diary-format';
import { diaryDayDateOf, emojiToTagMap, tagToEmojiMap, getTagEmoji, LEGACY_DIARY_TYPES } from './config';
import type { DiaryEntry } from './types';

/** 旧文件里的一个条目块 */
export interface LegacyBlock {
  /** HH:mm */
  time: string;
  /** 由 emoji 反查出的标签名（无命中回退 ['日记']） */
  tags: string[];
  /** 正文（头行之后到下一头行之前，已 trim） */
  body: string;
  /** 块头在文件里的行号（0-based） */
  line: number;
  /** 本块最后一行（含；下一个块头行 - 1，或文件末行） */
  endLine: number;
}

export interface LegacyDayFile {
  /** 文件名里的日期 YYYY-MM-DD */
  date: string;
  blocks: LegacyBlock[];
  /** 首块前的游离非空行 + 时间越界头行数（>0 时转换要人工处理，不硬转） */
  unparsed: number;
  /** 无可解析块且无游离行（空文件） */
  empty: boolean;
  /**
   * 整篇降级来的（一个头行都没有、整篇正文算一条）。
   * 只有 `parseDayFileForRead` 会置 true；`parseLegacyDayFile` 永远不出这个形态——
   * 写层拿到的永远是「真按头行切开的文件」，见本文件末尾的口径说明。
   */
  whole?: boolean;
}

/** 头行：`# <emoji序列> HH:mm`（与 scripts/diary-split.mjs 同口径） */
const HEADING_RE = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;

/** 旧版 28 类的 emoji→标签（只读兜底，不参与当前类型表/UI） */
const LEGACY_EMOJI_TO_TAG: Record<string, string> = buildLegacyEmojiToTag();
const LEGACY_TAG_TO_EMOJI: Record<string, string> = buildLegacyTagToEmoji();

function buildLegacyEmojiToTag(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of LEGACY_DIARY_TYPES) {
    if (!out[t.emoji]) out[t.emoji] = t.tag;
  }
  return out;
}
function buildLegacyTagToEmoji(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of LEGACY_DIARY_TYPES) out[t.tag] = t.emoji;
  return out;
}

/** grapheme 切分器：'✍️'=U+270D+U+FE0F、'🧑‍🎨'=ZWJ 三码点，按码点切会拆碎（旧 parser 同款） */
const segmenter: { segment(input: string): Iterable<{ segment: string }> } | null = (() => {
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(i: string): Iterable<{ segment: string }> } }).Segmenter;
    return Seg ? new Seg(undefined, { granularity: 'grapheme' }) : null;
  } catch (e) {
    return null;
  }
})();

/** emoji 序列 → 标签名（去重保序；无命中回退 ['日记']） */
export function tagsFromEmojiSeq(seq: string): string[] {
  const tags: string[] = [];
  const push = (emoji: string): void => {
    const tag = emojiToTagMap[emoji] || LEGACY_EMOJI_TO_TAG[emoji];
    if (tag && !tags.includes(tag)) tags.push(tag);
  };
  if (segmenter) {
    for (const g of segmenter.segment(seq)) push(g.segment);
  } else {
    // 老环境兜底：按码点切（组合 emoji 可能失配，但至少单码点 emoji 能认）
    for (const ch of Array.from(seq)) push(ch);
  }
  return tags.length > 0 ? tags : ['日记'];
}

/** 标签 → emoji 序列（旧文件头行写法；当前表查不到时用旧表兜底，保证转换保真） */
export function emojiSeqOfTags(tags: string[]): string {
  const seq = tags
    .map((t) => tagToEmojiMap[t] || LEGACY_TAG_TO_EMOJI[t] || '📖')
    .join('');
  return seq || '📖';
}

/** 把一条日记序列化成旧格式块（不含文件末尾换行；调用方决定块间空行） */
export function serializeLegacyBlock(tags: string[], time: string, body: string): string {
  return `# ${emojiSeqOfTags(tags)} ${time}\n\n${String(body ?? '').trim()}\n`;
}

/**
 * 解析旧日期文件（day 格式）。日期优先用调用方算好的 `date`（按 Obsidian 日记日期格式解析），
 * 没传才退回 basename 的 `YYYY-MM-DD` 形状；两者都拿不到 → null。
 * 行号以 `\n` 切分（CRLF 先归一），供写层按块替换/删除与 UI 跳转。
 */
export function parseLegacyDayFile(content: string, path: string, date?: string): LegacyDayFile | null {
  const resolved = date ?? diaryDateFromLegacyPath(path);
  if (!resolved) return null;

  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: LegacyBlock[] = [];
  let unparsed = 0;
  let cur: { time: string; tags: string[]; start: number } | null = null;

  const flush = (endLine: number): void => {
    if (!cur) return;
    const body = lines
      .slice(cur.start + 1, endLine + 1)
      .join('\n')
      .trim();
    blocks.push({ time: cur.time, tags: cur.tags, body, line: cur.start, endLine: Math.max(cur.start, endLine) });
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = HEADING_RE.exec(line);
    if (m) {
      if (isValidDiaryTime(m[2])) {
        flush(i - 1);
        cur = { time: m[2], tags: tagsFromEmojiSeq(m[1]), start: i };
      } else {
        unparsed++; // 时间越界头行：不当作条目
      }
      continue;
    }
    if (!cur && line.trim() !== '') unparsed++; // 首块前的游离正文
  }
  flush(lines.length - 1);

  return { date: resolved, blocks, unparsed, empty: blocks.length === 0 && unparsed === 0 };
}

/**
 * 无头行文件的兜底时分：ctime 落在**文件名那一天** → 取它的 HH:mm；否则 00:00。
 *
 * 两条口径（2026-11-06）：
 * - 用 ctime 不用 mtime：日记当天写下、之后常被反复编辑，mtime 会漂到深夜；创建时间更贴「那天写的」。
 * - **必须校验日期**：跨盘拷入 / 同步拉下来的 ctime 是拷贝时间。ADR-0157 补记正是因此把
 *   无条件的 ctime 推导从日记侧清掉了；这里请回来的是「带日期校验的兜底」，两条不是一回事。
 *   校验不过就记 00:00——展示 00:00 比编一个假时分诚实。
 */
export function diaryFallbackTime(ctimeMs: number | null | undefined, date: string): string {
  const ms = Number(ctimeMs);
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const d = new Date(ms);
  if (!Number.isFinite(d.valueOf())) return '00:00';
  const pad = (n: number): string => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (day !== String(date || '')) return '00:00';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * **读路径专用**的 day 文件解析：在 `parseLegacyDayFile` 之上加一层「整篇降级」。
 *
 * Obsidian 原生日记常常就是一篇纯正文，没有 `# emoji HH:mm` 分段时间头。严格解析会
 * 把它算成「N 行游离正文」→ 册子里一条都不显示、转换整份跳过（用户 2026-11-06 点名要能看见）。
 *
 * 降级判据（宁可少降，不乱降）：
 * - 一个头行都没有（连写坏的 `# 📖 25:00` 也没有）—— 有头行说明用户想分段，写坏了就该
 *   照旧进「跳过报告」让人自己修，不能把坏头行当正文吞掉；
 * - 没有 bz 条目属性（`date`）—— 有条目属性却用日期命名的，是被改了名的分片文件，
 *   不是 Obsidian 原生日记；降级会把 frontmatter 当正文摊到墙上；
 * - 整篇有正文（全空白仍算空文件）。
 *
 * 合成块的 line/endLine 覆盖首个到最后一个非空行：`jumpToDiaryEntry` 靠它定位，
 * 写层不认这个形态（见文件末口径）。
 */
export function parseDayFileForRead(
  content: string,
  path: string,
  date?: string,
  ctimeMs?: number | null
): LegacyDayFile | null {
  const day = parseLegacyDayFile(content, path, date);
  if (!day || day.blocks.length > 0 || day.unparsed === 0) return day;

  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n');
  const hasHeading = lines.some((l) => HEADING_RE.test(l));
  if (hasHeading) return day; // 想分段但头行写坏：不降级，留给跳过报告
  // 带 bz 条目属性（date）却用日期命名：被改名的分片文件，降级会把 frontmatter 当正文
  if (parseDiaryEntryFile(content).meta) return day;

  let first = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0) return day; // 全空白：维持空文件

  day.blocks = [
    {
      time: diaryFallbackTime(ctimeMs, day.date),
      tags: ['日记'],
      body: lines.slice(first, last + 1).join('\n').trim(),
      line: first,
      endLine: last,
    },
  ];
  day.unparsed = 0;
  day.empty = false;
  day.whole = true;
  return day;
}

/** 路径是否 day 格式文件（按当前日记目录 + Obsidian 日期格式解析，兼容内置四种与旧 `YYYY-MM-DD`） */
export function isLegacyDiaryPath(path: string | null | undefined): boolean {
  const p = String(path ?? '');
  return !!diaryDayDateOf(p) || !!diaryDateFromLegacyPath(p);
}

/**
 * 旧文件里的一个块 → DiaryEntry（墙/写层共用）。
 * lineNumber = 块头行号：旧文件一天多篇共用 filePath，靠它区分同刻两条、并供跳转滚行。
 */
export function legacyBlockToEntry(day: LegacyDayFile, block: LegacyBlock, path: string): DiaryEntry {
  const [h = 0, m = 0] = block.time.split(':').map(Number);
  return {
    date: day.date,
    time: block.time,
    timeValue: h * 100 + m,
    tags: block.tags,
    emoji: block.tags.map((t) => getTagEmoji(t)).join(''),
    content: block.body,
    filename: path,
    filePath: path,
    lineNumber: block.line,
    id: `diary-${path.replace(/\//g, '-')}-${day.date}-${block.time}-${block.line}`,
  };
}

/*
 * 口径（ADR-0286）：**读降级，写严格**。
 *
 * - 读：`parseDayFileForRead` 允许「整篇无头行」的文件降级成一条（Obsidian 原生日记开箱可见）；
 * - 写：`store.ts` 的所有写口仍走 `parseLegacyDayFile`，并对「blocks 空 + unparsed > 0」
 *   抛 `UnparsedLineError`——bz 不改写原生文件的格式。
 *
 * 两条共用 `LegacyDayFile` 形状，边界只在调用方选哪个函数。**不要给 `parseLegacyDayFile`
 * 加降级参数**：那会让写层默认放过原生文件，静默改格式的口子就又开了。
 */
