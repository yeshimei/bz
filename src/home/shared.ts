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
  // 备忘录（memo 域，ADR-0092/0117）：2026-09-10 用户拍板补入首页入口（此前只在命令面板可达）
  { id: 'memo', commandId: 'bz-memo-open', name: '备忘录', sub: '随手记与待办', icon: iconOf('memo') },
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
  // 移动附件（attach 域）：2026-09-10 用户拍板自首页入口移除（命令仍可在命令面板调用）
  { id: 'encrypt', commandId: 'bz-encrypt-open', name: '保险库', sub: '密码·加密笔记·日记', icon: iconOf('encrypt') },
  // 密码本（password-vault 域，ADR-0109 拆回独立域；id 沿用合并前磁贴 id，旧钉选自动复活）
  { id: 'vault', commandId: 'bz-password-vault-open', name: '密码本', sub: '密码与密钥', icon: iconOf('vault') },
  { id: 'settings', commandId: 'bz-settings-panel-open', name: '设置', sub: '全域设置', icon: iconOf('settings') },
];

export const DOMAIN_MAP: Map<string, HomeDomain> = new Map(DOMAINS.map((d) => [d.id, d]));

/** 徽标功能色（数据语义，双主题一致） */
export const DOMAIN_DOT: Record<string, string> = {
  diary: '#e67341',
  memo: '#e8590c',
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

/* ---------- 入口顺序（2026-09-10 用户拍板：桌面/移动各排各的，持久化 home.json） ---------- */

/**
 * 按持久化顺序重排域清单（纯函数，node 可测）。
 *  - 未列出的域（此后新增的域）保持 DOMAINS 声明顺序，整体落在已列出项之后；
 *  - 已退役/未知 id 自然被忽略（不在 domains 里就不参与排序）；
 *  - sort 在 V8 稳定 → 未列出项之间的先后 = DOMAINS 声明顺序。
 */
export function applyOrder(order: readonly string[] | null | undefined, domains: HomeDomain[] = DOMAINS): HomeDomain[] {
  if (!order || !order.length) return domains;
  const rank = new Map<string, number>();
  order.forEach((id, i) => { if (!rank.has(id)) rank.set(id, i); });
  const MISS = Number.MAX_SAFE_INTEGER;
  return [...domains].sort((a, b) => (rank.get(a.id) ?? MISS) - (rank.get(b.id) ?? MISS));
}

/**
 * 把 id 在**可见序列**内挪到指定下标（纯函数，node 可测；拖拽排序的落点计算用）。
 * 入参 order 先归一化成**完整顺序**（= applyOrder 的 id 序列，补齐未列出域）：
 * 首次排序时 order 为空，拖一次就要落盘完整 14 项，而不是只存动过的那两项。
 *
 * 下标口径：**只对可见域计数**（hidden 里的域不占位），落盘结果 = 新可见序列 + hidden 追尾。
 * 为何不按完整序列计数：设置面板里的列表是「可见域在前、移除的域排最下面」（用户 2026-09-10 拍板），
 * 拖拽下标取自该列表；若按完整序列解释，隐藏项插在中间时下标会整体错位。
 * 越界 / 未知 id → 返回归一化结果（不抛错）。
 */
export function reorderTo(
  order: readonly string[] | null | undefined,
  id: string,
  toIndex: number,
  hidden: readonly string[] = [],
  domains: HomeDomain[] = DOMAINS,
): string[] {
  const all = applyOrder(order, domains).map((d) => d.id);
  const off = new Set(hidden);
  const visible = all.filter((x) => !off.has(x));
  const from = visible.indexOf(id);
  if (from < 0 || toIndex < 0 || toIndex >= visible.length) return all;
  visible.splice(from, 1);
  visible.splice(toIndex, 0, id);
  return [...visible, ...all.filter((x) => off.has(x))];
}

/** 排序作用端：桌面入口行（desk）/ 移动瓦片（mob）——两套顺序互不影响 */
export type HomeOrderScope = 'desk' | 'mob';

/** 入口顺序持久化形状（home.json / 见 ./order 读写）
 *  v3（2026-09-10 用户拍板「两端互不影响、互相不能修改」）：**顺序与隐藏都按端各一份** ——
 *  在桌面端删掉的域不会从移动端消失，反之亦然。v2 的单一 `hidden` 读取时两端各继承一份（见 ./order）。 */
export interface HomeOrder {
  version: number;
  desk: string[];
  mob: string[];
  /** 桌面端隐藏的域 id（只作用于桌面入口行） */
  hiddenDesk: string[];
  /** 移动端隐藏的域 id（只作用于移动瓦片） */
  hiddenMob: string[];
}

/** 取某端的隐藏域清单（纯函数，node 可测）：desk/mob 各一份，互不影响 */
export function hiddenOf(order: HomeOrder, scope: HomeOrderScope): string[] {
  return scope === 'mob' ? order.hiddenMob : order.hiddenDesk;
}

/**
 * 首页实际展示的域清单 = 该端持久化顺序 + 剔除隐藏域（渲染层与设置弹窗共用，单一口径）。
 * order 为空 → DOMAINS 默认顺序；hidden 为空 → 全部展示。
 */
export function visibleDomains(
  order?: readonly string[] | null,
  hidden?: readonly string[] | null,
  domains: HomeDomain[] = DOMAINS,
): HomeDomain[] {
  const hide = new Set(hidden ?? []);
  return applyOrder(order, domains.filter((d) => !hide.has(d.id)));
}

/* ---------- 入口菜单（桌面右键 / 移动长按抽屉） ---------- */

/** 菜单里一条域动作：文案 + 直达命令 id + lucide 图标名（执行在 ui.ts，本层只出清单） */
export interface DomainMenuAction {
  label: string;
  commandId: string;
  icon: string;
  /**
   * 动态文案槽位：由 ui.ts 在挂菜单时按实时状态改写 label（静态 label 作兜底/默认）。
   * 'focus' = 番茄钟（专注中 → 停止专注；否则 → 开始专注）——唯一动态项。
   */
  dynamic?: 'focus';
}

/** 番茄钟菜单项文案（纯函数，node 可测）：专注进行中 → 停止专注；否则开始专注 */
export function pomodoroMenuLabel(focusing: boolean): string {
  return focusing ? '停止专注' : '开始专注';
}

/**
 * 域菜单动作（2026-09-10 用户拍板：菜单只放**域自己的快捷功能**——
 * 不放「打开 X」（入口本身就是打开）、不放「整理顺序」（排序改直接拖拽，见 shared.reorderTo）。
 * **本表没有条目的域 = 不挂右键菜单 / 长按抽屉**（空的就别弹），ui.ts 依此判断。
 * 图标一律取「其他域右键菜单已在用」的 lucide 名（原型图标表按名查，
 * 不在表里的名字会静默渲染成空 —— 新增图标记得同时补 prototypes/home/prototype-icons.js）。
 */
export const DOMAIN_MENU: Record<string, DomainMenuAction[]> = {
  diary: [{ label: '写日记', commandId: 'bz-diary-write', icon: 'pen-line' }],
  memo: [{ label: '写备忘', commandId: 'bz-memo-add', icon: 'clipboard-list' }],
  cinema: [
    { label: '加影视', commandId: 'bz-cinema-add', icon: 'plus' },
    { label: '影视分析报告', commandId: 'bz-cinema-analysis', icon: 'bar-chart-3' },
  ],
  review: [
    { label: '开始复习', commandId: 'bz-review-start', icon: 'play' },
    { label: '加入复习计划', commandId: 'bz-review-add', icon: 'plus' },
    { label: '复习计划分析报告', commandId: 'bz-review-report', icon: 'bar-chart-3' },
  ],
  // 番茄钟：一把切换（专注中→停止；休息中→跳过休息再开；idle→开），命令 bz-pomodoro-focus-toggle。
  // 唯一动态文案项：label 由 ui.ts 按番茄钟实时相位改写为「停止专注 / 开始专注」（dynamic='focus'）
  pomodoro: [{ label: '开始专注', commandId: 'bz-pomodoro-focus-toggle', icon: 'timer', dynamic: 'focus' }],
  favorites: [{ label: '加收藏', commandId: 'bz-favorites-add', icon: 'bookmark' }],
  knowledge: [
    { label: '术语生成文献笔记', commandId: 'bz-knowledge-note-term', icon: 'file-text' },
    { label: '视频生成文献笔记', commandId: 'bz-knowledge-note-video', icon: 'list-video' },
  ],
  bookshelf: [{ label: '阅读分析报告', commandId: 'bz-reading-report-open', icon: 'bar-chart-3' }],
  secondbrain: [
    { label: '第二大脑对话', commandId: 'bz-secondbrain-chat', icon: 'message-circle' },
    { label: '参考侧栏', commandId: 'bz-secondbrain-open', icon: 'zap' },
  ],
  belongings: [{ label: '加物品', commandId: 'bz-belongings-add', icon: 'archive' }],
  vault: [{ label: '快速生成密码', commandId: 'bz-password-vault-gen', icon: 'key' }],
};

/** 域色（入口行 / 移动瓦片 / 抽屉盒头共用单一口径；未登记的域回落中性灰） */
export function domainColor(id: string): string {
  return DOMAIN_DOT[id] ?? '#8a8f99';
}

/**
 * 长按抽屉盒头 markup（2026-09-10 用户拍板：盒头要更详细）：
 * **上排 = 域彩色图标 + 域名（同一行）**，**下排 = 入口行右侧那行灰字**（不与图标同排、
 * 也不缩进到图标右侧 —— 整行起于盒头左边）。灰字口径与列表同源（见 riverCountText；
 * 该域没有计数文案时回落域副题 sub —— 与入口行 `riverCountText(...) ?? d.sub` 完全一致）。
 * 纯层只出 markup，ui.ts 建节点后 mountIcons 物化图标（图标一律 data-lucide 占位）。
 */
export function sheetHeadHtml(d: HomeDomain, data: RiverData): string {
  const ct = riverCountText(d.id, data) ?? d.sub;
  return '<div class="bz-home-sheet-head">'
    + '<div class="bz-home-sheet-top">'
    + '<span class="bz-home-sheet-ic" style="color:' + domainColor(d.id) + '">' + iconSpan(d.icon) + '</span>'
    + '<div class="bz-home-sheet-nm">' + esc(d.name) + '</div>'
    + '</div>'
    + '<div class="bz-home-sheet-sub">' + esc(ct) + '</div>'
    + '</div>';
}

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
  /** 备忘录未完成条数（2026-09-10 memo 入首页入口时补） */
  memoOpen: number;
  /** 备忘录重要未完成条数（priority==='important' && !completed；memo 彩点 hot 用，item-1789106079981） */
  memoUrgentOpen: number;
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
  memoOpen: 0,
  memoUrgentOpen: 0,
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
  /** 番茄钟正在专注（计时中或暂停中；采集层动态 import 跨域只读，失败回落 false）。
   *  纯层不做跨域 import（渲染纯层契约），专注态只能作为数据入参进彩点规则（item-1789106079981）。 */
  pomodoroFocusing: boolean;
}

/* ---------- 时间线四类（内容过滤 / 范围 / 字号 口径；issue 287，2026-09-11 用户点名） ---------- */

/** 时间线一条痕迹的类别（设置面板「时间线内容过滤」的勾选单位）。
 *  分法只认「这条痕迹说了什么」，不认域——同一条日记痕迹永远是 produce，
 *  不会因为改了域清单而换类。 */
export type TimelineKind =
  /** 产出：写出了/收进了/记下了东西（日记条目、剪藏保存、读完一本、看完一部、写完备忘、专注完） */
  | 'produce'
  /** 状态推进：改的是已有东西的状态（加入片单、读到 N%、新增待办、标记在看） */
  | 'progress'
  /** 小橘点评 ✦（不是痕迹，是挂在痕迹下面的那句话） */
  | 'note'
  /** 已跳过：剪藏流里被划掉的条目（news:skipped，真实数据里占行为流 51%） */
  | 'skipped';

/** 四类的中文名（设置面板勾选项文案单源；首页不需要，故只在这边声明） */
export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  produce: '产出',
  progress: '状态推进',
  note: '点评 ✦',
  skipped: '已跳过',
};

/** 时间线过滤设置（四个键的读值快照；缺省全开产出/状态推进/点评、关已跳过） */
export interface TimelineFilter {
  produce: boolean;
  progress: boolean;
  notes: boolean;
  skipped: boolean;
}

export const DEFAULT_TIMELINE_FILTER: TimelineFilter = {
  produce: true, progress: true, notes: true, skipped: false,
};

/** 时间线时间范围（「最近 N 天」的分子；week = 周历窗口全长 7 天） */
export type TimelineRange = 'today' | '3d' | 'week';

/** 范围 → 天数（today=1 只渲染今天那一格；3d=3；week=7 与周历同窗口） */
export function timelineRangeDays(range: string | null | undefined): number {
  if (range === '3d') return 3;
  if (range === 'week') return 7;
  return 1;
}

/**
 * 一条 recap 痕迹 → 类别（纯函数，node 可测）。
 * 判据取**文案前缀**而非域：同一域两种动作分属两类是常态
 * （影院「标记已看」= 产出，「加入片单」= 状态推进），只有文案才带这个信息。
 * 域名 → 文案前缀的对应关系见 recap/aggregate.ts 的 buildRecap 各分支。
 */
export function timelineKind(text: string): TimelineKind {
  // 状态推进：只有「还没发生成事实」的动作落这里
  if (
    text.startsWith('新增备忘录')       // 记下来了，但还没做完
    || text.includes('加入片单')        // 想看，不是看过
    || text.includes('读到 ')           // 进度，不是读完
  ) return 'progress';
  return 'produce';
}

/** 按设置过滤时间线痕迹（纯函数，node 可测）。hiddenKinds 内含的类别整条剔除。 */
export function filterEvents<T extends { text: string }>(events: T[], filter: TimelineFilter): T[] {
  return events.filter((e) => {
    const kind = timelineKind(e.text);
    return kind === 'progress' ? filter.progress : filter.produce;
  });
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

/** 时刻 → 当日内毫秒偏移（本地时区） */
function dayOffsetMs(t: number): number {
  const d = new Date(t);
  return d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds();
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
      // 「动手早晚」比的是两天各自的**钟点**，必须归一化到日内偏移再相减：
      // firstTs 是绝对时间戳（跨天差 ~24h），直接减会在真实数据上恒得「晚了 1300+ 分钟」
      // （2026-09-10 修复；此前测试把昨天时刻也设成今天，掩盖了该缺陷）。
      const diff = Math.round((dayOffsetMs(day.firstTs) - dayOffsetMs(data.yesterday.firstTs)) / 60000);
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

/** 入口行彩点状态：ok=今日有动静 / warn=进行中·待处理（日记连击、专注中、剪藏未读、影院在看）/ hot=逾期·需立即关注（复习逾期、重要备忘未完成）/ off=无动静 */
export type RiverDot = 'ok' | 'warn' | 'hot' | 'off';

/** 彩点规则（node 可测；与原型 buildDots 一致，映射到 home 域 id：memo/memo 同源）。
 *  点亮等级语义（item-1789106079981 定案）：ok=今日有动静；warn=进行中/待处理；hot=逾期/需立即关注；
 *  同域多条件取高（off<ok<warn<hot）。 */
export function buildDots(data: RiverData): Record<string, RiverDot> {
  const day = data.today;
  const hasEvent = (d: string): boolean => day.events.some((e) => e.domain === d);
  const c = data.counts;
  return {
    diary: day.summary.diary > 0 ? 'ok' : data.streak.diaryStreak > 0 ? 'warn' : 'off',
    review: c.reviewOverdue > 0 ? 'hot' : 'off',
    memo: c.memoUrgentOpen > 0 ? 'hot' : day.summary.memoDone + day.summary.memoCreated > 0 ? 'ok' : 'off',
    pomodoro: data.pomodoroFocusing ? 'warn' : day.summary.pomodoros > 0 ? 'ok' : 'off',
    cinema: c.cinemaWatching > 0 ? 'warn' : hasEvent('cinema') ? 'ok' : 'off',
    bookshelf: hasEvent('bookshelf') ? 'ok' : 'off',
    clipping: c.clippingUnread > 0 ? 'warn' : 'off',
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
    case 'memo':
      return `${c.memoOpen} 条待办`;
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

