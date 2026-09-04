/**
 * 数据体检·检查四：同源一致性（D4 检查 d）。
 *
 * memo.json 是备忘录（memo）与待办（todo）的同源数据文件，两域各自加载同一条目集，
 * 口径必须一致。本检查对磁盘原文做双视角核对：
 * - memo 视角：todo/data.ts loadItems 的归一口径快照（completed: item.completed || null）；
 * - todo 视角：todo/data.ts 的 normalizeItem 实际归一（同一约定字段集）；
 * 两视角对同一份磁盘数据各自归一后比对条数/完成数——两条归一链任何一侧改字段语义
 * （或磁盘数据让两链产出分叉）都会在这里报红。另抓结构问题：非对象条目（红）、
 * 重复 id（黄）、缺标题（黄）、缺 id（提示）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { readRawJson, jsonScanTargets } from './files';
import { normalizeItem } from '../todo/data';

/**
 * memo 视角归一（todo/data.ts DataManager.loadItems 的映射快照——只取归一、不带其补 id 写回副作用）。
 * 注意：这是「口径快照」不是复用调用——体检禁止走域写路径（loadItems 缺 id 时会写盘）；
 * 快照与 todo normalizeItem 漂移时双视角计数分叉，本检查报红（这正是检查目的）。
 */
function memoNormalize(item: Record<string, unknown>): Record<string, unknown> {
  const { title, scene, created } = item;
  return {
    id: item.id,
    title,
    scene,
    priority: item.priority || 'minor',
    created,
    completed: item.completed || null,
    due: item.due || null,
    notePath: item.notePath || null,
    notePosition: item.notePosition || null,
    scriptName: item.scriptName || null,
    courseName: item.courseName || null,
    coursePath: item.coursePath || null,
    linkedNote: item.linkedNote || null,
    url: item.url || null,
  };
}

/** 单视角计数：条数 + 完成数（memo 口径 = completed 非 null；todo 口径 = completed 真值） */
interface ViewCount {
  total: number;
  done: number;
}

/** 双视角核对结果（纯函数产物，node 可测） */
export interface MemoConsistencyStats {
  /** 磁盘条目总数（数组长度；非数组为 -1） */
  total: number;
  /** 非对象条目数 */
  nonObject: number;
  /** 缺 id 条目数 */
  missingId: number;
  /** 重复 id 的条目数（第二次及以后出现同 id 的条目计 1） */
  duplicateId: number;
  /** 缺标题条目数 */
  missingTitle: number;
  /** memo 视角：条数/完成数（loadItems 口径快照归一） */
  memoView: ViewCount;
  /** todo 视角：条数/完成数（normalizeItem 实际归一） */
  todoView: ViewCount;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 纯函数：memo.json 原文 → 双视角统计 */
export function analyzeMemoConsistency(raw: unknown): MemoConsistencyStats {
  const stats: MemoConsistencyStats = {
    total: Array.isArray(raw) ? raw.length : -1,
    nonObject: 0,
    missingId: 0,
    duplicateId: 0,
    missingTitle: 0,
    memoView: { total: 0, done: 0 },
    todoView: { total: 0, done: 0 },
  };
  if (!Array.isArray(raw)) return stats;
  const seenIds = new Set<string>();
  for (const it of raw) {
    if (!isPlainObject(it)) {
      stats.nonObject += 1;
      continue;
    }
    const id = typeof it.id === 'string' && it.id ? it.id : '';
    if (!id) stats.missingId += 1;
    else if (seenIds.has(id)) stats.duplicateId += 1;
    else seenIds.add(id);
    if (!it.title || !String(it.title).trim()) stats.missingTitle += 1;

    // 双视角各自归一后计数（memo: 非 null 计完成；todo: 真值计完成——各自域的真实口径）
    const m = memoNormalize(it);
    if (m.completed !== null) stats.memoView.done += 1;
    const t = normalizeItem(it);
    if (t.completed) stats.todoView.done += 1;
    stats.memoView.total += 1;
    stats.todoView.total += 1;
  }
  return stats;
}

/** 纯函数：双视角统计 → 结论 + 问题清单 */
export function consistencyIssuesOf(stats: MemoConsistencyStats): { summary: string; issues: CheckIssue[] } {
  const issues: CheckIssue[] = [];
  if (stats.total < 0) {
    return {
      summary: '文件不是条目数组形态',
      issues: [
        {
          severity: 'error',
          title: 'memo.json 不是条目数组形态（备忘录与待办都无法读取）',
          detail: '两域的读取链都期望「条目数组」；当前文件是其他形态，请从 CONFIG/.CORRUPT/ 留档或备份恢复。',
        },
      ],
    };
  }
  // 双视角口径核对（条数/完成数必须一致；归一链分叉才会不等）
  if (stats.memoView.total !== stats.todoView.total || stats.memoView.done !== stats.todoView.done) {
    issues.push({
      severity: 'error',
      title: `双视角计数不一致：备忘录 ${stats.memoView.total} 条/完成 ${stats.memoView.done}，待办 ${stats.todoView.total} 条/完成 ${stats.todoView.done}`,
      detail: '同一份 memo.json，两个域的统计口径出现分叉，说明字段归一链路有 bug，请反馈修复。',
    });
  }
  if (stats.nonObject > 0) {
    issues.push({
      severity: 'error',
      title: `${stats.nonObject} 条非对象条目（备忘录与待办的读取都会在这里中断）`,
      detail: '数组里混入了非对象内容（字符串/数字等），两域加载都会失败，请从留档或备份修复。',
    });
  }
  if (stats.duplicateId > 0) {
    issues.push({
      severity: 'warn',
      title: `${stats.duplicateId} 条重复 id（完成/删除会同 id 联动误伤）`,
      detail: '同 id 条目在两域中都会被当成同一条处理：勾选完成一条，另一条也显示完成。',
    });
  }
  if (stats.missingTitle > 0) {
    issues.push({
      severity: 'warn',
      title: `${stats.missingTitle} 条缺少标题（列表显示为空行）`,
      detail: '标题是两域共用的展示字段；缺失多为外部写入导致。',
    });
  }
  if (stats.missingId > 0) {
    issues.push({
      severity: 'info',
      title: `${stats.missingId} 条缺少 id（下次读取时自动补）`,
      detail: '两域加载时会自动生成 id 写回，无需处理。',
    });
  }
  const bad = stats.nonObject + stats.duplicateId + stats.missingTitle;
  const summary = issues.some((i) => i.severity === 'error')
    ? '发现结构异常'
    : bad > 0
      ? `条数 ${stats.total} · 完成 ${stats.memoView.done}，两域口径一致，另有 ${bad} 处小问题`
      : `条数 ${stats.total} · 完成 ${stats.memoView.done}，两域口径一致`;
  return { summary, issues };
}

/** 检查四：memo.json 同源一致性（只读） */
export async function checkSameSourceConsistency(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  if (opts.isCancelled?.()) return null;
  const file = jsonScanTargets(app).find((t) => t.file.endsWith('/memo.json'))?.file || 'CONFIG/STORAGE/memo.json';
  const parsed = await readRawJson(app, file);
  if (parsed === null) {
    return { id: 'consistency', name: '同源一致性（备忘录 / 待办）', summary: 'memo.json 不存在（两域都还没写过数据），跳过', issues: [], scanned: 0 };
  }
  if (!parsed.ok) {
    // 坏 json 已由检查一报告，这里不重复报
    return { id: 'consistency', name: '同源一致性（备忘录 / 待办）', summary: 'memo.json 无法解析（见「数据文件可解析」项），跳过', issues: [], scanned: 0 };
  }
  await opts.tick?.('备忘录 / 待办');
  const stats = analyzeMemoConsistency(parsed.data);
  const { summary, issues } = consistencyIssuesOf(stats);
  return { id: 'consistency', name: '同源一致性（备忘录 / 待办）', summary, issues, scanned: stats.total };
}
