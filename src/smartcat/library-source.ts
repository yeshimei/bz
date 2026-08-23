/**
 * 书库观察（ticket 081，ADR-0034）——weave-data.json 数据文件监听（smartcat 盲通道 extract 纯函数）。
 * bz 书库 UI 纯只读展示；EPUB 阅读数据全由外部 Weave EPUB Reader 插件落盘 weave-data.json。
 * v2（用户 2026-08-24 追加拍板）：书架增删三态（加入/开始读/移出）、时长带进度、
 * 划线/想法带内容（实测字段：highlight.text = 划线原文、highlight.commentText = 想法/批注，无 quoteText）
 * + index 层 per-book 5 分钟防抖合并。
 * 本模块全部纯函数（无状态）：libraryWeaveDiff 产结构化 diff；index 层消费——书架/时长/读完即时入流，
 * 划线/想法事件走防抖 pending（见 index.ts）；组稿纯函数 buildLibraryNoteText 供结算用。
 * 首次快照（snapshotDomains）调用只记状态不产出（由调用方丢弃返回值实现）。
 */

export interface LibraryBookEvent {
  /** weave books 字典键（书唯一 id；防抖 pending 按它分 key） */
  id: string;
  title: string;
}
export interface LibrarySessionEvent extends LibraryBookEvent {
  /** 新增会话时长向上取整分钟（最小 1） */
  minutes: number;
  /** 当次保存的阅读进度百分比（0-100 整数，1.0 归一 → 100） */
  percent: number;
}
export interface LibraryContentEvent extends LibraryBookEvent {
  /** 新增条目的内容文本（无内容的新增项被过滤；全部为空则该事件不发） */
  texts: string[];
}
/** libraryWeaveDiff 的结构化 diff（各数组均为原始事件；无标题的书不产生事件） */
export interface LibraryWeaveDiff {
  added: LibraryBookEvent[];      // 新书 percent==0 →「你把《X》加入了书架」（即时）
  removed: LibraryBookEvent[];    // 条目消失 →「你把《X》移出了书架」（即时；移除/删除合并，不做文件存在性判断）
  started: LibraryBookEvent[];    // 新书 percent>0 →「你开始读《X》」（即时；读覆盖加入不双发）
  done: LibraryBookEvent[];       // completedTime 首次出现 →「你读完了《X》」（即时）
  sessions: LibrarySessionEvent[]; // 会话新增 →「你读了《X》约 N 分钟（读到 NN%）」（即时，不受防抖限制）
  highlightEvents: LibraryContentEvent[]; // 划重点（内容文本）→ index 层 5 分钟防抖
  excerptEvents: LibraryContentEvent[];   // 写想法（内容文本）→ index 层 5 分钟防抖
}

const PREF = 'lib:';
const HAD_SUFFIX = ':had';

/** prev 键：lib:<bookId>:<k>（had/done 0/1、pct 百分比整数、hl/ex/sess 计数、title 标题存档） */
function libKey(bookId: string, k: string): string {
  return PREF + bookId + ':' + k;
}

/** percent 归一：1.0 → 100（p<=1 视为 0-1 刻度 ×100，p>1 视为 0-100 直接四舍五入；与 items.ts 语义一致） */
export function normalizeWeavePercent(percent: any): number {
  const p = Number(percent);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return p > 1 ? Math.min(100, Math.round(p)) : Math.round(Math.min(1, p) * 100);
}

/**
 * 划线/想法元素内容文本提取（实测 weave 元素字段：highlight.text = 划线原文、
 * highlight.commentText = 想法/批注；无 quoteText）。多级回退取第一个非空 string。
 * preferComment=true：想法（commentText 优先）；false：划线（text 优先）。
 */
function extractItemText(item: any, preferComment: boolean): string {
  if (!item || typeof item !== 'object') return '';
  const fields = preferComment ? ['commentText', 'text', 'quoteText', 'quote'] : ['text', 'quoteText', 'quote', 'commentText'];
  for (const f of fields) {
    const v = typeof item[f] === 'string' ? item[f].trim() : '';
    if (v) return v;
  }
  return '';
}

/** prev 中已记 had=1 的书 id（removed 检测用；title 从 prev 取） */
function knownBookIds(prev: Map<string, string>): string[] {
  const out: string[] = [];
  for (const k of prev.keys()) {
    if (!k.startsWith(PREF) || !k.endsWith(HAD_SUFFIX)) continue;
    const id = k.slice(PREF.length, k.length - HAD_SUFFIX.length);
    if (id) out.push(id);
  }
  return out;
}

/**
 * weave-data.json diff → 结构化原始事件；raw/books 非对象 → null；一次啥都没变 → null。
 * prev 记账：had/done（0/1）、pct（百分比整数）、hl/ex/sess（计数）、title（removed 文案存档）；
 * 条目移出书架时清理该书全部 prev 键（重新加入视为新书）。
 */
export function libraryWeaveDiff(raw: any, prev: Map<string, string>): LibraryWeaveDiff | null {
  if (!raw || typeof raw !== 'object' || !raw.books || typeof raw.books !== 'object') return null;
  const diff: LibraryWeaveDiff = { added: [], removed: [], started: [], done: [], sessions: [], highlightEvents: [], excerptEvents: [] };
  const present = new Set<string>();

  for (const bookId of Object.keys(raw.books)) {
    const book = raw.books[bookId];
    if (!book || typeof book !== 'object') continue;
    present.add(bookId);
    // 标题取 meta.title；无标题的书跳过（不断言，prev 也不记账）
    const title = typeof book?.meta?.title === 'string' ? book.meta.title.trim() : '';
    if (!title) continue;
    const reading = book.reading && typeof book.reading === 'object' ? book.reading : {};
    const notes = book.notes && typeof book.notes === 'object' ? book.notes : {};
    const had = prev.get(libKey(bookId, 'had')) === '1';
    const percent = normalizeWeavePercent(reading?.position?.percent);
    const event: LibraryBookEvent = { id: bookId, title };

    // 1) 书架新条目：percent==0 → 加入书架；percent>0 → 开始读（读覆盖加入，不双发；
    //    旧条目 percent 前进不观察——进度百分比本身不观察）
    if (!had) {
      (percent > 0 ? diff.started : diff.added).push(event);
    }
    prev.set(libKey(bookId, 'had'), '1');

    // 2) 读完了：stats.completedTime 首次出现
    if (reading?.stats?.completedTime) {
      if (prev.get(libKey(bookId, 'done')) !== '1') diff.done.push(event);
      prev.set(libKey(bookId, 'done'), '1');
    } else if (!prev.has(libKey(bookId, 'done'))) {
      prev.set(libKey(bookId, 'done'), '0');
    }

    // 3) 阅读时长：sessions 新增 → 新增各项 durationSeconds 求和 → 向上取整分钟（最小 1，带当次进度）
    const sessions = Array.isArray(reading.sessions) ? reading.sessions : [];
    const prevSess = Number(prev.get(libKey(bookId, 'sess')) || 0);
    if (sessions.length > prevSess) {
      const fresh = sessions.slice(prevSess);
      const total = fresh.reduce((sum: number, s: any) => sum + (Number(s?.durationSeconds) || 0), 0);
      diff.sessions.push({ ...event, minutes: Math.max(1, Math.ceil(total / 60)), percent });
    }
    prev.set(libKey(bookId, 'sess'), String(sessions.length));

    // 4) 划重点：highlights 新增 → 取新增各条划线内容文本（无内容的项过滤；全为空不发该事件）
    const hl = Array.isArray(notes.highlights) ? notes.highlights : [];
    const prevHl = Number(prev.get(libKey(bookId, 'hl')) || 0);
    if (hl.length > prevHl) {
      const texts = hl.slice(prevHl).map((h: any) => extractItemText(h, false)).filter(Boolean);
      if (texts.length) diff.highlightEvents.push({ ...event, texts });
    }
    prev.set(libKey(bookId, 'hl'), String(hl.length));

    // 5) 写想法：excerpts 新增 → 取新增各条想法内容文本（想法 = 批注/评论文本优先）
    const ex = Array.isArray(notes.excerpts) ? notes.excerpts : [];
    const prevEx = Number(prev.get(libKey(bookId, 'ex')) || 0);
    if (ex.length > prevEx) {
      const texts = ex.slice(prevEx).map((e: any) => extractItemText(e, true)).filter(Boolean);
      if (texts.length) diff.excerptEvents.push({ ...event, texts });
    }
    prev.set(libKey(bookId, 'ex'), String(ex.length));

    prev.set(libKey(bookId, 'pct'), String(percent));
    prev.set(libKey(bookId, 'title'), title);
  }

  // 6) 移出书架：prev 中 had 的书在当前 books 中消失 → 统一「移出」（移除/删除合并；
  //    无文件存在性判断、无 vault delete 监听）；清理该书 prev（重新加入视为新书）
  for (const id of knownBookIds(prev)) {
    if (present.has(id)) continue;
    const title = prev.get(libKey(id, 'title')) || '';
    if (title) diff.removed.push({ id, title });
    for (const k of ['had', 'done', 'pct', 'hl', 'ex', 'sess', 'title']) prev.delete(libKey(id, k));
  }

  const any = Object.values(diff).some((a) => a.length > 0);
  return any ? diff : null;
}

/** 别名（v1 命名兼容 + DOMAIN_FILES.library.extract 指向）：结构化 diff 与 libraryWeaveDiff 同函数。 */
export const libraryWeaveExtract = libraryWeaveDiff;

/**
 * 划线/想法 5 分钟窗口结算文案（index 层防抖结算调用）：
 * 只有划线 1 条「你在《X》划了条重点：「c1」」/多条「你在《X》划了 N 条重点：「c1」、「c2」」；
 * 划线+想法用「；」拼接「…；写了条想法：「e1」」；只有想法同理（多条「写了 N 条想法」）。
 * 无内容 → null。
 */
export function buildLibraryNoteText(title: string, highlights: string[], excerpts: string[]): string | null {
  const hs = (highlights || []).map((s: string) => String(s).trim()).filter(Boolean);
  const es = (excerpts || []).map((s: string) => String(s).trim()).filter(Boolean);
  if (!hs.length && !es.length) return null;
  const parts: string[] = [];
  if (hs.length) {
    parts.push(hs.length === 1 ? '划了条重点：「' + hs[0] + '」' : '划了 ' + hs.length + ' 条重点：「' + hs.join('」、「') + '」');
  }
  if (es.length) {
    parts.push(es.length === 1 ? '写了条想法：「' + es[0] + '」' : '写了 ' + es.length + ' 条想法：「' + es.join('」、「') + '」');
  }
  return '你在《' + title + '》' + parts.join('；');
}