/**
 * 书库 EPUB 读书笔记（ADR-0013 扩展）：从 weave-data.json 直接渲染 划线+想法，按章节分组；
 * 双击跳原文（weave-cfi 深链），长按编辑想法/删除（bz 直改 weave-data.json，ADR 记录竞态例外）。
 */
import { notice } from '../core/dom';
import { deriveBookSettings, DEFAULT_WEAVE_DATA_FILE, normalizeWeaveDataPath, readWeaveDataAggregates } from './items';

export interface EpubBookNote {
  /** 高亮记录引用（notes.highlights 中索引所在项）。 */
  highlight: any;
  text: string;
  comment: string;
  chapterIndex: number;
  chapterTitle: string;
  cfiRange: string;
  createdTime: number;
  /** True = 有「想法」（commentText 非空），用于长按编辑/删除语义。 */
  hasComment: boolean;
}

/** 深链 cfi 编码（与 Weave EpubLinkService.encodeCfiForWikilink 对齐）。 */
export function encodeCfiForWikilink(cfi: string): string {
  return String(cfi || '')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\|/g, '%7C');
}

/** 章节标题兜底。 */
export function resolveChapterLabel(item: any): string {
  const title = typeof item?.chapterTitle === 'string' ? item.chapterTitle.trim() : '';
  if (title) return title;
  const index = typeof item?.chapterIndex === 'number' ? item.chapterIndex : -1;
  return index >= 0 ? `第 ${index + 1} 章` : '未命名章节';
}

/** 按 vaultPath 找书聚合（无则 null）。 */
export async function findWeaveBookByPath(app: any, vaultPath: string): Promise<any | null> {
  const aggregates = await readWeaveDataAggregates(app);
  const normalized = String(vaultPath || '').trim();
  return aggregates.find((aggregate) => String(aggregate?.file?.vaultPath || '').trim() === normalized) || null;
}

/** 读某书的划线列表（notes.highlights），映射为读书笔记条目。
 *  调用方可传入已 findWeaveBookByPath 得到的 book，避免重复读取 weave-data.json。 */
export async function loadEpubBookNotes(app: any, vaultPath: string, book?: any): Promise<EpubBookNote[]> {
  const resolved = book ?? (await findWeaveBookByPath(app, vaultPath));
  if (!resolved) return [];
  const highlights = Array.isArray(resolved?.notes?.highlights) ? resolved.notes.highlights : [];
  return highlights
    .filter((h: any) => h && typeof h === 'object')
    .map((h: any) => ({
      highlight: h,
      text: typeof h.text === 'string' ? h.text : '',
      comment: typeof h.commentText === 'string' ? h.commentText : '',
      chapterIndex: typeof h.chapterIndex === 'number' ? h.chapterIndex : 0,
      chapterTitle: resolveChapterLabel(h),
      cfiRange: typeof h.cfiRange === 'string' ? h.cfiRange : '',
      createdTime: typeof h.createdTime === 'number' ? h.createdTime : 0,
      hasComment: typeof h.commentText === 'string' && !!h.commentText.trim(),
    }));
}

/** 构建跳回原文的深链文本（workspace.openLinkText 用）。 */
export function buildEpubJumpLink(book: any, note: EpubBookNote): string {
  const vaultPath = String(book?.file?.vaultPath || '').trim();
  if (!vaultPath || !note.cfiRange) return '';
  const sourceId = typeof book?.file?.sourceId === 'string' ? book.file.sourceId : '';
  const chapter = typeof note.chapterIndex === 'number' && Number.isFinite(note.chapterIndex) ? note.chapterIndex : undefined;
  let subpath = `weave-cfi=${encodeCfiForWikilink(note.cfiRange)}`;
  if (chapter !== undefined) subpath += `&chapter=${chapter}`;
  if (sourceId) subpath += `&sid=${encodeURIComponent(sourceId)}`;
  return `${vaultPath}#${subpath}`;
}

// ---------- 直改 weave-data.json（Q16：bz 直接操作数据文件，ADR-0013 扩展记录竞态例外） ----------

function weavDataFilePath(): string {
  const settings = deriveBookSettings();
  return `${normalizeWeaveDataPath(settings.weaveDataPath)}/weave-data.json`;
}

/** 读最新 weave-data.json 文档结构（原始对象，勿直接改动缓存）。 */
async function readWeaveDocument(app: any): Promise<any> {
  const filePath = weavDataFilePath();
  const file = app?.vault?.getAbstractFileByPath?.(filePath);
  if (!file) throw new Error('weave-data.json 不存在');
  const content = await app.vault.adapter.read(filePath);
  return JSON.parse(content);
}

/** 写回 weave-data.json（整文件；沿用 vault 写入语义）。 */
async function writeWeaveDocument(app: any, document: any): Promise<void> {
  const filePath = weavDataFilePath();
  const content = JSON.stringify(document, null, 2);
  const file = app?.vault?.getAbstractFileByPath?.(filePath);
  if (file) await app.vault.modify(file, content);
  else await app.vault.create(filePath, content);
}

/** 找到目标书所在聚合；不存在返回 null。 */
async function findWeaveBookWithMutation(app: any, vaultPath: string): Promise<any | null> {
  let document: any;
  try {
    document = await readWeaveDocument(app);
  } catch {
    return null;
  }
  const books = document?.books;
  if (!books || typeof books !== 'object') return null;
  const normalized = String(vaultPath || '').trim();
  for (const aggregate of Object.values(books) as any[]) {
    if (String(aggregate?.file?.vaultPath || '').trim() === normalized) {
      return { document, aggregate };
    }
  }
  return null;
}

/** 更新某书某划线的想法（commentText）；高亮不存在 → false。 */
export async function updateEpubNoteComment(
  app: any,
  vaultPath: string,
  highlightId: string,
  comment: string
): Promise<boolean> {
  const target = await findWeaveBookWithMutation(app, vaultPath);
  if (!target) return false;
  const { document, aggregate } = target;
  const highlights = aggregate?.notes?.highlights;
  if (!Array.isArray(highlights)) return false;
  const idx = highlights.findIndex((h: any) => String(h?.id || '') === String(highlightId || ''));
  if (idx < 0) return false;
  const normalizedComment = String(comment || '').trim();
  const next = { ...highlights[idx] };
  if (normalizedComment) {
    next.commentText = normalizedComment;
  } else {
    delete next.commentText;
  }
  next.hasCommentDivider = !!normalizedComment;
  highlights[idx] = next;
  await writeWeaveDocument(app, document);
  return true;
}

/** 删除某书某高亮（整条移除）；不存在 → false。 */
export async function deleteEpubNote(app: any, vaultPath: string, highlightId: string): Promise<boolean> {
  const target = await findWeaveBookWithMutation(app, vaultPath);
  if (!target) return false;
  const { document, aggregate } = target;
  const highlights = aggregate?.notes?.highlights;
  if (!Array.isArray(highlights)) return false;
  const before = highlights.length;
  aggregate.notes.highlights = highlights.filter((h: any) => String(h?.id || '') !== String(highlightId || ''));
  if (aggregate.notes.highlights.length === before) return false;
  await writeWeaveDocument(app, document);
  return true;
}
