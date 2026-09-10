/**
 * 日记写层（issue 256 写链路迁入）：唯一有权改写日记 md 的模块。
 *
 * 写模型：diaryDataMap（日期 → 条目数组）不再是常驻全量缓存——每次写操作在
 * core per-path 串行队列（enqueueFileTask，键 = 日记文件路径）内「磁盘同步 → 守卫 →
 * 变更 → 全量重写」一气呵成（D3 可靠写契约收口：守卫读与写同队列互斥，TOCTOU 无窗口）。
 * 磁盘同步即守卫：parseFile 的 onUnparsed 口径在同步时计量，命中未解析行即拒处理并
 * 人话指引「检测日记解析」（与丢失口径严格一致，直接写会永久抹掉这些行）。
 *
 * 条目定位：filename + lineNumber（writeFile 落盘时把 map 条目行号与磁盘标题行一一对应，
 * P1-12 同 time 多条不再靠 time 唯一定位）；行号失配回退「同 time 仅一条」/ 内容匹配。
 * 动作完成后发域事件（diary:entry-added / entry-deleted / tags-changed / file-vacated），
 * 墙与其他消费者自行刷新；本模块不碰 DOM、不挂监听。
 */
import { notify } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { enqueueFileTask } from '../core/storage';
import { getApp } from '../core/app';
import { DIARY_DIRECTORY, getTagEmoji } from './config';
import { isEncryptedEntry, parseFile } from './parser';
import type { DiaryEntry } from './types';

/**
 * 日期 → 条目数组 的写模型映射（最近一次操作该日期时的内存快照；
 * 每次写前都会从磁盘重新同步，此 map 仅供调用方读取复用，不保证跨操作新鲜）。
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

/** 守卫拒绝错误：调用方可识别后静默（人话通知已发） */
export class UnparsedLineError extends Error {
  constructor(public dateStr: string, public count: number) {
    super(`「${dateStr}」有 ${count} 行内容无法解析，已拒绝处理`);
    this.name = 'UnparsedLineError';
  }
}

interface SyncedDate {
  entries: DiaryEntry[];
  exists: boolean;
}

/**
 * 队列内磁盘同步：读磁盘 → parseFile 计量未解析行 → 命中即抛 UnparsedLineError（拒处理）。
 * 文件不存在返回空数组（新文件）；读失败视为空（写路径自身有失败兜底）。
 * 同步结果回写 diaryDataMap（供调用方读快照）。
 */
async function syncDateFromDisk(dateStr: string): Promise<SyncedDate> {
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) {
    if (diaryDataMap) diaryDataMap.delete(dateStr);
    return { entries: [], exists: false };
  }
  let unparsed = 0;
  let entries: DiaryEntry[] = [];
  try {
    const content = await getApp().vault.read(file);
    entries = parseFile(content, dateStr, (n) => (unparsed = n));
  } catch (e) {
    return { entries: [], exists: true }; // 读失败不拦截：写路径自身有失败兜底
  }
  if (unparsed > 0) {
    warnUnparsed(
      `「${dateStr}」有 ${unparsed} 行内容无法解析，本次修改没有写入文件` +
        `（直接处理会丢失这些行）。请先在日记本设置中运行「检测日记解析」修复后再试。`,
      `diary-write-refused-${dateStr}`
    );
    throw new UnparsedLineError(dateStr, unparsed);
  }
  if (!diaryDataMap) setDiaryDataMap(new Map());
  if (entries.length === 0) diaryDataMap!.delete(dateStr);
  else diaryDataMap!.set(dateStr, entries);
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
 * 落盘 IO 刻意写在 enqueueFileTask 回调的词法区域内——D3 直写守门视队列内 IO 为契约内实现，
 * 抽成独立函数会让写脱离区域而被判裸直写（写必须在队列内，与守卫读互斥才能消 TOCTOU 窗口）。
 */
async function withDateFile<T>(dateStr: string, task: (entries: DiaryEntry[]) => T | Promise<T>): Promise<T> {
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  return enqueueFileTask(filePath, async () => {
    const { entries } = await syncDateFromDisk(dateStr);
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
      console.error(`重新生成文件 ${dateStr}.md 失败:`, error);
      throw error;
    }
    return result;
  });
}

/** 读快照：磁盘同步后返回该日期条目副本（不落盘；供 recap 等预读，守卫命中同样拒读） */
export async function listDateEntries(dateStr: string): Promise<DiaryEntry[]> {
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  return enqueueFileTask(filePath, async () => {
    const { entries } = await syncDateFromDisk(dateStr);
    return entries.map((e) => ({ ...e }));
  });
}

/** 添加新日记条目（原 addEntry 语义：map 插入 + 全量重写；时间序插入位） */
export async function addEntry(
  dateStr: string,
  timeStr: string,
  tagsArray: string[],
  content: string
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

  await withDateFile(dateStr, (entries) => {
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
 * 返回删除条数；删除后该日期无条目时整文件删除并发 diary:file-vacated。
 */
export async function removeDiaryEntries(
  dateStr: string,
  match: (e: DiaryEntry) => boolean
): Promise<number> {
  let removed: DiaryEntry[] = [];
  let vacated = false;

  await withDateFile(dateStr, (entries) => {
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
 * 更新条目标签（原 updateTags 语义，定位 = filename+lineNumber 谓词由调用方闭包）。
 * 命中 0 条返回 false（数据未加载/被加密链路换血等——不再盲写旧数据）。
 * 成功发 diary:tags-changed。
 */
export async function updateDiaryTags(
  dateStr: string,
  match: (e: DiaryEntry) => boolean,
  newTags: string[]
): Promise<DiaryEntry | null> {
  // 闭包内赋值的宿主对象（TS 对闭包赋值的收窄不回流的 workaround：直接变量会被窄化为 never）
  const res: { oldTags: string[]; changed: boolean; entry: DiaryEntry | null } = { oldTags: [], changed: false, entry: null };

  await withDateFile(dateStr, (entries) => {
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
 * 按 filename+lineNumber 反查条目（墙动作入口；墙与写层同源解析、行号一致）。
 * 先查 diaryDataMap 快照，未命中做一次该日期磁盘同步后重查（替代旧「全量 loadAll 兜底」）。
 */
export async function findDiaryEntry(filename: string, lineNumber: number): Promise<DiaryEntry | null> {
  const dateStr = filename.includes('/') ? filename.split('/').pop()!.replace(/\.md$/, '') : filename;
  const lookup = (map: Map<string, DiaryEntry[]> | null): DiaryEntry | null => {
    const entries = map?.get(dateStr);
    if (!entries) return null;
    return (
      entries.find((e) => e.filename === filename && e.lineNumber === lineNumber) ??
      null
    );
  };
  const hit = lookup(diaryDataMap);
  if (hit) return hit;
  try {
    await listDateEntries(dateStr);
  } catch (e) {
    return null; // 守卫拒读（未解析行）：动作不可用
  }
  return lookup(diaryDataMap);
}

/** 守卫拒绝的统一静默处理（UI 层 catch 后判断：人话通知已由写层发出，不再叠加） */
export function isUnparsedRefusal(e: unknown): boolean {
  return e instanceof UnparsedLineError;
}

// ===== 兼容导出（原 store 面名；encrypt 编排等内部消费） =====

export { isEncryptedEntry };
