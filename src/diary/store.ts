/**
 * 日记写层（issue 256 写链路迁入）：唯一有权改写日记 md 的模块。
 *
 * 写模型：diaryDataMap（文件路径 → 条目数组）不再是常驻全量缓存——每次写操作在
 * core per-path 串行队列（enqueueFileTask，键 = 日记文件路径）内「磁盘同步 → 守卫 →
 * 变更 → 全量重写」一气呵成（D3 可靠写契约收口：守卫读与写同队列互斥，TOCTOU 无窗口）。
 * 磁盘同步即守卫：parseFile 的 onUnparsed 口径在同步时计量，命中未解析行即拒处理并
 * 人话指引「检测日记解析」（与丢失口径严格一致，直接写会永久抹掉这些行）；
 * 读盘失败同样中止任务（D1：视为空文件会删掉/覆盖整天日记）。
 *
 * 条目定位：filePath + lineNumber（writeFile 落盘时把 map 条目行号与磁盘标题行一一对应，
 * P1-12 同 time 多条不再靠 time 唯一定位；D2 子目录日期文件按完整路径读写，与顶层同名文件互不串扰）；
 * 行号失配回退「同 time 仅一条」/ 内容匹配。
 * 动作完成后发域事件（diary:entry-added / entry-deleted / tags-changed / file-vacated），
 * 墙与其他消费者自行刷新；本模块不碰 DOM、不挂监听。
 */
import { stripMdExt } from '../core/utils';
import { notify } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { enqueueFileTask } from '../core/storage';
import { getApp } from '../core/app';
import { DIARY_DIRECTORY, getTagEmoji } from './config';
import { isEncryptedEntry, parseFile } from './parser';
import type { DiaryEntry } from './types';

/**
 * 文件路径 → 条目数组 的写模型映射（最近一次操作该文件时的内存快照；
 * 每次写前都会从磁盘重新同步，此 map 仅供调用方读取复用，不保证跨操作新鲜）。
 * 键 = 文件完整路径（D2：子目录日期文件与顶层同名日期文件互不串扰）。
 * 加密条目不在 md 中、不进此 map（加密可见性由墙的 mergeEncryptedEntries 负责）。
 */
export let diaryDataMap: Map<string, DiaryEntry[]> | null = null;

export function setDiaryDataMap(map: Map<string, DiaryEntry[]> | null) {
  diaryDataMap = map;
}

/** 「无法解析行」警告 toast（无 DOM 环境/通知容器缺失时静默；dedupeKey 防反复触发刷屏） */
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

/** 守卫拒绝错误：调用方可识别后静默（人话通知已发） */
export class UnparsedLineError extends Error {
  constructor(public dateStr: string, public count: number) {
    super(`「${dateStr}」有 ${count} 行内容无法解析，已拒绝处理`);
    this.name = 'UnparsedLineError';
  }
}

/**
 * 读盘失败错误（D1 修复）：读失败若视为空文件，删除路径会在空数组上「跑完」把整天日记文件
 * 删掉、写路径会用只有新条目的内容覆盖当天全部日记。现改为抛错中止队列任务（与守卫拒写同待遇），
 * 调用方经 isDiaryReadFailure 识别后静默（人话通知已由写层发出）。
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

/** 日期写操作的目标文件引用（filePath 缺省 = 顶层 `<日记目录>/<date>.md`） */
export interface DateWriteOptions {
  /** 目标文件完整 vault 路径（子目录日期文件必传，D2：写回原文件而非顶层同名文件） */
  filePath?: string;
}

/** 解析日期写操作引用：dateStr + filePath（缺省拼顶层路径） */
function resolveDateRef(dateStr: string, opts?: DateWriteOptions): { dateStr: string; filePath: string } {
  return { dateStr, filePath: opts?.filePath || `${DIARY_DIRECTORY}/${dateStr}.md` };
}

interface SyncedDate {
  entries: DiaryEntry[];
  exists: boolean;
}

/**
 * 队列内磁盘同步：读磁盘 → parseFile 计量未解析行 → 命中即抛 UnparsedLineError（拒处理）。
 * 文件不存在返回空数组（新文件）；读失败抛 DiaryFileReadError 中止任务（D1：直接写会用
 * 「只有新条目」的全文覆盖/清空整天日记）。同步结果回写 diaryDataMap（键 = 文件路径，供调用方读快照）。
 */
async function syncDateFromDisk(ref: { dateStr: string; filePath: string }): Promise<SyncedDate> {
  const file = getApp().vault.getAbstractFileByPath(ref.filePath) as any;
  if (!file) {
    if (diaryDataMap) diaryDataMap.delete(ref.filePath);
    return { entries: [], exists: false };
  }
  let unparsed = 0;
  let entries: DiaryEntry[] = [];
  try {
    const content = await getApp().vault.read(file);
    entries = parseFile(content, ref.dateStr, (n) => (unparsed = n));
  } catch (e) {
    warnReadFailed(
      `「${ref.dateStr}」日记读取失败，本次修改没有执行（直接写会覆盖整篇日记）。请稍后重试。`,
      `diary-read-failed-${ref.filePath}`
    );
    throw new DiaryFileReadError(ref.filePath, e);
  }
  if (unparsed > 0) {
    warnUnparsed(
      `「${ref.dateStr}」有 ${unparsed} 行内容无法解析，本次修改没有写入文件` +
        `（直接处理会丢失这些行）。请先在日记本设置中运行「检测日记解析」修复后再试。`,
      `diary-write-refused-${ref.filePath}`
    );
    throw new UnparsedLineError(ref.dateStr, unparsed);
  }
  if (!diaryDataMap) setDiaryDataMap(new Map());
  for (const e of entries) e.filePath = ref.filePath; // 条目回填来源路径（定位谓词用）
  if (entries.length === 0) diaryDataMap!.delete(ref.filePath);
  else diaryDataMap!.set(ref.filePath, entries);
  return { entries, exists: true };
}

/**
 * 同步结果按时间序序列化为文件全文（纯计算，不碰 vault）。
 * 空数组表示「整文件删除」，由调用方（队列回调）执行。
 * 稳定标识：写盘时把每个 map 条目的行号与磁盘标题行一一对应（P1-12：同 time 多条不再靠 time 唯一定位）
 */
function serializeDateFile(entries: DiaryEntry[]): string {
  entries.sort((a, b) => a.timeValue - b.timeValue);
  let headingCursor = 0;
  const fileLines = entries
    .map((entry) => {
      const emojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join('');
      const lines = [`# ${emojiSeq} ${entry.time}`, ''];
      if (entry.content.trim()) lines.push(entry.content.trim());
      lines.push('');
      entry.lineNumber = headingCursor + 1;
      headingCursor += lines.length;
      return lines;
    })
    .flat()
    .slice(0, -1);
  return fileLines.join('\n');
}

/**
 * 串行队列壳：同步 → 守卫 → task（拿到可变条目数组）→ 落盘，全在同一队列任务内。
 * 队列键 = 目标文件路径（子目录日期文件与顶层同名文件各自串行，互不阻塞也互不误写）。
 * 落盘 IO 刻意写在 enqueueFileTask 回调的词法区域内——D3 直写守门视队列内 IO 为契约内实现，
 * 抽成独立函数会让写脱离区域而被判裸直写（写必须在队列内，与守卫读互斥才能消 TOCTOU 窗口）。
 */
async function withDateFile<T>(
  ref: { dateStr: string; filePath: string },
  task: (entries: DiaryEntry[]) => T | Promise<T>
): Promise<T> {
  const filePath = ref.filePath;
  return enqueueFileTask(filePath, async () => {
    const { entries } = await syncDateFromDisk(ref);
    const result = await task(entries);
    const file = getApp().vault.getAbstractFileByPath(filePath) as any;
    if (entries.length === 0) {
      if (file) await getApp().vault.delete(file);
      return result;
    }
    const finalContent = serializeDateFile(entries);
    try {
      if (file) await getApp().vault.modify(file, finalContent);
      else await getApp().vault.create(filePath, finalContent);
    } catch (error) {
      console.error(`重新生成文件 ${filePath} 失败:`, error);
      throw error;
    }
    return result;
  });
}

/** 读快照：磁盘同步后返回该日期条目副本（不落盘；供 recap 等预读，守卫命中同样拒读） */
export async function listDateEntries(dateStr: string, opts?: DateWriteOptions): Promise<DiaryEntry[]> {
  const ref = resolveDateRef(dateStr, opts);
  return enqueueFileTask(ref.filePath, async () => {
    const { entries } = await syncDateFromDisk(ref);
    return entries.map((e) => ({ ...e }));
  });
}

/** 添加新日记条目（原 addEntry 语义：map 插入 + 全量重写；时间序插入位）。
 *  opts.filePath：写入子目录日期文件（D2）；缺省写顶层 `<日记目录>/<date>.md`（新写条目默认落点）。 */
export async function addEntry(
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string,
  opts?: DateWriteOptions
): Promise<DiaryEntry> {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const timeValue = hours * 100 + minutes;

  const newEntry: DiaryEntry = {
    date: dateStr,
    time: timeStr,
    timeValue: timeValue,
    tags: tagsArray,
    emoji: '',
    content: content.trim(),
    filename: dateStr,
    lineNumber: 0,
  };
  newEntry.emoji = tagsArray.map((tag) => getTagEmoji(tag)).join('');

  await withDateFile(resolveDateRef(dateStr, opts), (entries) => {
    let insertIndex = entries.findIndex((e) => e.timeValue > timeValue);
    if (insertIndex === -1) insertIndex = entries.length;
    entries.splice(insertIndex, 0, newEntry);
  });

  const finalEntry = { ...newEntry };
  finalEntry.id = `${dateStr}-${timeStr.replace(/:/g, '-')}-${Date.now()}`;
  emitDomainEvent('diary:entry-added', { date: dateStr, time: timeStr, tags: tagsArray, content: content.trim() });
  return finalEntry;
}

/**
 * 删除匹配条目（原 deleteEntry 语义，定位从 id 改为谓词——wall/recap 各自携带定位字段）。
 * opts.filePath：子目录日期文件（D2）；缺省操作顶层 `<日记目录>/<date>.md`。
 * 返回删除条数；删除后该日期无条目时整文件删除并发 diary:file-vacated。
 */
export async function removeDiaryEntries(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  opts?: DateWriteOptions
): Promise<number> {
  let removed: DiaryEntry[] = [];
  let vacated = false;

  await withDateFile(resolveDateRef(dateStr, opts), (entries) => {
    removed = entries.filter(match);
    if (removed.length === 0) return;
    for (const r of removed) {
      const idx = entries.indexOf(r);
      if (idx !== -1) entries.splice(idx, 1);
    }
    vacated = entries.length === 0;
  });

  if (removed.length === 0) return 0;

  if (vacated) {
    // 结构性事实：该日期整文件已清空删除（意图类事件 entry-deleted 由 UI 确认回调负责，此处不发）
    emitDomainEvent('diary:file-vacated', { date: dateStr });
  }
  return removed.length;
}

/**
 * 更新条目标签（原 updateTags 语义，定位 = filePath+lineNumber 谓词由调用方闭包）。
 * opts.filePath：子目录日期文件（D2）；缺省操作顶层 `<日记目录>/<date>.md`。
 * 命中 0 条返回 false（数据未加载/被加密链路换血等——不再盲写旧数据）。
 * 成功发 diary:tags-changed。
 */
export async function updateDiaryTags(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  newTags: string[],
  opts?: DateWriteOptions
): Promise<DiaryEntry | null> {
  // 闭包内赋值的宿主对象（TS 对闭包赋值的收窄不回流的 workaround：直接变量会被窄化为 never）
  const res: { oldTags: string[]; changed: boolean; entry: DiaryEntry | null } = { oldTags: [], changed: false, entry: null };

  await withDateFile(resolveDateRef(dateStr, opts), (entries) => {
    const hit = entries.find(match) ?? null;
    if (!hit) return;
    res.entry = hit;
    if (hit.tags.length === newTags.length && hit.tags.every((t) => newTags.includes(t))) {
      return; // 标签未变化：等价成功，不写盘
    }
    res.oldTags = [...hit.tags];
    hit.tags = newTags;
    hit.emoji = newTags.map((tag) => getTagEmoji(tag)).join('');
    res.changed = true;
  });

  if (!res.entry) return null;
  if (res.changed) {
    // 动作埋点：标签变更写盘成功
    emitDomainEvent('diary:tags-changed', {
      date: res.entry.date,
      time: res.entry.time,
      from: res.oldTags,
      to: newTags,
    });
  }
  return res.entry;
}

/**
 * 按 filePath+lineNumber 反查条目（墙动作入口；墙与写层同源解析、行号一致）。
 * 入参兼容两种形状：日期串（→ 顶层 `<日记目录>/<date>.md`）或完整 vault 路径（子目录日期文件，D2）。
 * 先查 diaryDataMap 快照，未命中做一次该文件磁盘同步后重查（替代旧「全量 loadAll 兜底」）。
 */
export async function findDiaryEntry(filename: string, lineNumber: number): Promise<DiaryEntry | null> {
  const filePath = filename.includes('/') ? filename : `${DIARY_DIRECTORY}/${filename}.md`;
  const dateStr = stripMdExt(filePath.split('/').pop()!);
  const lookup = (map: Map<string, DiaryEntry[]> | null): DiaryEntry | null => {
    const entries = map?.get(filePath);
    if (!entries) return null;
    return (
      entries.find((e) => e.filePath === filePath && e.lineNumber === lineNumber) ??
      null
    );
  };
  const hit = lookup(diaryDataMap);
  if (hit) return hit;
  try {
    await listDateEntries(dateStr, { filePath });
  } catch (e) {
    return null; // 守卫拒读/读失败：动作不可用（人话通知已由写层发出）
  }
  return lookup(diaryDataMap);
}

/** 守卫拒绝的统一静默处理（UI 层 catch 后判断：人话通知已由写层发出，不再叠加） */
export function isUnparsedRefusal(e: unknown): boolean {
  return e instanceof UnparsedLineError;
}

// ===== 兼容导出（原 store 面名；encrypt 编排等内部消费） =====

export { isEncryptedEntry };
