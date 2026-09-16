/**
 * 数据体检（checkup 域）：编排器 + 一键修复 + 结果缓存。
 *
 * - runCheckup：四类检查串行跑（逐检查让出主线程防大数据卡死），单检查抛错降级为
 *   该项的红色问题（不拖垮整页）；取消（isCancelled）→ 返回 null，不产报告。
 * - 结果缓存（仿保险库体检）：内存级 lastReport，重开面板显示上次结果 + 提示可重跑。
 * - fixOrphanIssues：可修复项（收藏关联 / 剪藏残留 / 剪藏标注与待回写来源 / 知识盒任务引用）
 *   定点清理，读改写入 per-path 串行队列（D1 契约）；返回 undo 闭包供 notifyUndo 撤销链使用。
 */
import { yieldToMainThread as yieldToMainThreadCore } from '../core/utils';
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

/** 让出主线程（core yieldToMainThread 转发壳：requestIdleCallback 优先 + 超时兜底） */
function yieldToMainThread(): Promise<void> {
  return yieldToMainThreadCore();
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
 * 知识盒修复（issue 339）：清空指向缺失文件的 notePath/videoPath（任务本体保留）。
 * fixKey = `<任务id>|note` / `<任务id>|video`；undo 恢复原字段值（任务已删则跳过）。
 */
async function fixKnowledge(app: App, file: string, keys: string[]): Promise<FixOutcome> {
  const restored = new Map<string, { notePath?: string; videoPath?: string }>();
  const fixed = await enqueueFileTask(file, async () => {
    const store = jsonFileStore<any[]>(file, { defaultValue: [] as any[] });
    const data = await store.read();
    let n = 0;
    for (const key of keys) {
      const bar = key.lastIndexOf('|');
      if (bar <= 0) continue;
      const id = key.slice(0, bar);
      const field = key.slice(bar + 1) === 'note' ? 'notePath' : 'videoPath';
      const it = (Array.isArray(data) ? data : []).find((d: any) => d && typeof d === 'object' && String(d.id) === id);
      if (!it) continue;
      const cur = String(it[field] || '').trim();
      if (!cur) continue; // 已被用户改掉：幂等跳过
      const rec = restored.get(id) ?? {};
      rec[field === 'notePath' ? 'notePath' : 'videoPath'] = it[field];
      restored.set(id, rec);
      it[field] = null;
      n += 1;
    }
    if (n > 0) await store.write(data);
    return n;
  });
  return {
    fixed,
    label: fixed ? `已清除 ${fixed} 处知识盒任务的失效引用（任务保留）` : '没有需要清除的引用（数据已变化）',
    undo: async () => {
      if (!restored.size) return;
      await enqueueFileTask(file, async () => {
        const store = jsonFileStore<any[]>(file, { defaultValue: [] as any[] });
        const data = await store.read();
        for (const it of Array.isArray(data) ? data : []) {
          if (!it || typeof it !== 'object' || !restored.has(String(it.id))) continue;
          const rec = restored.get(String(it.id))!;
          if (rec.notePath !== undefined) it.notePath = rec.notePath;
          if (rec.videoPath !== undefined) it.videoPath = rec.videoPath;
        }
        await store.write(data);
      });
    },
  };
}

/** clipbook.json 缺段兜底形状（marks/pendingSource 修复写路径用） */
function clipbookDefault(): Record<string, unknown> {
  return { articleOverrides: {}, savedArchive: [], order: [], marks: {}, savedImages: {}, pendingSource: {} };
}

/** 读出侧写里的 Record 段（缺段就地补空对象；非对象形态整段重置） */
function recordSectionOf(data: any, key: string): Record<string, any> {
  const cur = data && typeof data === 'object' ? data[key] : undefined;
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) return cur;
  data[key] = {};
  return data[key];
}

/**
 * 剪藏标注修复（issue 339）：从 clipbook.json marks 移除指向已不存在笔记的标注记录。
 * fixKey = JSON.stringify([articleKey, find, notePath])（find 串任意字符安全）；
 * 清空列表时连键一起删（对齐 clipbook 清理语义）；undo 按原索引插回。
 */
async function fixClipbookMarks(app: App, file: string, keys: string[]): Promise<FixOutcome> {
  const removed: Array<{ articleKey: string; mark: any; index: number }> = [];
  const fixed = await enqueueFileTask(file, async () => {
    const store = jsonFileStore<any>(file, { defaultValue: clipbookDefault });
    const data = await store.read();
    const marks = recordSectionOf(data, 'marks');
    let n = 0;
    for (const key of keys) {
      let articleKey = '';
      let find = '';
      let notePath = '';
      try {
        const [a, f, p] = JSON.parse(key) as unknown[];
        articleKey = String(a ?? '');
        find = String(f ?? '');
        notePath = String(p ?? '');
      } catch {
        continue;
      }
      if (!articleKey || !notePath) continue;
      const list = Array.isArray(marks[articleKey]) ? marks[articleKey] : [];
      const idx = list.findIndex(
        (m: any) => m && typeof m === 'object' && String(m.find || '') === find && String(m.notePath || '') === notePath
      );
      if (idx === -1) continue;
      removed.push({ articleKey, mark: list[idx], index: idx });
      list.splice(idx, 1);
      if (list.length === 0) delete marks[articleKey];
      n += 1;
    }
    if (n > 0) await store.write(data);
    return n;
  });
  return {
    fixed,
    label: fixed ? `已清除 ${fixed} 条失效的剪藏标注` : '没有需要清除的标注（数据已变化）',
    undo: async () => {
      if (!removed.length) return;
      await enqueueFileTask(file, async () => {
        const store = jsonFileStore<any>(file, { defaultValue: clipbookDefault });
        const data = await store.read();
        const marks = recordSectionOf(data, 'marks');
        for (const r of removed) {
          const list = Array.isArray(marks[r.articleKey]) ? marks[r.articleKey] : [];
          const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
          list.splice(at, 0, r.mark);
          marks[r.articleKey] = list;
        }
        await store.write(data);
      });
    },
  };
}

/**
 * 剪藏待回写来源修复（issue 339）：从 clipbook.json pendingSource 移除指向已不存在笔记的路径。
 * fixKey = JSON.stringify([articleKey, notePath])；清空列表时连键一起删；undo 按原索引插回。
 */
async function fixClipbookPendingSource(app: App, file: string, keys: string[]): Promise<FixOutcome> {
  const removed: Array<{ articleKey: string; notePath: string; index: number }> = [];
  const fixed = await enqueueFileTask(file, async () => {
    const store = jsonFileStore<any>(file, { defaultValue: clipbookDefault });
    const data = await store.read();
    const pending = recordSectionOf(data, 'pendingSource');
    let n = 0;
    for (const key of keys) {
      let articleKey = '';
      let notePath = '';
      try {
        const [a, p] = JSON.parse(key) as unknown[];
        articleKey = String(a ?? '');
        notePath = String(p ?? '');
      } catch {
        continue;
      }
      if (!articleKey || !notePath) continue;
      const list = Array.isArray(pending[articleKey]) ? pending[articleKey] : [];
      const idx = list.findIndex((p: any) => String(p || '') === notePath);
      if (idx === -1) continue;
      removed.push({ articleKey, notePath, index: idx });
      list.splice(idx, 1);
      if (list.length === 0) delete pending[articleKey];
      n += 1;
    }
    if (n > 0) await store.write(data);
    return n;
  });
  return {
    fixed,
    label: fixed ? `已清除 ${fixed} 条失效的剪藏待回写来源` : '没有需要清除的待回写来源（数据已变化）',
    undo: async () => {
      if (!removed.length) return;
      await enqueueFileTask(file, async () => {
        const store = jsonFileStore<any>(file, { defaultValue: clipbookDefault });
        const data = await store.read();
        const pending = recordSectionOf(data, 'pendingSource');
        for (const r of removed) {
          const list = Array.isArray(pending[r.articleKey]) ? pending[r.articleKey] : [];
          const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
          list.splice(at, 0, r.notePath);
          pending[r.articleKey] = list;
        }
        await store.write(data);
      });
    },
  };
}

/**
 * 孤儿条目一键修复（收藏关联 + 剪藏残留 + 剪藏标注/待回写来源 + 知识盒任务引用，一起执行）。
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

  const markKeys = fixKeysOf(issues, 'clipbook-marks');
  if (markKeys.length) outcomes.push(await fixClipbookMarks(app, fileOf('clipbook.json'), markKeys));

  const srcKeys = fixKeysOf(issues, 'clipbook-source');
  if (srcKeys.length) outcomes.push(await fixClipbookPendingSource(app, fileOf('clipbook.json'), srcKeys));

  const kbKeys = fixKeysOf(issues, 'knowledge');
  if (kbKeys.length) outcomes.push(await fixKnowledge(app, fileOf('knowledge.json'), kbKeys));

  return outcomes;
}
