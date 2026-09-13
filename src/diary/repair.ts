/**
 * 日记格式体检引擎（ADR-0130 重定义；原 ticket 121 行修复引擎随条目文件化退役）。
 * 只读扫描、不修任何内容——条目文件化后没有「头行可修」，问题清单供用户点击跳转手工处理。
 *
 * 三类体检项（口径从严，与运行时宽降级互补）：
 * - legacy：旧格式日期文件（`YYYY-MM-DD.md`）仍留在日记目录（未迁移/误归档）；
 * - unparsable：文件名非条目形状或日期非法，且 frontmatter `日期` 缺失/损坏——运行时该文件
 *   不会出现在墙上（parseEntryFile 返回 null）；若文件名合法仅属性损坏，运行时已按文件名
 *   降级加载，但属性与文件名双轨不一致仍是隐患，体检从严上报；
 * - name-mismatch：frontmatter `日期` 与文件名日期都能解析但不一致（其一必错，需人工裁决）。
 */

import { DIARY_ENTRY_FILE_RE, isValidDiaryDate, isValidDiaryTime } from '../core/diary-format';

export type DiaryLintReason = 'unparsable' | 'legacy' | 'name-mismatch';

export interface DiaryLintItem {
  /** 文件完整 vault 路径 */
  path: string;
  reason: DiaryLintReason;
  /** 人话说明（体检面板直接展示） */
  detail: string;
}

export const LINT_REASON_TEXT: Record<DiaryLintReason, string> = {
  legacy: '旧格式日期文件（未迁移）',
  unparsable: '无法解析为条目',
  'name-mismatch': '属性日期与文件名不一致',
};

/** 提取 frontmatter `日期` 行原始值（无 frontmatter / 无该键返回 null） */
function frontmatterDateRaw(content: string): string | null {
  const text = (content || '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const m = /^日期:[^\S\n]*(.+)$/m.exec(text.slice(4, end));
  return m ? m[1].trim() : null;
}

/** 解析 `YYYY-MM-DD HH:mm` 为合法元组；形状/日历/时刻任一非法返回 null */
function parseDateTimeValue(raw: string): { date: string; time: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(raw || '');
  if (!m) return null;
  return isValidDiaryDate(m[1]) && isValidDiaryTime(m[2]) ? { date: m[1], time: m[2] } : null;
}

/**
 * 体检单个文件（纯函数）：返回体检项 reason，格式健康返回 null。
 * 路径仅需能取 basename（完整 vault 路径或纯文件名均可）。
 */
export function lintEntryFile(path: string, content: string): DiaryLintReason | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  if (/^\d{4}-\d{2}-\d{2}\.md$/.test(base)) return 'legacy';

  const raw = frontmatterDateRaw(content);
  const fmMeta = raw ? parseDateTimeValue(raw) : null;
  const m = DIARY_ENTRY_FILE_RE.exec(base);
  const fileDate = m && isValidDiaryDate(m[1]) && isValidDiaryTime(`${m[2]}:${m[3]}`) ? m[1] : null;

  if (raw && !fmMeta && !fileDate) return 'unparsable'; // 属性损坏且文件名救不回
  if (!fmMeta && !fileDate) return 'unparsable'; // 无属性且文件名非条目形状/日期非法
  if (fmMeta && fileDate && fmMeta.date !== fileDate) return 'name-mismatch';
  if (raw && !fmMeta && fileDate) return 'unparsable'; // 属性存在但损坏（运行时按文件名降级，体检从严）
  if (fmMeta && !fileDate) return 'name-mismatch'; // 属性合法但文件名非条目形状
  return null;
}

/** 批量体检：逐文件产出体检项清单（顺序保持传入顺序） */
export function lintDiaryFiles(files: { path: string; content: string }[]): DiaryLintItem[] {
  const out: DiaryLintItem[] = [];
  for (const f of files) {
    const reason = lintEntryFile(f.path, f.content);
    if (reason) out.push({ path: f.path, reason, detail: LINT_REASON_TEXT[reason] });
  }
  return out;
}
