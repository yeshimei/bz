/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：clipbook.json 侧写读写。
 * 纯数据层（无 DOM、无事件），node 环境可测。
 *
 * clipbook.json 语义（ADR-0082 §2）：news.json 不新增段（外部守护进程写契约），
 * 插件阅读状态落此侧写：
 * - articleOverrides: 稳定标识 → { reading?: boolean }（news.json 只存 read/state 布尔档，
 *   「在读」需插件侧写承载；已保存标记 news 侧已有 state，不进此表）
 * - savedArchive: 遗留兼容段——原设计意图是回填「news.json 已删（保留策略清理）但剪藏
 *   目录仍留」的已保存残留；当前**无产出方**（清理路径已改 removeArticleKeys，不再为此段
 *   回填；仅 checkup 修复会剔除指向不存在剪藏的残留，不新增）。读取侧仍作为 saved 判定
 *   通道之一保留（store 的 savedKeys），实际 saved 判定主要靠 clipByUrl（url 命中剪藏
 *   目录）与 news 侧 state，故无产出方不影响状态正确性。
 * - order: 「全部未读」排序（本票不做拖拽，段预留）
 */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';

export interface ClipbookData {
  articleOverrides: Record<string, { reading?: boolean }>;
  savedArchive: Array<{ url: string; title: string; savedAt: string }>;
  order: string[];
}

export const CLIPBOOK_JSON = 'clipbook.json';

/** clipbook.json 路径（跟随 storagePath；默认 CONFIG/STORAGE/clipbook.json） */
export function clipbookFilePath(): string {
  return storageFile(CLIPBOOK_JSON);
}

function resolve(data: ClipbookData): ClipbookData {
  return {
    articleOverrides: data && data.articleOverrides !== null && typeof data.articleOverrides === 'object' && !Array.isArray(data.articleOverrides)
      ? data.articleOverrides
      : {},
    savedArchive: Array.isArray(data && data.savedArchive)
      ? (data.savedArchive as any[]).filter((s) => s && typeof s === 'object' && s.url)
      : [],
    order: Array.isArray(data && data.order) ? (data.order as any[]).map(String) : [],
  };
}

/** 读 clipbook.json（缺失/损坏 → 空侧写 + 建文件） */
export async function readClipbookData(): Promise<ClipbookData> {
  const data = await jsonFileStore<any>(clipbookFilePath(), { defaultValue: () => emptySidecar() }).read();
  return resolve(data || {});
}

/** 写回 clipbook.json（整段覆盖）。C30：写失败上抛（原静默吞错让 updateClipbookData
 *  的调用方拿到假成功、重载回跳）——调用方自行决定提示/降级（flowDeleteNews 已有 catch） */
export async function writeClipbookData(data: ClipbookData): Promise<void> {
  await jsonFileStore<ClipbookData>(clipbookFilePath(), { defaultValue: () => emptySidecar() }).write(data);
}

/**
 * 读改写事务（D2 可靠写契约原语 1 收编）：侧写「读→改→写」整体入 core per-path 串行队列，
 * mutator 基于磁盘现值产出新侧写。并发动作（在读切换 × N、删除清理与在读切换交错）
 * 不再基于过期快照互相覆盖；坏文件由 jsonFileStore 留档降级（原语 3）。
 * C30：写盘失败时 Promise reject（不再返回未落盘的 next 假成功）。
 * 注意：队列不可重入——mutate 内勿对 clipbook.json 再调本函数/enqueueFileTask。
 */
export function updateClipbookData(mutate: (cur: ClipbookData) => ClipbookData): Promise<ClipbookData> {
  return enqueueFileTask(clipbookFilePath(), async () => {
    const cur = await readClipbookData();
    const next = mutate(cur);
    await writeClipbookData(next);
    return next;
  });
}

export function emptySidecar(): ClipbookData {
  return { articleOverrides: {}, savedArchive: [], order: [] };
}
