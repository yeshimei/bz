/**
 * 日记本「概念稿」数据入口（prototypes 专用，非产品代码）
 *
 * 为什么要有它：概念稿要的是「大刀阔斧、方向完全不同」的版式探索，不可能沿用
 * 现有 render.ts/ui.ts 的 markup 与行为——但它们必须吃**同一份真数据**，否则日期/
 * 标签/媒体全是伪的，评审没有意义。
 *
 * 做法：与 fake-sim.ts 完全同源的启动注入（FakeApp + 真 config/data 链），
 * 但出口不是 openPanel，而是把聚合后的 WallEntry 模型交给概念页：
 *   window.BZ_CONCEPT.boot() → Promise<模型>
 * 解析/排序/媒体 URL 全部走 src/diary/{parser,data,config}.ts 真实现，零复制。
 *
 * 产物：scripts/build-diary-concepts.mjs → concepts/concept-data.js（IIFE，挂 BZ_CONCEPT）
 */
import { FakeApp, encodeSeedFile } from '../fake/fake-obsidian';
import { setApp } from '../../../src/core/app';
import { setSettingsProvider } from '../../../src/core/settings-provider';
import { applyDirectories } from '../../../src/diary/config';
import {
  loadWallEntries,
  groupByMonth,
  mediaSrc,
  pickOnThisDay,
  type WallEntry,
} from '../../../src/diary/data';

/** 快照来源：自身 window 优先；iframe 场景读父页（window.DIARY 的全局声明见 fake-obsidian.ts） */
function seedSource(): { FILES?: Array<{ path: string; content: string; ctime: number }> } | null {
  return window.DIARY || (window.parent && (window.parent as Window).DIARY) || null;
}

function seedVault(): void {
  const files = seedSource()?.FILES || [];
  if (files.length && !localStorage.getItem('bz-sim:' + files[0].path)) {
    for (const f of files) {
      localStorage.setItem('bz-sim:' + f.path, encodeSeedFile(f.content, { ctime: f.ctime, mtime: f.ctime }));
    }
  }
}

export interface ConceptTagCount {
  tag: string;
  count: number;
}

export interface ConceptDay {
  date: string;
  entries: WallEntry[];
}

export interface ConceptModel {
  /** 全量条目（date/time 降序） */
  entries: WallEntry[];
  /** 按日分组（降序，同日按时间降序） */
  days: ConceptDay[];
  /** 按标签计数（降序）——用于「类型/主题」维度的版式实验 */
  tagCounts: ConceptTagCount[];
  /** 按内容类型计数：日记 / 影视 / 信 / 书 */
  kindCounts: { diary: number; movie: number; letter: number; book: number };
  /** 期间：最早 / 最晚日期 */
  span: { from: string; to: string; years: number };
  /** 媒体 URL 解析（走真 vault 资源路径；原型下为 /__vault-media/<名> 按需供给） */
  mediaUrl: (name: string, sourcePath?: string) => string;
  /** 指定日期（YYYY-MM-DD）的「那年今天」条目 */
  onThisDay: (today: string) => WallEntry[];
  /** 按月分组（'YYYY-MM' → 条目） */
  months: Map<string, WallEntry[]>;
}

let _model: ConceptModel | null = null;

/** 启动并产出模型（幂等：同页重复调用返回同一实例） */
export async function boot(): Promise<ConceptModel> {
  if (_model) return _model;

  seedVault();
  setSettingsProvider(() => ({}) as never);
  const app = new FakeApp();
  setApp(app as never);
  applyDirectories({});

  const entries = await loadWallEntries(app as never);

  // 标签计数（一份数据，多种版式视角的原料）
  const tagMap = new Map<string, number>();
  const kindCounts = { diary: 0, movie: 0, letter: 0, book: 0 };
  for (const e of entries) {
    kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
    for (const t of e.tags) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  }
  const tagCounts = [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  // 按日分组
  const dayMap = new Map<string, WallEntry[]>();
  for (const e of entries) {
    let list = dayMap.get(e.date);
    if (!list) {
      list = [];
      dayMap.set(e.date, list);
    }
    list.push(e);
  }
  const days: ConceptDay[] = [...dayMap.entries()]
    .map(([date, list]) => ({ date, entries: list }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const dates = entries.map((e) => e.date).sort();
  const from = dates[0] || '';
  const to = dates[dates.length - 1] || '';

  _model = {
    entries,
    days,
    tagCounts,
    kindCounts,
    span: {
      from,
      to,
      years: from && to ? Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 : 0,
    },
    mediaUrl: (name, sourcePath) => mediaSrc(app as never, name, sourcePath),
    onThisDay: (today) => pickOnThisDay(entries, today),
    months: groupByMonth(entries),
  };
  return _model;
}

/** 供概念页同步取用（boot 之后） */
export function model(): ConceptModel {
  if (!_model) throw new Error('BZ_CONCEPT.boot() 尚未完成');
  return _model;
}

/** 便捷：媒体名 → 可直接塞进 img/video 的 URL（失败返回空串，交页面走占位） */
export function url(name: string, sourcePath?: string): string {
  return model().mediaUrl(name, sourcePath);
}

/** 标签 → 稳定色调（概念稿配色用；按标签名散列到 HSL，同一标签恒定同色） */
export function tagHue(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360;
  return h;
}
