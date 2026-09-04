/**
 * 书架墙 EPUB 读书笔记（ADR-0013 扩展）：从 weave-data.json 直接渲染 划线+想法，按章节分组；
 * 双击跳原文（weave-cfi 深链），长按编辑想法/删除（bz 直改 weave-data.json，ADR 记录竞态例外）。
 * 迁移自旧 src/library/epub-notes.ts（旧域退役：weave 聚合通道改走本域 data.ts）。
 */
import { enqueueFileTask } from '../core/storage';
import { WEAVE_DATA_FILE, readWeaveAggregates, resolveWeaveDataPath } from './data';

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
  const aggregates = await readWeaveAggregates(app);
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

/**
 * 继续读深链：weave-data.json reading.position.cfi（Weave 进度契约 { chapterIndex, cfi, percent }）
 * → `path#weave-cfi=…&chapter=…&sid=…`，跳当前阅读位置（编码函数本域自带，不引用已删 library）。
 * 无聚合/无 cfi 返回 ''（调用方回落直接打开 vaultPath，Weave 自行恢复上次位置）。
 */
export async function buildEpubResumeLink(app: any, vaultPath: string): Promise<string> {
  const path = String(vaultPath || '').trim();
  if (!path) return '';
  const book = await findWeaveBookByPath(app, path);
  const position = book?.reading?.position;
  const cfi = typeof position?.cfi === 'string' ? position.cfi.trim() : '';
  if (!cfi) return '';
  const chapter = typeof position?.chapterIndex === 'number' && Number.isFinite(position.chapterIndex)
    ? position.chapterIndex
    : undefined;
  const sourceId = typeof book?.file?.sourceId === 'string' ? book.file.sourceId : '';
  let subpath = `weave-cfi=${encodeCfiForWikilink(cfi)}`;
  if (chapter !== undefined) subpath += `&chapter=${chapter}`;
  if (sourceId) subpath += `&sid=${encodeURIComponent(sourceId)}`;
  return `${path}#${subpath}`;
}

// ---------- 直改 weave-data.json（Q16：bz 直接操作数据文件，ADR-0013 扩展记录竞态例外） ----------
// D3 可靠写契约原语 1 收编：「读最新文档 → 就地改动 → 整文件写回」整体入 core per-path 串行队列
// （enqueueFileTask，键 = weave-data.json 路径）——想法编辑与划线删除并发时按序落盘，后写者不再用
// 陈旧基线覆盖先写者。与 Weave 插件的双写竞态仍按 ADR-0013 例外口径保留（跨插件无法共队列）。

function weavDataFilePath(app: any): string {
  return `${resolveWeaveDataPath(app)}/${WEAVE_DATA_FILE}`;
}

/** 队列内事务：按 vaultPath 定位目标书聚合 → mutate 就地改动（返回 false = 无改动不写盘）→ 整文件写回。 */
async function mutateWeaveBook(
  app: any,
  vaultPath: string,
  mutate: (aggregate: any) => boolean
): Promise<boolean> {
  const filePath = weavDataFilePath(app);
  return enqueueFileTask(filePath, async () => {
    // 读最新文档（缺失/损坏 → 不写不建文件，保持「weave 不在时零侵入」语义）
    let document: any;
    try {
      const file = app?.vault?.getAbstractFileByPath?.(filePath);
      if (!file) return false;
      const content = await app.vault.adapter.read(filePath);
      document = JSON.parse(content);
    } catch {
      return false;
    }
    const books = document?.books;
    if (!books || typeof books !== 'object') return false;
    const normalized = String(vaultPath || '').trim();
    let aggregate: any = null;
    for (const agg of Object.values(books) as any[]) {
      if (String(agg?.file?.vaultPath || '').trim() === normalized) {
        aggregate = agg;
        break;
      }
    }
    if (!aggregate) return false;
    if (!mutate(aggregate)) return false;
    // 写回整文件（沿用 vault 写入语义；JSON 序列化格式 2 空格缩进不变）
    const content = JSON.stringify(document, null, 2);
    const f = app?.vault?.getAbstractFileByPath?.(filePath);
    if (f) await app.vault.modify(f, content);
    else await app.vault.create(filePath, content);
    return true;
  });
}

/** 更新某书某划线的想法（commentText）；高亮不存在或 highlightId 为空（脏数据）→ false。 */
export async function updateEpubNoteComment(
  app: any,
  vaultPath: string,
  highlightId: string,
  comment: string
): Promise<boolean> {
  // P2：空 id 会与「无 id 高亮」的兜底空串匹配上，误改第一条脏记录
  if (!String(highlightId || '').trim()) return false;
  return mutateWeaveBook(app, vaultPath, (aggregate) => {
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
    return true;
  });
}

/** 删除某书某高亮（整条移除）；不存在或 highlightId 为空（脏数据）→ false。 */
export async function deleteEpubNote(app: any, vaultPath: string, highlightId: string): Promise<boolean> {
  // P2：空 id 在过滤条件里会命中所有「无 id 高亮」（String(h?.id||'') === ''），一次删光脏记录
  if (!String(highlightId || '').trim()) return false;
  return mutateWeaveBook(app, vaultPath, (aggregate) => {
    const highlights = aggregate?.notes?.highlights;
    if (!Array.isArray(highlights)) return false;
    const before = highlights.length;
    aggregate.notes.highlights = highlights.filter((h: any) => String(h?.id || '') !== String(highlightId || ''));
    return aggregate.notes.highlights.length !== before;
  });
}
