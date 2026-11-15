/* ============================================================
 * bz · 日记本「没写完的那张纸」（src/diary/draft-store.ts）
 *
 * 起因（2026-11-15 备忘录）：写作内页原先的「先收着」只是不销毁 DOM，强制关闭 Obsidian
 * 之后内存态连 textarea 一起没了，字就丢了。这里把草稿同步落 localStorage——
 * 写入是同步的，卸载 / 强杀不用等异步写盘；按库分键，多个 vault 不串草稿。
 *
 * 口径：
 * - 只在**有正文**时写（空纸不占键），落笔 / 揉掉立刻删键；
 * - 草稿是临时态：不进册子数据文件、不跟库同步、不参与加密写层（日记条目的加密归保险库管）；
 * - 正文以 base64 落盘（`b64:` 前缀，见 encodeText 注释）：**不是加密，只是不让本机存储里
 *   直接躺着中文**；旧版明文稿照旧能读回来（无前缀即原样）；
 * - **每个窗口各占一个键**（2026-11-15 发版 review）：Obsidian 多窗口共用一个 localStorage，
 *   原先一个库只有一个键，两个窗口同时写、都没落笔时后写的会把先写的盖掉。现在恢复取
 *   savedAt 最新的那份，写入只碰自己的槽，落笔 / 揉掉的清理删整组；
 * - 存储不可用（隐私模式 / quota）一律静默：草稿丢了只是回到旧行为，不能让写日记崩掉。
 * ============================================================ */
import { vaultKeyOf } from '../core/vault-key';

export const DIARY_DRAFT_KEY = 'bz-diary-write-draft';

/** 旧槽过期时间：别的窗口留下的稿子超过这么久不可能还要接着写，读的时候顺手清掉 */
const DRAFT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
/** 正文 base64 标记（没有这个前缀的 = 旧版明文，读的时候原样认） */
const B64_PREFIX = 'b64:';

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
  /** 本地时间毫秒：多窗口时按它认哪份最新，也用于提示「上次写到几点」 */
  savedAt: number;
}

/** localStorage 需要的三个方法 + 可选的键枚举（测试可注入内存替身） */
export interface DraftStoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 真实 localStorage 有；替身不给就退回「只认旧单键」 */
  readonly length?: number;
  key?(index: number): string | null;
}

/* ---------- 窗口槽 ---------- */

let slot: string | null = null;

/** 本窗口的草稿槽（随机后缀，一次会话一个） */
function draftSlot(): string {
  if (!slot) slot = Math.random().toString(36).slice(2, 10) || 'w';
  return slot;
}

/** 测试用：模拟「另一个窗口 / 下一次启动」（换一个槽） */
export function resetDraftSlotForTest(): void {
  slot = null;
}

/** 每个库各记各的：localStorage 是 Obsidian 整个应用共用的（同 setup-state 的分键口径） */
function keyBase(vault: string): string {
  const key = vaultKeyOf(vault);
  return key ? `${DIARY_DRAFT_KEY}:${key}` : DIARY_DRAFT_KEY;
}

/** 旧版单键（一个库一个键；多窗口共用）——保留导出给旧引用与迁移断言用 */
export function diaryDraftKey(vault: string): string {
  return keyBase(vault);
}

/** 本窗口要写的键 */
function draftKey(vault: string): string {
  return `${keyBase(vault)}:${draftSlot()}`;
}

/** 这个库名下全部草稿键：旧单键 + 本窗口槽 + （能枚举时）其它窗口的槽 */
function draftKeys(vault: string, store: DraftStoreLike): string[] {
  const base = keyBase(vault);
  const out: string[] = [base, draftKey(vault)];
  const n = typeof store.length === 'number' ? store.length : -1;
  if (typeof store.key === 'function' && n >= 0) {
    for (let i = 0; i < n; i++) {
      const k = store.key(i);
      if (k && k !== base && k.startsWith(base + ':') && !out.includes(k)) out.push(k);
    }
  }
  return out;
}

export function defaultDraftStore(): DraftStoreLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/* ---------- 正文遮挡（base64，不是加密） ---------- */

/**
 * 正文以 base64 存：localStorage 就在用户本机，随便翻一下就能看见全部中文。
 * 这**不是加密**——日记条目的保密交给保险库（加密册），草稿只是临时纸，能做的是别让
 * 明文直接躺在存储里。用 TextEncoder 转 UTF-8 再 btoa，和浏览器 / Node 都兼容。
 */
function encodeText(s: string): string {
  try {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return B64_PREFIX + btoa(bin);
  } catch {
    return s; // 宿主缺 btoa：退回明文（行为等同旧版），总比写不进去丢字强
  }
}

/** 解码正文；旧版明文（无前缀）原样返回；base64 坏了返回 null（当脏数据） */
function decodeText(s: string): string | null {
  if (!s.startsWith(B64_PREFIX)) return s;
  try {
    const bin = atob(s.slice(B64_PREFIX.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/* ---------- 读写 ---------- */

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

/** 已落盘的一条：校验 + 解正文；脏数据返回 null */
function parseDraft(raw: string): DiaryDraftData | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Partial<DiaryDraftData>;
  const ok =
    typeof d.text === 'string' &&
    !!d.text &&
    typeof d.date === 'string' &&
    typeof d.time === 'string' &&
    Array.isArray(d.tags) &&
    d.tags.every((t) => typeof t === 'string') &&
    (d.edit === undefined || validEdit(d.edit));
  if (!ok) return null;
  const text = decodeText(d.text as string);
  if (text === null || !text.trim()) return null;
  let edit: DiaryDraftEdit | undefined;
  if (d.edit) {
    const expect = decodeText(d.edit.expectContent);
    if (expect === null) return null;
    edit = { ...d.edit, expectContent: expect, originalTags: [...d.edit.originalTags] };
  }
  return {
    text,
    date: d.date as string,
    time: d.time as string,
    tags: [...(d.tags as string[])],
    edit,
    savedAt: Number(d.savedAt) || 0,
  };
}

function readKey(store: DraftStoreLike, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function removeKey(store: DraftStoreLike, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* 存储整体不可用时连清理都做不到，忽略即可 */
  }
}

/** 顺手清掉别的窗口留下的、已经不可能再接着写的旧槽（保留 keepKey 与最新那份） */
function pruneOldSlots(store: DraftStoreLike, vault: string, keepKey: string, now: number): void {
  for (const key of draftKeys(vault, store)) {
    if (key === keepKey) continue;
    const raw = readKey(store, key);
    if (!raw) continue;
    let at = 0;
    try {
      const d = JSON.parse(raw) as { savedAt?: unknown } | null;
      at = Number(d?.savedAt) || 0;
    } catch {
      at = 0; // 坏数据一并清
    }
    if (!at || now - at > DRAFT_MAX_AGE_MS) removeKey(store, key);
  }
}

/** 读草稿：跨窗口取 savedAt 最新的那份；脏数据当没草稿并顺手删键 */
export function readDiaryDraft(vault: string, store = defaultDraftStore()): DiaryDraftData | null {
  if (!store) return null;
  const now = Date.now();
  let best: DiaryDraftData | null = null;
  let bestKey = '';
  for (const key of draftKeys(vault, store)) {
    const raw = readKey(store, key);
    if (!raw) continue;
    const d = parseDraft(raw);
    if (!d) {
      removeKey(store, key);
      continue;
    }
    if (!best || d.savedAt > best.savedAt) {
      best = d;
      bestKey = key;
    }
  }
  if (best) pruneOldSlots(store, vault, bestKey, now);
  return best;
}

/** 同步落盘：输入停顿、收起书、卸载三处都会调，重复写同一份没有副作用 */
export function writeDiaryDraft(vault: string, data: DiaryDraftData, store = defaultDraftStore()): void {
  if (!store || !data.text.trim()) return;
  const payload: DiaryDraftData = {
    ...data,
    text: encodeText(data.text),
    edit: data.edit ? { ...data.edit, expectContent: encodeText(data.edit.expectContent) } : undefined,
  };
  try {
    store.setItem(draftKey(vault), JSON.stringify(payload));
    pruneOldSlots(store, vault, draftKey(vault), Date.now());
  } catch {
    /* 隐私模式 / 配额满：回到「只在内存里保着」的旧行为，不打断写字 */
  }
}

/** 这张纸结束了（落笔 / 揉掉 / 另起一张）：整组键一起删，别的窗口留下的同名稿也不该再冒出来 */
export function clearDiaryDraft(vault: string, store = defaultDraftStore()): void {
  if (!store) return;
  for (const key of draftKeys(vault, store)) removeKey(store, key);
}
