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
import { corruptBackupsFor, fileExists, jsonScanTargets, readRawJson, CORRUPT_DIR } from './files';

/** 单个数据文件的解析体检结果（纯数据，node 可测） */
export interface JsonFileVerdict {
  file: string;
  label: string;
  /** missing=文件不存在 / ok=解析成功 / corrupt=解析失败 / unreadable=文件在但读不动（IO/权限等瞬时故障） */
  state: 'missing' | 'ok' | 'corrupt' | 'unreadable';
  /** corrupt 时存在的留档文件名（CONFIG/.CORRUPT/ 下） */
  backups: string[];
}

/** 纯函数：单文件解析判定（readRawJson 的结果 → verdict；node 可测）。
 *  unreadable：读失败但文件确实存在（func P3-1）——吞成 missing 会让体检假绿。 */
export function verdictOfJsonTarget(
  file: string,
  label: string,
  parsed: { ok: true; data: unknown } | { ok: false; raw: string } | null,
  backups: string[],
  unreadable = false
): JsonFileVerdict {
  if (parsed === null) {
    return unreadable
      ? { file, label, state: 'unreadable', backups: [] }
      : { file, label, state: 'missing', backups: [] };
  }
  return { file, label, state: parsed.ok ? 'ok' : 'corrupt', backups: parsed.ok ? [] : backups };
}

/** 纯函数：verdict 清单 → 检查结论 + 问题清单 */
export function jsonIssuesOf(verdicts: JsonFileVerdict[]): { summary: string; issues: CheckIssue[] } {
  const issues: CheckIssue[] = [];
  const existing = verdicts.filter((v) => v.state !== 'missing');
  const bad = verdicts.filter((v) => v.state === 'corrupt');
  const stuck = verdicts.filter((v) => v.state === 'unreadable');
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
  for (const v of stuck) {
    // func P3-1：读失败（被占用/权限/同步盘瞬时 IO）≠ 损坏 ≠ 缺失，人话提示不吞成「不存在」
    //（口径对齐 clipbook C24：读抛错 = 瞬时可重试，区别于损坏态）
    issues.push({
      severity: 'warn',
      title: `${v.label}数据文件存在但读不动（非损坏非缺失）`,
      detail: `文件：${v.file}\n读取时出错（可能被占用、权限不足或同步盘瞬时故障）。本次体检未检查该文件内容，请稍后重新体检。`,
    });
  }
  if (bad.length) {
    issues.push({
      severity: 'warn',
      title: `坏文件将在对应功能下次读取时自动留档并重建（D1 契约）`,
      detail: `对应功能下次读取该文件时，解析失败的原内容会先留档到 ${CORRUPT_DIR}/ 再重建默认文件，数据不会丢；可从留档手工恢复（体检当下不改动任何文件）。`,
    });
  }
  const summary = bad.length
    ? `${existing.length} 个数据文件中 ${bad.length} 个无法解析`
    : stuck.length
      ? `${existing.length} 个数据文件中 ${stuck.length} 个读不动（请重新体检）`
      : `${existing.length} 个数据文件全部可解析`;
  return { summary, issues };
}

/** 检查一：全部域数据 json 逐个解析（只读，逐文件让出主线程） */
export async function checkJsonFiles(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  const targets = jsonScanTargets(app);
  const verdicts: JsonFileVerdict[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (opts.isCancelled?.()) return null;
    const parsed = await readRawJson(app, t.file);
    // 读失败复核（func P3-1）：raw 读不到时区分「文件不在」（missing，懒创建常态）
    // 与「文件在但读不动」（unreadable，瞬时可重试）
    const unreadable = parsed === null && fileExists(app, t.file);
    verdicts.push(verdictOfJsonTarget(t.file, t.label, parsed, parsed && !parsed.ok ? corruptBackupsFor(app, t.file) : [], unreadable));
    await opts.tick?.(`${t.label}（${t.file}）`, { done: i + 1, total: targets.length });
  }
  const { summary, issues } = jsonIssuesOf(verdicts);
  const section: CheckSection = { id: 'json', name: '数据文件可解析', summary, issues, scanned: verdicts.filter((v) => v.state !== 'missing').length };
  return section;
}
