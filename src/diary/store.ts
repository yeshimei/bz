/**
 * 数据层：加载/写回/增删/刷新监听（不直接触碰 DOM）。
 * 原脚本 loadAll（1371）、writeFile（1825）、onFileChange（1798）、
 * refreshFile（1724）、refreshSpecialFile（1764）、addEntry（3481）、deleteEntry（2526）。
 * UI 刷新通过回调解耦（避免循环依赖）。
 */
import { notice, notify } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { enqueueFileTask } from '../core/storage';
import { getApp } from './app';
import { BATCH_SIZE, DIARY_DIRECTORY, LETTER_DIRECTORY, MOVIE_DIRECTORY, getTagEmoji } from './config';
import { isEncryptedEntry, parseFile, parseLetterFile, parseMovieFile } from './parser';
import { loadEncryptedEntries, isUnlocked } from './encrypt';
import { diaryDataMap, setDiaryDataMap, state } from './state';
import type { DiaryEntry } from './types';

// ===== UI 刷新回调（由 ui 层注册） =====
type RefreshCallback = () => void;

const fullRefreshCallbacks: RefreshCallback[] = [];
const lightRefreshCallbacks: RefreshCallback[] = [];
const progressCallbacks: ((loaded: number, total: number) => void)[] = [];
const loadingCallbacks: ((loading: boolean) => void)[] = [];

/** 全量刷新：重筛 + 重渲染 + 标签重建（原 refreshFile/loadAll 末尾逻辑） */
export function onFullRefresh(cb: RefreshCallback) {
  fullRefreshCallbacks.push(cb);
}
/** 轻量刷新：仅标签重建 + 标题后缀（原 addEntry/updateTags 末尾逻辑） */
export function onLightRefresh(cb: RefreshCallback) {
  lightRefreshCallbacks.push(cb);
}
/** 加载进度回调（原 updateProgress） */
export function onProgress(cb: (loaded: number, total: number) => void) {
  progressCallbacks.push(cb);
}
/** 加载状态回调（原 setLoadingState） */
export function onLoadingChange(cb: (loading: boolean) => void) {
  loadingCallbacks.push(cb);
}

function emitFullRefresh() {
  fullRefreshCallbacks.forEach((cb) => cb());
}
function emitLightRefresh() {
  lightRefreshCallbacks.forEach((cb) => cb());
}

function emitProgress(loaded: number, total: number) {
  progressCallbacks.forEach((cb) => cb(loaded, total));
}
function emitLoading(loading: boolean) {
  loadingCallbacks.forEach((cb) => cb(loading));
}

/** 文件变更延迟：固定 100ms（设置项已移除） */
const FILE_CHANGE_DELAY = 100;

// ===== 目录递归查找（vault 未就绪时兜底） =====
function findDirRecursive(folder: any, path: string): any {
  if (!folder || !folder.children) return null;
  if (folder.path === path) return folder;
  for (const child of folder.children) {
    if (child.children) {
      const found = findDirRecursive(child, path);
      if (found) return found;
    }
  }
  return null;
}

// ===== 排序辅助 =====
function sortEntries(entries: DiaryEntry[]) {
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
  });
}

function assignIds(entries: DiaryEntry[]) {
  entries.forEach((entry, idx) => {
    if (!entry.id) {
      const safeTime = entry.time.replace(/:/g, '-');
      entry.id = `${entry.date}-${safeTime}-${idx}`;
    }
  });
}

/** 合并解锁后的加密日记条目进 originalDiaryEntries（Q21-a：未解锁不并入，完全不可见） */
async function mergeEncryptedEntries() {
  let encrypted: DiaryEntry[] = [];
  try {
    if (!isUnlocked()) return;
    encrypted = await loadEncryptedEntries();
  } catch (e) {
    // encrypt 域未配置/设置未注入（如未初始化）：视为无加密条目，避免阻断主列表（ADR-0002 降级链）
    return;
  }
  const existing = state.data.originalDiaryEntries.filter((e) => !e.encrypted);
  const merged = [...existing, ...encrypted].filter(Boolean) as DiaryEntry[];
  sortEntries(merged);
  assignIds(merged);
  state.data.originalDiaryEntries = merged;
}

// ===== 加载 =====

/** 加载所有日记（分批并发）+ 影视 + 信 */
export async function loadAll() {
  if (state.data.isLoadingData) return;
  state.data.isLoadingData = true;
  emitLoading(true);
  try {
    const app = getApp();
    let diaryDir = app.vault.getAbstractFileByPath(DIARY_DIRECTORY) as any;
    if (!diaryDir || !diaryDir.children) {
      // 兜底：vault 文件树可能未就绪，递归查找目录
      const root = app.vault.getRoot() as any;
      diaryDir = findDirRecursive(root, DIARY_DIRECTORY);
    }
    if (!diaryDir || !diaryDir.children) {
      state.data.originalDiaryEntries = [];
      state.data.currentFilteredEntries = [];
      // P3 审查修复：目录缺失早退时同步清 map——残留旧 map 会让后续 addEntry
      // 仍对着已消失目录写文件，且内存 map 与空列表口径不一致
      setDiaryDataMap(null);
      // 渲染空态（避免静默空白）
      state.data.currentDisplayCount = 0;
      emitFullRefresh();
      emitLoading(false);
      return;
    }

    const mdFiles = diaryDir.children
      .filter((f: any) => f.extension === 'md')
      .sort((a: any, b: any) => b.name.localeCompare(a.name));
    const totalDiaryFiles = mdFiles.length;

    let movieFiles: any[] = [];
    let letterFiles: any[] = [];

    emitProgress(0, totalDiaryFiles || 1);

    const BATCH_CONCURRENCY = 10;
    const results: { date: string; entries: DiaryEntry[] }[] = [];
    // UX-9 警告接线：记录存在未解析行的文件数，加载完成后一次性提示
    let unparsedFiles = 0;
    if (totalDiaryFiles > 0) {
      for (let i = 0; i < mdFiles.length; i += BATCH_CONCURRENCY) {
        const batch = mdFiles.slice(i, i + BATCH_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (file: any, idx: number) => {
            const content = await app.vault.read(file);
            const entries = parseFile(content, file.basename, (n) => {
              if (n > 0) unparsedFiles++;
            });
            emitProgress(i + idx + 1, totalDiaryFiles);
            return { date: file.basename, entries };
          })
        );
        results.push(...batchResults);
      }
    }

    state.data.originalDiaryEntries = [];
    const map = new Map<string, DiaryEntry[]>();
    for (const { date, entries } of results) {
      if (entries.length) {
        map.set(date, entries);
        state.data.originalDiaryEntries.push(...entries.filter((e) => !isEncryptedEntry(e)));
      }
    }
    setDiaryDataMap(map);

    // ========== 加载影视文件 ==========
    const movieDir = app.vault.getAbstractFileByPath(MOVIE_DIRECTORY) as any;
    if (movieDir && movieDir.children) {
      movieFiles = movieDir.children.filter((f: any) => f.extension === 'md');
    }

    // ========== 加载信文件 ==========
    const letterDir = app.vault.getAbstractFileByPath(LETTER_DIRECTORY) as any;
    if (letterDir && letterDir.children) {
      letterFiles = letterDir.children.filter((f: any) => f.extension === 'md');
    }

    const totalFiles = totalDiaryFiles + movieFiles.length + letterFiles.length;
    if (totalFiles === 0) {
      // 空库：渲染空态（原脚本此处早退导致空白面板，此处补齐刷新）
      state.data.currentDisplayCount = 0;
      emitFullRefresh();
      emitProgress(0, 0);
      state.data.isLoadingData = false;
      emitLoading(false);
      return;
    }

    const loadedDiary = totalDiaryFiles;
    emitProgress(loadedDiary, totalFiles);

    for (let i = 0; i < movieFiles.length; i++) {
      const movieEntry = await parseMovieFile(movieFiles[i]);
      if (movieEntry) {
        state.data.originalDiaryEntries.push(movieEntry);
      }
      emitProgress(loadedDiary + i + 1, totalFiles);
    }

    const offset = loadedDiary + movieFiles.length;
    for (let i = 0; i < letterFiles.length; i++) {
      const letterEntry = await parseLetterFile(letterFiles[i]);
      if (letterEntry) {
        state.data.originalDiaryEntries.push(letterEntry);
      }
      emitProgress(offset + i + 1, totalFiles);
    }

    // 统一排序
    await mergeEncryptedEntries(); // 解锁态下合并加密日记（ADR-0017；未解锁为空）
    sortEntries(state.data.originalDiaryEntries);
    // 确保每个条目都有 id
    assignIds(state.data.originalDiaryEntries);

    // UX-9 警告接线：有文件存在未解析行时汇总提示（这些行未进列表，重写会丢）
    if (unparsedFiles > 0) {
      warnUnparsed(
        `${unparsedFiles} 个日记文件存在无法解析的行，这些行没有加载。可在日记本设置中运行「检测日记解析」定位修复。`,
        'diary-loadall-unparsed'
      );
    }

    // 修复点：使用 full refresh 正确应用筛选条件
    state.data.currentDisplayCount = 0;
    emitFullRefresh();
    emitProgress(0, 0); // 隐藏进度条（原 hideProgress）
  } catch (err: any) {
    console.error('[日记本] 数据加载失败:', err);
    try {
      notice('数据加载失败：' + (err?.message || err), 'error');
    } catch (e) {}
  } finally {
    state.data.isLoadingData = false;
    emitLoading(false);
  }
}

// ===== 写回 =====

/** 「无法解析行」警告 toast（无 DOM 环境/通知容器缺失时静默；dedupeKey 防外部编辑反复触发刷屏） */
function warnUnparsed(msg: string, dedupeKey?: string) {
  try {
    notify(msg, { type: 'warning', dedupeKey });
  } catch (e) {
    /* 无 DOM 环境（node 测试）降级为静默 */
  }
}

/**
 * 写/删前守卫（P0 审查修复）：目标文件在磁盘上存在「无法解析的行」时拒处理并提示。
 * writeFile 用内存 map 全量重写整份文件（空条目时整文件删除），磁盘上任何未被解析的行
 * （文件开头游离行、条目内「空行 + # 形似标题」截断后的孤行等）都不在内存 map 里——
 * 直接处理会把它们从磁盘永久抹掉。此处在写/删前用 parseFile 的 onUnparsed 口径
 * （与丢失口径严格一致）复读磁盘文件计量，命中即拒并以人话通知引导先用修复工具。
 * 返回 true 表示已拒处理。
 */
async function refuseIfDiskUnparsed(dateStr: string, action: 'write' | 'delete'): Promise<boolean> {
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) return false; // 新文件：无旧内容可丢
  let unparsed = 0;
  try {
    const content = await getApp().vault.read(file);
    parseFile(content, dateStr, (n) => (unparsed = n));
  } catch (e) {
    return false; // 读失败不拦截写：写路径自身有失败兜底
  }
  if (unparsed <= 0) return false;
  warnUnparsed(
    `「${dateStr}」有 ${unparsed} 行内容无法解析，${
      action === 'delete' ? '已保留原文件未删除' : '本次修改没有写入文件'
    }（直接处理会丢失这些行）。请先在日记本设置中运行「检测日记解析」修复后再试。`,
    `diary-write-refused-${dateStr}`
  );
  return true;
}

/**
 * 写入日记文件（按时间序，原 writeFile）。
 * D3 可靠写契约原语 1 收编（旧域冻结区只动写安全）：同日日记文件的「P0 守卫读 → 内存渲染 →
 * 整文件写/删」整体入 core per-path 串行队列（enqueueFileTask，键 = 日记文件路径）——
 * 连续快速追加/删除条目与外部同步写并发时按序落盘，消灭「读-写窗口交错覆盖」；
 * 守卫读与写同队列互斥后，守卫到写之间不再可能被其他写方插入（TOCTOU 收口）。
 * 队列不可重入：任务体内不再对同路径入队（deleteEntry 的删除分支单独入队，不嵌套调用本函数）。
 */
export async function writeFile(dateStr: string) {
  if (!diaryDataMap || !diaryDataMap.has(dateStr)) return;
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  await enqueueFileTask(filePath, async () => {
    // P0 写前守卫：磁盘存在未解析行时拒写，引导先用「检测日记解析」修复工具
    if (await refuseIfDiskUnparsed(dateStr, 'write')) return;
    state.events.isInternalUpdate = true;
    try {
      const entries = diaryDataMap!.get(dateStr)!;

      if (entries.length === 0) {
        const file = getApp().vault.getAbstractFileByPath(filePath) as any;
        if (file) await getApp().vault.delete(file);
        return;
      }

      entries.sort((a, b) => a.timeValue - b.timeValue);
      // 稳定标识：写盘时把每个 map 条目的行号与磁盘标题行一一对应（P1-12：同 time 多条不再靠 time 唯一定位）
      let headingCursor = 0;
      const fileLines = entries
        .map((entry) => {
          // 使用 getTagEmoji 生成 emoji 序列
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

      const finalContent = fileLines.join('\n');
      const file = getApp().vault.getAbstractFileByPath(filePath) as any;

      try {
        if (file) await getApp().vault.modify(file, finalContent);
        else await getApp().vault.create(filePath, finalContent);
      } catch (error) {
        console.error(`重新生成文件 ${dateStr}.md 失败:`, error);
        throw error;
      }
    } finally {
      state.events.isInternalUpdate = false;
    }
  });
}

// ===== 新增 =====

/** 添加新日记条目到数据（原 addEntry） */
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

  if (!diaryDataMap) setDiaryDataMap(new Map());
  if (!diaryDataMap!.has(dateStr)) diaryDataMap!.set(dateStr, []);

  const entries = diaryDataMap!.get(dateStr)!;
  let insertIndex = entries.findIndex((e) => e.timeValue > timeValue);
  if (insertIndex === -1) insertIndex = entries.length;
  entries.splice(insertIndex, 0, newEntry);

  await writeFile(dateStr);

  // 回读校验行号（writeFile 已按磁盘标题行给 map 条目盖 lineNumber 戳；此处按行号精确对位，不再按 time+tags 猜测）
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (file) {
    const fileContent = await getApp().vault.read(file);
    const parsedEntries = parseFile(fileContent, dateStr);
    const matched = parsedEntries.find((e) => e.time === timeStr && e.lineNumber === newEntry.lineNumber);
    if (matched) {
      newEntry.lineNumber = matched.lineNumber;
    }
  }

  const finalEntry = { ...newEntry };
  finalEntry.id = `${dateStr}-${timeStr.replace(/:/g, '-')}-${Date.now()}`;
  state.data.originalDiaryEntries.push(finalEntry);
  sortEntries(state.data.originalDiaryEntries);
  emitLightRefresh();
  return finalEntry;
}

// ===== 删除 =====

/** 删除日记条目（原 deleteEntry） */
export async function deleteEntry(entryId: string) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) throw new Error('未找到日记条目');

  const dateStr = entry.date;
  const entries = diaryDataMap!.get(dateStr);
  if (!entries) throw new Error('未找到日期对应的日记数据');

  // 稳定定位（P1-12）：行号优先（writeFile 后与磁盘标题行一一对应），同 time 多条不再误删；
  // 行号失配的旧数据回退到「该时间仅一条」的唯一匹配
  let entryIndex = entries.findIndex((e) => e.time === entry.time && e.lineNumber === entry.lineNumber);
  if (entryIndex === -1) {
    const sameTime = entries.filter((e) => e.time === entry.time);
    if (sameTime.length === 1) entryIndex = entries.indexOf(sameTime[0]);
  }
  if (entryIndex === -1) throw new Error('未找到日记条目在数据中的索引');

  entries.splice(entryIndex, 1);

  const flatEntryIndex = state.data.originalDiaryEntries.findIndex((e) => e.id === entryId);
  if (flatEntryIndex !== -1) state.data.originalDiaryEntries.splice(flatEntryIndex, 1);

  const filteredIndex = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
  if (filteredIndex !== -1) state.data.currentFilteredEntries.splice(filteredIndex, 1);

  if (entries.length === 0) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    // P0 守卫 + 整文件删除入同路径串行队列（D3 收编）：守卫读与删除对 writeFile 等同文件写任务互斥，
    // 「守卫通过 → 删除」之间不再可能被其他写方重建/改写文件
    let vacated = false;
    await enqueueFileTask(filePath, async () => {
      const file = getApp().vault.getAbstractFileByPath(filePath) as any;
      if (!file) return;
      // P0 守卫：整文件删除同样会丢磁盘上的未解析行——命中时保留文件（同拒写口径）
      if (await refuseIfDiskUnparsed(dateStr, 'delete')) return;
      state.events.isInternalUpdate = true;
      try {
        await getApp().vault.delete(file);
        vacated = true;
      } finally {
        state.events.isInternalUpdate = false;
      }
    });
    if (vacated) {
      // 结构性事实：该日期整文件已清空删除（意图类事件 entry-deleted 由 UI 确认回调负责，此处不发）
      emitDomainEvent('diary:file-vacated', { date: dateStr });
    }
    if (diaryDataMap) diaryDataMap.delete(dateStr);
  } else {
    await writeFile(dateStr);
  }

  emitFullRefresh();
}

// ===== 刷新（文件变更） =====

/** 判断某条目是否属于该日记文件的普通条目（refreshFile / onFileDeleted 共用剔除口径） */
function isPlainEntryOfThisFile(e: DiaryEntry, dateStr: string): boolean {
  return (
    !e.encrypted &&
    !(e.id && (e.id.startsWith('movie-') || e.id.startsWith('letter-'))) &&
    !e.filename.includes('/') &&
    (e.date === dateStr || e.filename === dateStr)
  );
}

/** 文件删除后的内存剔除：map 日期项与列表普通条目（P2 审查修复：外部删除不再残留） */
function removeFileEntries(filePath: string) {
  const dateStr = filePath.split('/').pop()!.replace(/\.md$/, '');
  if (diaryDataMap) diaryDataMap.delete(dateStr);
  const before = state.data.originalDiaryEntries.length;
  state.data.originalDiaryEntries = state.data.originalDiaryEntries.filter((e) => !isPlainEntryOfThisFile(e, dateStr));
  state.data.currentFilteredEntries = state.data.currentFilteredEntries.filter((e) => !isPlainEntryOfThisFile(e, dateStr));
  if (state.data.originalDiaryEntries.length !== before) emitFullRefresh();
}

/**
 * 文件删除事件入口（diary:file-deleted 订阅端）：外部删除日记文件后剔除内存条目。
 * 不触碰磁盘；影视/信特殊条目与加密条目不在此剔除。isInternalUpdate 回环抑制同 onFileChange。
 */
export async function onFileDeleted(evt: { path: string }) {
  if (state.events.isInternalUpdate) return;
  removeFileEntries(evt.path);
}

/**
 * 文件重命名/移动事件入口（diary:file-renamed 订阅端）：剔除旧路径条目后按新路径刷新。
 */
export async function onFileRenamed(evt: { oldPath: string; newPath: string }) {
  if (state.events.isInternalUpdate) return;
  removeFileEntries(evt.oldPath);
  await refreshFile(evt.newPath);
}

/** 根据文件路径刷新对应日期的所有条目（原 refreshFile；导出供解密/外部改动后主动重读，不依赖文件事件） */
export async function refreshFile(filePath: string) {
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) return;
  const dateStr = file.basename;
  const content = await getApp().vault.read(file);
  // UX-9 警告接线：外部改动的文件带未解析行时提示（这些行不在刷新结果里，写回会被丢弃）
  let unparsed = 0;
  const newEntries = parseFile(content, dateStr, (n) => (unparsed = n));
  if (unparsed > 0) {
    warnUnparsed(
      `「${dateStr}」有 ${unparsed} 行内容无法解析，这些行没有加载。可在日记本设置中运行「检测日记解析」定位修复。`,
      `diary-refresh-unparsed-${dateStr}`
    );
  }

  if (!diaryDataMap) setDiaryDataMap(new Map());
  if (newEntries.length === 0) {
    diaryDataMap!.delete(dateStr);
  } else {
    diaryDataMap!.set(dateStr, newEntries);
  }

  // P0-4：仅移除属于该日记文件的普通条目（isPlainEntryOfThisFile 口径，影视/信等特殊条目
  // 即使 date 与该日记同日也不得被剔除）。加密条目由 mergeEncryptedEntries 统一重并。
  const otherEntries = state.data.originalDiaryEntries.filter((e) => !isPlainEntryOfThisFile(e, dateStr));
  newEntries.forEach((entry) => {
    entry.filename = dateStr;
  });
  const visibleEntries = newEntries.filter((e) => !isEncryptedEntry(e));
  state.data.originalDiaryEntries = [...otherEntries, ...visibleEntries];

  await mergeEncryptedEntries(); // 该日期若存在加密条目（不在 md 中），刷新后重新并入

  sortEntries(state.data.originalDiaryEntries);
  assignIds(state.data.originalDiaryEntries);

  emitFullRefresh();
}

/** 刷新单个影视/信文件条目（upsert 到数据列表，原 refreshSpecialFile） */
async function refreshSpecialFile(filePath: string, parseFn: (file: any) => Promise<DiaryEntry | null>, prefix: string) {
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) return;

  const newEntry = await parseFn(file);
  const oldEntryIndex = state.data.originalDiaryEntries.findIndex(
    (e) => e.id && e.id.startsWith(`${prefix}-${filePath.replace(/\//g, '-')}`)
  );
  if (oldEntryIndex !== -1) {
    if (newEntry) {
      // 更新
      state.data.originalDiaryEntries[oldEntryIndex] = newEntry;
    } else {
      // 文件无效，删除
      state.data.originalDiaryEntries.splice(oldEntryIndex, 1);
    }
  } else if (newEntry) {
    // 新增
    state.data.originalDiaryEntries.push(newEntry);
  }

  // 重新排序
  sortEntries(state.data.originalDiaryEntries);

  emitFullRefresh();
}

/** 监听日记文件变更（原 onFileChange，含节流与内部更新防回环）；P2：debounce 按 filePath 分桶，多文件并行变更互不吞并 */
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 文件变更刷新入口：订阅端 handler，接收域事件载荷 { path }（diary/movie/letter:file-modified
 * 三通道共用，由 panel.ts 经 onDomainEvent 接线；adapter 仅对 .md 派发域事件，此处保留
 * .md 后缀兜底判定）。isInternalUpdate 回环抑制留在订阅端本函数内，不前移到派发侧。
 */
export async function onFileChange(evt: { path: string }) {
  if (state.events.isInternalUpdate) return;
  const filePath = evt.path;
  // 目录前缀带边界匹配（避免 我的/日记.md、我的/日记本/... 误判）
  const inDir = (p: string, dir: string) => p === dir || p.startsWith(dir + '/');
  const isMd = filePath.endsWith('.md');
  const isDiaryFile = inDir(filePath, DIARY_DIRECTORY) && isMd;
  const isMovieFile = inDir(filePath, MOVIE_DIRECTORY) && isMd;
  const isLetterFile = inDir(filePath, LETTER_DIRECTORY) && isMd;

  if (!isDiaryFile && !isMovieFile && !isLetterFile) return;

  const pending = refreshTimers.get(filePath);
  if (pending) clearTimeout(pending);
  refreshTimers.set(
    filePath,
    setTimeout(async () => {
      refreshTimers.delete(filePath);
      if (isDiaryFile) {
        await refreshFile(filePath);
      } else if (isMovieFile) {
        await refreshSpecialFile(filePath, parseMovieFile, 'movie');
      } else if (isLetterFile) {
        await refreshSpecialFile(filePath, parseLetterFile, 'letter');
      }
    }, FILE_CHANGE_DELAY)
  );
}

// ===== 加密日记可见性（ADR-0017，Q21-a 未解锁完全不可见） =====

/** 解锁后重并加密条目并全量刷新（保险箱解锁回调 / 加密/降级动作后调用） */
export async function reloadWithEncrypted() {
  await mergeEncryptedEntries();
  state.data.currentDisplayCount = 0;
  emitFullRefresh();
}

/** 上锁后清除加密条目（保险箱上锁/关面板即上锁时调用），保持未解锁完全不可见 */
export function clearEncryptedEntries() {
  const hadEncrypted =
    state.data.originalDiaryEntries.some((e) => e.encrypted) ||
    state.data.currentFilteredEntries.some((e) => e.encrypted);
  if (!hadEncrypted) return;
  state.data.originalDiaryEntries = state.data.originalDiaryEntries.filter((e) => !e.encrypted);
  state.data.currentFilteredEntries = state.data.currentFilteredEntries.filter((e) => !e.encrypted);
  state.data.currentDisplayCount = 0;
  emitFullRefresh();
}
