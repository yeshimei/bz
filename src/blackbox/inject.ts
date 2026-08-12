/**
 * 来源笔记原位注入（ticket 06，铁律 #1 显式豁免——唯一写来源笔记的动作）：
 * 选中笔记文字录入概念/摘抄时，保存后把来源笔记中选区原文替换为 `[[目标笔记|原文字]]`
 * （恒用别名形式，显示内容仍是原文字；概念目标=概念名，摘抄目标=AI 标题）。
 * 四重守卫（任一命中 → 跳过注入并 toast「选区位于代码块/元数据内，未插入链接」）：
 * 选区与 frontmatter / 代码块（```/~~~）/ 数学块（$$）重叠、选区原文已是 `[[…]]` 包裹。
 * 无选中文字 / 来源笔记已不存在 / 选区读取失败 → 不注入，正常保存（永不拒收）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import type { SelectionSnapshot } from '../core/selection';

/** 守卫命中原因（empty = 无选区/选区越界/空选区，不 toast；其余 toast） */
export type InjectBlockReason = 'frontmatter' | 'code' | 'math' | 'wrapped' | 'empty';

/** 行号 → 字符偏移（\n 计 1；越界钳制到内容末尾） */
export function lineToOffset(content: string, line: number): number {
  const lines = content.split('\n');
  let off = 0;
  for (let i = 0; i < line && i < lines.length; i++) off += lines[i].length + 1;
  return Math.min(off, content.length);
}

/** 选区是否落在闭合栅栏块（```/~~~ 代码、$$ 数学）内 */
function fenceHit(lines: string[], start: number, end: number): 'code' | 'math' | null {
  let fence: 'code' | 'math' | null = null;
  let fenceStart = 0;
  let fenceEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('```') && !t.startsWith('~~~') && !t.startsWith('$$')) continue;
    if (!fence) {
      fence = t.startsWith('$$') ? 'math' : 'code';
      fenceStart = lineToOffset(lines.join('\n'), i);
      fenceEnd = fenceStart + lines[i].length;
    } else {
      const closeOff = lineToOffset(lines.join('\n'), i) + lines[i].length;
      if (start < closeOff && end > fenceStart) return fence; // 与已闭合块重叠
      fence = null;
      fenceEnd = closeOff;
    }
  }
  if (fence && start >= fenceStart) return fence; // 未闭合栅栏（块内未结束）→ 视为块内
  void fenceEnd;
  return null;
}

/**
 * 计算原位注入替换（纯函数）：四重守卫通过 → 返回替换后的全文；任一守卫命中 → 返回原因。
 * targetName：目标笔记名（概念名 / 摘抄 AI 标题）。
 */
export function computeInjection(
  content: string,
  selLine: number,
  selCh: number,
  selEndLine: number,
  selEndCh: number,
  targetName: string
): { ok: true; newContent: string } | { ok: false; reason: InjectBlockReason } {
  if (!content || !targetName || !targetName.trim()) return { ok: false, reason: 'empty' };
  const lines = content.split('\n');
  if (selLine >= lines.length || selEndLine >= lines.length) return { ok: false, reason: 'empty' }; // 选区越界（文件已变）
  const start = lineToOffset(content, selLine) + selCh;
  const end = lineToOffset(content, selEndLine) + selEndCh;
  if (end <= start || start >= content.length || end > content.length) return { ok: false, reason: 'empty' };
  const selected = content.slice(start, end);
  if (!selected.trim()) return { ok: false, reason: 'empty' };
  // 守卫 1：frontmatter 重叠
  const fm = content.match(/^---\n[\s\S]*?\n---/);
  if (fm && start < fm[0].length) return { ok: false, reason: 'frontmatter' };
  // 守卫 2/3：代码块 / 数学块重叠
  const hit = fenceHit(lines, start, end);
  if (hit) return { ok: false, reason: hit };
  // 守卫 4：选区原文已是 [[…]] 包裹（含 [[名|别名 形式）
  const before = content.slice(0, start);
  const after = content.slice(end);
  if (/\[\[[^\[\]]*\|?$/.test(before) && /^[^\[\]]*\]\]/.test(after)) {
    return { ok: false, reason: 'wrapped' };
  }
  const link = `[[${targetName}|${selected}]]`;
  return { ok: true, newContent: content.slice(0, start) + link + content.slice(end) };
}

/**
 * 执行原位注入（vault 写来源笔记，铁律 #1 唯一豁免）。
 * 来源笔记不存在 / 无选区 → 不注入正常保存；守卫命中 → toast 后跳过。
 */
export async function injectIntoSourceNote(
  app: App,
  snap: SelectionSnapshot | null,
  targetName: string
): Promise<{ injected: boolean; blocked?: InjectBlockReason }> {
  if (!snap || !snap.filePath) return { injected: false };
  const f = app.vault.getAbstractFileByPath(snap.filePath);
  if (!f) return { injected: false }; // 来源笔记已不存在 → 不注入，正常保存
  let content = '';
  try {
    content = await app.vault.read(f as any);
  } catch (e) {
    return { injected: false };
  }
  const r = computeInjection(content, snap.line, snap.ch, snap.endLine, snap.endCh, targetName);
  if (!r.ok) {
    if (r.reason !== 'empty') notice('⚠️ 选区位于代码块/元数据内，未插入链接', 'warning');
    return { injected: false, blocked: r.reason };
  }
  try {
    await app.vault.modify(f as any, r.newContent);
    return { injected: true };
  } catch (e) {
    return { injected: false }; // 写失败不阻断录入
  }
}
