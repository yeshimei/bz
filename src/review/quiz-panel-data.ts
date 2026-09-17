/**
 * 做题练习独立面板 · 数据层（issue 362）
 *
 * 范围解析与选题口径：
 * - 全部 = 整库 md（环境目录子树剪枝，同 core/path-picker 选择器口径 isExcludedPath）；
 * - 按文件夹 = 目录递归展开（'' = 库根目录 → 全部）；
 * - 单篇 = 精确路径。
 * - 本轮题量 = 按笔记 round-robin 交错抽取后截断（batch ≤ 0 = 不限）——短批量不集中在
 *   个别笔记，逐篇都能刷到。
 *
 * 只消费题库数据结构（QuizManager.loadQuiz 的 {notes} 形状），不触引擎会话状态；
 * 出题生成经 quizUI.ensureQuestions（引擎既有批量链路，面板侧按批循环），见 quiz-panel.ts。
 */
import type { App } from 'obsidian';
import { isExcludedPath } from '../core/path-picker';
import type { QuizQuestion } from './quiz-core/manager';

/** 整库笔记清单（md；环境目录子树剪枝；路径升序稳定输出） */
export function listVaultNotes(app: App): string[] {
  const files: Array<{ path?: string }> = (app?.vault as any)?.getMarkdownFiles?.() || [];
  const out: string[] = [];
  for (const f of files) {
    const p = String(f?.path || '');
    if (!p.endsWith('.md') || isExcludedPath(p)) continue;
    out.push(p);
  }
  return out.sort();
}

/** 目录清单递归展开为笔记路径（'' = 库根目录 → 全部；去重升序） */
export function notesInFolders(app: App, folders: string[]): string[] {
  const all = listVaultNotes(app);
  if (folders.includes('')) return all;
  const picked = new Set<string>();
  for (const p of all) {
    for (const dir of folders) {
      if (p.startsWith(dir + '/')) {
        picked.add(p);
        break;
      }
    }
  }
  return [...picked].sort();
}

/** 按范围解析笔记路径清单（scope = all 整库 / folder 目录展开 / note 单篇）。
 *  单篇校验存在性（审查修复）：手输路径不存在（被移动/改名/拼错）→ 返回空清单，
 *  由面板给人话提示，不再拿幽灵路径去出题误导。 */
export function resolveScopeNotes(
  app: App,
  scope: 'all' | 'folder' | 'note',
  folders: string[],
  notePath: string
): string[] {
  if (scope === 'folder') return notesInFolders(app, folders);
  if (scope === 'note') {
    return notePath && app?.vault?.getAbstractFileByPath?.(notePath) ? [notePath] : [];
  }
  return listVaultNotes(app);
}

/**
 * 读取范围内现有题目（只读题库，不触生成；带 notePath 供会话答对出库定位）。
 * 审查修复：题库整本由调用方循环外 loadQuiz 一次传入（原先逐篇 getQuestionsForNote
 * 是 O(N) 次读文件——「全部」范围整库逐篇读盘）。bank = QuizManager.loadQuiz 返回结构。
 */
export async function collectQuestionsForNotes(
  bank: { notes?: Record<string, QuizQuestion[]> | undefined } | null,
  paths: string[]
): Promise<QuizQuestion[]> {
  const notes = bank?.notes || {};
  const out: QuizQuestion[] = [];
  for (const p of paths) {
    const qs = notes[p];
    if (!qs || !qs.length) continue;
    for (const q of qs) out.push({ ...q, notePath: p });
  }
  return out;
}

/** 交错选题 + 截断：按笔记 round-robin 轮流抽题（batch ≤ 0 = 不限），结果保相对次序 */
export function pickRoundQuestions(all: QuizQuestion[], batch: number): QuizQuestion[] {
  const pools = new Map<string, QuizQuestion[]>();
  for (const q of all) {
    const key = q.notePath || '';
    const pool = pools.get(key);
    if (pool) pool.push(q);
    else pools.set(key, [q]);
  }
  const out: QuizQuestion[] = [];
  const capped = batch > 0;
  while (pools.size) {
    let took = false;
    for (const [key, pool] of pools) {
      const q = pool.shift();
      if (!q) {
        pools.delete(key);
        continue;
      }
      took = true;
      out.push(q);
      if (capped && out.length >= batch) return out;
    }
    if (!took) break;
  }
  return out;
}
