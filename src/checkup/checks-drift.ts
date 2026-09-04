/**
 * 数据体检·检查二：字段漂移（D4 检查 b）。
 *
 * 各域数据 normalize 后都有约定字段集；这里对磁盘原文做「约定外字段 / 约定字段缺失」统计：
 * - 条目级：memo.json（备忘录/待办条目）、favorites.json（收藏条目）、pomodoro.json（history 条目）；
 * - 段级：clipbook / news / home / belongings / quiz / pomodoro 根段。
 * 只报告不修（铁律：体检只读；缺失字段多数是旧数据常态，域读取时会自动补默认值）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { readRawJson, jsonScanTargets } from './files';

/** 备忘录/待办条目约定字段（todo/data.ts normalizeItem 同款 14 字段） */
export const MEMO_ITEM_FIELDS = [
  'id', 'title', 'scene', 'priority', 'created', 'completed', 'due',
  'notePath', 'notePosition', 'scriptName', 'courseName', 'coursePath', 'linkedNote', 'url',
];

/** 收藏条目约定字段（favorites/types.ts 13 字段 + ADR-0074 archived/archivedAt） */
export const FAVORITES_ITEM_FIELDS = [
  'id', 'tags', 'title', 'description', 'pinned', 'url', 'balance', 'balanceCacheTime',
  'balanceError', 'linkedNote', 'created', 'type', 'llmConfig', 'archived', 'archivedAt',
];

/** 番茄钟 history 条目约定字段（ticket 63：target 等残留视为约定外） */
export const POMODORO_HISTORY_FIELDS = ['ts', 'duration', 'task'];

/** 段级约定（各域数据根对象键集） */
export const SEGMENT_FIELDS: Record<string, string[]> = {
  'pomodoro.json': ['version', 'state', 'history'],
  'clipbook.json': ['articleOverrides', 'savedArchive', 'order'],
  'news.json': ['articles', 'stats', 'bilibiliUps', 'bilibiliUpInfo', 'bilibiliMaxItems', 'bilibiliCookie', 'sources'],
  'home.json': ['version', 'pinned'],
  'belongings.json': ['version', 'last_updated', 'items', 'categories', 'categoryIcons'],
  'quiz.json': ['notes'],
};

/** 条目字段漂移统计（纯函数，node 可测）：rawItems 非数组时 scanned=0 */
export interface ItemDriftStats {
  scanned: number;
  /** 非对象条目数（数字/字符串等混进数组） */
  nonObject: number;
  /** 约定外字段 → 出现该字段的条目数 */
  extra: Record<string, number>;
  /** 缺失的约定字段 → 缺该字段的条目数 */
  missing: Record<string, number>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 纯函数：数组原文 × 约定字段 → 漂移统计 */
export function analyzeItemDrift(rawItems: unknown, known: string[]): ItemDriftStats {
  const stats: ItemDriftStats = { scanned: 0, nonObject: 0, extra: {}, missing: {} };
  if (!Array.isArray(rawItems)) return stats;
  const knownSet = new Set(known);
  for (const it of rawItems) {
    if (!isPlainObject(it)) {
      stats.nonObject += 1;
      continue;
    }
    stats.scanned += 1;
    for (const key of Object.keys(it)) {
      if (!knownSet.has(key)) stats.extra[key] = (stats.extra[key] || 0) + 1;
    }
    for (const key of known) {
      if (!(key in it)) stats.missing[key] = (stats.missing[key] || 0) + 1;
    }
  }
  return stats;
}

/** 段级漂移统计（纯函数，node 可测） */
export interface SegmentDriftStats {
  /** 根是数组（news 旧形态等） */
  isArray: boolean;
  isObject: boolean;
  extra: string[];
  missing: string[];
}

/** 纯函数：根对象原文 × 约定段 → 段漂移统计 */
export function analyzeSegmentDrift(raw: unknown, known: string[]): SegmentDriftStats {
  if (Array.isArray(raw)) return { isArray: true, isObject: false, extra: [], missing: [] };
  if (!isPlainObject(raw)) return { isArray: false, isObject: false, extra: [], missing: [] };
  const knownSet = new Set(known);
  const keys = Object.keys(raw);
  return {
    isArray: false,
    isObject: true,
    extra: keys.filter((k) => !knownSet.has(k)),
    missing: known.filter((k) => !(k in raw)),
  };
}

/** 计数表 → 「字段 ×N」描述（按数量倒序） */
function countsToText(map: Record<string, number>): string {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ×${n}`)
    .join('、');
}

interface DriftDomainPlan {
  file: string;
  label: string;
  kind: 'item' | 'segment' | 'history';
}

/** 本检查覆盖的域（条目级 + 段级；其余 json 只参与「可解析」检查） */
function driftPlans(app: App): DriftDomainPlan[] {
  const targets = new Map(jsonScanTargets(app).map((t) => [t.file, t.label]));
  const plans: DriftDomainPlan[] = [];
  const pathOf = (name: string): string => {
    const hit = [...targets.keys()].find((f) => f.endsWith('/' + name) || f === name);
    return hit || name;
  };
  plans.push({ file: pathOf('memo.json'), label: targets.get(pathOf('memo.json')) || '备忘录 / 待办', kind: 'item' });
  plans.push({ file: pathOf('favorites.json'), label: targets.get(pathOf('favorites.json')) || '收藏本', kind: 'item' });
  plans.push({ file: pathOf('pomodoro.json'), label: targets.get(pathOf('pomodoro.json')) || '番茄钟', kind: 'history' });
  for (const name of Object.keys(SEGMENT_FIELDS)) {
    if (name === 'pomodoro.json') continue; // 上面已按 history 条目覆盖
    plans.push({ file: pathOf(name), label: targets.get(pathOf(name)) || name, kind: 'segment' });
  }
  return plans;
}

/** 纯函数：全部漂移统计 → 结论 + 问题清单 */
export function driftIssuesOf(
  results: Array<{ plan: DriftDomainPlan; parsed: { ok: true; data: unknown } | { ok: false } | null; item?: ItemDriftStats; seg?: SegmentDriftStats }>
): { summary: string; issues: CheckIssue[] } {
  const issues: CheckIssue[] = [];
  let scannedDomains = 0;
  let drifted = 0;
  for (const r of results) {
    if (r.parsed === null) continue; // 文件不存在：懒创建常态，不算问题
    scannedDomains += 1;
    if (!r.parsed.ok) continue; // 坏 json 由检查一报告，此处跳过
    const bad = (n: number) => n > 0;
    let hasDrift = false;
    if (r.item) {
      const s = r.item;
      if (bad(s.nonObject)) {
        hasDrift = true;
        issues.push({
          severity: 'error',
          title: `${r.plan.label}：${s.nonObject} 条非对象条目（两域读取都会失败）`,
          detail: `文件：${r.plan.file}\n数组里混入了 ${s.nonObject} 条非对象内容（字符串/数字等），备忘录与待办的读取链都会在这里中断，请从留档或备份修复该文件。`,
        });
      }
      if (Object.keys(s.extra).length) {
        hasDrift = true;
        issues.push({
          severity: 'warn',
          title: `${r.plan.label}：条目出现约定外字段（共 ${Object.values(s.extra).reduce((a, b) => a + b, 0)} 处）`,
          detail: `文件：${r.plan.file}\n${countsToText(s.extra)}\n约定字段集：${(r.plan.kind === 'history' ? POMODORO_HISTORY_FIELDS : r.plan.file.endsWith('favorites.json') ? FAVORITES_ITEM_FIELDS : MEMO_ITEM_FIELDS).join('、')}\n不影响读取，只报告不修改。`,
        });
      }
      if (Object.keys(s.missing).length) {
        hasDrift = true;
        issues.push({
          severity: 'info',
          title: `${r.plan.label}：部分条目缺少常见字段（读取时自动补默认值）`,
          detail: `文件：${r.plan.file}\n${countsToText(s.missing)}\n旧数据常态，无需处理。`,
        });
      }
    }
    if (r.seg) {
      const s = r.seg;
      if (s.isArray) {
        hasDrift = true;
        issues.push({
          severity: 'info',
          title: `${r.plan.label}：文件还是旧的纯数组形态（读取时自动包裹迁移）`,
          detail: `文件：${r.plan.file}\n域读取层会把旧数组自动包裹成对象形态，无需处理。`,
        });
      } else if (s.isObject) {
        if (s.extra.length) {
          hasDrift = true;
          issues.push({
            severity: 'warn',
            title: `${r.plan.label}：出现约定外数据段（${s.extra.join('、')}）`,
            detail: `文件：${r.plan.file}\n约定段：${SEGMENT_FIELDS[r.plan.file.split('/').pop() || '']?.join('、') || ''}\n不影响读取，只报告不修改（可能是旧版本残留或外部写入）。`,
          });
        }
        if (s.missing.length) {
          hasDrift = true;
          issues.push({
            severity: 'info',
            title: `${r.plan.label}：缺少数据段（${s.missing.join('、')}），读取时补默认值`,
            detail: `文件：${r.plan.file}`,
          });
        }
      } else {
        hasDrift = true;
        issues.push({
          severity: 'warn',
          title: `${r.plan.label}：根不是对象形态（既非对象也非数组）`,
          detail: `文件：${r.plan.file}`,
        });
      }
    }
    if (hasDrift) drifted += 1;
  }
  const summary = drifted ? `${scannedDomains} 个数据文件中 ${drifted} 个存在字段漂移` : `${scannedDomains} 个数据文件字段形态与约定一致`;
  return { summary, issues };
}

/** 检查二：字段漂移（只读，逐域让出主线程） */
export async function checkFieldDrift(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  const plans = driftPlans(app);
  const results: Array<{ plan: DriftDomainPlan; parsed: { ok: true; data: unknown } | { ok: false } | null; item?: ItemDriftStats; seg?: SegmentDriftStats }> = [];
  for (const plan of plans) {
    if (opts.isCancelled?.()) return null;
    const parsed = await readRawJson(app, plan.file);
    if (parsed && parsed.ok) {
      if (plan.kind === 'item') {
        results.push({ plan, parsed, item: analyzeItemDrift(parsed.data, plan.file.endsWith('favorites.json') ? FAVORITES_ITEM_FIELDS : MEMO_ITEM_FIELDS) });
      } else if (plan.kind === 'history') {
        const root = analyzeSegmentDrift(parsed.data, SEGMENT_FIELDS['pomodoro.json']);
        const hist = analyzeItemDrift(isPlainObject(parsed.data) ? (parsed.data as any).history : undefined, POMODORO_HISTORY_FIELDS);
        results.push({ plan, parsed, seg: root, item: hist });
      } else {
        const known = SEGMENT_FIELDS[plan.file.split('/').pop() || ''] || [];
        results.push({ plan, parsed, seg: analyzeSegmentDrift(parsed.data, known) });
      }
    } else {
      results.push({ plan, parsed });
    }
    await opts.tick?.(plan.label);
  }
  const { summary, issues } = driftIssuesOf(results);
  return { id: 'drift', name: '字段漂移', summary, issues, scanned: results.filter((r) => r.parsed).length };
}
