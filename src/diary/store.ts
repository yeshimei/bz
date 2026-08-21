/**
 * 数据层：加载/写回/增删/刷新监听（不直接触碰 DOM）。
 * 原脚本 loadAll（1371）、writeFile（1825）、onFileChange（1798）、
 * refreshFile（1724）、refreshSpecialFile（1764）、addEntry（3481）、deleteEntry（2526）。
 * UI 刷新通过回调解耦（避免循环依赖）。
 */
import { notice } from '../core/notice';
import { getApp } from './app';
import { BATCH_SIZE, DIARY_DIRECTORY, LETTER_DIRECTORY, MOVIE_DIRECTORY, buildTagMaps, getTagEmoji } from './config';
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

export function emitFullRefresh() {
  fullRefreshCallbacks.forEach((cb) => cb());
}
export function emitLightRefresh() {
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

/** 原 window.isProcessingRemainingFiles（死代码保留，行为一致） */
let isProcessingRemainingFiles = false;
export function getIsProcessingRemainingFiles(): boolean {
  return isProcessingRemainingFiles;
}

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
    if (totalDiaryFiles > 0) {
      for (let i = 0; i < mdFiles.length; i += BATCH_CONCURRENCY) {
        const batch = mdFiles.slice(i, i + BATCH_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (file: any, idx: number) => {
            const content = await app.vault.read(file);
            const entries = parseFile(content, file.basename);
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

/** 加密条目：内容含 🔐（保留在 diaryDataMap 防止写入时丢失） */

// ===== 写回 =====

/** 写入日记文件（按时间序，原 writeFile） */
export async function writeFile(dateStr: string) {
  if (!diaryDataMap || !diaryDataMap.has(dateStr)) return;
  state.events.isInternalUpdate = true;
  const entries = diaryDataMap.get(dateStr)!;

  if (entries.length === 0) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    const file = getApp().vault.getAbstractFileByPath(filePath) as any;
    if (file) await getApp().vault.delete(file);
    state.events.isInternalUpdate = false;
    return;
  }

  entries.sort((a, b) => a.timeValue - b.timeValue);
  const fileLines = entries
    .map((entry) => {
      // 使用 getTagEmoji 生成 emoji 序列
      const emojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join('');
      const lines = [`# ${emojiSeq} ${entry.time}`, ''];
      if (entry.content.trim()) lines.push(entry.content.trim());
      lines.push('');
      return lines;
    })
    .flat()
    .slice(0, -1);

  const finalContent = fileLines.join('\n');
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;

  try {
    if (file) await getApp().vault.modify(file, finalContent);
    else await getApp().vault.create(filePath, finalContent);
  } catch (error) {
    console.error(`重新生成文件 ${dateStr}.md 失败:`, error);
    throw error;
  } finally {
    state.events.isInternalUpdate = false;
  }
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

  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (file) {
    const fileContent = await getApp().vault.read(file);
    const parsedEntries = parseFile(fileContent, dateStr);
    const matched = parsedEntries.find(
      (e) => e.time === timeStr && e.tags.join(',') === tagsArray.join(',')
    );
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

  // 按时间匹配（同一文件内同一时间只有一个条目）
  const entryIndex = entries.findIndex((e) => e.time === entry.time);
  if (entryIndex === -1) throw new Error('未找到日记条目在数据中的索引');

  entries.splice(entryIndex, 1);

  const flatEntryIndex = state.data.originalDiaryEntries.findIndex((e) => e.id === entryId);
  if (flatEntryIndex !== -1) state.data.originalDiaryEntries.splice(flatEntryIndex, 1);

  const filteredIndex = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
  if (filteredIndex !== -1) state.data.currentFilteredEntries.splice(filteredIndex, 1);

  if (entries.length === 0) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    const file = getApp().vault.getAbstractFileByPath(filePath) as any;
    if (file) {
      state.events.isInternalUpdate = true;
      try {
        await getApp().vault.delete(file);
      } finally {
        state.events.isInternalUpdate = false;
      }
    }
    if (diaryDataMap) diaryDataMap.delete(dateStr);
  } else {
    await writeFile(dateStr);
  }

  emitFullRefresh();
}

// ===== 刷新（文件变更） =====

/** 根据文件路径刷新对应日期的所有条目（原 refreshFile） */
async function refreshFile(filePath: string) {
  const file = getApp().vault.getAbstractFileByPath(filePath) as any;
  if (!file) return;
  const dateStr = file.basename;
  const content = await getApp().vault.read(file);
  const newEntries = parseFile(content, dateStr);

  if (!diaryDataMap) setDiaryDataMap(new Map());
  if (newEntries.length === 0) {
    diaryDataMap!.delete(dateStr);
  } else {
    diaryDataMap!.set(dateStr, newEntries);
  }

  const otherEntries = state.data.originalDiaryEntries.filter((e) => e.date !== dateStr && !e.encrypted);
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

/** 监听日记文件变更（原 onFileChange，含节流与内部更新防回环） */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function onFileChange(file: any) {
  if (state.events.isInternalUpdate) return;
  const filePath = file.path;
  // 目录前缀带边界匹配（避免 我的/日记.md、我的/日记本/... 误判）
  const inDir = (p: string, dir: string) => p === dir || p.startsWith(dir + '/');
  const isDiaryFile = inDir(filePath, DIARY_DIRECTORY) && file.extension === 'md';
  const isMovieFile = inDir(filePath, MOVIE_DIRECTORY) && file.extension === 'md';
  const isLetterFile = inDir(filePath, LETTER_DIRECTORY) && file.extension === 'md';

  if (!isDiaryFile && !isMovieFile && !isLetterFile) return;

  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (isDiaryFile) {
      await refreshFile(filePath);
    } else if (isMovieFile) {
      await refreshSpecialFile(filePath, parseMovieFile, 'movie');
    } else if (isLetterFile) {
      await refreshSpecialFile(filePath, parseLetterFile, 'letter');
    }
    refreshTimer = null;
  }, FILE_CHANGE_DELAY);
}

/** 供 ui 层调用：重新构建标签映射（设置变更后） */
export function rebuildTagMaps() {
  buildTagMaps();
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
