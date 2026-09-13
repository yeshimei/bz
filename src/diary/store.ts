/**
 * 日记写层（issue 256 写链路迁入；ADR-0130 重写为条目文件粒度）：唯一有权改写日记 md 的模块。
 *
 * 写模型（ADR-0130）：一条日记 = 一个条目文件 `我的/日记/YYYY-MM-DD HH-MM(-N)?.md`，
 * frontmatter `日期`+`类型`，正文即内容。所有写操作在 core per-path 串行队列
 * （enqueueFileTask，键 = 条目文件路径）内「磁盘同步 → 变更 → 落盘」一气呵成
 * （D3 可靠写契约收口不变：守卫读与写同队列互斥，TOCTOU 无窗口）。
 * - 新建（addEntry）：按日期串行（队列键 = `<目录>/<date>` 伪路径），队内取空闲文件名
 *   （撞名循环，同刻第二篇落 `-2` 后缀）后 vault.create——先建后写全程在同一串行键内，无同刻竞态；
 * - 改标签（updateDiaryTags）：只重写 frontmatter，正文一字不动；
 * - 删除（removeDiaryEntries）：条目文件整文件删除（删除条目 = 删除其文件）。
 * 磁盘同步即守卫：读盘失败抛 DiaryFileReadError 中止任务（D1：视为空文件会删掉整篇日记）；
 * 文件存在但解析不出条目（文件名非条目形状/日期非法，frontmatter 损坏已由文件名降级兜住）
 * 抛 UnparsedLineError 拒处理——直接写会永久抹掉原文。运行时宽（降级）、体检严（repair lint）。
 * 动作完成后发域事件（diary:entry-added / tags-changed），墙与其他消费者自行刷新；
 * 本模块不碰 DOM、不挂监听。
 */
import { getApp } from '../core/app';
import { notify } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { enqueueFileTask } from '../core/storage';
import {
  DIARY_ENTRY_FILE_RE,
  diaryEntryPath,
  parseDiaryEntryFile,
  serializeDiaryEntryFile,
  isValidDiaryDate,
  isValidDiaryTime,
} from '../core/diary-format';
import { DIARY_DIRECTORY, getTagEmoji } from './config';
import { isEncryptedEntry, parseEntryFile } from './parser';
import type { DiaryEntry } from './types';

/**
 * 文件路径 → 条目数组 的写模型映射（最近一次操作该文件时的内存快照；
 * 每次写前都会从磁盘重新同步，此 map 仅供调用方读取复用，不保证跨操作新鲜）。
 * 键 = 条目文件完整路径。加密条目不在 md 中、不进此 map（加密可见性由墙的 mergeEncryptedEntries 负责）。
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

/** 「读盘失败」错误 toast（同 warnUnparsed 的静默降级口径；dedupeKey 防反复触发刷屏） */
function warnReadFailed(msg: string, dedupeKey?: string) {
  try {
    notify(msg, { type: 'error', dedupeKey });
  } catch (e) {
    /* 无 DOM 环境（node 测试）降级为静默 */
  }
}

/** 守卫拒绝错误：调用方可识别后静默（人话通知已发）。count 沿用旧行数口径（条目文件恒 1） */
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

/** 日期写操作的目标文件引用（ADR-0130：条目在目录下平铺，filePath 缺省按日期枚举） */
export interface DateWriteOptions {
  /** 目标条目文件完整 vault 路径（定位到具体文件时必传） */
  filePath?: string;
}

/** 枚举某日期的全部条目文件路径（日记目录下平铺 + 子目录递归场景，basename 形状 + 日期双重过滤） */
function listDateEntryPaths(dateStr: string): string[] {
  const dirPrefix = `${DIARY_DIRECTORY}/`;
  return (getApp().vault.getMarkdownFiles?.() || [])
    .map((f: { path: string }) => f.path)
    .filter((p: string) => {
      if (!p.startsWith(dirPrefix)) return false;
      const m = DIARY_ENTRY_FILE_RE.exec(p.split('/').pop() || '');
      return !!m && m[1] === dateStr;
    });
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
        `请先在日记本设置中运行「日记格式体检」排查。`,
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
 *  opts.filePath：只读指定条目文件；缺省枚举该日期全部条目文件（按时间升序）。 */
export async function listDateEntries(dateStr: string, opts?: DateWriteOptions): Promise<DiaryEntry[]> {
  if (opts?.filePath) {
    return withEntryFile(opts.filePath, ({ entry }) => (entry ? [{ ...entry }] : []));
  }
  const out: DiaryEntry[] = [];
  for (const p of listDateEntryPaths(dateStr)) {
    try {
      const es = await withEntryFile(p, ({ entry }) => (entry ? [{ ...entry }] : []));
      out.push(...es);
    } catch (e) {
      if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue; // 单文件异常不阻断整读
      throw e;
    }
  }
  out.sort((a, b) => a.timeValue - b.timeValue);
  return out;
}

/** 添加新日记条目：按日期串行取空闲文件名（同刻第二篇落 `-2` 后缀）后建文件。
 *  opts.filePath 只取其目录作为落点（条目文件一篇一条，不向已有文件追加）。 */
export async function addEntry(
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string,
  opts?: DateWriteOptions
): Promise<DiaryEntry> {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
  const timeValue = hours * 100 + minutes;
  const dir = opts?.filePath ? opts.filePath.split('/').slice(0, -1).join('/') : DIARY_DIRECTORY;
  // 串行键 = 目录/日期伪路径：同日新建互斥，撞名复检在任务内完成
  const addKey = `${dir}/${dateStr}`;

  const created = await enqueueFileTask(addKey, async () => {
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

/**
 * 删除匹配条目（定位谓词由调用方闭包，locator 行号兜底语义沿用）。
 * 命中即整文件删除；解析失败/不匹配的文件跳过不动。返回删除条数。
 */
export async function removeDiaryEntries(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  opts?: DateWriteOptions
): Promise<number> {
  const paths = opts?.filePath ? [opts.filePath] : listDateEntryPaths(dateStr);
  let removed = 0;
  for (const p of paths) {
    try {
      const del = await enqueueFileTask(p, async () => {
        // 写在队列回调词法区域内（D3 直写守门契约内实现）：守卫读 + 删除文件一气呵成
        const { file, entry } = await readEntryCtxInQueue(p);
        if (!file || !entry || !match(entry)) return false;
        await getApp().vault.delete(file);
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

/**
 * 更新条目标签（定位 = 谓词，filePath 限定由调用方传入）。
 * 命中即重写 frontmatter（正文不动）；标签未变化等价成功不写盘；命中 0 条返回 null。
 * 成功（含变化）发 diary:tags-changed。
 */
export async function updateDiaryTags(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  newTags: string[],
  opts?: DateWriteOptions
): Promise<DiaryEntry | null> {
  const paths = opts?.filePath ? [opts.filePath] : listDateEntryPaths(dateStr);
  for (const p of paths) {
    let hit: { entry: DiaryEntry; from: string[]; changed: boolean } | null = null;
    try {
      hit = await enqueueFileTask(p, async () => {
        // 写在队列回调词法区域内（D3 直写守门契约内实现）：守卫读 + 仅重写 frontmatter
        const { file, content, entry } = await readEntryCtxInQueue(p);
        if (!file || !entry || !match(entry)) return null;
        const changed = !(entry.tags.length === newTags.length && entry.tags.every((t) => newTags.includes(t)));
        if (!changed) return { entry, from: [...entry.tags], changed: false };
        const body = parseDiaryEntryFile(content).body;
        await getApp().vault.modify(file, serializeDiaryEntryFile({ date: entry.date, time: entry.time }, newTags, body));
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

/**
 * 按完整路径反查条目（墙动作入口；条目文件的 filename 即完整路径）。
 * 入参兼容旧形状：日期串（无 `/`）在新格式下无对应文件 → null。
 */
export async function findDiaryEntry(filename: string, lineNumber = 0): Promise<DiaryEntry | null> {
  void lineNumber; // ADR-0130：行号定位退场（locator 按 filePath+time），参数保留兼容旧调用面
  if (!filename || !filename.includes('/')) return null;
  try {
    return await withEntryFile(filename, ({ entry }) => (entry ? { ...entry } : null));
  } catch (e) {
    return null; // 守卫拒读/读失败：动作不可用（人话通知已由写层发出）
  }
}

/** 守卫拒绝的统一静默处理（UI 层 catch 后判断：人话通知已由写层发出，不再叠加） */
export function isUnparsedRefusal(e: unknown): boolean {
  return e instanceof UnparsedLineError;
}

// ===== 兼容导出（原 store 面名；encrypt 编排等内部消费） =====

export { isEncryptedEntry };
export { isValidDiaryDate, isValidDiaryTime };
