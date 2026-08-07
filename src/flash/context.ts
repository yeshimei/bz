/**
 * 闪念上下文工具（ticket 18，源码 L768-794 逐字）
 */
import type { Editor } from 'obsidian';

/** 光标所在句（前后找句界，回退上一行末尾 300 字） */
export function getCurrentContext(ed: Editor | null): string {
  if (!ed) return '';
  try {
    const cursor = ed.getCursor();
    const line = ed.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const after = line.slice(cursor.ch);

    // 前句界（往前找最后一个句界符）
    const bMatch = before.match(/[。！？!?\n][^。！？!?\n]*$/);
    const ctxBefore = bMatch ? bMatch[0].replace(/^[。！？!?\n]/, '') : before;

    // 后句界（往后找第一个句界符）
    const aMatch = after.match(/^[^。！？!?\n]*[。！？!?\n]/);
    const ctxAfter = aMatch ? aMatch[0].replace(/[。！？!?\n]$/, '') : after;

    let ctx = (ctxBefore + ctxAfter).trim();
    if (ctx.length < 2 && cursor.line > 0) {
      // 回退上一行末尾 300 字
      const prevLine = ed.getLine(cursor.line - 1);
      ctx = prevLine.slice(-300);
    }
    return ctx;
  } catch {
    return '';
  }
}
