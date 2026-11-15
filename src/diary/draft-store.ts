/* ============================================================
 * bz · 日记本「没写完的那张纸」（src/diary/draft-store.ts）
 *
 * 起因（2026-11-15 备忘录）：写作内页原先的「先收着」只是不销毁 DOM，强制关闭 Obsidian
 * 之后内存态连 textarea 一起没了，字就丢了。这里把草稿同步落 localStorage——
 * 写入是同步的，卸载 / 强杀不用等异步写盘；按库分键，多个 vault 不串草稿。
 *
 * 口径：
 * - 只在**有正文**时写（空纸不占键），落笔 / 揉掉立刻删键；
 * - 草稿是明文、且是临时态：日记条目里的加密由写层 / 保险库负责，这里不另造一套，
 *   也不把草稿混进册子数据文件（不留长期副本）；
 * - 存储不可用（隐私模式 / quota）一律静默：草稿丢了只是回到旧行为，不能让写日记崩掉。
 * ============================================================ */
import { vaultKeyOf } from '../core/vault-key';

export const DIARY_DRAFT_KEY = 'bz-diary-write-draft';

export interface DiaryDraftEdit {
  filePath: string;
  lineNumber: number;
  expectContent: string;
  originalTags: string[];
  whole: boolean;
}

export interface DiaryDraftData {
  /** textarea 原文：不 trim，换行与行尾空格都要留住 */
  text: string;
  date: string;
  time: string;
  tags: string[];
  /** 有值 = 「改字」态：恢复后原地替换那一条，不新增 */
  edit?: DiaryDraftEdit;
  /** 本地时间毫秒，只用于提示「上次写到几点」 */
  savedAt: number;
}

/** 只取 localStorage 需要的三个方法：测试可注入内存替身 */
export interface DraftStoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 每个库各记各的：localStorage 是 Obsidian 整个应用共用的（同 setup-state 的分键口径） */
export function diaryDraftKey(vault: string): string {
  const key = vaultKeyOf(vault);
  return key ? `${DIARY_DRAFT_KEY}:${key}` : DIARY_DRAFT_KEY;
}

export function defaultDraftStore(): DraftStoreLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function validEdit(e: unknown): e is DiaryDraftEdit {
  if (!e || typeof e !== 'object') return false;
  const x = e as Partial<DiaryDraftEdit>;
  return (
    typeof x.filePath === 'string' &&
    typeof x.lineNumber === 'number' &&
    typeof x.expectContent === 'string' &&
    Array.isArray(x.originalTags) &&
    x.originalTags.every((t) => typeof t === 'string') &&
    typeof x.whole === 'boolean'
  );
}

/** 读草稿；脏数据当没草稿并顺手删键（旧版格式 / 半截写入 / 手改过都算脏） */
export function readDiaryDraft(vault: string, store = defaultDraftStore()): DiaryDraftData | null {
  if (!store) return null;
  const key = diaryDraftKey(vault);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DiaryDraftData> | null;
    const ok =
      !!d &&
      typeof d === 'object' &&
      typeof d.text === 'string' &&
      !!d.text.trim() &&
      typeof d.date === 'string' &&
      typeof d.time === 'string' &&
      Array.isArray(d.tags) &&
      d.tags.every((t) => typeof t === 'string') &&
      (d.edit === undefined || validEdit(d.edit));
    if (!ok) {
      store.removeItem(key);
      return null;
    }
    const x = d as DiaryDraftData;
    return {
      text: x.text,
      date: x.date,
      time: x.time,
      tags: x.tags,
      edit: x.edit ? { ...x.edit, originalTags: [...x.edit.originalTags] } : undefined,
      savedAt: Number(x.savedAt) || 0,
    };
  } catch {
    try {
      store.removeItem(key);
    } catch {
      /* 存储整体不可用时连清理都做不到，忽略即可 */
    }
    return null;
  }
}

/** 同步落盘：输入停顿、收起书、卸载三处都会调，重复写同一份没有副作用 */
export function writeDiaryDraft(vault: string, data: DiaryDraftData, store = defaultDraftStore()): void {
  if (!store || !data.text.trim()) return;
  try {
    store.setItem(diaryDraftKey(vault), JSON.stringify(data));
  } catch {
    /* 隐私模式 / 配额满：回到「只在内存里保着」的旧行为，不打断写字 */
  }
}

export function clearDiaryDraft(vault: string, store = defaultDraftStore()): void {
  if (!store) return;
  try {
    store.removeItem(diaryDraftKey(vault));
  } catch {
    /* 同上 */
  }
}
