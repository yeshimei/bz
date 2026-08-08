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
  setTimeout(() => {
    const leaf = app.workspace.activeLeaf;
    if (leaf && leaf.view && leaf.view.editor) {
      leaf.view.editor.focus();
    }
  }, 150);
}

/** 更新批注：正则匹配 data-id + 原文一致才替换；清空删属性 */
export function updateComment(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  newComment: string,
  onDone?: () => void
) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return;

  app.vault.read(file).then((content: string) => {
    const spanRegex = /<span[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/span>/gs;
    let newContent = content.replace(spanRegex, (match: string, id: string, inner: string) => {
      if (id === highlightId && inner.trim() === text) {
        if (newComment === '') {
          return match.replace(/\s+data-comment="[^"]*"/, '');
        } else {
          if (match.includes('data-comment=')) {
            return match.replace(/(data-comment=")[^"]*(")/, `$1${newComment}$2`);
          } else {
            return match.replace(/<span/, `<span data-comment="${newComment}"`);
          }
        }
      }
      return match;
    });

    if (newContent === content) {
      notice('未找到对应高亮（原文不匹配），编辑失败');
      return;
    }
    app.vault.modify(file, newContent).then(() => {
      notice(newComment === '' ? '✅ 批注已清空' : '✅ 批注已更新');
      if (onDone) onDone();
    });
  });
}

/** 删除高亮：原生 window.confirm（源码语义） */
export function deleteHighlight(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  onDone?: () => void
) {
  if (!window.confirm('确定要删除该高亮及其批注吗？')) return;

  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return;

  app.vault.read(file).then((content: string) => {
    const spanRegex = /<span[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/span>/gs;
    let newContent = content.replace(spanRegex, (match: string, id: string, inner: string) => {
      if (id === highlightId && inner.trim() === text) {
        return '';
      }
      return match;
    });

    if (newContent === content) {
      notice('未找到对应高亮（原文不匹配），删除失败');
      return;
    }
    app.vault.modify(file, newContent).then(() => {
      notice('✅ 已删除');
      if (onDone) onDone();
    });
  });
}
