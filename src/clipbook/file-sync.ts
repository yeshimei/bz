/**
 * 剪藏本域文件同步（issue 336 / ADR-0149 决策 4）：clipbook.json 路径引用同步。
 *   rename → 同步 marks[][].notePath 与 pendingSource[][]（划词别名链 basename 随新路径
 *           自动更新，applyBodyTransforms 渲染/物化都按 notePath 现值取 basename）；
 *   delete → 剔除指向被删文献笔记的 marks 条目与 pendingSource 项（划词文本保持纯文本
 *           不挂链——applyBodyTransforms 只对现存 mark 做双链替换，anchor.ts 语义），
 *           防物化时 anchor 写未解析链接 / upgrade 静默失败（审计#4）。
 *           与保存物化 clearArticleTracking 幂等共处：同为 updateClipbookData 读改写事务，
 *           同 per-path 队列串行，谁先落盘谁生效、互不覆盖。
 * 队列/去抖/批量冲刷/事件订阅/生命周期收编至公共壳 core/file-sync（issue 365），
 * 域侧只留同步纯函数、监听范围与装配；rename 经域事件总线 'vault:md-renamed'
 * 按 DEBOUNCE_DELAY 合并去抖回放保序，delete 走 'vault:md-deleted' 即时通道
 * （obsidian-adapter 恒发、仅 md）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { createFileSync } from '../core/file-sync';
import { readClipbookData, updateClipbookData, type ClipbookData, type ClipMark } from './data';

// ---------- 同步纯函数（域内私有） ----------

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

// ---------- 路径 / 设置 ----------

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

// ---------- 壳装配（issue 365：队列/去抖/订阅/生命周期走 core/file-sync） ----------

/** clipbook.json 引用命中检查（范围外放行口径，同 memo E22）：marks 的 notePath 指向
 *  知识盒文献笔记，可不在剪藏目录监听范围内 */
async function referencedByClipbook(path: string): Promise<boolean> {
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
}

const agent = createFileSync<ClipbookData>({
  logTag: '[clipbook-file-sync]',
  failNotice: '剪藏本同步失败，数据可能不一致',
  failDedupeKey: 'clipbook-file-sync',
  watchedFolders: getWatchedFolders,
  /** clipbook.json 读改写事务（updateClipbookData 自带 per-path 串行队列与 D2 写契约） */
  commit: (apply) =>
    updateClipbookData((cur) => {
      apply(cur);
      return cur;
    }),
  referencedBy: referencedByClipbook,
  applyRename: syncRename,
  applyDelete: syncDelete,
});

/** 幂等初始化（main.ts onLayoutReady 常驻接线；ADR-0003 同款幂等） */
export function ensureFileSync(app: App): void {
  agent.ensure(app);
}

/** 卸载清理（壳置位 _cancelled 短路积压任务、丢弃去抖窗口内事件并退订全部监听） */
export function unloadFileSync(): void {
  agent.unload();
}
