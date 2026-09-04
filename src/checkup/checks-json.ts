/**
 * 数据体检·检查一：json 可解析（D4 检查 a）。
 *
 * 逐个只读直读各域数据 json（files.ts 清单），尝试解析：
 * - 解析失败 → 红色问题：列出文件路径与（若存在）CONFIG/.CORRUPT/ 留档路径；
 * - 留档目录里的历史备份（未对应到本次坏文件的）→ 黄色提示：说明历史上坏过、原内容在留档里。
 * 不存在的数据文件不算问题（首次使用前懒创建是常态）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { corruptBackupsFor, jsonScanTargets, readRawJson, CORRUPT_DIR } from './files';

/** 单个数据文件的解析体检结果（纯数据，node 可测） */
export interface JsonFileVerdict {
  file: string;
  label: string;
  /** missing=文件不存在 / ok=解析成功 / corrupt=解析失败 */
  state: 'missing' | 'ok' | 'corrupt';
  /** corrupt 时存在的留档文件名（CONFIG/.CORRUPT/ 下） */
  backups: string[];
}

/** 纯函数：单文件解析判定（readRawJson 的结果 → verdict；node 可测） */
export function verdictOfJsonTarget(
  file: string,
  label: string,
  parsed: { ok: true; data: unknown } | { ok: false; raw: string } | null,
  backups: string[]
): JsonFileVerdict {
  if (parsed === null) return { file, label, state: 'missing', backups: [] };
  return { file, label, state: parsed.ok ? 'ok' : 'corrupt', backups: parsed.ok ? [] : backups };
}

/** 纯函数：verdict 清单 → 检查结论 + 问题清单 */
export function jsonIssuesOf(verdicts: JsonFileVerdict[]): { summary: string; issues: CheckIssue[] } {
  const issues: CheckIssue[] = [];
  const existing = verdicts.filter((v) => v.state !== 'missing');
  const bad = verdicts.filter((v) => v.state === 'corrupt');
  for (const v of bad) {
    const lines = [`文件：${v.file}`];
    if (v.backups.length) lines.push(`留档：${v.backups.map((b) => `${CORRUPT_DIR}/${b}`).join('、')}`);
    else lines.push(`留档：暂无（${CORRUPT_DIR}/ 下没有该文件的备份）`);
    issues.push({
      severity: 'error',
      title: `${v.label}数据文件无法解析`,
      detail: lines.join('\n'),
    });
  }
  if (issues.length) {
    issues.push({
      severity: 'warn',
      title: `坏文件已由存储层自动留档并重建（D1 契约）`,
      detail: `解析失败时原内容先留档到 ${CORRUPT_DIR}/ 再重建默认文件，数据不会丢；可从留档手工恢复。`,
    });
  }
  const summary = bad.length
    ? `${existing.length} 个数据文件中 ${bad.length} 个无法解析`
    : `${existing.length} 个数据文件全部可解析`;
  return { summary, issues };
}

/** 检查一：全部域数据 json 逐个解析（只读，逐文件让出主线程） */
export async function checkJsonFiles(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  const targets = jsonScanTargets(app);
  const verdicts: JsonFileVerdict[] = [];
  for (const t of targets) {
    if (opts.isCancelled?.()) return null;
    const parsed = await readRawJson(app, t.file);
    verdicts.push(verdictOfJsonTarget(t.file, t.label, parsed, parsed && !parsed.ok ? corruptBackupsFor(app, t.file) : []));
    await opts.tick?.(`${t.label}（${t.file}）`);
  }
  const { summary, issues } = jsonIssuesOf(verdicts);
  const section: CheckSection = { id: 'json', name: '数据文件可解析', summary, issues, scanned: verdicts.filter((v) => v.state !== 'missing').length };
  return section;
}
