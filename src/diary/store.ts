/**
 * 日记写层（issue 256 写链路迁入；ADR-0130 重写为条目文件粒度；2026-11 增加一天一文件格式）。
 *
 * 两种写模型（由 settings.diaryEntryFormat 决定，config.isDayFormat()）：
 * - entry（缺省）：一条日记 = 一个条目文件 `我的/日记/YYMMDDHHmm(-N)?.md`，
 *   frontmatter `date`+`type`，正文即内容（ADR-0130/0131）。
 * - day：一天一个文件 `我的/日记/YYYY-MM-DD.md`，一条日记 = 文件里的一个
 *   `# emoji序列 HH:mm` 块（Obsidian 日记原生文件名）。读旧文件、改块标签、删块都在本模块。
 *
 * 所有写操作在 core per-path 串行队列（enqueueFileTask，键 = 目标文件路径 / 新建伪路径）内
 * 「磁盘同步 → 变更 → 落盘」一气呵成（D3 可靠写契约收口不变：守卫读与写同队列互斥）。
 * - 新建 entry：按日期串行取空闲文件名（同刻第二篇落 `-2` 后缀）后 vault.create；
 * - 新建 day：读当天日期文件，末尾追加块（文件不存在则建）；
 * - 改标签 entry：只重写 frontmatter；改标签 day：只替换块头行；
 * - 删除 entry：整文件进回收站；删除 day：只摘掉那个块（文件空了才整文件进回收站）。
 *
 * 磁盘同步即守卫：读盘失败抛 DiaryFileReadError 中止任务（D1：视为空文件会删掉整篇日记）；
 * 条目文件存在但解析不出条目抛 UnparsedLineError 拒处理——直接写会永久抹掉原文。
 * 动作完成后发域事件（diary:entry-added / tags-changed），墙与其他消费者自行刷新。
 * 本模块不碰 DOM、不挂监听。
 */
import { getApp } from '../core/app';
import { trashNote } from '../core/note-trash';
import { notify } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { enqueueFileTask } from '../core/storage';
import {
  diaryDateFromLegacyPath,
  diaryEntryPath,
  diaryMetaFromEntryPath,
  parseDiaryEntryFile,
  serializeDiaryEntryFile,
} from '../core/diary-format';
import { lintEntryFile } from './repair';
import { DIARY_DIRECTORY, diaryDayDateOf, diaryDayPath, getTagEmoji, isDayFormat } from './config';
import { parseEntryFile } from './parser';
import {
  emojiSeqOfTags,
  isLegacyDiaryPath,
  legacyBlockToEntry,
  parseDayFileForRead,
  parseLegacyDayFile,
  serializeLegacyBlock,
  type LegacyBlock,
  type LegacyDayFile,
} from './legacy';
import type { DiaryEntry } from './types';

/**
 * 文件路径 → 条目数组 的写模型映射（最近一次操作该文件时的内存快照；
 * 每次写前都会从磁盘重新同步，此 map 仅供调用方读取复用，不保证跨操作新鲜）。
 * 键 = 文件完整路径（旧日期文件一天多块 → 数组多条）。加密条目不在 md 中、不进此 map。
 */
export let diaryDataMap: Map<string, DiaryEntry[]> | null = null;

export function setDiaryDataMap(map: Map<string, DiaryEntry[]> | null) {
  diaryDataMap = map;
}

/** 「不可解析」警告 toast（无 DOM 环境/通知容器缺失时静默；dedupeKey 防反复触发刷屏） */
function warnUnparsed(msg: string, dedupeKey?: string) {
  try {
    notify(msg, { type: 'warning', dedupeKey });
  } catch (e) {
    /* 无 DOM 环境（node 测试）降级为静默 */
  }
}

/**
 * 整篇无头行的 Obsidian 原生日记：**写路径统一拒绝**（追加 / 改标签 / 删除都不许）。
 *
 * 读路径会把它降级成一条显示（`parseDayFileForRead`），但写路径一旦放过它，
 * 追加一个 `# 📖 HH:mm` 块就把纯正文变成「游离正文 + 头行块」——静默改写用户的原生文件。
 * 要在这里写，先走设置页的「切换并转换」。
 */
function refuseHeadlessDay(day: LegacyDayFile | null, filePath: string): void {
  if (!day || day.blocks.length > 0 || day.unparsed === 0) return;
  const name = filePath.split('/').pop() || filePath;
  warnUnparsed(
    `「${name}」是 Obsidian 原生日记（一整篇，没有分段时间），bz 不会改写它。要在这里写，先把日记格式切成「一篇一个文件」。`,
    `diary-write-refused-headless-${filePath}`
  );
  throw new UnparsedLineError(name, day.unparsed);
}

/** 「读盘失败」错误 toast（同 warnUnparsed 的静默降级口径；dedupeKey 防反复触发刷屏） */
function warnReadFailed(msg: string, dedupeKey?: string) {
  try {
    notify(msg, { type: 'error', dedupeKey });
  } catch (e) {
    /* 无 DOM 环境（node 测试）降级为静默 */
  }
}

/** 守卫拒绝错误：调用方可识别后静默（人话通知已发）。count 沿用旧行数口径（entry 恒 1） */
export class UnparsedLineError extends Error {
  constructor(public dateStr: string, public count: number) {
    super(`「${dateStr}」无法解析为日记条目，已拒绝处理`);
    this.name = 'UnparsedLineError';
  }
}

/**
 * 读盘失败错误（D1 修复）：读失败若视为空文件，删除路径会误删、写路径会覆盖整篇日记。
 * 现改为抛错中止队列任务（与守卫拒写同待遇），调用方经 isDiaryReadFailure 识别后静默
 * （人话通知已由写层发出）。
 */
export class DiaryFileReadError extends Error {
  constructor(public filePath: string, public cause_: unknown) {
    super(`日记文件读取失败：${filePath}`);
    this.name = 'DiaryFileReadError';
  }
}

/** 判断是否写层读盘失败（UI 层 catch 后静默：人话通知已由写层发出） */
export function isDiaryReadFailure(e: unknown): boolean {
  return e instanceof DiaryFileReadError;
}

/**
 * 提取 frontmatter 中契约外键的原始行（N4）：契约恰两属性（date+type），
 * 用户在属性面板自加的键（cssclass/tags/自定义键）在「改标签」重写 frontmatter 时
 * 原样保留、不静默丢弃。跳过契约两键及其缩进列表项，其余顶层键行（含行内数组/
 * 多行列表形态）按原文返回。
 */
function extraFrontmatterLines(content: string): string[] {
  const text = (content || '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return [];
  const end = text.indexOf('\n---', 4);
  if (end < 0) return [];
  const out: string[] = [];
  let keeping = false;
  for (const line of text.slice(4, end).split('\n')) {
    const kv = /^([^:\s][^:]*):(.*)$/.exec(line);
    if (kv) {
      const key = kv[1].trim();
      keeping = key !== 'date' && key !== 'type';
      if (keeping) out.push(line);
      continue;
    }
    if (keeping && /^\s+-\s/.test(line)) out.push(line); // 契约外键的多值列表项
  }
  return out;
}

/** 日期写操作的目标文件引用（ADR-0130：条目在目录下平铺，filePath 缺省按日期枚举） */
export interface DateWriteOptions {
  /** 目标文件完整 vault 路径（定位到具体文件时必传；旧日期文件同样适用） */
  filePath?: string;
  /** 销毁而非回收（ADR-0245 唯一例外：明文收进保险库后摘除原条目文件——
   *  回收站里留一份明文等于加密白做）。只有加密流程传它，日常删除一律不传 */
  purge?: boolean;
}

/* ==================== 日期条目引用（新格式 / 旧文件块 统一） ==================== */

interface DateEntryRef {
  path: string;
  time: string;
  /** 旧日期文件的块头行号；新格式条目恒 undefined */
  line?: number;
  legacy: boolean;
}

/** 读一篇旧日期文件的守卫上下文 */
interface LegacyFileCtx {
  file: any;
  content: string;
  day: LegacyDayFile | null;
}

/** 枚举某日期全部条目引用：新格式按文件名，day 日期文件读一次拆块 */
async function listDateEntryRefs(dateStr: string): Promise<DateEntryRef[]> {
  const dirPrefix = `${DIARY_DIRECTORY}/`;
  const out: DateEntryRef[] = [];
  if (!DIARY_DIRECTORY) return out; // 未配置日记目录：不枚举（防 startsWith('/') 扫空）
  const vault = getApp().vault;
  for (const f of vault.getMarkdownFiles?.() || []) {
    const p = String((f as { path?: string }).path ?? '');
    if (!p.startsWith(dirPrefix)) continue;
    const meta = diaryMetaFromEntryPath(p);
    if (meta) {
      if (meta.date === dateStr) out.push({ path: p, time: meta.time, legacy: false });
      continue;
    }
    const legacyDate = diaryDayDateOf(p) ?? diaryDateFromLegacyPath(p);
    if (legacyDate !== dateStr) continue;
    try {
      const file = vault.getAbstractFileByPath(p);
      if (!file || 'children' in file) continue;
      const content = await vault.read(file as any);
      // 读路径允许「整篇无头行」降级成一条（Obsidian 原生日记）；写路径仍走严格解析
      const day = parseDayFileForRead(content, p, legacyDate, (file as { stat?: { ctime?: number } }).stat?.ctime);
      if (!day) continue;
      for (const b of day.blocks) out.push({ path: p, time: b.time, line: b.line, legacy: true });
    } catch (e) {
      /* 单个旧文件读失败：不阻断整读（体检/转换另有入口） */
    }
  }
  out.sort((a, b) => a.time.localeCompare(b.time) || (a.line ?? 0) - (b.line ?? 0));
  return out;
}

/** 指定文件的条目引用（新格式一条 / day 文件全部块） */
async function listEntryRefsForFile(filePath: string): Promise<DateEntryRef[]> {
  const meta = diaryMetaFromEntryPath(filePath);
  if (meta) return [{ path: filePath, time: meta.time, legacy: false }];
  const date = diaryDayDateOf(filePath) ?? diaryDateFromLegacyPath(filePath);
  if (!date) {
    // 显式指定的未知形状文件：仍交给 entry 守卫读（readEntryCtxInQueue →
    // UnparsedLineError），否则「filePath 指向随手记」会静默变成 0 条，守卫语义丢失
    return [{ path: filePath, time: '', legacy: false }];
  }
  try {
    const file = getApp().vault.getAbstractFileByPath(filePath);
    if (!file || 'children' in file) return [];
    const content = await getApp().vault.read(file as any);
    const day = parseDayFileForRead(content, filePath, date, (file as { stat?: { ctime?: number } }).stat?.ctime);
    return (day?.blocks ?? []).map((b) => ({ path: filePath, time: b.time, line: b.line, legacy: true }));
  } catch (e) {
    return [];
  }
}

/**
 * 旧日期文件的队列内守卫读（读失败/非旧文件形状抛错，与 entry 守卫同待遇）。
 * `readOnly` = 纯读场景（`listDateEntries`）：允许整篇无头行的原生日记降级成一条；
 * 默认（写场景）走严格解析，`refuseHeadlessDay` 拦下改写。
 */
async function readLegacyCtxInQueue(filePath: string, opts?: { readOnly?: boolean }): Promise<LegacyFileCtx> {
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) return { file: null, content: '', day: null };
  let content = '';
  try {
    content = await getApp().vault.read(file);
  } catch (e) {
    warnReadFailed(
      `「${filePath.split('/').pop()}」日记读取失败，本次修改没有执行（直接写会覆盖整篇日记）。请稍后重试。`,
      `diary-read-failed-${filePath}`
    );
    throw new DiaryFileReadError(filePath, e);
  }
  const date = diaryDayDateOf(filePath) ?? diaryDateFromLegacyPath(filePath);
  const day = opts?.readOnly
    ? parseDayFileForRead(content, filePath, date ?? undefined, file?.stat?.ctime)
    : parseLegacyDayFile(content, filePath, date ?? undefined);
  if (!day) {
    warnUnparsed(
      `「${filePath.split('/').pop()}」不是日记日期文件，本次修改没有执行。`,
      `diary-write-refused-${filePath}`
    );
    throw new UnparsedLineError(filePath.split('/').pop() || filePath, 1);
  }
  if (!opts?.readOnly) refuseHeadlessDay(day, filePath);
  if (!diaryDataMap) setDiaryDataMap(new Map());
  diaryDataMap!.set(
    filePath,
    day.blocks.map((b) => legacyBlockToEntry(day, b, filePath))
  );
  return { file, content, day };
}

/** 旧日期文件的队列壳（读在队列内，与写路径 FIFO 互斥）；`readOnly` 见 readLegacyCtxInQueue */
async function withLegacyFile<T>(
  filePath: string,
  task: (ctx: LegacyFileCtx) => T | Promise<T>,
  opts?: { readOnly?: boolean }
): Promise<T> {
  return enqueueFileTask(filePath, async () => task(await readLegacyCtxInQueue(filePath, opts)));
}

/** 在旧文件里按块头行号（优先）或时刻找块 */
function findLegacyBlock(day: LegacyDayFile, ref: { time: string; line?: number }): LegacyBlock | null {
  return day.blocks.find((b) => b.line === ref.line) ?? day.blocks.find((b) => b.time === ref.time) ?? null;
}

/** 队列任务上下文：file=null 表示文件不存在（新建场景由调用方另行处理） */
interface EntryFileCtx {
  file: any;
  content: string;
  entry: DiaryEntry | null;
}

/**
 * 队列内守卫读（只读）：必须在 enqueueFileTask 回调内首行调用（守卫读与后续写同任务互斥）。
 * - 读失败发通知抛 DiaryFileReadError；文件存在但解析不出条目发通知抛 UnparsedLineError；
 * - 解析成功回写 diaryDataMap 快照（键 = 文件路径）。
 */
async function readEntryCtxInQueue(filePath: string): Promise<EntryFileCtx> {
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  let content = '';
  if (file) {
    try {
      content = await getApp().vault.read(file);
    } catch (e) {
      warnReadFailed(
        `「${filePath.split('/').pop()}」日记读取失败，本次修改没有执行（直接写会覆盖整篇日记）。请稍后重试。`,
        `diary-read-failed-${filePath}`
      );
      throw new DiaryFileReadError(filePath, e);
    }
  }
  const entry = file ? parseEntryFile(content, filePath) : null;
  if (file && !entry) {
    warnUnparsed(
      `「${filePath.split('/').pop()}」无法解析为日记条目（文件名非条目形状或日期非法），本次修改没有执行。` +
        `请检查该文件的文件名与正文里的日期。`,
      `diary-write-refused-${filePath}`
    );
    throw new UnparsedLineError(filePath.split('/').pop() || filePath, 1);
  }
  if (!diaryDataMap) setDiaryDataMap(new Map());
  if (file && entry) diaryDataMap!.set(filePath, [entry]);
  else diaryDataMap!.delete(filePath);
  return { file, content, entry };
}

/** 只读场景的队列壳（listDateEntries/findDiaryEntry）：读在队列内，与写路径 FIFO 互斥 */
async function withEntryFile<T>(filePath: string, task: (ctx: EntryFileCtx) => T | Promise<T>): Promise<T> {
  return enqueueFileTask(filePath, async () => task(await readEntryCtxInQueue(filePath)));
}

/** 读快照：返回该日期全部条目副本（不落盘；供 locator/recap 等预读）。
 *  opts.filePath：只读指定文件（旧日期文件返回全部块）；缺省枚举该日期全部条目（按时间升序）。 */
export async function listDateEntries(dateStr: string, opts?: DateWriteOptions): Promise<DiaryEntry[]> {
  const refs = opts?.filePath ? await listEntryRefsForFile(opts.filePath) : await listDateEntryRefs(dateStr);
  const explicitPath = !!opts?.filePath;
  const out: DiaryEntry[] = [];
  for (const ref of refs) {
    try {
      if (ref.legacy) {
        const ctx = await withLegacyFile(ref.path, (c) => c, { readOnly: true });
        const block = ctx.day ? findLegacyBlock(ctx.day, ref) : null;
        if (ctx.day && block) out.push({ ...legacyBlockToEntry(ctx.day, block, ref.path) });
        continue;
      }
      const es = await withEntryFile(ref.path, ({ entry }) => (entry ? [{ ...entry }] : []));
      out.push(...es);
    } catch (e) {
      // 显式 filePath（单文件读）保留原来的守卫语义：抛给调用方；
      // 按日期批量枚举才「单文件异常不阻断整读」
      if (explicitPath) throw e;
      if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue;
      throw e;
    }
  }
  out.sort((a, b) => a.timeValue - b.timeValue);
  return out;
}

/**
 * 逐级建目录（vault 路径，非点前缀）：已存在的层级跳过；建失败只吞掉——
 * 真正的失败交给随后的 vault.create 报（那里有准确的落点与原因）。
 */
async function ensureFolderFor(dir: string): Promise<void> {
  if (!dir) return;
  const v = getApp().vault;
  const missing: string[] = [];
  let probe = dir;
  while (probe && !v.getAbstractFileByPath(probe)) {
    missing.unshift(probe);
    const s = probe.lastIndexOf('/');
    if (s <= 0) break;
    probe = probe.slice(0, s);
  }
  for (const p of missing) {
    try {
      await v.createFolder(p);
    } catch (e) {
      /* 并发建目录竞态无害 */
    }
  }
}

/** 添加新日记条目（按当前格式分派）。
 *  opts.filePath 只取其目录作为落点：entry 新建独立文件；day 追加到当天的日期文件。 */
export async function addEntry(
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string,
  opts?: DateWriteOptions
): Promise<DiaryEntry> {
  const dir = opts?.filePath ? opts.filePath.split('/').slice(0, -1).join('/') : DIARY_DIRECTORY;
  if (isDayFormat()) return addLegacyEntry(dir, dateStr, timeStr, tagsArray, content);
  return addEntryFile(dir, dateStr, timeStr, tagsArray, content);
}

/** entry 格式：新建一个条目文件（原逻辑不变） */
async function addEntryFile(
  dir: string,
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string
): Promise<DiaryEntry> {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
  const timeValue = hours * 100 + minutes;
  // 串行键 = 目录/日期伪路径：同日新建互斥，撞名复检在任务内完成
  const addKey = `${dir}/${dateStr}`;

  const created = await enqueueFileTask(addKey, async () => {
    // 落笔前先把目录建出来：vault.create 不会替你建父目录，全新库里第一篇必然 ENOENT
    await ensureFolderFor(dir);
    let seq = 1;
    let filePath = diaryEntryPath(dir, dateStr, timeStr, seq);
    while (getApp().vault.getAbstractFileByPath(filePath)) {
      seq += 1;
      filePath = diaryEntryPath(dir, dateStr, timeStr, seq);
    }
    const finalContent = serializeDiaryEntryFile({ date: dateStr, time: timeStr }, tagsArray, content.trim());
    try {
      await getApp().vault.create(filePath, finalContent);
    } catch (error) {
      console.error(`创建条目文件 ${filePath} 失败:`, error);
      throw error;
    }
    const entry: DiaryEntry = {
      date: dateStr,
      time: timeStr,
      timeValue,
      tags: tagsArray,
      emoji: tagsArray.map((tag) => getTagEmoji(tag)).join(''),
      content: content.trim(),
      filename: filePath,
      filePath,
      lineNumber: 0,
      id: `${dateStr}-${timeStr.replace(/:/g, '-')}-${Date.now()}`,
    };
    if (!diaryDataMap) setDiaryDataMap(new Map());
    diaryDataMap!.set(filePath, [entry]);
    return entry;
  });

  emitDomainEvent('diary:entry-added', { date: dateStr, time: timeStr, tags: tagsArray, content: content.trim() });
  return created;
}

/** day 格式：追加一个 `# emoji HH:mm` 块到当天的 `YYYY-MM-DD.md`（末尾空行分隔） */
async function addLegacyEntry(
  dir: string,
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string
): Promise<DiaryEntry> {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
  const timeValue = hours * 100 + minutes;
  // 文件名按 Obsidian 日记的日期格式（`YYYY/MM/DD` 会落子目录，ensureFolderFor 逐级建）
  const filePath = diaryDayPath(dir, dateStr);
  const addKey = `${dir}/${dateStr}`;

  const created = await enqueueFileTask(addKey, async () => {
    await ensureFolderFor(dir);
    const file = getApp().vault.getAbstractFileByPath(filePath) as any;
    let before = '';
    if (file) {
      try {
        before = await getApp().vault.read(file);
      } catch (e) {
        warnReadFailed(
          `「${filePath.split('/').pop()}」日记读取失败，本次落笔没有执行。请稍后重试。`,
          `diary-read-failed-${filePath}`
        );
        throw new DiaryFileReadError(filePath, e);
      }
    }
    /*
     * 文件已存在且是「整篇无头行」的原生日记：拒绝追加。
     * 追加一个 `# emoji HH:mm` 块会把纯正文变成「游离正文 + 头行块」，等于静默改写用户的原生文件。
     */
    refuseHeadlessDay(parseLegacyDayFile(before, filePath, dateStr), filePath);
    const base = before.replace(/\s+$/, '');
    const prefix = base ? `${base}\n\n` : '';
    const block = serializeLegacyBlock(tagsArray, timeStr, content.trim());
    const next = `${prefix}${block}`;
    if (file) await getApp().vault.modify(file, next);
    else await getApp().vault.create(filePath, next);

    const day = parseLegacyDayFile(next, filePath, dateStr);
    const blocks = day?.blocks ?? [];
    const line = blocks.length > 0 ? blocks[blocks.length - 1].line : 0;
    const entry: DiaryEntry = {
      date: dateStr,
      time: timeStr,
      timeValue,
      tags: tagsArray,
      emoji: tagsArray.map((tag) => getTagEmoji(tag)).join(''),
      content: content.trim(),
      filename: filePath,
      filePath,
      lineNumber: line,
      id: `diary-${filePath.replace(/\//g, '-')}-${dateStr}-${timeStr}-${line}`,
    };
    if (!diaryDataMap) setDiaryDataMap(new Map());
    diaryDataMap!.set(
      filePath,
      blocks.map((b) => legacyBlockToEntry(day!, b, filePath))
    );
    return entry;
  });

  emitDomainEvent('diary:entry-added', { date: dateStr, time: timeStr, tags: tagsArray, content: content.trim() });
  return created;
}

/**
 * 删除匹配条目（定位谓词由调用方闭包，locator 行号兜底语义沿用）。
 * - entry 格式：整文件移入回收站（`opts.purge` 时销毁，仅供加密收信后摘明文）；
 * - day 格式：只摘掉命中的块；文件里没有别的块了才整文件进回收站/销毁。
 * 解析失败/不匹配的文件跳过不动。返回删除条数。
 */
export async function removeDiaryEntries(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  opts?: DateWriteOptions
): Promise<number> {
  const refs = opts?.filePath ? await listEntryRefsForFile(opts.filePath) : await listDateEntryRefs(dateStr);
  let removed = 0;
  for (const ref of refs) {
    const p = ref.path;
    try {
      const del = ref.legacy
        ? await enqueueFileTask(p, async () => removeLegacyBlockInQueue(p, ref, match, !!opts?.purge))
        : await enqueueFileTask(p, async () => {
            // 写在队列回调词法区域内（D3 直写守门契约内实现）：守卫读 + 删除文件一气呵成
            const { file, entry } = await readEntryCtxInQueue(p);
            if (!file || !entry || !match(entry)) return false;
            const app = getApp();
            if (opts?.purge) await app.vault.delete(file); // 明文摘除：不进回收站（ADR-0245 例外）
            else await trashNote(app, file);
            if (diaryDataMap) diaryDataMap.delete(p);
            return true;
          });
      if (del) removed += 1;
    } catch (e) {
      if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue; // 异常文件不阻断整删
      throw e;
    }
  }
  return removed;
}

/** day 格式删一个块：只改该块的行范围；文件里没有别的内容时整文件回收/销毁 */
async function removeLegacyBlockInQueue(
  filePath: string,
  ref: DateEntryRef,
  match: (e: DiaryEntry) => boolean,
  purge: boolean
): Promise<boolean> {
  const { file, content, day } = await readLegacyCtxInQueue(filePath);
  if (!file || !day) return false;
  const block = findLegacyBlock(day, ref);
  if (!block) return false;
  const entry = legacyBlockToEntry(day, block, filePath);
  if (!match(entry)) return false;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  lines.splice(block.line, block.endLine - block.line + 1);
  const text = normalizeLegacyText(lines.join('\n'));
  if (!text.trim()) {
    const app = getApp();
    if (purge) await app.vault.delete(file);
    else await trashNote(app, file);
    if (diaryDataMap) diaryDataMap.delete(filePath);
    return true;
  }
  await getApp().vault.modify(file, text);
  const rest = parseLegacyDayFile(text, filePath, day.date);
  if (diaryDataMap) {
    diaryDataMap.set(
      filePath,
      (rest?.blocks ?? []).map((b) => legacyBlockToEntry(rest!, b, filePath))
    );
  }
  return true;
}

/** 删除块后的文本归一：去掉块留下的三个以上连续空行、首尾空行，末尾保留一个换行 */
function normalizeLegacyText(raw: string): string {
  return raw
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '\n');
}

/**
 * 更新条目标签（定位 = 谓词，filePath 限定由调用方传入）。
 * - entry 格式：命中即重写 frontmatter（正文不动）：
 *   - 标签未变化（有序逐位比较，N3）等价成功不写盘；
 *   - 体检 name-mismatch（属性时间与题目不一致、需人工裁决，N4）的文件拒写并通知；
 *   - 契约外 frontmatter 键逐键保留（N4）。
 * - day 格式：只替换该块的头行（emoji 序列），正文与其他块不动。
 * 命中 0 条返回 null。成功（含变化）发 diary:tags-changed。
 */
export async function updateDiaryTags(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  newTags: string[],
  opts?: DateWriteOptions
): Promise<DiaryEntry | null> {
  const refs = opts?.filePath ? await listEntryRefsForFile(opts.filePath) : await listDateEntryRefs(dateStr);
  for (const ref of refs) {
    const p = ref.path;
    let hit: { entry: DiaryEntry; from: string[]; changed: boolean } | null = null;
    try {
      hit = ref.legacy
        ? await enqueueFileTask(p, async () => updateLegacyBlockTagsInQueue(p, ref, match, newTags))
        : await enqueueFileTask(p, async () => {
            // 写在队列回调词法区域内（D3 直写守门契约内实现）：守卫读 + 仅重写 frontmatter
            const { file, content, entry } = await readEntryCtxInQueue(p);
            if (!file || !entry || !match(entry)) return null;
            // N4：属性与题目双轨不一致（体检 name-mismatch 口径）拒写，人工裁决后再改
            if (lintEntryFile(p, content) === 'name-mismatch') {
              warnUnparsed(
                `「${p.split('/').pop()}」属性时间与文件名不一致（需人工裁决），本次改标签没有执行。` +
                  `请先修正该文件的文件名或属性时间后再试。`,
                `diary-name-mismatch-${p}`
              );
              return null;
            }
            // N3：有序逐位比较——重复标签集（['日记','日记']）与 ['日记','随笔'] 不再被误判等价
            const changed = entry.tags.join('\u0000') !== newTags.join('\u0000');
            if (!changed) return { entry, from: [...entry.tags], changed: false };
            const body = parseDiaryEntryFile(content).body;
            let disk = serializeDiaryEntryFile({ date: entry.date, time: entry.time }, newTags, body);
            // N4：契约外键原样插回重写后的 frontmatter（位于关闭行之前）
            const extra = extraFrontmatterLines(content);
            if (extra.length > 0) {
              const closeIdx = disk.indexOf('\n---\n', 4);
              disk = disk.slice(0, closeIdx + 1) + extra.join('\n') + '\n' + disk.slice(closeIdx + 1);
            }
            await getApp().vault.modify(file, disk);
            const from = [...entry.tags];
            entry.tags = [...newTags];
            entry.emoji = newTags.map((tag) => getTagEmoji(tag)).join('');
            if (diaryDataMap) diaryDataMap.set(p, [entry]);
            return { entry, from, changed: true };
          });
    } catch (e) {
      if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue;
      throw e;
    }
    if (hit) {
      if (hit.changed) {
        emitDomainEvent('diary:tags-changed', { date: hit.entry.date, time: hit.entry.time, from: hit.from, to: newTags });
      }
      return hit.entry;
    }
  }
  return null;
}

/** day 格式改块头（只替换头行 emoji 序列；正文原样） */
async function updateLegacyBlockTagsInQueue(
  filePath: string,
  ref: DateEntryRef,
  match: (e: DiaryEntry) => boolean,
  newTags: string[]
): Promise<{ entry: DiaryEntry; from: string[]; changed: boolean } | null> {
  const { file, content, day } = await readLegacyCtxInQueue(filePath);
  if (!file || !day) return null;
  const block = findLegacyBlock(day, ref);
  if (!block) return null;
  const entry = legacyBlockToEntry(day, block, filePath);
  if (!match(entry)) return null;

  const from = [...entry.tags];
  const changed = from.join('\u0000') !== newTags.join('\u0000');
  if (!changed) return { entry, from, changed: false };

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  lines[block.line] = `# ${emojiSeqOfTags(newTags)} ${block.time}`;
  await getApp().vault.modify(file, lines.join('\n'));
  const rest = parseLegacyDayFile(lines.join('\n'), filePath, day.date);
  if (diaryDataMap) {
    diaryDataMap.set(
      filePath,
      (rest?.blocks ?? []).map((b) => legacyBlockToEntry(rest!, b, filePath))
    );
  }
  const updated = { ...legacyBlockToEntry(day, block, filePath), tags: [...newTags] };
  updated.emoji = newTags.map((tag) => getTagEmoji(tag)).join('');
  return { entry: updated, from, changed: true };
}

/**
 * 按完整路径 + 时刻/行号反查条目（墙动作入口；条目文件的 filename 即完整路径）。
 * - entry 格式：路径即唯一，time/line 忽略；
 * - day 格式：同一路径一天多块，必须给 time 或 line（line 优先）。
 * 入参兼容旧形状：日期串（无 `/`）无对应文件 → null。
 */
export async function findDiaryEntry(filename: string, time?: string, line?: number): Promise<DiaryEntry | null> {
  if (!filename || !filename.includes('/')) return null;
  try {
    if (isLegacyDiaryPath(filename)) {
      return await enqueueFileTask(filename, async () => {
        const { day } = await readLegacyCtxInQueue(filename);
        if (!day) return null;
        const block =
          (line != null ? day.blocks.find((b) => b.line === line) : undefined) ??
          (time ? day.blocks.find((b) => b.time === time) : undefined) ??
          day.blocks[0];
        return block ? { ...legacyBlockToEntry(day, block, filename) } : null;
      });
    }
    return await withEntryFile(filename, ({ entry }) => (entry ? { ...entry } : null));
  } catch (e) {
    return null; // 守卫拒读/读失败：动作不可用（人话通知已由写层发出）
  }
}

/** 守卫拒绝的统一静默处理（UI 层 catch 后判断：人话通知已由写层发出，不再叠加） */
export function isUnparsedRefusal(e: unknown): boolean {
  return e instanceof UnparsedLineError;
}

// ---------------- 内存路径同步（issue 339：vault:md-renamed / vault:md-deleted 消费的纯内存口） ----------------

/**
 * 笔记改名内存同步（issue 339，纯内存不落盘；快照回写机制不动）：
 * diaryDataMap 键与命中条目的 filePath/filename 重定向 oldPath→newPath。
 * 返回是否发生改动（无 map / 无命中键 / 同路径均空转）。
 */
export function rekeyDiaryMapPath(oldPath: string, newPath: string): boolean {
  if (!diaryDataMap || !oldPath || !newPath || oldPath === newPath) return false;
  const entries = diaryDataMap.get(oldPath);
  if (!entries) return false;
  diaryDataMap.delete(oldPath);
  for (const e of entries) {
    if (e.filePath === oldPath) e.filePath = newPath;
    if (e.filename === oldPath) e.filename = newPath;
  }
  diaryDataMap.set(newPath, entries);
  return true;
}

/** 笔记删除内存同步（issue 339，纯内存不落盘）：移除该路径的内存快照。返回是否移除。 */
export function dropDiaryMapPath(path: string): boolean {
  if (!diaryDataMap || !path) return false;
  return diaryDataMap.delete(path);
}
