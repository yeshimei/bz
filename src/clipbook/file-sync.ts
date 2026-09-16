/**
 * 剪藏本域文件同步（issue 336 / ADR-0149 决策 4）：clipbook.json 路径引用同步。
 *   rename → 同步 marks[][].notePath 与 pendingSource[][]（划词别名链 basename 随新路径
 *           自动更新，applyBodyTransforms 渲染/物化都按 notePath 现值取 basename）；
 *   delete → 剔除指向被删文献笔记的 marks 条目与 pendingSource 项（划词文本保持纯文本
 *           不挂链——applyBodyTransforms 只对现存 mark 做双链替换，anchor.ts 语义），
 *           防物化时 anchor 写未解析链接 / upgrade 静默失败（审计#4）。
 *           与保存物化 clearArticleTracking 幂等共处：同为 updateClipbookData 读改写事务，
 *           同 per-path 队列串行，谁先落盘谁生效、互不覆盖。
 * sync 纯函数与队列/去抖为域内私有副本（勿跨域 import，同 memo/file-sync 范式）；
 * rename 经域事件总线 'vault:md-renamed' 按 DEBOUNCE_DELAY 合并去抖回放保序，
 * delete 走 'vault:md-deleted' 即时通道（obsidian-adapter 恒发、仅 md）。
 */
import { stripMdExt } from '../core/utils';
import type { App } from 'obsidian';
import { notify } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { readClipbookData, updateClipbookData, type ClipbookData, type ClipMark } from './data';

// ---------- 同步纯函数（域内私有副本） ----------

/** 笔记重命名：marks[].notePath 与 pendingSource[] 原地改指新路径 */
function syncRename(data: ClipbookData, { oldPath, newPath }: { oldPath: string; newPath: string }): boolean {
  let changed = false;
  for (const key of Object.keys(data.marks)) {
    const list = data.marks[key];
    if (!Array.isArray(list)) continue;
    for (const mk of list as ClipMark[]) {
      if (mk && mk.notePath === oldPath) { mk.notePath = newPath; changed = true; }
    }
  }
  for (const key of Object.keys(data.pendingSource)) {
    const list = data.pendingSource[key];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      if (list[i] === oldPath) { list[i] = newPath; changed = true; }
    }
  }
  return changed;
}

/**
 * 笔记删除：剔除指向被删笔记的 marks 条目与 pendingSource 项（空列表键一并删，防残留
 * 空数组堆积）。savedImages（src→local 图片映射）与 articleOverrides/savedArchive 非
 * 文献笔记路径引用，不在同步范围。
 */
function syncDelete(data: ClipbookData, path: string): boolean {
  let changed = false;
  const marks: Record<string, ClipMark[]> = {};
  for (const key of Object.keys(data.marks)) {
    const list = data.marks[key];
    if (!Array.isArray(list)) continue;
    const kept = (list as ClipMark[]).filter((mk) => !(mk && mk.notePath === path));
    if (kept.length !== list.length) changed = true;
    if (kept.length) marks[key] = kept;
  }
  const pendingSource: Record<string, string[]> = {};
  for (const key of Object.keys(data.pendingSource)) {
    const list = data.pendingSource[key];
    if (!Array.isArray(list)) continue;
    const kept = (list as string[]).filter((p) => p !== path);
    if (kept.length !== list.length) changed = true;
    if (kept.length) pendingSource[key] = kept;
  }
  if (!changed) return false;
  data.marks = marks;
  data.pendingSource = pendingSource;
  return true;
}

/** 监听目录范围检查：路径等于目录本身或位于其下（同 memo/file-sync 口径） */
function inFolders(path: string, folders: string[]): boolean {
  return folders.some((f) => path.startsWith(f + '/') || path === f);
}

/** 剪藏目录（设置 articleDirectory；域内私有副本，同 flow.ts dirOf 口径） */
function clipDirOf(): string {
  const s = tryGetSettings() as any;
  return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

/** 监听目录：marks/pendingSource 指向知识盒文献笔记（默认「文献盒」），来源录入口带当前
 *  笔记时也可能指向剪藏目录内笔记——两个栖息地都纳入监听，其余靠引用放行（E22 同款） */
function getWatchedFolders(): string[] {
  const s = tryGetSettings() as any;
  const kb = String((s && s.knowledgeDirectory) || '文献盒').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || '文献盒';
  return [kb, clipDirOf()];
}

// ---------- 队列 / 去抖（memo/file-sync 逐行等价移植） ----------

let initialized = false;
/** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清） */
let _refs: (() => void)[] = [];
/** 卸载标志：置位后积压任务首行短路、去抖窗口内事件直接丢弃 */
let _cancelled = false;
/** 待清理的去抖器（unload 时清定时器） */
let _flushers: { cancel(): void }[] = [];

/** 任务队列：串行执行（失败通知，去重防刷屏）；执行前检查 _cancelled，卸载后积压任务首行短路 */
let queue: Promise<any> = Promise.resolve();
function enqueue(task: () => Promise<any> | void) {
  queue = queue
    .then(() => {
      if (_cancelled) return;
      return task();
    })
    .catch((e) => {
      console.error('[clipbook-file-sync]', e);
      notify('剪藏本同步失败，数据可能不一致', { type: 'error', dedupeKey: 'clipbook-file-sync' });
    });
}

/** 去抖延迟：复用既有 DEBOUNCE_DELAY 设置（字符串毫秒，缺省 300） */
function debounceDelay(): number {
  const s: any = tryGetSettings();
  return Number(s && s.DEBOUNCE_DELAY) || 300;
}

/** 同类事件合并去抖：DEBOUNCE_DELAY 窗口内同型事件收集成批，静默期后作为单个
 *  队列任务按序回放——既削队列峰值，又保留 rename 链（A→B→C）等顺序语义。 */
function createBatchFlusher<T>(run: (batch: T[]) => Promise<void>): ((ev: T) => void) & { cancel(): void } {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (_cancelled) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    enqueue(() => run(batch));
  };
  const push = (ev: T): void => {
    if (_cancelled) return;
    pending.push(ev);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceDelay());
  };
  return Object.assign(push, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = [];
    },
  });
}

// ---------- 事件编排 ----------

function createFileSyncAgent(_app: App): void {
  /** clipbook.json 引用命中检查（范围外放行口径，同 memo E22）：marks 的 notePath 指向
   *  知识盒文献笔记，可不在剪藏目录监听范围内 */
  const referencedByClipbook = async (path: string): Promise<boolean> => {
    if (!path) return false;
    try {
      const data = await readClipbookData();
      const markHit = Object.values(data.marks).some((list) =>
        (list as ClipMark[]).some((mk) => mk && mk.notePath === path));
      const pendingHit = Object.values(data.pendingSource).some((list) => (list as string[]).includes(path));
      return markHit || pendingHit;
    } catch (e) {
      return false;
    }
  };

  const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, getWatchedFolders());

  /** 总线载荷 → 现有闭包期望的伪 TFile 形状（{path, basename, extension:'md'}） */
  const pseudoFile = (path: string): any => ({
    path,
    basename: stripMdExt(path.split('/').pop() || ''),
    extension: 'md',
  });

  const flushRenames = createBatchFlusher<{ oldPath: string; newPath: string }>(async (batch) => {
    for (const ev of batch) {
      await updateClipbookData((cur) => {
        syncRename(cur, ev);
        return cur;
      });
    }
  });
  _flushers.push(flushRenames);
  _refs.push(onDomainEvent<{ oldPath: string; newPath: string }>('vault:md-renamed', (evt) => {
    const file = pseudoFile(evt.newPath);
    // 范围外放行看新旧两条路径（改名移出/移入监听范围都算被引用）
    void (async () => {
      if (!(isMd(file) || (await referencedByClipbook(evt.oldPath)) || (await referencedByClipbook(evt.newPath)))) return;
      flushRenames({ oldPath: evt.oldPath, newPath: evt.newPath });
    })();
  }));

  _refs.push(onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
    const file = pseudoFile(evt.path);
    void (async () => {
      // 范围外但被 clipbook.json 引用的笔记删除同样要剔条
      if (isMd(file) || (await referencedByClipbook(evt.path))) {
        enqueue(() =>
          updateClipbookData((cur) => {
            syncDelete(cur, evt.path);
            return cur;
          }),
        );
      }
    })();
  }));
}

/** 幂等初始化（main.ts onLayoutReady 常驻接线；ADR-0003 同款幂等） */
export function ensureFileSync(app: App): void {
  if (initialized) return;
  initialized = true;
  _cancelled = false; // 重新启用后恢复任务受理
  createFileSyncAgent(app);
}

/** 卸载清理：置位 _cancelled 使积压任务首行短路并丢弃去抖窗口内未回放的事件，
 *  退订全部监听（总线退订幂等，重复卸载无双清风险）后重置模块状态。 */
export function unloadFileSync(): void {
  _cancelled = true;
  for (const f of _flushers) {
    try {
      f.cancel();
    } catch (e) { /* 忽略 */ }
  }
  _flushers = [];
  for (const off of _refs) {
    try {
      off();
    } catch (e) { /* 忽略 */ }
  }
  _refs = [];
  initialized = false;
  queue = Promise.resolve();
}
