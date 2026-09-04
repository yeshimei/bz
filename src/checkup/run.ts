/**
 * 数据体检（checkup 域）：编排器 + 一键修复 + 结果缓存。
 *
 * - runCheckup：四类检查串行跑（逐检查让出主线程防大数据卡死），单检查抛错降级为
 *   该项的红色问题（不拖垮整页）；取消（isCancelled）→ 返回 null，不产报告。
 * - 结果缓存（仿保险库体检）：内存级 lastReport，重开面板显示上次结果 + 提示可重跑。
 * - fixOrphanIssues：可修复项（收藏关联 / 剪藏残留）定点清理，读改写入 per-path
 *   串行队列（D1 契约）；返回 undo 闭包供 notifyUndo 撤销链使用。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckResult, CheckSection, CheckupReport } from './types';
import { enqueueFileTask, jsonFileStore } from '../core/storage';
import { jsonScanTargets } from './files';
import { checkJsonFiles } from './checks-json';
import { checkFieldDrift } from './checks-drift';
import { checkOrphans } from './checks-orphans';
import { checkSameSourceConsistency } from './checks-consistency';

/** 面板进度显示用的检查项清单（顺序即执行顺序） */
export const CHECK_LABELS = ['数据文件可解析', '字段漂移', '孤儿条目', '同源一致性'];

export interface RunCheckupOpts {
  /** 每个检查项开始/分片时回调（index 从 0；label 为当前子任务描述） */
  onProgress?: (p: { index: number; total: number; label: string }) => void;
  /** 取消令牌：true = 尽快中止，runCheckup 返回 null */
  isCancelled?: () => boolean;
}

/** 四类检查串行执行；整体取消 → null */
export async function runCheckup(app: App, opts: RunCheckupOpts = {}): Promise<CheckupReport | null> {
  const total = CHECK_LABELS.length;
  const runners: Array<(o: { tick: (label: string) => Promise<void> | void; isCancelled: () => boolean }) => Promise<CheckResult>> = [
    (o) => checkJsonFiles(app, o),
    (o) => checkFieldDrift(app, o),
    (o) => checkOrphans(app, o),
    (o) => checkSameSourceConsistency(app, o),
  ];
  const sections: CheckSection[] = [];
  for (let i = 0; i < runners.length; i++) {
    if (opts.isCancelled?.()) return null;
    opts.onProgress?.({ index: i, total, label: CHECK_LABELS[i] });
    try {
      const section = await runners[i]({
        tick: async (label) => {
          opts.onProgress?.({ index: i, total, label });
          // 让出主线程（reading-report 先例）：大库分片间隙插帧，防数秒冻结
          await yieldToMainThread();
        },
        isCancelled: () => !!opts.isCancelled?.(),
      });
      if (section === null) return null; // 已取消
      sections.push(section);
    } catch (e) {
      // 单检查失败不拖垮整页：降级为该项红色问题
      sections.push({
        id: (['json', 'drift', 'orphan', 'consistency'] as const)[i],
        name: CHECK_LABELS[i],
        summary: '检查未能完成',
        issues: [{ severity: 'error', title: `${CHECK_LABELS[i]}检查出错`, detail: e instanceof Error ? e.message : String(e) }],
        scanned: 0,
      });
    }
  }
  const report: CheckupReport = { sections, finishedAt: new Date().toLocaleString() };
  lastReport = report; // 结果缓存（内存级，重开面板展示）
  return report;
}

/** 让出主线程（requestIdleCallback 优先 + 超时兜底，退化 setTimeout） */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(() => resolve(), { timeout: 200 });
    else window.setTimeout(resolve, 0);
  });
}

// ---------- 结果缓存（仿保险库体检：lastCheckup 内存级缓存） ----------

let lastReport: CheckupReport | null = null;

/** 上次体检报告（未体检过为 null） */
export function getLastCheckupReport(): CheckupReport | null {
  return lastReport;
}

/** 测试钩子：清空缓存（跨用例隔离） */
export function __resetCheckupCacheForTests(): void {
  lastReport = null;
}

// ---------- 一键修复（孤儿清理；notifyUndo 撤销链由 UI 层挂） ----------

export interface FixOutcome {
  /** 实际清除的条目数 */
  fixed: number;
  /** 人话描述（通知正文用，无 emoji） */
  label: string;
  /** 撤销（恢复被清除的数据；失败向上抛由 notifySaveError 提示） */
  undo: () => Promise<void>;
}

/** 从问题清单按修复组提取 keys */
export function fixKeysOf(issues: CheckIssue[], group: string): string[] {
  return issues.filter((i) => i.fixGroup === group && i.fixKey).map((i) => i.fixKey!);
}

/**
 * 收藏本修复：清空失效的「关联笔记」字段（条目本体保留）。
 * 读改写入 per-path 串行队列；undo 恢复原字段值（条目已删则跳过）。
 */
async function fixFavorites(app: App, file: string, ids: string[]): Promise<FixOutcome> {
  const restored = new Map<string, string | null>();
  const fixed = await enqueueFileTask(file, async () => {
    const store = jsonFileStore<any[]>(file, { defaultValue: [] as any[] });
    const data = await store.read();
    const want = new Set(ids);
    let n = 0;
    for (const it of data) {
      if (!it || typeof it !== 'object' || !want.has(String(it.id))) continue;
      const note = String(it.linkedNote || '').trim();
      if (!note) continue; // 已被用户改掉：幂等跳过
      restored.set(String(it.id), it.linkedNote ?? null);
      it.linkedNote = null;
      n += 1;
    }
    if (n > 0) await store.write(data);
    return n;
  });
  return {
    fixed,
    label: fixed ? `已清除 ${fixed} 条失效的收藏关联（条目保留）` : '没有需要清除的关联（数据已变化）',
    undo: async () => {
      if (!restored.size) return;
      await enqueueFileTask(file, async () => {
        const store = jsonFileStore<any[]>(file, { defaultValue: [] as any[] });
        const data = await store.read();
        for (const it of data) {
          if (!it || typeof it !== 'object' || !restored.has(String(it.id))) continue;
          it.linkedNote = restored.get(String(it.id)) ?? null;
        }
        await store.write(data);
      });
    },
  };
}

/**
 * 剪藏本修复：从 clipbook.json 侧写 savedArchive 移除指向已不存在剪藏笔记的残留。
 * undo 按原索引插回（并发写后越界则尾插）。
 */
async function fixClipbook(app: App, file: string, urls: string[]): Promise<FixOutcome> {
  const removed: Array<{ url: string; title: string; savedAt: string; index: number }> = [];
  const fixed = await enqueueFileTask(file, async () => {
    const store = jsonFileStore<any>(file, {
      defaultValue: () => ({ articleOverrides: {}, savedArchive: [], order: [] }),
    });
    const data = await store.read();
    const list = Array.isArray(data && data.savedArchive) ? data.savedArchive : [];
    const want = new Set(urls);
    const kept: any[] = [];
    let n = 0;
    list.forEach((entry: any, index: number) => {
      const url = entry && typeof entry === 'object' ? String(entry.url || '') : '';
      if (url && want.has(url)) {
        removed.push({ url, title: String(entry.title || ''), savedAt: String(entry.savedAt || ''), index });
        n += 1;
      } else {
        kept.push(entry);
      }
    });
    if (n > 0) {
      data.savedArchive = kept;
      await store.write(data);
    }
    return n;
  });
  return {
    fixed,
    label: fixed ? `已清除 ${fixed} 条剪藏「已保存」残留` : '没有需要清除的残留（数据已变化）',
    undo: async () => {
      if (!removed.length) return;
      await enqueueFileTask(file, async () => {
        const store = jsonFileStore<any>(file, {
          defaultValue: () => ({ articleOverrides: {}, savedArchive: [], order: [] }),
        });
        const data = await store.read();
        const list = Array.isArray(data && data.savedArchive) ? data.savedArchive : [];
        for (const r of removed) {
          const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
          list.splice(at, 0, { url: r.url, title: r.title, savedAt: r.savedAt });
        }
        data.savedArchive = list;
        await store.write(data);
      });
    },
  };
}

/**
 * 孤儿条目一键修复（收藏关联 + 剪藏残留两组一起执行）。
 * 只处理传入问题里的可修复项；文件路径按当前设置解析（数据已变化时幂等跳过）。
 */
export async function fixOrphanIssues(app: App, issues: CheckIssue[]): Promise<FixOutcome[]> {
  const outcomes: FixOutcome[] = [];
  const targets = jsonScanTargets(app);
  const fileOf = (suffix: string): string => targets.find((t) => t.file.endsWith('/' + suffix))?.file || 'CONFIG/STORAGE/' + suffix;

  const favIds = fixKeysOf(issues, 'favorites');
  if (favIds.length) outcomes.push(await fixFavorites(app, fileOf('favorites.json'), favIds));

  const clipUrls = fixKeysOf(issues, 'clipbook');
  if (clipUrls.length) outcomes.push(await fixClipbook(app, fileOf('clipbook.json'), clipUrls));

  return outcomes;
}
