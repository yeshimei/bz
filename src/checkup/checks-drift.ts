/**
 * 数据体检·检查二：字段漂移（D4 检查 b）。
 *
 * 各域数据 normalize 后都有约定字段集；这里对磁盘原文做「约定外字段 / 约定字段缺失」统计：
 * - 条目级：memo.json（备忘录条目）、favorites.json（收藏条目）、pomodoro.json（history 条目）；
 * - 段级：clipbook / news / home / belongings / quiz / pomodoro 根段。
 * 只报告不修（铁律：体检只读；缺失字段多数是旧数据常态，域读取时会自动补默认值）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { readRawJson, jsonScanTargets } from './files';

/** 备忘录条目约定字段（memo/data.ts normalizeItem 同款 14 字段） */
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

/**
 * 可选段豁免清单（呈报#50/CK1 拍板）：这些根段是「功能未用到就不写」的正常形态，
 * 不属旧数据损坏——体检不再对它们计缺（出「缺少数据段」info 属狼来了噪音）。
 * - pomodoro.json 'archived'：issue 357 周归档段，写侧无归档时条件展开省键（pomodoro/data.ts）
 * 白名单（SEGMENT_FIELDS）仍完整登记这些键（防「约定外」误报）；本清单只豁免 missing，
 * extra（约定外段）与真异常仍照报。登记新可选段时同步 contract.test.ts 契约行。
 */
export const OPTIONAL_SEGMENTS: Record<string, string[]> = {
  'pomodoro.json': ['archived'],
};

/**
 * 可选字段豁免清单（呈报#50/CK1 拍板，与 OPTIONAL_SEGMENTS 同口径的条目级面）：
 * 这些条目字段是「功能未用到就不写」的可选项，不再计缺（出「部分条目缺少常见字段」info）。
 * - favorites 'archived'/'archivedAt'：ADR-0074 条目归档字段，未归档条目即缺
 * - pomodoro history 'task'：专注任务可选字段（state.ts task?，不用任务功能即缺）
 */
export const OPTIONAL_ITEM_FIELDS: Record<string, string[]> = {
  'favorites.json': ['archived', 'archivedAt'],
  'pomodoro.json': ['task'],
};

/** 段级约定（各域数据根对象键集；与域写侧形状单源的恒等锁见 tests/checkup/contract.test.ts） */
export const SEGMENT_FIELDS: Record<string, string[]> = {
  // archived = issue 357 周归档可选段（深审 PA-1：本插件自己写的正常归档数据，不得被体检
  // 误报「约定外数据段/可能是外部写入」；缺段属「功能未启用」正常形态，豁免清单见 OPTIONAL_SEGMENTS）
  'pomodoro.json': ['version', 'state', 'history', 'archived'],
  // clipbook 7 段 = clipbook/data.ts emptySidecar()（issue 339 marks/savedImages/pendingSource
  // + issue 358 readLog 扩段；func P2-1：此前漏 4 段致用过剪藏本即恒误报）
  'clipbook.json': ['articleOverrides', 'savedArchive', 'order', 'marks', 'savedImages', 'pendingSource', 'readLog'],
  // news 10 段 = clipbook/news-data.ts emptyData()（issue 302 lastFetchAt/fetchIntervalMin 扩段；func P2-2）
  'news.json': [
    'articles', 'stats', 'bilibiliUps', 'bilibiliUpInfo', 'bilibiliMaxItems', 'bilibiliCookie', 'sources', 'rssFeeds',
    'lastFetchAt', 'fetchIntervalMin',
  ],
  // home v3 五键 = home/order.ts emptyHomeOrder()（home 批 1d26c797 已修）
  'home.json': ['version', 'desk', 'mob', 'hiddenDesk', 'hiddenMob'],
  // belongings 3 段 = belongings/data.ts belongingsSaveShape 落盘键集（ADR-0102：categories/
  // categoryIcons 为内存派生段设计上不落盘——func P2-4/A1：此前多列 2 键致恒报「缺少数据段」info）
  'belongings.json': ['version', 'last_updated', 'items'],
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

/** 纯函数：数组原文 × 约定字段 → 漂移统计（optional=可选字段，CK1：不计缺只计约定外） */
export function analyzeItemDrift(rawItems: unknown, known: string[], optional: string[] = []): ItemDriftStats {
  const stats: ItemDriftStats = { scanned: 0, nonObject: 0, extra: {}, missing: {} };
  if (!Array.isArray(rawItems)) return stats;
  const knownSet = new Set(known);
  const optionalSet = new Set(optional);
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
      if (!(key in it) && !optionalSet.has(key)) stats.missing[key] = (stats.missing[key] || 0) + 1;
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

/** 纯函数：根对象原文 × 约定段 → 段漂移统计（optional=可选段，CK1：不计缺只计约定外） */
export function analyzeSegmentDrift(raw: unknown, known: string[], optional: string[] = []): SegmentDriftStats {
  if (Array.isArray(raw)) return { isArray: true, isObject: false, extra: [], missing: [] };
  if (!isPlainObject(raw)) return { isArray: false, isObject: false, extra: [], missing: [] };
  const knownSet = new Set(known);
  const optionalSet = new Set(optional);
  const keys = Object.keys(raw);
  return {
    isArray: false,
    isObject: true,
    extra: keys.filter((k) => !knownSet.has(k)),
    missing: known.filter((k) => !(k in raw) && !optionalSet.has(k)),
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
  plans.push({ file: pathOf('memo.json'), label: targets.get(pathOf('memo.json')) || '备忘录', kind: 'item' });
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
    // func P3-2：favorites.json 根形态守卫——被外部写成合法 JSON 对象（非数组）时
    // analyzeItemDrift 静默零统计、域读取链会失败，必须报告（memo.json 的同型问题
    // 由检查四双链核对报红，此处不重复立项）
    if (r.plan.kind === 'item' && r.plan.file.endsWith('favorites.json') && r.parsed && r.parsed.ok && !Array.isArray(r.parsed.data)) {
      hasDrift = true;
      issues.push({
        severity: 'warn',
        title: `${r.plan.label}：不是条目数组形态（读取链会失败）`,
        detail: `文件：${r.plan.file}\n当前根是 ${Array.isArray(r.parsed.data) ? '数组' : r.parsed.data && typeof r.parsed.data === 'object' ? '对象' : typeof r.parsed.data}，收藏本读取链期望「条目数组」；请从留档或备份恢复。`,
      });
    }
    if (r.item) {
      const s = r.item;
      if (bad(s.nonObject)) {
        hasDrift = true;
        issues.push({
          severity: 'error',
          title: `${r.plan.label}：${s.nonObject} 条非对象条目（读取链会在这里中断）`,
          detail: `文件：${r.plan.file}\n数组里混入了 ${s.nonObject} 条非对象内容（字符串/数字等），${r.plan.label}的读取链都会在这里中断，请从留档或备份修复该文件。`,
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
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    if (opts.isCancelled?.()) return null;
    const parsed = await readRawJson(app, plan.file);
    if (parsed && parsed.ok) {
      if (plan.kind === 'item') {
        const optional = plan.file.endsWith('favorites.json') ? OPTIONAL_ITEM_FIELDS['favorites.json'] : undefined;
        results.push({ plan, parsed, item: analyzeItemDrift(parsed.data, plan.file.endsWith('favorites.json') ? FAVORITES_ITEM_FIELDS : MEMO_ITEM_FIELDS, optional) });
      } else if (plan.kind === 'history') {
        const root = analyzeSegmentDrift(parsed.data, SEGMENT_FIELDS['pomodoro.json'], OPTIONAL_SEGMENTS['pomodoro.json']);
        const hist = analyzeItemDrift(isPlainObject(parsed.data) ? (parsed.data as any).history : undefined, POMODORO_HISTORY_FIELDS, OPTIONAL_ITEM_FIELDS['pomodoro.json']);
        results.push({ plan, parsed, seg: root, item: hist });
      } else {
        const base = plan.file.split('/').pop() || '';
        const known = SEGMENT_FIELDS[base] || [];
        results.push({ plan, parsed, seg: analyzeSegmentDrift(parsed.data, known, OPTIONAL_SEGMENTS[base]) });
      }
    } else {
      results.push({ plan, parsed });
    }
    await opts.tick?.(plan.label, { done: i + 1, total: plans.length });
  }
  const { summary, issues } = driftIssuesOf(results);
  return { id: 'drift', name: '字段漂移', summary, issues, scanned: results.filter((r) => r.parsed).length };
}
