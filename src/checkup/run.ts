/**
 * 数据体检（checkup 域）：编排器 + 一键修复 + 结果缓存。
 *
 * - runCheckup：四类检查串行跑（逐检查让出主线程防大数据卡死），单检查抛错降级为
 *   该项的红色问题（不拖垮整页）；取消（isCancelled）→ 返回 null，不产报告。
 *   检查注册表 CHECKS 单源（深审补维-1/ui P3-4）：id/label/runner 同源，
 *   CHECK_LABELS 派生导出，运行态步骤清单（ui.ts）与降级分支不再手抄。
 * - 结果缓存（仿保险库体检）：内存级 lastReport + 数据指纹（各扫描文件 mtime，
 *   eff P3-6），重开面板可区分「此后数据未变化」与「数据可能已变化」。
 * - fixOrphanIssues：可修复项（收藏关联 / 剪藏残留 / 剪藏标注与待回写来源 / 知识盒任务引用）
 *   定点清理，读改写入 per-path 串行队列（D1 契约）；逐组容错（ui P3-2：一组失败不丢
 *   前序已落盘组的撤销链），返回 undo 闭包供 notifyUndo 撤销链使用。
 *
 * 修复链契约（深审登记）：
 * - 形状单源（ARCH-1）：clipbook.json 的 defaultValue 一律引 clipbook/data emptySidecar()，
 *   不再手抄——旧手抄 3 键/6 键两份已与域单源漂移（缺 readLog）；
 * - 不凭空建文件（ARCH-1 加固）：修复/撤销 read 前先判文件存在，文件缺失（扫描后、
 *   修复前的窗口期被删，或存储路径刚迁移）→ 该组按「数据已变化」零命中处理，
 *   不经 jsonFileStore 的「缺失即落盘 defaultValue」路径造 stub；
 * - 撤销落点（S-2）：undo 闭包持有修复时刻解析的文件路径快照——撤销窗口内改
 *   storagePath 会写到旧路径文件（数据不丢、落点错位）；延迟解析成本高于收益，
 *   以本注释登记契约，暂不实现。
 */
import type { App } from 'obsidian';
import { yieldToMainThread } from '../core/utils';
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection, CheckupReport } from './types';
import { jsonScanTargets } from './files';
import { checkJsonFiles } from './checks-json';
import { checkFieldDrift } from './checks-drift';
import { checkOrphans } from './checks-orphans';
import { checkSameSourceConsistency } from './checks-consistency';
import { emptySidecar } from '../clipbook/data';

/** 检查注册表单源（id/label/runner 同源；顺序即执行顺序） */
interface CheckRegistration {
  id: CheckSection['id'];
  label: string;
  runner: (app: App, o: Pick<CheckOpts, 'tick' | 'isCancelled'>) => Promise<CheckResult>;
}

const CHECKS: CheckRegistration[] = [
  { id: 'json', label: '数据文件可解析', runner: checkJsonFiles },
  { id: 'drift', label: '字段漂移', runner: checkFieldDrift },
  { id: 'orphan', label: '孤儿条目', runner: checkOrphans },
  { id: 'consistency', label: '同源一致性', runner: checkSameSourceConsistency },
];

/** 面板进度显示用的检查项清单（CHECKS 派生，保持导出面兼容） */
export const CHECK_LABELS: string[] = CHECKS.map((c) => c.label);

export interface RunCheckupOpts {
  /**
   * 每个检查项开始/分片时回调（index 从 0；label 为当前子任务描述）。
   * subDone/subTotal（eff P2-1）：检查项内子任务进度（逐文件/逐条目），
   * UI 据此在检查项之间插值推进进度条——大库体检中段不再静止。
   */
  onProgress?: (p: { index: number; total: number; label: string; subDone?: number; subTotal?: number }) => void;
  /** 取消令牌：true = 尽快中止，runCheckup 返回 null */
  isCancelled?: () => boolean;
}

/** 四类检查串行执行；整体取消 → null */
export async function runCheckup(app: App, opts: RunCheckupOpts = {}): Promise<CheckupReport | null> {
  const total = CHECKS.length;
  const sections: CheckSection[] = [];
  for (let i = 0; i < CHECKS.length; i++) {
    if (opts.isCancelled?.()) return null;
    opts.onProgress?.({ index: i, total, label: CHECKS[i].label });
    try {
      const section = await CHECKS[i].runner(app, {
        tick: async (label, sub) => {
          opts.onProgress?.({ index: i, total, label, subDone: sub?.done, subTotal: sub?.total });
          // 让出主线程（reading-report 先例）：大库分片间隙插帧，防数秒冻结
          await yieldToMainThread();
        },
        isCancelled: () => !!opts.isCancelled?.(),
      });
      if (section === null) return null; // 已取消
      sections.push(section);
    } catch (e) {
      // 单检查失败不拖垮整页：降级为该项红色问题（id/label 与注册表同源，不再手抄）
      sections.push({
        id: CHECKS[i].id,
        name: CHECKS[i].label,
        summary: '检查未能完成',
        issues: [{ severity: 'error', title: `${CHECKS[i].label}检查出错`, detail: e instanceof Error ? e.message : String(e) }],
        scanned: 0,
      });
    }
  }
  const report: CheckupReport = { sections, finishedAt: new Date().toLocaleString() };
  lastReport = report; // 结果缓存（内存级，重开面板展示）
  lastFingerprints = collectFingerprints(app); // 数据指纹（eff P3-6：重开时区分缓存是否仍然可信）
  return report;
}

// ---------- 结果缓存（仿保险库体检：lastCheckup 内存级缓存 + mtime 指纹） ----------

let lastReport: CheckupReport | null = null;
/** 体检完成时刻各扫描文件的 mtime 指纹（eff P3-6：重开面板时对比，判定缓存是否仍然可信） */
let lastFingerprints: Record<string, number> | null = null;

/** 采集各扫描数据文件的 mtime 指纹（O(N) 次内存查询零 IO；取不到 mtime 的文件不记） */
export function collectFingerprints(app: App): Record<string, number> {
  const fp: Record<string, number> = {};
  // 防御：指纹是缓存可信度的辅助口径，采集不到（vault 异常/测试桩）不作为失败点
  const get = (app.vault as any)?.getAbstractFileByPath;
  if (typeof get !== 'function') return fp;
  for (const t of jsonScanTargets(app)) {
    const f = get.call(app.vault, t.file) as { stat?: { mtime?: number } } | null;
    if (f && f.stat && typeof f.stat.mtime === 'number') fp[t.file] = f.stat.mtime;
  }
  return fp;
}

/**
 * 重开面板时的缓存失效判定（eff P3-6）：与体检完成时刻的指纹对比——
 * 返回 'clean'（全部文件 mtime 未变，提示可弱化为「此后数据未变化」）
 * 或 'changed'（有文件变化/无法判定，维持「数据可能已变化」口径）。
 * 无指纹基准（从未采到）保守按 changed，不无据宣称「未变化」。
 */
export function cacheFreshness(app: App): 'clean' | 'changed' {
  if (!lastFingerprints || Object.keys(lastFingerprints).length === 0) return 'changed';
  const now = collectFingerprints(app);
  const oldKeys = Object.keys(lastFingerprints);
  if (oldKeys.length !== Object.keys(now).length) return 'changed';
  for (const k of oldKeys) {
    if (now[k] !== lastFingerprints[k]) return 'changed';
  }
  return 'clean';
}

/** 上次体检报告（未体检过为 null） */
export function getLastCheckupReport(): CheckupReport | null {
  return lastReport;
}

/** 测试钩子：清空缓存（跨用例隔离） */
export function __resetCheckupCacheForTests(): void {
  lastReport = null;
  lastFingerprints = null;
}

// ---------- 一键修复（孤儿清理；notifyUndo 撤销链由 UI 层挂） ----------

export interface FixOutcome {
  /** 修复组人话名（eff P3-1：批量撤销通知聚合计数用） */
  group: string;
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

/** 文件存在才读（修复链专用，ARCH-1 加固）：不存在返回 null，绝不触发「缺失即落盘 stub」 */
async function readJsonIfPresent<T>(app: App, file: string, make: () => { read(): Promise<T> }): Promise<T | null> {
  if (!app.vault.getAbstractFileByPath(file)) return null;
  return make().read();
}

/**
 * 收藏本修复：清空失效的「关联笔记」字段（条目本体保留）。
 * 读改写入 per-path 串行队列；undo 恢复原字段值——仅当现值仍是被清除态（空）才恢复
 * （func P3-8 守卫：撤销窗口内用户已设新关联则跳过，不静默顶掉用户编辑）。
 */
async function fixFavorites(app: App, file: string, ids: string[]): Promise<FixOutcome> {
  const restored = new Map<string, string | null>();
  const fixed = await enqueueFileTask(file, async () => {
    const data = await readJsonIfPresent<any[]>(app, file, () => jsonFileStore<any[]>(file, { defaultValue: [] as any[] }));
    if (data === null) return 0; // 文件缺失：零命中，不建 stub
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
    if (n > 0) await jsonFileStore<any[]>(file, { defaultValue: [] as any[] }).write(data);
    return n;
  });
  return {
    group: '收藏关联',
    fixed,
    label: fixed ? `已清除 ${fixed} 条失效的收藏关联（条目保留）` : '没有需要清除的关联（数据已变化）',
    undo: async () => {
      if (!restored.size) return;
      await enqueueFileTask(file, async () => {
        const data = await readJsonIfPresent<any[]>(app, file, () => jsonFileStore<any[]>(file, { defaultValue: [] as any[] }));
        if (data === null) return; // 文件没了：无处恢复（数据已整体变化）
        for (const it of data) {
          if (!it || typeof it !== 'object' || !restored.has(String(it.id))) continue;
          if (String(it.linkedNote || '').trim()) continue; // P3-8 守卫：用户已设新关联，不顶掉
          it.linkedNote = restored.get(String(it.id)) ?? null;
        }
        await jsonFileStore<any[]>(file, { defaultValue: [] as any[] }).write(data);
      });
    },
  };
}

/** 读出侧写里的 Record 段（缺段就地补空对象；非对象形态整段重置） */
function recordSectionOf(data: any, key: string): Record<string, any> {
  const cur = data && typeof data === 'object' ? data[key] : undefined;
  if (cur && typeof cur === 'object' && !Array.isArray(cur)) return cur;
  data[key] = {};
  return data[key];
}

/**
 * 剪藏本三组修复批（eff P3-7）：savedArchive 残留 / 划词标注 marks / 待回写来源 pendingSource
 * 三段合并在一次 enqueueFileTask 内完成——读一次、各删各的、至多写一次
 * （旧实现三组各自独立读改写同一 clipbook.json，大 sidecar 下三次全文件 IO）。
 * 每组独立 FixOutcome（undo 闭包数据结构不变）；文件缺失 → 各组零命中，不建 stub。
 */
async function fixClipbookBatch(app: App, file: string, urls: string[], markKeys: string[], srcKeys: string[]): Promise<FixOutcome[]> {
  const removedSaved: Array<{ url: string; title: string; savedAt: string; index: number }> = [];
  const removedMarks: Array<{ articleKey: string; mark: any; index: number }> = [];
  const removedSrc: Array<{ articleKey: string; notePath: string; index: number }> = [];
  const hasWork = urls.length > 0 || markKeys.length > 0 || srcKeys.length > 0;

  const counts = await enqueueFileTask(file, async () => {
    if (!hasWork) return { saved: 0, marks: 0, src: 0 };
    const data = await readJsonIfPresent<any>(app, file, () => jsonFileStore<any>(file, { defaultValue: emptySidecar }));
    if (data === null) return { saved: 0, marks: 0, src: 0 }; // 文件缺失：三组全零命中

    // 组 1：savedArchive 残留
    let cntSaved = 0;
    const list = Array.isArray(data.savedArchive) ? data.savedArchive : [];
    const want = new Set(urls);
    const kept: any[] = [];
    list.forEach((entry: any, index: number) => {
      const url = entry && typeof entry === 'object' ? String(entry.url || '') : '';
      if (url && want.has(url)) {
        removedSaved.push({ url, title: String(entry.title || ''), savedAt: String(entry.savedAt || ''), index });
        cntSaved += 1;
      } else {
        kept.push(entry);
      }
    });
    if (cntSaved > 0) data.savedArchive = kept;

    // 组 2：marks 标注
    let nMarks = 0;
    if (markKeys.length) {
      const marks = recordSectionOf(data, 'marks');
      for (const key of markKeys) {
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
        const markList = Array.isArray(marks[articleKey]) ? marks[articleKey] : [];
        const idx = markList.findIndex(
          (m: any) => m && typeof m === 'object' && String(m.find || '') === find && String(m.notePath || '') === notePath
        );
        if (idx === -1) continue;
        removedMarks.push({ articleKey, mark: markList[idx], index: idx });
        markList.splice(idx, 1);
        if (markList.length === 0) delete marks[articleKey];
        nMarks += 1;
      }
    }

    // 组 3：pendingSource 待回写来源
    let nSrc = 0;
    if (srcKeys.length) {
      const pending = recordSectionOf(data, 'pendingSource');
      for (const key of srcKeys) {
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
        const srcList = Array.isArray(pending[articleKey]) ? pending[articleKey] : [];
        const idx = srcList.findIndex((p: any) => String(p || '') === notePath);
        if (idx === -1) continue;
        removedSrc.push({ articleKey, notePath, index: idx });
        srcList.splice(idx, 1);
        if (srcList.length === 0) delete pending[articleKey];
        nSrc += 1;
      }
    }

    if (cntSaved + nMarks + nSrc > 0) await jsonFileStore<any>(file, { defaultValue: emptySidecar }).write(data);
    return { saved: cntSaved, marks: nMarks, src: nSrc };
  });

  const makeSavedUndo = (): () => Promise<void> => async () => {
    if (!removedSaved.length) return;
    await enqueueFileTask(file, async () => {
      const data = await readJsonIfPresent<any>(app, file, () => jsonFileStore<any>(file, { defaultValue: emptySidecar }));
      if (data === null) return;
      const list = Array.isArray(data.savedArchive) ? data.savedArchive : [];
      for (const r of removedSaved) {
        const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
        list.splice(at, 0, { url: r.url, title: r.title, savedAt: r.savedAt });
      }
      data.savedArchive = list;
      await jsonFileStore<any>(file, { defaultValue: emptySidecar }).write(data);
    });
  };
  const makeMarksUndo = (): () => Promise<void> => async () => {
    if (!removedMarks.length) return;
    await enqueueFileTask(file, async () => {
      const data = await readJsonIfPresent<any>(app, file, () => jsonFileStore<any>(file, { defaultValue: emptySidecar }));
      if (data === null) return;
      const marks = recordSectionOf(data, 'marks');
      for (const r of removedMarks) {
        const list = Array.isArray(marks[r.articleKey]) ? marks[r.articleKey] : [];
        const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
        list.splice(at, 0, r.mark);
        marks[r.articleKey] = list;
      }
      await jsonFileStore<any>(file, { defaultValue: emptySidecar }).write(data);
    });
  };
  const makeSrcUndo = (): () => Promise<void> => async () => {
    if (!removedSrc.length) return;
    await enqueueFileTask(file, async () => {
      const data = await readJsonIfPresent<any>(app, file, () => jsonFileStore<any>(file, { defaultValue: emptySidecar }));
      if (data === null) return;
      const pending = recordSectionOf(data, 'pendingSource');
      for (const r of removedSrc) {
        const list = Array.isArray(pending[r.articleKey]) ? pending[r.articleKey] : [];
        const at = r.index >= 0 && r.index <= list.length ? r.index : list.length;
        list.splice(at, 0, r.notePath);
        pending[r.articleKey] = list;
      }
      await jsonFileStore<any>(file, { defaultValue: emptySidecar }).write(data);
    });
  };

  const outcomes: FixOutcome[] = [];
  if (urls.length) {
    outcomes.push({
      group: '剪藏残留',
      fixed: counts.saved,
      label: counts.saved ? `已清除 ${counts.saved} 条剪藏「已保存」残留` : '没有需要清除的残留（数据已变化）',
      undo: makeSavedUndo(),
    });
  }
  if (markKeys.length) {
    outcomes.push({
      group: '剪藏标注',
      fixed: counts.marks,
      label: counts.marks ? `已清除 ${counts.marks} 条失效的剪藏标注` : '没有需要清除的标注（数据已变化）',
      undo: makeMarksUndo(),
    });
  }
  if (srcKeys.length) {
    outcomes.push({
      group: '剪藏待回写来源',
      fixed: counts.src,
      label: counts.src ? `已清除 ${counts.src} 条失效的剪藏待回写来源` : '没有需要清除的待回写来源（数据已变化）',
      undo: makeSrcUndo(),
    });
  }
  return outcomes;
}

/**
 * 知识盒修复（issue 339）：清空指向缺失文件的 notePath/videoPath（任务本体保留）。
 * fixKey = `<任务id>|note` / `<任务id>|video`；undo 恢复原字段值——仅当现值仍是被清除态
 * （空）才恢复（func P3-8 守卫：撤销窗口内用户已设新引用则跳过，不静默顶掉）。
 */
async function fixKnowledge(app: App, file: string, keys: string[]): Promise<FixOutcome> {
  const restored = new Map<string, { notePath?: string; videoPath?: string }>();
  const fixed = await enqueueFileTask(file, async () => {
    const data = await readJsonIfPresent<any[]>(app, file, () => jsonFileStore<any[]>(file, { defaultValue: [] as any[] }));
    if (data === null) return 0;
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
    if (n > 0) await jsonFileStore<any[]>(file, { defaultValue: [] as any[] }).write(data);
    return n;
  });
  return {
    group: '知识盒引用',
    fixed,
    label: fixed ? `已清除 ${fixed} 处知识盒任务的失效引用（任务保留）` : '没有需要清除的引用（数据已变化）',
    undo: async () => {
      if (!restored.size) return;
      await enqueueFileTask(file, async () => {
        const data = await readJsonIfPresent<any[]>(app, file, () => jsonFileStore<any[]>(file, { defaultValue: [] as any[] }));
        if (data === null) return;
        for (const it of Array.isArray(data) ? data : []) {
          if (!it || typeof it !== 'object' || !restored.has(String(it.id))) continue;
          const rec = restored.get(String(it.id))!;
          // P3-8 守卫：仅当现值仍是被清除态（空）才恢复，不顶掉用户新编辑
          if (rec.notePath !== undefined && !String(it.notePath || '').trim()) it.notePath = rec.notePath;
          if (rec.videoPath !== undefined && !String(it.videoPath || '').trim()) it.videoPath = rec.videoPath;
        }
        await jsonFileStore<any[]>(file, { defaultValue: [] as any[] }).write(data);
      });
    },
  };
}

export interface FixOrphanResult {
  /** 各修复组结果（fixed=0 的组在内——UI 借此判定「没有需要清除的项」） */
  outcomes: FixOutcome[];
  /** 修复失败的组（ui P3-2：一组写盘抛错不丢前序已落盘组的撤销链，失败组单独提示） */
  failures: string[];
}

/**
 * 孤儿条目一键修复（收藏关联 + 剪藏三组合批 + 知识盒任务引用，一起执行）。
 * 只处理传入问题里的可修复项；文件路径按当前设置解析（数据已变化时幂等跳过）。
 * 逐组容错（ui P3-2）：任一组写盘抛错不再吞掉前序组的 outcomes——已落盘修复的
 * 撤销链照常返回，失败组名进 failures 由 UI 单独提示。
 */
export async function fixOrphanIssues(app: App, issues: CheckIssue[]): Promise<FixOrphanResult> {
  const outcomes: FixOutcome[] = [];
  const failures: string[] = [];
  const targets = jsonScanTargets(app);
  // fileOf 兜底走 core storageFile（跟随 storagePath 设置；深审 ARCH-3：原硬编码
  // 'CONFIG/STORAGE/' 无视自定义存储路径，现清单恒含各文件、兜底实际不可达）
  const fileOf = (suffix: string): string => targets.find((t) => t.file.endsWith('/' + suffix))?.file || storageFile(suffix);

  const favIds = fixKeysOf(issues, 'favorites');
  if (favIds.length) {
    try {
      outcomes.push(await fixFavorites(app, fileOf('favorites.json'), favIds));
    } catch {
      failures.push('收藏关联');
    }
  }

  const clipUrls = fixKeysOf(issues, 'clipbook');
  const markKeys = fixKeysOf(issues, 'clipbook-marks');
  const srcKeys = fixKeysOf(issues, 'clipbook-source');
  if (clipUrls.length || markKeys.length || srcKeys.length) {
    try {
      outcomes.push(...(await fixClipbookBatch(app, fileOf('clipbook.json'), clipUrls, markKeys, srcKeys)));
    } catch {
      failures.push('剪藏残留/标注/待回写来源');
    }
  }

  const kbKeys = fixKeysOf(issues, 'knowledge');
  if (kbKeys.length) {
    try {
      outcomes.push(await fixKnowledge(app, fileOf('knowledge.json'), kbKeys));
    } catch {
      failures.push('知识盒任务引用');
    }
  }

  return { outcomes, failures };
}
