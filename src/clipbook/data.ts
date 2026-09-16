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
 * - readLog: 阅读会话流水（issue 358）——插件侧阅读时长收集的唯一落点；news.json stats 段
 *   只有计数无时长，报告（report-ui/report-stats）从本段派生。
 */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';

/** 划词锚定标记（issue 329 / ADR-0144）：find = 选区原文（替换定位串），notePath = 文献笔记路径 */
export interface ClipMark {
  find: string;
  notePath: string;
  kind: 'term' | 'passage';
}

/** 已保存图片映射（issue 329）：src = 正文原外链（精确匹配），local = 本地 vault 路径 */
export interface ClipSavedImage {
  src: string;
  local: string;
}

/** 阅读会话流水条目（issue 358）：一次封存的连续阅读段（右栏/详情停留）。
 *  粒度 =「哪篇（key/title）· 哪里来（src）· 读多久（minutes 整分钟）· 何时封存（ts）」；
 *  同篇多次打开 = 多条记录（时段分布按段归桶），报告层聚合去重。 */
export interface ClipReadLogEntry {
  /** 条目稳定标识（articleKeyOf / clip:<path>） */
  key: string;
  title: string;
  /** 来源展示名（ClipArticle.srcName：B站 UP 名 / 平台 / 剪藏站点） */
  src: string;
  /** 本次会话整分钟（≥1；不足 1 分钟不记） */
  minutes: number;
  /** 会话封存时刻（epoch ms） */
  ts: number;
}

export interface ClipbookData {
  articleOverrides: Record<string, { reading?: boolean }>;
  savedArchive: Array<{ url: string; title: string; savedAt: string }>;
  order: string[];
  /** 划词锚定（issue 329 / ADR-0144）：articleKey → 选区替换标记（未保存条目暂存，保存物化即清） */
  marks: Record<string, ClipMark[]>;
  /** 已保存图片（issue 329）：articleKey → 外链→本地路径映射（保存物化时统一换链） */
  savedImages: Record<string, ClipSavedImage[]>;
  /** 待升级 source 的文献笔记路径（issue 329 / ADR-0144 source 两态；term/passage/plate 通用）：
   *  articleKey → 该条目发起录入的文献笔记路径清单，保存物化时回写 [[剪藏路径|标题]] */
  pendingSource: Record<string, string[]>;
  /** 阅读会话流水（issue 358）：append-only，追加时裁剪（180 天外 + 上限条数，见 flow trimReadLog）；
   *  旧侧写无此段 → 空数组兜底，零迁移 */
  readLog: ClipReadLogEntry[];
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
    // issue 329 新段：旧侧写无此三段 → 空对象兜底；段内结构容错（非法形态整段丢弃）
    marks: resolveRecord(data && (data as any).marks, (v: any) =>
      Array.isArray(v) ? v.filter((m: any) => m && typeof m.find === 'string' && typeof m.notePath === 'string') : []),
    savedImages: resolveRecord(data && (data as any).savedImages, (v: any) =>
      Array.isArray(v) ? v.filter((im: any) => im && typeof im.src === 'string' && typeof im.local === 'string') : []),
    pendingSource: resolveRecord(data && (data as any).pendingSource, (v: any) =>
      Array.isArray(v) ? v.map(String).filter(Boolean) : []),
    // issue 358 新段：旧侧写无此段 → 空数组兜底；条目形态容错（非法条目整条丢弃）
    readLog: resolveReadLog((data as any)?.readLog),
  };
}

/** readLog 段容错解析（issue 358）：非数组 → 空数组；条目缺关键字段/时长非法 → 丢弃 */
function resolveReadLog(raw: any): ClipReadLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e: any) =>
    e && typeof e === 'object'
    && typeof e.key === 'string' && e.key
    && typeof e.minutes === 'number' && isFinite(e.minutes) && e.minutes > 0
    && typeof e.ts === 'number' && isFinite(e.ts)
  ).map((e: any) => ({
    key: e.key,
    title: typeof e.title === 'string' ? e.title : '',
    src: typeof e.src === 'string' ? e.src : '',
    minutes: e.minutes,
    ts: e.ts,
  }));
}

/** Record 段容错解析：非对象 → 空对象；每值经 coerce 归一 */
function resolveRecord<T>(raw: any, coerce: (v: any) => T[]): Record<string, T[]> {
  if (!raw || raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, T[]> = {};
  for (const k of Object.keys(raw)) out[k] = coerce((raw as any)[k]);
  return out;
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
  return { articleOverrides: {}, savedArchive: [], order: [], marks: {}, savedImages: {}, pendingSource: {}, readLog: [] };
}
