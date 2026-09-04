/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：clipbook.json 侧写读写。
 * 纯数据层（无 DOM、无事件），node 环境可测。
 *
 * clipbook.json 语义（ADR-0082 §2）：news.json 不新增段（外部守护进程写契约），
 * 插件阅读状态落此侧写：
 * - articleOverrides: 稳定标识 → { reading?: boolean }（news.json 只存 read/state 布尔档，
 *   「在读」需插件侧写承载；已保存标记 news 侧已有 state，不进此表）
 * - savedArchive: news.json 中已删（保留策略清理）但剪藏目录仍留的已保存残留
 *   ——保留策略删除后若无此段，目录里的旧剪藏会回落到「未读」错态。
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

/** 写回 clipbook.json（整段覆盖；静默吞错） */
export async function writeClipbookData(data: ClipbookData): Promise<void> {
  try {
    await jsonFileStore<ClipbookData>(clipbookFilePath(), { defaultValue: () => emptySidecar() }).write(data);
  } catch (e) { /* 静默 */ }
}

/**
 * 读改写事务（D2 可靠写契约原语 1 收编）：侧写「读→改→写」整体入 core per-path 串行队列，
 * mutator 基于磁盘现值产出新侧写。并发动作（在读切换 × N、删除清理与在读切换交错）
 * 不再基于过期快照互相覆盖；坏文件由 jsonFileStore 留档降级（原语 3）。
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
