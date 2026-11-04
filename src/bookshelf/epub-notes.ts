/**
 * 书架墙 EPUB 读书笔记（ADR-0013 扩展）：从 weave-data.json / bz-reader.json 渲染 划线+想法，
 * 按章节分组；双击跳原文（weave 走 `#weave-cfi=` 深链，bz 阅读走 `obsidian://bz-reader` 协议），
 * 长按编辑想法/删除（直改数据文件，ADR 记录竞态例外）。
 * 迁移自旧 src/library/epub-notes.ts（旧域退役：聚合通道改走本域 data.ts）。
 *
 * 双源分派（2026-11-04，bz 阅读接入）：
 *   - 读：readEpubAggregates 已把 bz-reader.json 归一成 weave 形状（reader-source.ts），
 *     本文件不重复处理字段差异；
 *   - 跳转：浏览器里唯一能把「一条划线」送回原文的路是各自插件的深链——weave 是
 *     `path#weave-cfi=…`（openLinkText），bz 阅读是 `obsidian://bz-reader?book=…&cfi=…`
 *     （它没有注册 .epub 扩展名处理器，裸 openLinkText 会落到 Weave 或打不开）；
 *   - 写：必须写回**这本书所在的源文件**，否则想法会写进一份根本不参与该书记录的 JSON。
 *     源按与读取相同的规则定位（findEpubBookByPath → epubSourceOf），不另立一套判据。
 */
import { enqueueFileTask } from '../core/storage';
import { openExternalUrl } from '../core/utils';
import {
  WEAVE_DATA_FILE, epubSourceOf, readEpubAggregates, resolveWeaveDataPath,
} from './data';
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

/** 按 vaultPath 找书聚合（weave + bz 阅读合并源；无则 null）。
 *  `silent` 供写路径定位用：写入不该因为另一份数据文件损坏而弹告警。 */
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
      // weave 写 commentText，bz 阅读写 comment——readEpubAggregates 归一后两边都有 commentText
      comment: typeof h.commentText === 'string' ? h.commentText : '',
      chapterIndex: typeof h.chapterIndex === 'number' ? h.chapterIndex : 0,
      chapterTitle: resolveChapterLabel(h),
      cfiRange: typeof h.cfiRange === 'string' ? h.cfiRange : '',
      createdTime: typeof h.createdTime === 'number' ? h.createdTime : 0,
      hasComment: typeof h.commentText === 'string' && !!h.commentText.trim(),
    }));
}

/** 构建跳回原文的深链文本（workspace.openLinkText 用；仅 weave 源）。
 *  bz 阅读的书没有 weave 处理器可接：误用时返回空串，交给 epubJumpTargetOf 走协议链接。 */
export function buildEpubJumpLink(book: any, note: EpubBookNote): string {
  if (epubSourceOf(book)?.source === 'reader') return '';
  const vaultPath = String(book?.file?.vaultPath || '').trim();
  if (!vaultPath || !note.cfiRange) return '';
  const sourceId = typeof book?.file?.sourceId === 'string' ? book.file.sourceId : '';
  const chapter = typeof note.chapterIndex === 'number' && Number.isFinite(note.chapterIndex) ? note.chapterIndex : undefined;
  let subpath = `weave-cfi=${encodeCfiForWikilink(note.cfiRange)}`;
  if (chapter !== undefined) subpath += `&chapter=${chapter}`;
  if (sourceId) subpath += `&sid=${encodeURIComponent(sourceId)}`;
  return `${vaultPath}#${subpath}`;
}

/** bz 阅读的协议参数上限（与 bz-reader data/deeplink.ts 的 SNIPPET 一致：20 字足够唯一定位一次） */
const READER_TEXT_SNIPPET = 20;

/**
 * bz 阅读的位置链接：`obsidian://bz-reader?book=<id>&cfi=…&t=…&c=…`。
 * 与 bz-reader 自己的 deeplink.ts 同格式；`t` 是 CFI 失效时它用来在章节里搜的原文片段。
 * 章节名是 bz 侧兜底（「第 N 章」）时不传——那不是真章节，传过去只会让降级搜索更窄。
 */
export function buildReaderJumpUrl(book: any, note: EpubBookNote): string {
  const bookId = String(epubSourceOf(book)?.bookId || book?.id || '').trim();
  if (!bookId) return '';
  const q: string[] = [`book=${encodeURIComponent(bookId)}`];
  if (note.cfiRange) q.push(`cfi=${encodeURIComponent(note.cfiRange)}`);
  const text = String(note.text || '').replace(/\s+/g, ' ').trim().slice(0, READER_TEXT_SNIPPET);
  if (text) q.push(`t=${encodeURIComponent(text)}`);
  const chapter = String(note.chapterTitle || '').trim();
  if (chapter && !/^第 \d+ 章$/.test(chapter) && chapter !== '未命名章节') q.push(`c=${encodeURIComponent(chapter)}`);
  return `obsidian://bz-reader?${q.join('&')}`;
}

/** 跳转目标：wiki 深链（weave）或协议 URL（bz 阅读），由调用方按 kind 选择打开方式 */
export type EpubJumpTarget = { kind: 'wikilink'; value: string } | { kind: 'url'; value: string };

export function epubJumpTargetOf(book: any, note: EpubBookNote): EpubJumpTarget | null {
  if (epubSourceOf(book)?.source === 'reader') {
    const url = buildReaderJumpUrl(book, note);
    return url ? { kind: 'url', value: url } : null;
  }
  const link = buildEpubJumpLink(book, note);
  return link ? { kind: 'wikilink', value: link } : null;
}

/** 打开 `obsidian://` 协议链接：走 core `openExternalUrl` 单源（app.openUrl → electron →
 *  window.open 的兜底链，全链失败有人话提示）。裸 window.open 在移动端对自定义协议不可靠，
 *  失败了也静默——用户只看到弹窗关了、原文没打开。 */
export function openProtocolUrl(app: any, url: string): void {
  openExternalUrl(app, url);
}

/** 打开跳转目标（双击划线 → 落回原文那一句）。返回是否真的打开——调用方据此决定要不要
 *  关掉弹窗：目标为空（bz 书缺 bookId / weave 划线脏数据缺 cfiRange）时关窗就是「对着桌面」。 */
export function openEpubJump(app: any, book: any, note: EpubBookNote): boolean {
  const target = epubJumpTargetOf(book, note);
  if (!target) return false;
  if (target.kind === 'wikilink') {
    app?.workspace?.openLinkText?.(target.value, '', false);
    return true;
  }
  openProtocolUrl(app, target.value);
  return true;
}

/**
 * 打开/继续读一本书（书架墙「继续读」与详情弹窗共用）：
 *   - bz 阅读的书走 `obsidian://bz-reader?book=…`（带当前位置 CFI），它没注册 .epub 扩展名；
 *   - weave 的书沿用 openLinkText（Weave 注册了 epub 处理器，落回上次阅读位置）。
 */
export function openEpubBook(
  app: any,
  item: { epubSource?: string; epubBookId?: string | null; epubCfi?: string | null; epubVaultPath?: string | null },
): boolean {
  if (item?.epubSource === 'reader' && item.epubBookId) {
    const q = [`book=${encodeURIComponent(item.epubBookId)}`];
    if (item.epubCfi) q.push(`cfi=${encodeURIComponent(item.epubCfi)}`);
    openProtocolUrl(app, `obsidian://bz-reader?${q.join('&')}`);
    return true;
  }
  const target = String(item?.epubVaultPath || '').trim();
  if (!target) return false;
  void app?.workspace?.openLinkText?.(target, '', true);
  return true;
}

// ---------- 直改数据文件（Q16：bz 直接操作数据文件，ADR-0013 扩展记录竞态例外） ----------
// D3 可靠写契约原语 1 收编：「读最新文档 → 就地改动 → 整文件写回」整体入 core per-path 串行队列
// （enqueueFileTask，键 = 目标数据文件路径）——想法编辑与划线删除并发时按序落盘，后写者不再用
// 陈旧基线覆盖先写者。与外部阅读器插件的双写竞态仍按 ADR-0013 例外口径保留（跨插件无法共队列）。

function weaveDataFilePath(app: any): string {
  return `${resolveWeaveDataPath(app)}/${WEAVE_DATA_FILE}`;
}

/** 队列内事务：按 vaultPath 定位目标书聚合 → mutate 就地改动（返回 false = 无改动不写盘）→ 整文件写回。 */
async function mutateWeaveBook(
  app: any,
  vaultPath: string,
  mutate: (aggregate: any) => boolean
): Promise<boolean> {
  const filePath = weaveDataFilePath(app);
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
      return false; // 缺失/损坏：不写不建，与 weave 侧「插件不在时零侵入」同语义
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

/** 写入源定位：与读取同一规则（合并后这本书归哪个源），再决定写哪个文件的哪套字段。 */
async function epubSourceForWrite(app: any, vaultPath: string): Promise<'weave' | 'reader'> {
  const book = await findEpubBookByPath(app, vaultPath, { silent: true });
  return epubSourceOf(book)?.source === 'reader' ? 'reader' : 'weave';
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
  if ((await epubSourceForWrite(app, vaultPath)) === 'reader') {
    return mutateReaderBook(app, vaultPath, (book) => {
      const highlights = Array.isArray(book?.notes?.highlights) ? book.notes.highlights : null;
      if (!highlights) return false;
      const h = highlights.find((x: any) => String(x?.id || '') === String(highlightId || ''));
      if (!h) return false;
      if (normalizedComment) h.comment = normalizedComment;
      else delete h.comment;
      h.updatedAt = Date.now();
      // 镜像（bz 阅读的 excerpts 与 highlights 同 id）：Thought 正文在 comment，两处都要跟上
      const excerpts = Array.isArray(book.notes.excerpts) ? book.notes.excerpts : [];
      const mirror = excerpts.find((e: any) => String(e?.id || '') === String(highlightId || ''));
      if (mirror) {
        if (normalizedComment) mirror.comment = normalizedComment;
        else delete mirror.comment;
      }
      return true;
    });
  }
  return mutateWeaveBook(app, vaultPath, (aggregate) => {
    const highlights = aggregate?.notes?.highlights;
    if (!Array.isArray(highlights)) return false;
    const idx = highlights.findIndex((h: any) => String(h?.id || '') === String(highlightId || ''));
    if (idx < 0) return false;
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
  if ((await epubSourceForWrite(app, vaultPath)) === 'reader') {
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
  return mutateWeaveBook(app, vaultPath, (aggregate) => {
    const highlights = aggregate?.notes?.highlights;
    if (!Array.isArray(highlights)) return false;
    const before = highlights.length;
    aggregate.notes.highlights = highlights.filter((h: any) => String(h?.id || '') !== String(highlightId || ''));
    return aggregate.notes.highlights.length !== before;
  });
}
