/**
 * 第二大脑上下文工具（ticket 103；对齐 QA 闪念.js L768-794）
 * - 句界集含中文分号/半角分号/省略号：[。！？!?；;…\n]（旧版缺这三者）；
 * - **空白行不再回退上一行**（issue 428）：旧版「当前行整行空白 → 取上一行尾 300 字」会让
 *   光标停在空行时触发一次查询（用户报「放到空行里面它也会进行一个查询」）。空行 = 无上下文，
 *   返回空串；调用方（参考面板/移动面板）据此短路——面板保持现状，不发新查询；
 * - 命中句含收尾句界符（end=i+1，与 QA 一致）；
 * - 保留 null 守卫与 try/catch（bz 防御性改进，QA 无）。
 */
import type { Editor } from 'obsidian';

export function getCurrentContext(ed: Editor | null): string {
  if (!ed) return '';
  try {
    const cursor = ed.getCursor();
    const line = ed.getLine(cursor.line);
    if (!line || line.trim().length === 0) return '';
    const fullText = line;
    const cursorPos = cursor.ch;
    const sentenceBreaks = /[。！？!?；;…\n]/;
    let start = 0;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (sentenceBreaks.test(fullText[i])) {
        start = i + 1;
        break;
      }
    }
    let end = fullText.length;
    for (let i = cursorPos; i < fullText.length; i++) {
      if (sentenceBreaks.test(fullText[i])) {
        end = i + 1;
        break;
      }
    }
    let sentence = fullText.substring(start, end).trim();
    if (!sentence) sentence = fullText.trim();
    return sentence;
  } catch {
    return '';
  }
}
