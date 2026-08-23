/**
 * 书库观察（ticket 081，ADR-0034）——weave-data.json 数据文件监听（smartcat 盲通道 extract 纯函数）。
 * bz 书库 UI 纯只读展示；EPUB 阅读数据全由外部 Weave EPUB Reader 插件落盘 weave-data.json。
 * v2（用户 2026-08-24 追加拍板）：书架增删三态（加入/开始读/移出）、时长带进度、
 * 划线/想法带内容（实测字段：highlight.text = 划线原文、highlight.commentText = 想法/批注，无 quoteText）
 * + index 层 per-book 5 分钟防抖合并。
 * v3（ticket 084c A4）：hl/ex 由 length 计数游标改**内容指纹记账**——prev 存「已见指纹集合」
 * （每条文氏 text+commentText 指纹；集合 join 成一串存 Map<string,string> 契约）而非计数。
 * bz deleteEpubNote 删划线直改 weave-data → 删除只缩小集合不影响判新增：再新增只发新内容，
 * 同内容划两条只产一次（防旧内容重发）。
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

/** prev 键：lib:<bookId>:<k>（had/done 0/1、pct 百分比整数、hl/ex 已见指纹集合串、sess 计数、title 标题存档） */
function libKey(bookId: string, k: string): string {
  return PREF + bookId + ':' + k;
}

/** 指纹内部分隔符（text 与 commentText 拼接，控制字符防与正文冲突） */
const FP_INNER_SEP = '\u0001';
/** 指纹集合 → prev 字符串的分隔符（集合元素 join 成一串） */
const FP_SET_SEP = '\u0002';

/**
 * 划线/想法条目内容指纹（A4）：text+commentText 原文 trim 后拼接。同内容（同 text 同 commentText）
 * 指纹相同 → 已见集合去重，「划两条同内容」只产一次；删除只把条目移出，已见指纹保留 → 再新增只发新指纹。
 */
function itemFingerprint(item: any): string {
  if (!item || typeof item !== 'object') return '';
  const text = typeof item.text === 'string' ? item.text.trim() : '';
  const comment = typeof item.commentText === 'string' ? item.commentText.trim() : '';
  return text + FP_INNER_SEP + comment;
}

/** prev 字符串 → 已见指纹集合（''/undefined → 空集合） */
function seenFingerprints(value: string | undefined): Set<string> {
  const seen = new Set<string>();
  if (!value) return seen;
  for (const fp of value.split(FP_SET_SEP)) if (fp) seen.add(fp);
  return seen;
}

/** 已见指纹集合 → prev 字符串（排序 join：同集合恒等串，删条目不改变其余指纹的串） */
function fingerprintValue(seen: Set<string>): string {
  return [...seen].sort().join(FP_SET_SEP);
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
 * prev 记账：had/done（0/1）、pct（百分比整数）、hl/ex（已见指纹集合串，A4）、sess（计数）、title（removed 文案存档）；
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

    // 4) 划重点：highlights 新增 → 按内容指纹记账（A4，ticket 084c）：新增 = 现在条目指纹不在
    //    prev 已见集合者（删除不影响判新增）；同内容（text+commentText 同）划多条只产一次；
    //    无内容的项跳过（不记账不产）；提取内容文本（无内容的项过滤；全为空不发该事件）
    const hl = Array.isArray(notes.highlights) ? notes.highlights : [];
    const seenHl = seenFingerprints(prev.get(libKey(bookId, 'hl')));
    const hlFresh: string[] = [];
    for (const h of hl) {
      const fp = itemFingerprint(h);
      if (!fp || seenHl.has(fp)) continue;
      seenHl.add(fp);
      const t = extractItemText(h, false);
      if (t) hlFresh.push(t);
    }
    if (hlFresh.length) diff.highlightEvents.push({ ...event, texts: hlFresh });
    prev.set(libKey(bookId, 'hl'), fingerprintValue(seenHl));

    // 5) 写想法：excerpts 新增 → 同上指纹记账（想法 = 批注/评论文本优先）
    const ex = Array.isArray(notes.excerpts) ? notes.excerpts : [];
    const seenEx = seenFingerprints(prev.get(libKey(bookId, 'ex')));
    const exFresh: string[] = [];
    for (const e of ex) {
      const fp = itemFingerprint(e);
      if (!fp || seenEx.has(fp)) continue;
      seenEx.add(fp);
      const t = extractItemText(e, true);
      if (t) exFresh.push(t);
    }
    if (exFresh.length) diff.excerptEvents.push({ ...event, texts: exFresh });
    prev.set(libKey(bookId, 'ex'), fingerprintValue(seenEx));

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