/**
 * 日记加密编排层（diary 域，ADR-0017；issue 256 随写链路迁入新 diary 域）
 * 复用保险箱 SafeManager：加密日记 = 保险箱里一篇 kind='diary-entry' 的 SafeNote。
 * - 加密：构建 `# emoji HH:mm\n正文` 块 + 收集正文引用的图片/视频附件 → lockNote 入库 →
 *         原块由 diary 域写层（store.removeDiaryEntries）摘除（lockNote 不删整 md）。
 * - 加载：从解锁的 SafeManager 读全部 diary-entry → 解密 → 解析成 DiaryEntry（带 encrypted/noteId 标记）。
 * - 降级/改分类：restoreDiaryEntry 还原附件 + 块 merge 回原 md + 取出即删。
 * 依赖方向（ADR-0002）：store(数据层) ← 本层 ← ui；不挂 window；import 保险箱域（显式跨域 import）。
 */
import { stripMdExt } from '../core/utils';
import { getApp } from '../core/app';
import { getSafeManager } from '../encrypt';
import { collectNoteAttachmentPaths, kindOf } from '../encrypt/ui';
import { bytesToBase64, type LockAttachmentInput } from '../encrypt/data';
import { DIARY_DIRECTORY, ENCRYPT_TAG, getTagEmoji, emojiToTagMap } from './config';
import type { DiaryEntry } from './types';

// 加密分类标签名（ADR-0017；写入块标题、参与筛选/计数）——单一来源在 config，此处转出给 UI 层
export { ENCRYPT_TAG };

// ===== 解锁态（与保险箱同一 SafeManager 单例，共享解锁态） =====
let unlockedListeners: (() => void)[] = [];

export function isUnlocked(): boolean {
  // 降级链：保险箱未初始化/设置未注入时视为未解锁，不阻断列表渲染（与 store 加密合并同策略）
  try {
    return getSafeManager().unlocked;
  } catch (e) {
    return false;
  }
}

export function onUnlockChange(cb: () => void): void {
  unlockedListeners.push(cb);
}

function notifyUnlockChange(): void {
  unlockedListeners.forEach((cb) => cb());
}

/** 保险箱解锁/上锁（复用一个实例；关日记面板即上锁在这里触发整体 lock） */
export function lockSafe(): void {
  getSafeManager().lock();
  notifyUnlockChange();
}

// ===== 附件收集（正文里的 ![[...]] 图片/视频） =====

interface AttachmentInput extends LockAttachmentInput {}

async function collectAttachmentsForContent(content: string, datePath: string): Promise<AttachmentInput[]> {
  const app = getApp();
  // 附件引用：metadataCache.embeds（Obsidian 自带链接信息）为主 + 正则兜底（collectNoteAttachmentPaths）
  const paths = collectNoteAttachmentPaths(app, datePath, content);
  const out: AttachmentInput[] = [];
  for (const p of paths) {
    try {
      const f = app.vault.getAbstractFileByPath(p);
      if (!f) continue;
      const buf = await app.vault.readBinary(f as any);
      // 原始 base64（无预览层精简；还原以原质量为准）——统一分块 util
      out.push({ path: p, kind: kindOf(p), data: bytesToBase64(new Uint8Array(buf)) });
    } catch (e) {
      /* 附件读取失败跳过该附件 */
    }
  }
  return out;
}

// ===== 加密单个条目 =====

/**
 * 把一条普通日记加密移入保险箱。
 * @param entry 要加密的条目（其 tags 会追加 加密 写入块标题）
 * @returns 加密后的 DiaryEntry（encrypted=true）或 null
 */
export async function encryptEntry(entry: DiaryEntry): Promise<DiaryEntry | null> {
  const safe = getSafeManager();
  if (!safe.unlocked) throw new Error('未解锁，无法加密日记');

  const tags = [...new Set([...entry.tags, ENCRYPT_TAG])];
  const emojiSeq = tags.map((t) => getTagEmoji(t)).join('');
  const block = `# ${emojiSeq} ${entry.time}\n${entry.content.trim()}`;
  // 来源文件路径：子目录日期条目用实际路径（D2），缺省顶层 `<日记目录>/<date>.md`
  const datePath = entry.filePath || `${DIARY_DIRECTORY}/${entry.date}.md`;
  const attachments = await collectAttachmentsForContent(entry.content || '', datePath);

  // D9：lockNote 本就返回入库的 SafeNote——不再取 notes[length-1]（耦合「追加在末尾」实现，
  // 并发/插序变化即错链 noteId）
  const note = await safe.lockNote(
    {
      path: datePath,
      title: `${entry.date} · ${entry.time} 日记`,
      kind: 'diary-entry',
      content: block,
      attachments,
    }
  );

  return {
    ...entry,
    tags,
    emoji: emojiSeq,
    encrypted: true,
    noteId: note.id,
  };
}

// ===== 读取全部加密日记 =====

/**
 * 从解锁的保险箱读全部 diary-entry 加密日记 → 解密并解析成 DiaryEntry 列表。
 * 未解锁返回 []（Q21-a 完全不可见）。
 */
export async function loadEncryptedEntries(): Promise<DiaryEntry[]> {
  const safe = getSafeManager();
  if (!safe.unlocked || !safe.manifest) return [];
  const out: DiaryEntry[] = [];
  for (const note of safe.manifest.notes) {
    if (note.kind !== 'diary-entry') continue;
    try {
      const plain = await safe.getDiaryEntryPlain(note.id);
      if (plain === null || plain === undefined) continue;
      // 临时文件名占位：parseFile 需要 dateStr，用它还原 date
      const date = stripMdExt(note.path.split('/').pop() || '');
      const entry = parseDiaryBlock(plain, date, note.id);
      if (entry) out.push(entry);
    } catch (e) {
      /* 单篇解密失败跳过，不阻断其余 */
    }
  }
  return out;
}

/** 把一个 `# emoji HH:mm\n正文` 块解析成 DiaryEntry（带 encrypted/noteId） */
function parseDiaryBlock(block: string, date: string, noteId: string): DiaryEntry | null {
  const lines = block.replace(/\r\n/g, '\n').split('\n');
  const m = lines[0]?.match(/^#\s+(\S+)\s+(\d{2}:\d{2})$/);
  if (!m) return null;
  const emojiSeq = m[1];
  const time = m[2];
  const [h, min] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  // emoji → 标签（复用日记映射；解析不到则保留原始 emoji 序列为标签名？——这里按 emoji 解析）
  const tags = emojiTagsToLabels(emojiSeq);
  const content = lines.slice(1).join('\n').trim();
  return {
    date,
    time,
    timeValue: h * 100 + min,
    tags,
    emoji: emojiSeq,
    content,
    filename: date,
    lineNumber: 0,
    encrypted: true,
    noteId,
    id: `enc-diary-${noteId}`,
  };
}

/** emoji 序列 → 标签名（复用日记 emojiToTagMap；未知 emoji 用「日记」兜底） */
function emojiTagsToLabels(emojiSeq: string): string[] {
  const tags: string[] = [];
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const s of seg.segment(emojiSeq)) {
    const label = emojiToTagMap[s.segment];
    if (label && !tags.includes(label)) tags.push(label);
  }
  if (tags.length === 0) tags.push('日记');
  return tags;
}

// ===== 删除加密条目（永久销毁密文） =====

export async function deleteEncryptedEntry(noteId: string): Promise<void> {
  const safe = getSafeManager();
  if (!safe.unlocked) throw new Error('未解锁');
  await safe.removeNote(noteId);
}

// ===== 降级/改分类（恢复 merge 回原 md，取出即删） =====

/**
 * 还原落点按当前日记目录重算（D9 后半）：加密时固化的是「当时」的日记文件路径，
 * 用户改过日记目录/移动过日期文件后直接还原会 merge 进旧目录（墙读新目录 → 条目凭空消失）。
 * 规则：日期形状合法的 diary-entry，若 note.path 指向的文件已不存在或不在当前日记目录下，
 * 改指当前目录下该日期文件的实际位置（无则顶层默认），并尽力落盘清单。
 */
async function realignRestorePath(noteId: string): Promise<void> {
  const safe = getSafeManager();
  const note = safe.manifest?.notes?.find((n) => n.id === noteId);
  if (!note || note.kind !== 'diary-entry') return;
  const dateStr = stripMdExt(note.path.split('/').pop() || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  let target: string | null = null;
  try {
    const dirPrefix = `${DIARY_DIRECTORY}/`;
    const app = getApp();
    const dateFiles = (app.vault.getMarkdownFiles?.() || [])
      .map((f: { path: string }) => f.path)
      .filter((p: string) => p.startsWith(dirPrefix) && p.endsWith(`/${dateStr}.md`));
    // 优先顶层同名文件（写层新写条目的默认落点），其次目录内已有位置
    target = dateFiles.includes(`${DIARY_DIRECTORY}/${dateStr}.md`)
      ? `${DIARY_DIRECTORY}/${dateStr}.md`
      : dateFiles[0] || `${DIARY_DIRECTORY}/${dateStr}.md`;
  } catch (e) {
    return; // vault 枚举不可用：保持原路径（还原行为同旧版）
  }
  if (target === note.path) return;
  note.path = target;
  try {
    await safe.saveManifest();
  } catch (e) {
    /* 清单落盘失败不阻断还原：内存路径已更新，本次还原落新目录 */
  }
}

/** 构造还原块：以 newTags 重建标题行（丢弃加密，保留 HH:mm 与正文）。
 *  D10：newTags 滤掉「加密」后为空时兜底「日记」——原样保留会把 🔐 写回标题，
 *  条目被墙永久隐藏且已无 noteId 可再解密。 */
async function buildRestoreBlock(noteId: string, newTags?: string[]): Promise<string | null> {
  const plain = await getSafeManager().getDiaryEntryPlain(noteId);
  if (plain === null || plain === undefined) return null;
  const lines = plain.replace(/\r\n/g, '\n').split('\n');
  const m = lines[0]?.match(/^#\s+\S+\s+(\d{2}:\d{2})$/);
  if (!m) return null;
  const kept = (newTags ?? []).filter((t) => t !== ENCRYPT_TAG);
  const seqTags = kept.length > 0 ? kept : ['日记'];
  const newSeq = seqTags.map((t) => getTagEmoji(t)).join('');
  return `# ${newSeq} ${m[1]}${lines.length > 1 ? '\n' + lines.slice(1).join('\n') : ''}`;
}

/**
 * 改分类降级（Q20-a）：加密日记改类型 = 还原 + 以新标签重建标题行。
 * 解密 = 传入去「加密」后的原标签（reclassifyEntry），标题 emoji 不残留 🔐。
 * 调用方负责刷新。
 */
export async function reclassifyEntry(noteId: string, newTags: string[]): Promise<boolean> {
  await realignRestorePath(noteId); // D9：还原目录按当前设置重算
  const block = await buildRestoreBlock(noteId, newTags);
  if (block === null) return false;
  return getSafeManager().restoreDiaryEntry(noteId, block);
}