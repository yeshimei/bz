/**
 * 书库 notes（ticket 12）：读书笔记解析/跳转/批注更新/删除高亮，源码逐字移植。
 * 源码：书库.js L1010-1275
 */
import { notice } from '../core/dom';

export interface BookNoteNode {
  level: number;
  heading: string | null;
  raw: string | null;
  children: BookNoteNode[];
  highlights: BookHighlight[];
  hasHighlight?: boolean;
}

export interface BookHighlight {
  id: string;
  text: string;
  comment: string | null;
  date: string | null;
  index: number;
  fullTag: string;
  type?: string;
}

export interface ParsedBookNotes {
  bookTitle: string;
  root: BookNoteNode;
}

/** 解析读书笔记：headings + cm-highlight spans 建树 */
export function parseBookNotes(content: string, bookTitle: string): ParsedBookNotes {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: { level: number; text: string; raw: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      raw: match[0].trim(),
      index: match.index,
    });
  }

  const spanRegex = /<span\s+[^>]*class="[^"]*__comment[^"]*cm-highlight[^"]*"[^>]*>(.*?)<\/span>/gs;
  const highlights: BookHighlight[] = [];
  let spanMatch: RegExpExecArray | null;
  while ((spanMatch = spanRegex.exec(content)) !== null) {
    const fullTag = spanMatch[0];
    const innerText = spanMatch[1].trim();
    const idMatch = fullTag.match(/data-id="([^"]*)"/);
    const commentMatch = fullTag.match(/data-comment="([^"]*)"/);
    const dateMatch = fullTag.match(/data-date="([^"]*)"/);
    const id = idMatch ? idMatch[1] : null;
    const comment = commentMatch ? commentMatch[1] : null;
    const date = dateMatch ? dateMatch[1] : null;
    if (id) {
      highlights.push({
        id,
        text: innerText,
        comment,
        date,
        index: spanMatch.index,
        fullTag,
      });
    }
  }

  const root: BookNoteNode = {
    level: 0,
    heading: null,
    raw: null,
    children: [],
    highlights: [],
  };

  if (highlights.length === 0) {
    return { bookTitle, root };
  }

  const events: any[] = [];
  for (const h of headings) {
    events.push({ type: 'heading', ...h });
  }
  for (const hl of highlights) {
    events.push({ type: 'highlight', ...hl });
  }
  events.sort((a, b) => a.index - b.index);

  const stack: BookNoteNode[] = [root];

  for (const ev of events) {
    if (ev.type === 'heading') {
      while (stack.length > 1 && stack[stack.length - 1].level >= ev.level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      const node: BookNoteNode = {
        level: ev.level,
        heading: ev.text,
        raw: ev.raw,
        children: [],
        highlights: [],
      };
      parent.children.push(node);
      stack.push(node);
    } else if (ev.type === 'highlight') {
      if (stack.length > 0) {
        stack[stack.length - 1].highlights.push(ev as BookHighlight);
      }
    }
  }

  function markHasHighlight(node: BookNoteNode): boolean {
    let has = node.highlights.length > 0;
    for (const child of node.children) {
      if (markHasHighlight(child)) has = true;
    }
    node.hasHighlight = has;
    return has;
  }
  markHasHighlight(root);

  return { bookTitle, root };
}

/** 跳转到高亮：openLinkText(path#^id) + 150ms 后编辑器聚焦 */
export function jumpToHighlight(app: any, filePath: string, highlightId: string) {
  const linkText = `${filePath}#^${highlightId}`;
  app.workspace.openLinkText(linkText, '', false);
  // audit I：activeLeaf 已被 API 弃用（obsidian.d.ts @deprecated），改用 getMostRecentLeaf
  // 取最近叶子；聚焦失败只告警，不影响跳转本身
  setTimeout(() => {
    try {
      const leaf = app.workspace.getMostRecentLeaf?.();
      const editor = (leaf?.view as any)?.editor;
      if (editor && typeof editor.focus === 'function') editor.focus();
    } catch (e) {
      console.warn('聚焦编辑器失败:', e);
    }
  }, 150);
}

/** 高亮 span 重写共用：正则匹配 data-id + 原文一致才应用 apply；返回改写结果与是否命中 */
function rewriteHighlightSpan(
  content: string,
  highlightId: string,
  text: string,
  apply: (match: string) => string,
): { next: string; replaced: boolean } {
  const spanRegex = /<span[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/span>/gs;
  let replaced = false;
  const next = content.replace(spanRegex, (match: string, id: string, inner: string) => {
    if (id === highlightId && inner.trim() === text) {
      replaced = true;
      return apply(match);
    }
    return match;
  });
  return { next, replaced };
}

/**
 * 更新批注：命中替换 data-comment，清空删属性。
 * audit D：写盘收口 vault.process 原子读改写——旧 read→modify 全文替换窗口会把
 * bookshelf 等他域并发落盘的 frontmatter 修改静默回滚。
 * audit H：返回 Promise<boolean>（成功 true；文件缺失/未命中/IO 失败 false + notice），
 * 不再静默悬挂编辑弹窗；onDone 保留（成功时回调）兼容既有调用面。
 */
export async function updateComment(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  newComment: string,
  onDone?: () => void
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    notice('文件不存在，编辑批注失败');
    return false;
  }
  // P1-18：newComment 以 HTML 属性值嵌入（data-comment 属性机制不变），双引号转义 &quot;；
  // 替换串一律函数式——字符串形式的 $&、$`、$' 等会被当作替换模式注入。
  const attrValue = newComment.replace(/"/g, '&quot;');
  const applyEdit = (match: string): string => {
    if (newComment === '') {
      return match.replace(/\s+data-comment="[^"]*"/, '');
    }
    if (match.includes('data-comment=')) {
      return match.replace(/(data-comment=")[^"]*(")/, (_m: string, p1: string, p2: string) => `${p1}${attrValue}${p2}`);
    }
    return match.replace(/<span/, () => `<span data-comment="${attrValue}"`);
  };
  try {
    // 先读一次做命中判定：未命中不落盘（保持旧行为——失败路径不触发 modify 事件）
    const content = await app.vault.read(file);
    const { replaced } = rewriteHighlightSpan(content, highlightId, text, applyEdit);
    // 命中与否按「是否处理过目标 span」判定：同值保存全文不变，旧的全文本比对会误报失败
    if (!replaced) {
      notice('未找到对应高亮（原文不匹配），编辑失败');
      return false;
    }
    // 原子读改写：对最新盘上内容重放替换（read→write 窗口不再吃掉他域并发写入）
    await app.vault.process(file, (latest: string) => rewriteHighlightSpan(latest, highlightId, text, applyEdit).next);
    notice(newComment === '' ? '批注已清空' : '批注已更新', 'success');
    if (onDone) onDone();
    return true;
  } catch (e) {
    console.error(`更新批注失败: ${filePath}`, e);
    notice('编辑批注失败，请重试', 'error');
    return false;
  }
}

/**
 * 删除高亮：确认弹窗统一在 UI 层处理（ticket 52）——长按日期先关笔记壳再弹 core/flow-dialog，
 * 由调用方重开壳；此处只负责读改写文件。
 * audit D：写盘收口 vault.process 原子读改写（防他域并发写被旧快照回滚）。
 * audit H：返回 Promise<boolean>（成功 true；失败 false + notice + onDone 仍回调），
 * onDone 在流程结束（成功或失败）时统一回调：UI 层据此重开壳，失败路径不留「壳已关」的死局（B2）。
 */
export async function deleteHighlight(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  onDone?: () => void
): Promise<boolean> {
  const done = () => {
    if (onDone) onDone();
  };
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    done();
    return false;
  }
  try {
    const content = await app.vault.read(file);
    const { replaced } = rewriteHighlightSpan(content, highlightId, text, () => '');
    if (!replaced) {
      notice('未找到对应高亮（原文不匹配），删除失败');
      done(); // 失败也重开壳（B2）
      return false;
    }
    await app.vault.process(file, (latest: string) => rewriteHighlightSpan(latest, highlightId, text, () => '').next);
    notice('已删除', 'success');
    done();
    return true;
  } catch (e) {
    console.error(`删除高亮失败: ${filePath}`, e);
    notice('删除高亮失败，请重试', 'error');
    done(); // 失败也重开壳（B2）
    return false;
  }
}
