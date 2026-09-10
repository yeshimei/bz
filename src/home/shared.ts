/**
 * 内容首页（home 域）渲染纯层·共享层（ADR-0104 markup 单源 + ADR-0105 布局×主题分层）。
 *
 * 本文件是「原型 × 插件」跨布局共享的唯一事实源：域清单/活动河类型与口径/
 * 规则纯函数（点评/预告/彩点/计数文案）/日期文案全部出自这里——
 *   - 插件侧：ui.ts / river.ts 直接 import（事件绑定/core 服务/数据读写留各自实现）；
 *   - 原型侧：dev watch 打成 prototype-render.js（IIFE，挂 window.BZR_home），壳消费同一份。
 * 纯层契约（tests/core/render-purity.test.ts 守卫）：import 白名单仅 `../core/ui/str`
 * 与 `../core/domain-icons`（零依赖常量表）；recap 类型仅 type-only（编译期擦除）。
 * 禁 obsidian/moment/core 服务/组件库 barrel；禁模块级可变状态（活动河数据与视图状态
 * 显式入参）；图标一律 `<i data-lucide>` 占位，由各端 mountIcons 物化。
 * 布局差异层（面板骨架/周历/河卡）见 layouts/river/render.ts；域入口 render.ts 聚合两者。
 */
import { esc, iconSpan } from '../core/ui/str';
import { DOMAIN_ICONS } from '../core/domain-icons';
import type { RecapItem, RecapSummary } from '../recap/aggregate';

// 再出口（壳经 window.BZR_home 取用；插件 ui.ts 亦统一从这里取）
export { esc, iconSpan };
export { DOMAIN_ICONS };

/* ---------- 域清单（原 domains.ts 收编；domains.ts re-export 兼容旧引用） ---------- */

/** 磁贴 id → 事实源键（settings/vault 与域 id 异名，其余同键；wall 随日记本正名并一，ADR-0115） */
const ICON_KEY: Record<string, string> = { settings: 'settings-panel', vault: 'password-vault' };
/** 图标一律取 core/domain-icons 单一事实源（终局 review 批 B：17 条字面量迁移，值不变） */
const iconOf = (id: string): string => DOMAIN_ICONS[ICON_KEY[id] ?? id];

export interface HomeDomain {
  /** 域名 id（home.json pinned 存储值） */
  id: string;
  /** 命令 id（点卡执行） */
  commandId: string;
  name: string;
  /** 卡片副题（静态；动态统计见徽标） */
  sub: string;
  /** lucide 图标名（Obsidian setIcon 已注册名） */
  icon: string;
}

export const DOMAINS: HomeDomain[] = [
  { id: 'diary', commandId: 'bz-diary-open', name: '日记本', sub: '写今天的闪念 · 回忆媒体墙', icon: iconOf('diary') },
  { id: 'cinema', commandId: 'bz-cinema-open', name: '影院', sub: '影视想看与在看', icon: iconOf('cinema') },
  { id: 'review', commandId: 'bz-review-open', name: '复习计划', sub: '到期卡片队列', icon: iconOf('review') },
  { id: 'pomodoro', commandId: 'bz-pomodoro-open', name: '番茄钟', sub: '专注计时', icon: iconOf('pomodoro') },
  { id: 'favorites', commandId: 'bz-favorites-open', name: '收藏本', sub: '收藏条目', icon: iconOf('favorites') },
  { id: 'clipping', commandId: 'bz-clipbook-open', name: '剪藏本', sub: '未读流与剪藏', icon: iconOf('clipping') },
  // 文献盒（literature 域，ADR-0072）：文献笔记列表 + 视频/术语录入（补内容域曝光位）
  { id: 'knowledge', commandId: 'bz-knowledge-open', name: '知识盒', sub: '文献录入 · 卡片 · 主题', icon: iconOf('knowledge') },
  // 旧书库（library）域退役：本卡由书架墙（bookshelf）承接（id 变更后旧 home.json 里钉选的 library 自动失效，可在编辑模式重钉）
  { id: 'bookshelf', commandId: 'bz-bookshelf-open', name: '书库', sub: '藏书与读书笔记', icon: iconOf('bookshelf') },
  // 第二大脑（secondbrain 域，issue 251）：主面板统一入口（检索/对话/灵感参考都从面板进）
  { id: 'secondbrain', commandId: 'bz-secondbrain-panel', name: '第二大脑', sub: '笔记检索与问答', icon: iconOf('secondbrain') },
  { id: 'belongings', commandId: 'bz-belongings-open', name: '归物本', sub: '物品登记', icon: iconOf('belongings') },
  { id: 'attach', commandId: 'bz-attach-move', name: '移动附件', sub: '附件归位', icon: iconOf('attach') },
  { id: 'encrypt', commandId: 'bz-encrypt-open', name: '保险库', sub: '密码·加密笔记·日记', icon: iconOf('encrypt') },
  // 密码本（password-vault 域，ADR-0109 拆回独立域；id 沿用合并前磁贴 id，旧钉选自动复活）
  { id: 'vault', commandId: 'bz-password-vault-open', name: '密码本', sub: '密码与密钥', icon: iconOf('vault') },
  { id: 'settings', commandId: 'bz-settings-panel-open', name: '设置', sub: '全域设置', icon: iconOf('settings') },
];

export const DOMAIN_MAP: Map<string, HomeDomain> = new Map(DOMAINS.map((d) => [d.id, d]));

/** 徽标功能色（数据语义，双主题一致） */
export const DOMAIN_DOT: Record<string, string> = {
  diary: '#e67341',
  recap: '#d64d8f',
  cinema: '#e6951d',
  review: '#7c5cd6',
  pomodoro: '#e5534b',
  favorites: '#f0b429',
  clipping: '#2f9e5f',
  knowledge: '#c2559d',
  bookshelf: '#3d7bd6',
  secondbrain: '#a33d2a',
  'reading-report': '#3fa7a0',
  belongings: '#45a35c',
  attach: '#8a8f99',
  encrypt: '#8a8f99',
  vault: '#c9a227',
  smartcat: '#e67341',
  settings: '#8a8f99',
};

/** 全量域 id（钉选候选/迷你 chips 遍历顺序） */
export const ALL_DOMAIN_IDS: string[] = DOMAINS.map((d) => d.id);

/* ---------- 活动河类型（原 river.ts 纯类型段收编；river.ts re-export 兼容） ---------- */

/** 时间线一条痕迹（recap RecapItem 的域展宽版：memo 保留原名，前端图标/名称映射） */
export type RiverEvent = RecapItem;

/** 日记连击态 */
export interface RiverStreak {
  /** 从今天（未写不算断）往回连续写日记的天数 */
  diaryStreak: number;
  diaryWrittenToday: boolean;
}

/** 全部域入口实时计数（口径注释见 river.ts 各采集分支） */
export interface RiverCounts {
  diaryTotal: number;
  reviewTotal: number;
  reviewOverdue: number;
  reviewDueTomorrow: number;
  cinemaWant: number;
  cinemaWatching: number;
  bookshelfReading: number;
  bookshelfFinished: number;
  clippingUnread: number;
  favoritesTotal: number;
  belongingsTotal: number;
}

export const EMPTY_COUNTS: RiverCounts = {
  diaryTotal: 0,
  reviewTotal: 0,
  reviewOverdue: 0,
  reviewDueTomorrow: 0,
  cinemaWant: 0,
  cinemaWatching: 0,
  bookshelfReading: 0,
  bookshelfFinished: 0,
  clippingUnread: 0,
  favoritesTotal: 0,
  belongingsTotal: 0,
};

/** 时间线摘要（recap RecapSummary + memoCreated：彩点规则的需要） */
export interface RiverSummary extends RecapSummary {
  /** 今日新增备忘录条数（recap 摘要无此字段，由时间线「新增备忘录」条目数派生） */
  memoCreated: number;
}

export const EMPTY_SUMMARY: RiverSummary = {
  diary: 0, movies: 0, books: 0, memoDone: 0, memoCreated: 0, pomodoros: 0, pomodoroMinutes: 0,
};

/** 一天的时间线（今天/昨天同构） */
export interface RiverDay {
  dateStr: string;
  events: RiverEvent[];
  summary: RiverSummary;
  /** 第一条痕迹时刻（无痕迹为 null；点评「动手早晚」比较用） */
  firstTs: number | null;
}

/** 周历一格（头行动静历，可点切天） */
export interface RiverWeekDay {
  /** 完整日期 'YYYY-MM-DD'（视图键，与 days[].dateStr 同键） */
  dateStr: string;
  /** 展示用 'MM-DD' */
  label: string;
  dayOfMonth: number;
  weekday: string;
  /** 当天有动静（时间线非空） */
  hit: boolean;
}

/** 活动河聚合结果 */
export interface RiverData {
  today: RiverDay;
  yesterday: RiverDay;
  /** 本周 7 天窗口（index 0 = 今天，往回 6 天；周历切天的数据源） */
  days: RiverDay[];
  week: RiverWeekDay[];
  streak: RiverStreak;
  counts: RiverCounts;
}

/* ---------- 日期/文案小工具 ---------- */

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD'（本地时区） */
export function dateStrOf(anchor: number): string {
  const d = new Date(anchor);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function fmtHm(t: number): string {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 头行日期文案：'YYYY-MM-DD 周X · HH:mm'（打开时刻现取，非模块级状态） */
export function headDateText(now: number = Date.now()): string {
  const d = new Date(now);
  const wd = '日一二三四五六'[d.getDay()];
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} 周${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/* ---------- 规则纯函数（原型 buildNotes/buildPreviews/buildDots 一比一移植） ---------- */

/** 时间线规则点评：index = 挂靠的事件下标（-1 = 空河整条点评，UI 层渲染在时间线顶部） */
export interface RiverNote {
  index: number;
  text: string;
}

/** 点评规则（node 可测）：
 *  - 首条动静 vs 昨天首条：早晚分钟差点评（昨天无痕迹则报首动时刻）；
 *  - 今晚（≥18 点）有动静、日记还空着且连击 >0 → 末条挂连击提醒 */
export function buildNotes(data: RiverData): RiverNote[] {
  const notes: RiverNote[] = [];
  const day = data.today;
  if (!day.events.length) return notes;
  if (day.firstTs !== null) {
    if (data.yesterday.firstTs !== null) {
      const diff = Math.round((day.firstTs - data.yesterday.firstTs) / 60000);
      if (diff > 0) notes.push({ index: 0, text: `动手比昨天晚了 ${diff} 分钟，不过来了就好。` });
      else if (diff < 0) notes.push({ index: 0, text: `动手比昨天早了 ${-diff} 分钟，好开头。` });
      else notes.push({ index: 0, text: '和昨天几乎同一时间动手，节奏很稳。' });
    } else {
      notes.push({ index: 0, text: `今天第一笔动静在 ${fmtHm(day.firstTs)}。` });
    }
  }
  const last = day.events[day.events.length - 1];
  const evening = new Date(last.ts);
  evening.setHours(18, 0, 0, 0);
  if (!data.streak.diaryWrittenToday && data.streak.diaryStreak > 0 && last.ts >= evening.getTime()) {
    notes.push({ index: day.events.length - 1, text: `晚上效率回来了——但日记还空着，×${data.streak.diaryStreak} 连击在等你。` });
  }
  return notes;
}

/** 明天预告卡 */
export interface RiverPreview {
  h: string;
  b: string;
  go: string;
  goLabel: string;
}

/** 预告规则（node 可测）：复习到期/逾期 → 剪藏库存 → 日记连击，三张卡 */
export function buildPreviews(data: RiverData): RiverPreview[] {
  const c = data.counts;
  const t = data.today.summary;
  const s = data.streak;
  const out: RiverPreview[] = [];
  if (c.reviewDueTomorrow > 0) {
    out.push({ h: `复习将到期 ${c.reviewDueTomorrow} 张`, b: '按 SRS 间隔推算，明天到期。今晚顺手过一遍队列，明天正好清干净。', go: 'review', goLabel: '去复习计划 →' });
  } else if (c.reviewOverdue > 0) {
    out.push({ h: `还有 ${c.reviewOverdue} 张逾期卡`, b: '逾期是唯一会随时间变贵的债。约 4 分钟一张，还掉最划算。', go: 'review', goLabel: '去还卡 →' });
  } else {
    out.push({ h: t.pomodoros > 0 ? `今天已专注 ${t.pomodoros} 轮` : '番茄引擎待命', b: '排一轮 25 分钟给明天最重要的那件事。', go: 'pomodoro', goLabel: '开番茄钟 →' });
  }
  out.push(
    c.clippingUnread > 0
      ? { h: `剪藏还压 ${c.clippingUnread} 篇`, b: '挑 1 篇放进明早：通勤读一篇，保持进出平衡。', go: 'clipping', goLabel: '挑一篇放明早 →' }
      : { h: '剪藏库已清空', b: '库存干净了，明天遇到好文章放心收。', go: 'clipping', goLabel: '去剪藏本 →' }
  );
  if (!s.diaryWrittenToday && s.diaryStreak > 0) {
    out.push({ h: `日记连击 ×${s.diaryStreak} 待续`, b: '写三行也算数。今晚补上，明天它自己接着长。', go: 'diary', goLabel: '去写日记 →' });
  } else if (s.diaryWrittenToday) {
    out.push({ h: `今日日记已写 · 连击 ×${s.diaryStreak + 1}`, b: '明天同一时间回来续上，连击就是这么长起来的。', go: 'diary', goLabel: '看日记本 →' });
  } else {
    out.push({ h: '给明天留一句话', b: '今晚写一篇日记，明晚它会变成日记本媒体墙上的新格子。', go: 'diary', goLabel: '去写日记 →' });
  }
  return out;
}

/** 入口行彩点状态：ok=今天有动静 / warn=提醒（日记连击）/ hot=逾期 / off=无动静 */
export type RiverDot = 'ok' | 'warn' | 'hot' | 'off';

/** 彩点规则（node 可测；与原型 buildDots 一致，映射到 home 域 id：memo/memo 同源） */
export function buildDots(data: RiverData): Record<string, RiverDot> {
  const day = data.today;
  const hasEvent = (d: string): boolean => day.events.some((e) => e.domain === d);
  return {
    diary: day.summary.diary > 0 ? 'ok' : data.streak.diaryStreak > 0 ? 'warn' : 'off',
    review: data.counts.reviewOverdue > 0 ? 'hot' : 'off',
    memo: day.summary.memoDone + day.summary.memoCreated > 0 ? 'ok' : 'off',
    pomodoro: day.summary.pomodoros > 0 ? 'ok' : 'off',
    cinema: hasEvent('cinema') ? 'ok' : 'off',
    bookshelf: hasEvent('bookshelf') ? 'ok' : 'off',
  };
}

/** 入口行彩点（river 规则只覆盖有动静语义的 6 域，其余恒 off） */
export function dotOf(dots: Record<string, RiverDot>, id: string): RiverDot {
  return dots[id] ?? 'off';
}

/** 全部域入口行计数文案（id 与 DOMAINS 一致；缺数据回落域副题） */
export function riverCountText(id: string, data: RiverData): string | null {
  const c = data.counts;
  switch (id) {
    case 'diary':
      return `${c.diaryTotal} 篇${data.streak.diaryWrittenToday ? ' · 今日已写' : ''}`;
    case 'review':
      return c.reviewOverdue > 0 ? `${c.reviewTotal} 张 · 逾期 ${c.reviewOverdue}` : `${c.reviewTotal} 张在册`;
    case 'cinema':
      return `想看 ${c.cinemaWant} · 在看 ${c.cinemaWatching}`;
    case 'bookshelf':
      return `在读 ${c.bookshelfReading} · 读完 ${c.bookshelfFinished}`;
    case 'clipping':
      return `未读 ${c.clippingUnread} 篇`;
    case 'favorites':
      return `${c.favoritesTotal} 条`;
    case 'belongings':
      return `登记 ${c.belongingsTotal} 件`;
    default:
      return null; // recap/literature/reading-report/attach/encrypt/vault/smartcat/settings/pomodoro 走域副题
  }
}

