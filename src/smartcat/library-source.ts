/**
 * 书库观察（ticket 081，ADR-0034）——weave-data.json 数据文件监听（smartcat 盲通道 extract 纯函数）。
 * bz 书库 UI 纯只读展示；EPUB 阅读数据全由外部 Weave EPUB Reader 插件落盘 weave-data.json，
 * 本模块 diff 各书阅读状态产观察：开始读 / 读完了 / 划重点 / 写想法 / 阅读时长。
 * prev 按 bookId 记账（lib:<id>:started/done/hl/ex/sess）；一次保存可含多个变化，各产一条（数组）。
 * 首次快照（snapshotDomains）调用本函数只记状态不产观察（由调用方丢弃返回值实现）。
 */

/** prev 键：lib:<bookId>:<k>（started 0/1、done 0/1、hl/ex/sess 计数） */
function libKey(bookId: string, k: string): string {
  return 'lib:' + bookId + ':' + k;
}

/**
 * weave-data.json diff → 观察文本数组（可多条）；raw/books 非对象 → null；一次啥都没变 → null。
 * 单本书产出顺序：开始读 / 读完了 / 划重点 / 想法 / 时长（同次保存多事件可都产）。
 */
export function libraryWeaveExtract(raw: any, prev: Map<string, string>): string | null | string[] {
  if (!raw || typeof raw !== 'object' || !raw.books || typeof raw.books !== 'object') return null;
  const out: string[] = [];
  for (const bookId of Object.keys(raw.books)) {
    const book = raw.books[bookId];
    if (!book || typeof book !== 'object') continue;
    // 标题取 meta.title；无标题的书跳过（不断言，也不记 prev）
    const title = typeof book?.meta?.title === 'string' ? book.meta.title.trim() : '';
    if (!title) continue;
    const reading = book.reading && typeof book.reading === 'object' ? book.reading : {};
    const notes = book.notes && typeof book.notes === 'object' ? book.notes : {};

    // 1) 开始读：percent > 0 首次出现（进度百分比本身不观察，避免高频）
    const percent = Number(reading?.position?.percent) || 0;
    if (percent > 0) {
      if (prev.get(libKey(bookId, 'started')) !== '1') out.push('你开始读《' + title + '》');
      prev.set(libKey(bookId, 'started'), '1');
    } else if (!prev.has(libKey(bookId, 'started'))) {
      prev.set(libKey(bookId, 'started'), '0');
    }

    // 2) 读完了：stats.completedTime 首次出现
    if (reading?.stats?.completedTime) {
      if (prev.get(libKey(bookId, 'done')) !== '1') out.push('你读完了《' + title + '》');
      prev.set(libKey(bookId, 'done'), '1');
    } else if (!prev.has(libKey(bookId, 'done'))) {
      prev.set(libKey(bookId, 'done'), '0');
    }

    // 3) 划重点：notes.highlights 计数增长 n 条
    const hl = Array.isArray(notes.highlights) ? notes.highlights.length : 0;
    const prevHl = Number(prev.get(libKey(bookId, 'hl')) || 0);
    if (hl > prevHl) {
      const n = hl - prevHl;
      out.push(n === 1 ? '你在《' + title + '》划了条重点' : '你在《' + title + '》划了 ' + n + ' 条重点');
    }
    prev.set(libKey(bookId, 'hl'), String(hl));

    // 4) 写想法：notes.excerpts 计数增长 n 条
    const ex = Array.isArray(notes.excerpts) ? notes.excerpts.length : 0;
    const prevEx = Number(prev.get(libKey(bookId, 'ex')) || 0);
    if (ex > prevEx) {
      const n = ex - prevEx;
      out.push(n === 1 ? '你在《' + title + '》写了条想法' : '你在《' + title + '》写了 ' + n + ' 条想法');
    }
    prev.set(libKey(bookId, 'ex'), String(ex));

    // 5) 阅读时长：sessions 新增 → 新增各项 durationSeconds 求和 → 向上取整分钟（最小 1）
    const sessions = Array.isArray(reading.sessions) ? reading.sessions : [];
    const prevSess = Number(prev.get(libKey(bookId, 'sess')) || 0);
    if (sessions.length > prevSess) {
      const fresh = sessions.slice(prevSess);
      const total = fresh.reduce((sum: number, s: any) => sum + (Number(s?.durationSeconds) || 0), 0);
      const mins = Math.max(1, Math.ceil(total / 60));
      out.push('你读了《' + title + '》约 ' + mins + ' 分钟');
    }
    prev.set(libKey(bookId, 'sess'), String(sessions.length));
  }
  return out.length ? out : null;
}