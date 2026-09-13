/**
 * 日记格式体检引擎（ADR-0130 重定义；原 ticket 121 行修复引擎随条目文件化退役）。
 * 只读扫描、不修任何内容——条目文件化后没有「头行可修」，问题清单供用户点击跳转手工处理。
 *
 * 三类体检项（口径从严，与运行时宽降级互补）：
 * - legacy：旧格式日期文件（`YYYY-MM-DD.md`）仍留在日记目录（未迁移/误归档）；
 * - unparsable：题目非条目形状或日历时刻非法，且 frontmatter `date` 缺失/损坏——运行时该文件
 *   不会出现在墙上（parseEntryFile 返回 null）；若题目合法仅属性损坏，运行时已按题目降级加载，
 *   但属性与题目双轨不一致仍是隐患，体检从严上报；
 * - name-mismatch：frontmatter `date` 与题目（YYMMDDHHmm）都能解析但日期或时刻不一致
 *   （其一必错，需人工裁决）。
 */

import {
  DIARY_DATE_KEY,
  DIARY_LEGACY_FILE_RE,
  diaryMetaFromEntryPath,
  diaryStampText,
  parseDiaryStamp,
  readDiaryFrontmatterFieldRaw,
} from '../core/diary-format';

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
  'name-mismatch': '属性时间与题目不一致',
};

/**
 * 体检单个文件（纯函数）：返回体检项 reason，格式健康返回 null。
 * 路径仅需能取 basename（完整 vault 路径或纯文件名均可）。
 * 原始值读取与时间戳解析都走契约（readDiaryFrontmatterFieldRaw / parseDiaryStamp）——体检「从严」
 * 与运行时「从宽降级」用的是同一套格式知识，只是判定口径不同。
 */
export function lintEntryFile(path: string, content: string): DiaryLintReason | null {
  const base = (path || '').replace(/\\/g, '/').split('/').pop() || '';
  if (DIARY_LEGACY_FILE_RE.test(base)) return 'legacy';

  const raw = readDiaryFrontmatterFieldRaw(content, DIARY_DATE_KEY);
  const rawLegacyKey = readDiaryFrontmatterFieldRaw(content, '日期'); // ADR-0131 前的中文键（已不认）
  const fmMeta = raw ? parseDiaryStamp(raw) : null;
  const fileMeta = diaryMetaFromEntryPath(base);

  // 旧中文键残留（题目可能合法→运行时按题目降级，但属性已是死数据，体检从严报出）
  if (rawLegacyKey && !raw) return 'unparsable';

  if (raw && !fmMeta && !fileMeta) return 'unparsable'; // 属性损坏且题目救不回
  if (!fmMeta && !fileMeta) return 'unparsable'; // 无属性且题目非条目形状/日历时刻非法
  if (raw && !fmMeta && fileMeta) return 'unparsable'; // 属性存在但损坏（运行时按题目降级，体检从严）
  if (fmMeta && !fileMeta) return 'name-mismatch'; // 属性合法但题目非条目形状
  // 题目承载完整时间戳（YYMMDDHHmm）：日期或时刻任一不一致都判双轨冲突
  if (fmMeta && fileMeta && diaryStampText(fmMeta.date, fmMeta.time) !== diaryStampText(fileMeta.date, fileMeta.time)) {
    return 'name-mismatch';
  }
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
