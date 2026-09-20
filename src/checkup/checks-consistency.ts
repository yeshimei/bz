/**
 * 数据体检·检查四：同源一致性（D4 检查 d）。
 *
 * memo.json 是备忘录（memo）的同源数据文件。本检查对磁盘原文做双链核对：
 * - 口径快照链：memo/data.ts loadItems 的归一口径快照（下方 memoNormalize，手抄冻结）；
 * - 直读链：memo/data.ts 的 normalizeItem 实际归一（同一约定字段集）；
 * 现状声明（func P2-5）：memo loadItems 目前就是「逐条 return normalizeItem」的恒等转发，
 * 双链比对实为「手抄快照 × 活函数」——normalizeItem 任何字段语义变化（默认值、字段增删、
 * 归一规则改动）都会让两链产出分叉，在这里逐键比对报红（func P2-5 方案 b：字段级
 * Object.is 逐键核对，不再只比条数/完成数）。
 * 体检禁止走域写路径（loadItems 缺 id 时会写盘），故取快照而非复用调用。
 * 另抓结构问题：非对象条目（红）、重复 id（黄）、缺标题（黄）、缺 id（提示）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { readRawJson, jsonScanTargets } from './files';
import { normalizeItem } from '../memo/data';

/**
 * memo 视角归一（memo/data.ts DataManager.loadItems 的映射快照——只取归一、不带其补 id 写回副作用）。
 * 注意：这是「口径快照」不是复用调用——体检禁止走域写路径（loadItems 缺 id 时会写盘）；
 * 快照与 memo normalizeItem 漂移时双视角计数分叉，本检查报红（这正是检查目的）。
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

/** 纯函数：双链归一产物逐键比对，返回 Object.is 不等的键名（func P2-5 字段级核对） */
export function divergedKeysOf(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!Object.is(a[k], b[k])) out.push(k);
  }
  return out.sort();
}

/** 单视角计数：条数 + 完成数（快照口径 = completed 非 null；直读口径 = completed 真值） */
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
  /** 字段级归一分叉：键 → 分叉条目数（func P2-5；正常数据恒为空——分叉即归一链路 bug） */
  divergedKeys: Record<string, number>;
  /** 快照视角：条数/完成数（loadItems 口径快照归一） */
  storeView: ViewCount;
  /** 直读视角：条数/完成数（normalizeItem 实际归一） */
  rawView: ViewCount;
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
    divergedKeys: {},
    storeView: { total: 0, done: 0 },
    rawView: { total: 0, done: 0 },
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

    // 双视角各自归一：先按旧口径计数（兼容展示），再逐键 Object.is 核对（func P2-5）——
    // normalizeItem 任何字段语义漂移都会在这里现形
    const m = memoNormalize(it);
    const t = normalizeItem(it) as unknown as Record<string, unknown>;
    if (m.completed !== null) stats.storeView.done += 1;
    if (t.completed) stats.rawView.done += 1;
    stats.storeView.total += 1;
    stats.rawView.total += 1;
    for (const k of divergedKeysOf(m, t)) {
      stats.divergedKeys[k] = (stats.divergedKeys[k] || 0) + 1;
    }
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
          title: 'memo.json 不是条目数组形态（两条读取链都无法读取）',
          detail: '两条读取链都期望「条目数组」；当前文件是其他形态，请从 CONFIG/.CORRUPT/ 留档或备份恢复。',
        },
      ],
    };
  }
  // 双视角口径核对（条数/完成数必须一致；归一链分叉才会不等）
  if (stats.storeView.total !== stats.rawView.total || stats.storeView.done !== stats.rawView.done) {
    issues.push({
      severity: 'error',
      title: `双链计数不一致：单例读 ${stats.storeView.total} 条/完成 ${stats.storeView.done}，直读 ${stats.rawView.total} 条/完成 ${stats.rawView.done}`,
      detail: '同一份 memo.json，两条读取链的统计口径出现分叉，说明字段归一链路有 bug，请反馈修复。',
    });
  }
  // 字段级归一分叉（func P2-5）：快照与 normalizeItem 逐键 Object.is 核对——
  // normalizeItem 任何字段语义变化（默认值/归一规则/字段增删）都会在这里报红
  const diverged = Object.keys(stats.divergedKeys || {}).sort(
    (a, b) => (stats.divergedKeys[b] || 0) - (stats.divergedKeys[a] || 0)
  );
  if (diverged.length) {
    issues.push({
      severity: 'error',
      title: `双链归一分叉：${diverged.map((k) => `${k} ×${stats.divergedKeys[k]}`).join('、')}`,
      detail: '同一份 memo.json，「归一口径快照」与 normalizeItem 实际归一对上述字段产出不同结果，说明字段归一链路有 bug，请反馈修复。',
    });
  }
  if (stats.nonObject > 0) {
    issues.push({
      severity: 'error',
      title: `${stats.nonObject} 条非对象条目（两条读取链都会在这里中断）`,
      detail: '数组里混入了非对象内容（字符串/数字等），两条链加载都会失败，请从留档或备份修复。',
    });
  }
  if (stats.duplicateId > 0) {
    issues.push({
      severity: 'warn',
      title: `${stats.duplicateId} 条重复 id（完成/删除会同 id 联动误伤）`,
      detail: '同 id 条目在两条读取链中都会被当成同一条处理：勾选完成一条，另一条也显示完成。',
    });
  }
  if (stats.missingTitle > 0) {
    issues.push({
      severity: 'warn',
      title: `${stats.missingTitle} 条缺少标题（列表显示为空行）`,
      detail: '标题是两条读取链共用的展示字段；缺失多为外部写入导致。',
    });
  }
  if (stats.missingId > 0) {
    issues.push({
      severity: 'info',
      title: `${stats.missingId} 条缺少 id（下次读取时自动补）`,
      detail: '加载链会自动生成 id 写回，无需处理。',
    });
  }
  const bad = stats.nonObject + stats.duplicateId + stats.missingTitle;
  const summary = issues.some((i) => i.severity === 'error')
    ? '发现结构异常'
    : bad > 0
      ? `条数 ${stats.total} · 完成 ${stats.storeView.done}，双链口径一致，另有 ${bad} 处小问题`
      : `条数 ${stats.total} · 完成 ${stats.storeView.done}，双链口径一致`;
  return { summary, issues };
}

/** 检查四：memo.json 同源一致性（只读） */
export async function checkSameSourceConsistency(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  if (opts.isCancelled?.()) return null;
  const file = jsonScanTargets(app).find((t) => t.file.endsWith('/memo.json'))?.file || 'CONFIG/STORAGE/memo.json';
  const parsed = await readRawJson(app, file);
  if (parsed === null) {
    return { id: 'consistency', name: '同源一致性（备忘录）', summary: 'memo.json 不存在（还没写过数据），跳过', issues: [], scanned: 0 };
  }
  if (!parsed.ok) {
    // 坏 json 已由检查一报告，这里不重复报
    return { id: 'consistency', name: '同源一致性（备忘录）', summary: 'memo.json 无法解析（见「数据文件可解析」项），跳过', issues: [], scanned: 0 };
  }
  await opts.tick?.('备忘录');
  const stats = analyzeMemoConsistency(parsed.data);
  const { summary, issues } = consistencyIssuesOf(stats);
  return { id: 'consistency', name: '同源一致性（备忘录）', summary, issues, scanned: stats.total };
}
