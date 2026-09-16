/**
 * 首页时间线行为流数据层（issue 305 / ADR-0132）：时间线痕迹源自 collectRecap 文件统计
 * 整体替换为小橘行为流（CONFIG/STORAGE/smartcat-behavior.json，只读契约——探测存在再读，
 * 缺失/损坏回落空）。行为流只由插件内动作埋点写入，外部文件改动（批量编辑/同步/迁移）
 * 天然免疫（ADR-0129 回填事故的整类根除）。
 *
 * 映射表（宁缺勿假，ADR-0132）：无效/噪音动作（movie:deleted、memo:edited 等）返回 null
 * 不进时间线；事件直带 kind（produce/progress/note/skipped），过滤不再走文案前缀判类。
 * 纯数据层（无 DOM），node 环境可测。
 */
import type { App, TFile } from 'obsidian';
import { storageFile } from '../core/storage';
import { localDayKey } from '../core/utils';
import { pad2 } from '../core/ui/str';
import type { RiverEvent, TimelineEventKind } from './shared';

/** 行为流侧车文件（单源在 smartcat/memory.ts，此处按存储路径只读） */
const BEHAVIOR_SIDECAR = 'smartcat-behavior.json';

/** 行为流 source → **首页域 id**（渲染取图标/色/名，彩点 hasEvent 也认这个 id）。
 *  语义先例见 smartcat/dashboard.ts 的来源标签表：literature / bili-downloader 是知识盒
 *  旧域名的存量来源（ADR-0072 迁出后 source 值不迁移）。未收录来源原样透传（渲染回退显示源名）。 */
const SOURCE_DOMAIN: Record<string, string> = {
  movie: 'cinema',
  news: 'clipping',
  memo: 'memo',
  knowledge: 'knowledge',
  literature: 'knowledge',
  'bili-downloader': 'knowledge',
  favorites: 'favorites',
  review: 'review',
  diary: 'diary',
  pomodoro: 'pomodoro',
  belongings: 'belongings',
  library: 'bookshelf',
};

/** 行为流 source → 首页域 id（导出供测试与将来复用） */
export function behaviorSourceDomain(source: string): string {
  return SOURCE_DOMAIN[source] ?? source;
}

/** 行为流条目的最小读取面（容错解析后的归一形态） */
export interface BehaviorItemLite {
  source: string;
  type: string;
  name: string;
  rating: number | null;
  ts: number;
}

/** 时间线事件（RiverEvent + kind 必填：行为流映射时已定死） */
export type TimelineEvent = RiverEvent & { kind: TimelineEventKind };

/** 行为流原始条目容错归一（description 剥 `src:type ` 前缀兜底名称） */
export function normalizeBehaviorItem(raw: unknown): BehaviorItemLite | null {
  if (!raw || typeof raw !== 'object') return null;
  const it = raw as Record<string, unknown>;
  const source = typeof it.source === 'string' ? it.source : '';
  const type = typeof it.type === 'string' ? it.type : '';
  if (!source || !type) return null;
  const ts = Date.parse(String(it.timestamp ?? ''));
  if (!Number.isFinite(ts)) return null;
  const meta = (it.metadata ?? {}) as Record<string, unknown>;
  let name = typeof meta.name === 'string' ? meta.name.trim() : '';
  if (!name) {
    const desc = String(it.description ?? '');
    name = desc.replace(/^[a-z-]+:[a-z-]+\s*/i, '').trim();
  }
  const rating = typeof meta.rating === 'number' && Number.isFinite(meta.rating) ? meta.rating : null;
  return { source, type, name, rating, ts };
}

/** 归一化片名包装（与 recap 文案口径一致：《》/『』/「」） */
const wrap = (name: string, open: string, close: string): string => (name ? `${open}${name}${close}` : '');

/**
 * 行为条目 → 时间线事件（纯函数，ADR-0132 映射表）。
 * 返回 null = 该动作不进时间线（删除/编辑类噪音、无名条目、未收录源）。
 */
export function mapBehaviorEvent(item: BehaviorItemLite): TimelineEvent | null {
  const time = new Date(item.ts);
  const timeLabel = `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
  const base = { domain: behaviorSourceDomain(item.source), ts: item.ts, timeLabel };
  const key = `${item.source}:${item.type}`;
  // 复习启动条目无名（coverage-source 只发 {review, started}）→ 不走无名守卫
  if (key === 'review:started') return { ...base, kind: 'produce', text: '开始复习' };
  const name = item.name.trim();
  if (!name) return null;
  switch (key) {
    // 影院
    case 'movie:want':
      return { ...base, kind: 'progress', text: `${wrap(name, '《', '》')}加入片单` };
    case 'movie:watching':
      return { ...base, kind: 'progress', text: `开始看${wrap(name, '《', '》')}` };
    case 'movie:watched':
      return { ...base, kind: 'produce', text: `标记${wrap(name, '《', '》')}已看` };
    case 'movie:rated':
      return { ...base, kind: 'note', text: `评价${wrap(name, '《', '》')}${item.rating !== null ? ` ★${item.rating}` : ''}` };
    // 聚合讯
    case 'news:saved':
      return { ...base, kind: 'produce', text: `收藏文章${wrap(name, '『', '』')}` };
    case 'news:skipped':
      return { ...base, kind: 'skipped', text: `已跳过${wrap(name, '『', '』')}` };
    // 备忘录（added 保留「新增备忘录」前缀：memoCreated 派生契约）
    case 'memo:added':
      return { ...base, kind: 'progress', text: `新增备忘录『${name}』` };
    case 'memo:completed':
      return { ...base, kind: 'produce', text: `完成『${name}』` };
    // 知识盒 / 文献盒
    case 'knowledge:term-generated':
    case 'literature:term-generated':
      return { ...base, kind: 'produce', text: `生成术语${wrap(name, '『', '』')}` };
    case 'knowledge:passage-generated':   // issue 309 段落录入
      return { ...base, kind: 'produce', text: `整理段落${wrap(name, '『', '』')}` };
    case 'knowledge:image-generated':     // issue 312 图版录入
      return { ...base, kind: 'produce', text: `读图${wrap(name, '『', '』')}` };
    case 'knowledge:converted':
    case 'literature:converted':
      return { ...base, kind: 'produce', text: `转化${wrap(name, '『', '』')}` };
    // 收藏夹
    case 'favorites:added':
      return { ...base, kind: 'produce', text: `收藏站点${wrap(name, '『', '』')}` };
    // 视频下载
    case 'bili-downloader:added':
      return { ...base, kind: 'progress', text: `添加下载${wrap(name, '『', '』')}` };
    case 'bili-downloader:converted':
      return { ...base, kind: 'produce', text: `下载完成${wrap(name, '『', '』')}` };
    default:
      return null; // movie:deleted / memo:edited / review:added 等噪音动作与未收录源
  }
}

/** 读行为流侧车（只读契约：探测存在再读，缺失/损坏回落空数组） */
export async function readBehaviorItems(app: App): Promise<BehaviorItemLite[]> {
  try {
    const filePath = storageFile(BEHAVIOR_SIDECAR);
    if (!app.vault.getAbstractFileByPath(filePath)) return [];
    const f = app.vault.getAbstractFileByPath(filePath) as TFile;
    const parsed: unknown = JSON.parse(await app.vault.read(f));
    const items = (parsed as Record<string, unknown>)?.items;
    if (!Array.isArray(items)) return [];
    return items.map(normalizeBehaviorItem).filter((x): x is BehaviorItemLite => x !== null);
  } catch {
    return [];
  }
}

/** 本地日串 'YYYY-MM-DD'（issue 347 收编：转发 core localDayKey，原手写逐字等价） */
function dateStrOf(ts: number): string {
  return localDayKey(ts);
}

/**
 * 行为流 → 按日时间线（纯函数）：取最近 days 天（今天起往回），事件升序、直带 kind。
 * 映射为 null 的动作在分桶前剔除。
 */
export function behaviorToDays(
  items: BehaviorItemLite[],
  now: number,
  days: number,
): Array<{ dateStr: string; events: TimelineEvent[] }> {
  const out: Array<{ dateStr: string; events: TimelineEvent[] }> = [];
  for (let i = 0; i < days; i++) {
    const dayTs = now - i * 86400000;
    const day = dateStrOf(dayTs);
    const events: TimelineEvent[] = [];
    for (const item of items) {
      if (dateStrOf(item.ts) !== day) continue;
      const ev = mapBehaviorEvent(item);
      if (ev) events.push(ev);
    }
    events.sort((a, b) => a.ts - b.ts);
    out.push({ dateStr: day, events });
  }
  return out;
}
