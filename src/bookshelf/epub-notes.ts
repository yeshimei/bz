/**
 * 书架墙 EPUB 读书笔记（ADR-0283）：从 bz-reader.json 渲染 划线+想法，按章节分组；
 * 双击跳原文（`obsidian://bz-reader?book=…&cfi=…` 协议），长按编辑想法/删除
 * （直改数据文件，ADR 记录竞态例外）。
 * 迁移自旧 src/library/epub-notes.ts（旧域退役：聚合通道改走本域 data.ts）。
 *
 * 单数据源（v1.39.4，Weave 通道摘除后）：
 *   - 读：readEpubAggregates 已经过 reader-source.ts 归一（`comment` → `commentText`），
 *     本文件不重复处理字段差异；
 *   - 跳转：bz 阅读没有注册 .epub 扩展名处理器，裸 openLinkText 会落到别处或打不开，
 *     所以统一走它自己的协议链接（与其 data/deeplink.ts 同格式）；
 *   - 写：直接写 bz-reader.json，字段名按它的 schema（`comment` / `createdAt`），
 *     并同步同 id 的 excerpt 镜像（它与 highlights 是一对）。
 */
import { enqueueFileTask } from '../core/storage';
import { openExternalUrl } from '../core/utils';
import { openReaderJump, readerJumpUrl } from '../core/reader-link';
import { epubBookIdOf, readEpubAggregates } from './data';
import { resolveReaderDataFilePath } from './reader-source';

export interface EpubBookNote {
  /** 高亮记录引用（notes.highlights 中索引所在项）。 */
  highlight: any;
  text: string;
  comment: string;
  chapterIndex: number;
  chapterTitle: string;
  cfiRange: string;
  createdTime: number;
  /** True = 有「想法」（commentText 非空；bz 阅读归一后同样写进 commentText），用于长按编辑/删除语义。 */
  hasComment: boolean;
}

/** 章节标题兜底。 */
export function resolveChapterLabel(item: any): string {
  const title = typeof item?.chapterTitle === 'string' ? item.chapterTitle.trim() : '';
  if (title) return title;
  const index = typeof item?.chapterIndex === 'number' ? item.chapterIndex : -1;
  return index >= 0 ? `第 ${index + 1} 章` : '未命名章节';
}

/** 按 vaultPath 找书聚合（bz 阅读数据源；无则 null）。
 *  `silent` 供写路径定位用：写入不该因为数据文件损坏而弹告警。 */
export async function findEpubBookByPath(
  app: any,
  vaultPath: string,
  opts?: { silent?: boolean },
): Promise<any | null> {
  const aggregates = await readEpubAggregates(app, opts);
  const normalized = String(vaultPath || '').trim();
  return aggregates.find((aggregate) => String(aggregate?.file?.vaultPath || '').trim() === normalized) || null;
}

/** 读某书的划线列表（notes.highlights），映射为读书笔记条目。
 *  调用方可传入已 findEpubBookByPath 得到的 book，避免重复读取数据文件。 */
export async function loadEpubBookNotes(app: any, vaultPath: string, book?: any): Promise<EpubBookNote[]> {
  const resolved = book ?? (await findEpubBookByPath(app, vaultPath));
  if (!resolved) return [];
  const highlights = Array.isArray(resolved?.notes?.highlights) ? resolved.notes.highlights : [];
  return highlights
    .filter((h: any) => h && typeof h === 'object')
    .map((h: any) => ({
      highlight: h,
      text: typeof h.text === 'string' ? h.text : '',
      // bz 阅读写 comment——readEpubAggregates 归一后这里读到 commentText
      comment: typeof h.commentText === 'string' ? h.commentText : '',
      chapterIndex: typeof h.chapterIndex === 'number' ? h.chapterIndex : 0,
      chapterTitle: resolveChapterLabel(h),
      cfiRange: typeof h.cfiRange === 'string' ? h.cfiRange : '',
      createdTime: typeof h.createdTime === 'number' ? h.createdTime : 0,
      hasComment: typeof h.commentText === 'string' && !!h.commentText.trim(),
    }));
}

/**
 * bz 阅读的位置链接：`obsidian://bz-reader?book=<id>&cfi=…&t=…&c=…`。
 * 拼装与编码走 core `reader-link` 单源（同一串在第二大脑引用卡、知识盒来源也用）；
 * 本函数只决定**哪些参数该传**——章节名是 bz 侧兜底（「第 N 章」）时不传，那不是真章节，
 * 传过去只会让降级搜索更窄。
 */
export function buildReaderJumpUrl(book: any, note: EpubBookNote): string {
  const bookId = String(epubBookIdOf(book) || book?.id || '').trim();
  if (!bookId) return '';
  const chapter = String(note.chapterTitle || '').trim();
  const realChapter = chapter && !/^第 \d+ 章$/.test(chapter) && chapter !== '未命名章节' ? chapter : '';
  return readerJumpUrl(bookId, { cfi: note.cfiRange, text: note.text, chapter: realChapter });
}

/** 打开 `obsidian://` 协议链接：走 core `openExternalUrl` 单源（app.openUrl → electron →
 *  window.open 的兜底链，全链失败有人话提示）。裸 window.open 在移动端对自定义协议不可靠，
 *  失败了也静默——用户只看到弹窗关了、原文没打开。 */
export function openProtocolUrl(app: any, url: string): void {
  openExternalUrl(app, url);
}

/** 打开一条划线的原文位置。返回是否真的打开——调用方据此决定要不要关掉弹窗：
 *  目标为空（脏数据缺 bookId）时关窗就是「对着桌面」。 */
export function openEpubJump(app: any, book: any, note: EpubBookNote): boolean {
  const url = buildReaderJumpUrl(book, note);
  if (!url) return false;
  openProtocolUrl(app, url);
  return true;
}

/**
 * 打开/继续读一本书（书架墙「继续读」与详情弹窗共用）：
 *  `obsidian://bz-reader?book=…`（带当前位置 CFI）。bz 阅读没注册 .epub 扩展名，
 *  没有 bookId 就没法定位——返回 false 让调用方留在原地。
 */
export function openEpubBook(
  app: any,
  item: { epubBookId?: string | null; epubCfi?: string | null },
): boolean {
  const bookId = String(item?.epubBookId || '').trim();
  if (!bookId) return false;
  openReaderJump(app, bookId, { cfi: item.epubCfi });
  return true;
}

// ---------- 直改数据文件（Q16：bz 直接操作数据文件，ADR-0283 记录竞态例外） ----------
// D3 可靠写契约原语 1 收编：「读最新文档 → 就地改动 → 整文件写回」整体入 core per-path 串行队列
// （enqueueFileTask，键 = 目标数据文件路径）——想法编辑与划线删除并发时按序落盘，后写者不再用
// 陈旧基线覆盖先写者。与外部阅读器插件的双写竞态仍按 ADR-0283 例外口径保留（跨插件无法共队列）。

/**
 * 队列内事务（bz 阅读）：`books` 是数组，字段名是 `comment` / `createdAt`。
 *
 * 写盘前把 `book.updatedAt` 与 `book.notesUpdatedAt` 一起推进到当前时刻——bz 阅读的
 * ReaderStore 写盘前会比对磁盘签名并**按时间戳合并**外部修改（store.ts 第 4 条 + A-15）：
 *   - `updatedAt` 决定 progress / meta / 收藏 谁赢（同值取本地）；
 *   - `notes` 单独比 `notesUpdatedAt`（同值取磁盘那份）。
 * 只推 updatedAt 不推 notesUpdatedAt 会留一个丢想法的窗口：bz 阅读刚划了一条线、还没
 * flush（2 秒节流）时到这里改想法，它内存里的 notes 更新（notesUpdatedAt 更大），flush
 * 时「本地 notes 赢」，把这份刚写进去的想法整份顶掉。
 */
async function mutateReaderBook(
  app: any,
  vaultPath: string,
  mutate: (book: any) => boolean
): Promise<boolean> {
  const filePath = await resolveReaderDataFilePath(app);
  return enqueueFileTask(filePath, async () => {
    let document: any;
    try {
      const content = await app.vault.adapter.read(filePath);
      document = JSON.parse(content);
    } catch {
      return false; // 缺失/损坏：不写不建，与本域只读语义一致
    }
    const books = Array.isArray(document?.books) ? document.books : null;
    if (!books) return false;
    const normalized = String(vaultPath || '').trim();
    const book = books.find((b: any) => String(b?.fileRef?.vaultPath || '').trim() === normalized);
    if (!book) return false;
    if (!mutate(book)) return false;
    book.updatedAt = Date.now();
    // 标注单独一条时间线（bz-reader store.ts 的 A-15）：写的是 notes，就得推进它，
    // 否则「bz 阅读刚划线未 flush」时它会以本地 notes 赢回、盖掉刚写进去的想法
    book.notesUpdatedAt = book.updatedAt;
    // bz 阅读写的是单行紧凑 JSON（store.ts JSON.stringify 无缩进）；沿用它的格式，diff 才不会整份翻红
    const content = JSON.stringify(document);
    const f = app?.vault?.getAbstractFileByPath?.(filePath);
    if (f) await app.vault.modify(f, content);
    else await app.vault.adapter.write(filePath, content);
    return true;
  });
}

/** 更新某书某划线的想法；高亮不存在或 highlightId 为空（脏数据）→ false。 */
export async function updateEpubNoteComment(
  app: any,
  vaultPath: string,
  highlightId: string,
  comment: string
): Promise<boolean> {
  // P2：空 id 会与「无 id 高亮」的兜底空串匹配上，误改第一条脏记录
  if (!String(highlightId || '').trim()) return false;
  const normalizedComment = String(comment || '').trim();
  return mutateReaderBook(app, vaultPath, (book) => {
    const highlights = Array.isArray(book?.notes?.highlights) ? book.notes.highlights : null;
    if (!highlights) return false;
    const h = highlights.find((x: any) => String(x?.id || '') === String(highlightId || ''));
    if (!h) return false;
    if (normalizedComment) h.comment = normalizedComment;
    else delete h.comment;
    h.updatedAt = Date.now();
    // 镜像（bz 阅读的 excerpts 与 highlights 同 id）：想法正文在 comment，两处都要跟上
    const excerpts = Array.isArray(book.notes.excerpts) ? book.notes.excerpts : [];
    const mirror = excerpts.find((e: any) => String(e?.id || '') === String(highlightId || ''));
    if (mirror) {
      if (normalizedComment) mirror.comment = normalizedComment;
      else delete mirror.comment;
    }
    return true;
  });
}

/** 删除某书某高亮（整条移除）；不存在或 highlightId 为空（脏数据）→ false。 */
export async function deleteEpubNote(app: any, vaultPath: string, highlightId: string): Promise<boolean> {
  // P2：空 id 在过滤条件里会命中所有「无 id 高亮」（String(h?.id||'') === ''），一次删光脏记录
  if (!String(highlightId || '').trim()) return false;
  return mutateReaderBook(app, vaultPath, (book) => {
    const notes = book?.notes;
    if (!notes) return false;
    const id = String(highlightId || '');
    const highlights = Array.isArray(notes.highlights) ? notes.highlights : [];
    const next = highlights.filter((h: any) => String(h?.id || '') !== id);
    if (next.length === highlights.length) return false;
    notes.highlights = next;
    // 镜像同 id 一起删（bz 阅读 data/notes.ts 的删除也是成对的）
    if (Array.isArray(notes.excerpts)) {
      notes.excerpts = notes.excerpts.filter((e: any) => String(e?.id || '') !== id);
    }
    return true;
  });
}
