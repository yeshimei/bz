/**
 * 收藏本渲染纯层（issue 242/ADR-0104：原型 × 插件 markup 单源）。
 *
 * 收藏本跨布局共享层（ADR-0105）：常量/口径计算/卡片/表单/行操作集/菜单与抽屉 markup——
 * 任何布局不得私有一份口径。布局差异层见 layouts/board/；域入口仍是 render.ts。
 * 原型 × 插件 markup 单源：
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 评审壳侧：经 fake-sim 启动器（ADR-0106）把真 ui.ts 依赖链打进
 *     prototype-behavior.js（window.BZW_favorites），iframe 壳跑真行为消费同一批函数；
 *     prototype-render.js 渲染产物已于 2026-09-09 退役（壳不再自绘）。
 *
 * 纯度契约（tests/core/render-purity.test.ts 守卫，违者门禁红）：
 *   - import 白名单：`../core/ui/str`（零依赖字符串工具）、`./config`、`./types`（type-only）；
 *   - 禁 obsidian / moment / core 服务 / 组件库 barrel；
 *   - 禁模块级可变状态：条目与视图状态一律显式入参（items + FavView）；
 *   - 禁 DOM 副作用（innerHTML 胶水在 layouts/board/render.ts）。
 *
 * 图标 = `<i data-lucide>` 占位串（str.ts iconSpan），由两侧各自 mountIcons 兑现。
 * data-fav-* 钩子即两侧事件绑定与测试断言的共同契约，改钩子先改这里。
 * C5 视觉拍板定稿（ADR-0101）：本文件只做 markup 平移，任何视觉值一个像素不动。
 */
import { esc, emptyHtmlStr, iconSpan, relTime } from '../core/ui/str';
import { getTags } from './config';
import type { FavoritesItem } from './types';

/** esc/iconSpan 再导出：评审壳演示层 markup（toast/确认框）与插件同源 */
export { esc, iconSpan };
/** 条目类型再导出（行为层统一从 render.ts 取用） */
export type { FavoritesItem } from './types';

// ==================== 常量 ====================

/** 内置视图哨兵值（UI-05/func-7 撞名防御单源）：磁贴行「全部/已归档」贴纸的 data-fav-tag
 *  一律发哨兵而非字面值——用户自定义标签可任意命名（issue 363），发字面值时同名标签的贴纸
 *  会被 applyTagFilter 的字面分支先行劫持（点「已归档」标签永远切归档视图，该标签筛选永不可达）。
 *  消费：layouts/board chipsHtml 发出、ui.applyTagFilter 分流。 */
export const VIEW_ALL = '__all';
export const VIEW_ARCHIVED = '__archived';

/** 标签名保留字（func-7：控制字面量与用户数据分命名空间后的最后一道闸）——新增/改名标签拒收，
 *  防止磁贴 data 值与视图哨兵/打开默认筛选哨兵撞名：
 *  「全部/已归档/__all/__archived」撞磁贴 data-fav-tag 分流、「@last/@archived」撞
 *  favoritesOpenFilter/favoritesLastFilter 设置哨兵（resolveOpenFilter/@last 记忆语义）。 */
export const RESERVED_TAG_LABELS: readonly string[] = [
  '全部', '已归档', VIEW_ALL, VIEW_ARCHIVED, '@last', '@archived',
];

/** 动态标签图标白名单（UI-10）：tag.ic 可经手改 data.json / 旧伴生 favorites.tags.json 迁入
 *  携带任意字符串，iconSpan 按「受信开发者常量」设计不转义 name——favorites 是唯一把用户数据
 *  喂进去的消费方，消费前按 lucide 名形态白名单校验，不合者回落 'tag'（单点收口，卡片徽记 /
 *  表单胶囊 / 标签管理三处消费同愈）。 */
export function safeTagIcon(ic: unknown): string {
  const s = typeof ic === 'string' ? ic : '';
  return /^[a-z0-9-]+$/i.test(s) ? s : 'tag';
}

/** lucide 图标名（原 ui.ts ICON 迁入） */
export const ICON = {
  close: 'x',
  add: 'plus',
  open: 'external-link',
  pin: 'pin',
  pinOff: 'pin-off',
  edit: 'pencil',
  archive: 'archive',
  unarchive: 'archive-restore',
  del: 'trash-2',
  ai: 'sparkles',
};

/** 默认排序键（favoritesDefaultSort 设置消费；issue 296）：new=最新收藏（缺省）/ old=最早收藏 / title=按标题 */
export type FavSort = 'new' | 'old' | 'title';

/** 非法值回落 new（与 memo resolveOpenScene 同款归一口径） */
export function normalizeFavSort(v: unknown): FavSort {
  return v === 'old' || v === 'title' ? v : 'new';
}

/** 视图状态切片（面板内会话态；ui.ts 的 FavState 与评审壳的 M 均结构兼容于此） */
export interface FavView {
  /** 当前标签筛选（null = 全部；存标签 label） */
  tag: string | null;
  /** 已归档视图（磁贴行「已归档」贴纸入口；数据仍 favorites.json，ADR-0074 冷存语义不变） */
  archived: boolean;
  /** 当前排序（issue 296 默认排序设置播种；缺省 new=最新收藏，置顶恒最前与排序无关） */
  sort?: FavSort;
}

// ==================== 小工具 / 口径 ====================

// 本地时间 YYYY-MM-DD HH:mm:ss（created/archivedAt 写入格式）+ 相对时间（跨域单源，
// 本域原 relTime 即其拍板蓝本）均收口 core/ui/str
export { localNow, relTime } from '../core/ui/str';

/** relTime 已收口 core/ui/str 单源（上方 re-export） */

/**
 * 首标签 → 磁圆点/徽记色相（原型 hueOf 逐字）。issue 363 标签自定义延伸：
 * 内置 9 类原名映射保留（未改名数据视觉不变）；未命中（自定义/改名标签）回落
 * 字符串 hash 色相带（同一 label 恒定、不同标签分散，不再一律兜底蓝）。
 * 审查修复：空 label（无标签条目）不再 hash 到 0 恒红，返回中性蓝 210。
 */
export function hueOf(label: string): number {
  if (!label) return 210;
  const m: Record<string, number> = {
    GitHub: 215, 桌面软件: 160, 网站: 30, 大模型: 265, pi: 100, Claude: 20, skills: 50, 酒馆: 330, 'DeepSeek Harness': 195,
  };
  if (m[label] != null) return m[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return h;
}

// ==================== 派生管道（items 显式入参） ====================

/** 可见条目 = 非归档（ADR-0074 冷存不可见，装载点唯一过滤） */
export function visibleItems(items: FavoritesItem[]): FavoritesItem[] {
  return items.filter((i) => !i.archived);
}

/** 已归档条目（「已归档」视图数据源；数据仍在 favorites.json） */
export function archivedItems(items: FavoritesItem[]): FavoritesItem[] {
  return items.filter((i) => !!i.archived);
}

/** 当前视图条目池：默认非归档；已归档视图仅归档条目 */
export function poolOf(items: FavoritesItem[], view: FavView): FavoritesItem[] {
  return view.archived ? archivedItems(items) : visibleItems(items);
}

/** 某标签在可见条目中的计数（磁贴行数字；零计数标签不显示） */
export function tagCount(items: FavoritesItem[], label: string): number {
  return visibleItems(items).filter((i) => (i.tags || []).includes(label)).length;
}

/** 当前展示列表：标签筛选（已归档视图不叠标签筛）+ 排序（view.sort，缺省最新收藏；issue 296）+
 *  置顶恒最前（稳定分区：置顶/非置顶各自组内按同序排） */
export function filteredItems(items: FavoritesItem[], view: FavView): FavoritesItem[] {
  let list = poolOf(items, view);
  if (!view.archived && view.tag) list = list.filter((i) => (i.tags || []).includes(view.tag as string));
  const byTimeDesc = (a: FavoritesItem, b: FavoritesItem) =>
    (b.created || '').localeCompare(a.created || '') || (b.id || '').localeCompare(a.id || '');
  const cmp: (a: FavoritesItem, b: FavoritesItem) => number =
    view.sort === 'old'
      ? (a, b) => (a.created || '').localeCompare(b.created || '') || (a.id || '').localeCompare(b.id || '')
      : view.sort === 'title'
        ? (a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN') || byTimeDesc(a, b)
        : byTimeDesc;
  const base = [...list].sort(cmp);
  const pinned = base.filter((i) => i.pinned);
  const rest = base.filter((i) => !i.pinned);
  return [...pinned, ...rest];
}

// ==================== 卡片 ====================

/** 收藏卡（原型 1:1；idx = 全量条目下标，承载胶带三色轮换——与插件 M.items.indexOf 同口径） */
export function cardHtml(it: FavoritesItem, idx: number): string {
  const pinnedCls = it.pinned ? ' bz-fav-pinc' : '';
  // 已归档视图卡：褪色冷存（仅归档视图可见，主列表本就过滤）
  const archCls = it.archived ? ' bz-fav-arch' : '';
  const hue = hueOf((it.tags || [])[0] || '');
  // 胶带三色轮换：基础类恒在（承载 absolute 定位/尺寸），变体类只换色与角度
  const tape = 'bz-fav-tape' + (idx % 3 ? [' bz-fav-tape--r', ' bz-fav-tape--g'][idx % 3 - 1] : '');
  // 键盘可达（UI-06③）：卡片最小语义 role=button + tabindex=0——Enter/Space 走与点击同径
  // （移动抽屉 / 桌面直开），keydown 委托在 ui.ts content 容器
  return `<div class="bz-fav-card${pinnedCls}${archCls}" data-fav-id="${esc(it.id)}" role="button" tabindex="0">
    <span class="${tape}"></span>
    <span class="bz-fav-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <h3>${esc(it.title || '无标题')}</h3>
    <p>${esc(it.description || '（这张卡只写了个名字）')}</p>
    <div class="bz-fav-ft"><span class="bz-fav-tags-row">${(it.tags || []).map((t) => {
      const h = hueOf(t);
      const ic = safeTagIcon((getTags().find((x) => x.label === t) || { ic: '' }).ic);
      return `<span class="bz-fav-tagb" style="background:hsl(${h} 70% 95%);color:hsl(${h} 45% 42%)">${ic ? iconSpan(ic, 'bz-ic--xs') : ''}<span>${esc(t)}</span></span>`;
    }).join('')}</span>
      <span>${esc(relTime(it.created))}</span></div>
  </div>`;
}

/** 空态：内芯收编 core emptyHtmlStr 单源（review-deep 一致#16：bz-empty 库皮 =
 *  图标 + 一句话 + 动作引导；原型文案保留为 title，desc 指向磁贴行常驻「新收藏」入口）。
 *  外层 .bz-fav-empty 域皮保留（承载 board 网格跨列与留白，styles.css 在案）——bookshelf 域皮包裹同款。
 *  文案按视图区分（UI-09）：归档空 ≠ 标签筛选空 ≠ 真空——「板上还没有卡片」会误导
 *  「数据没了」，实际只是被筛掉/冷存在归档箱。传参缺省 = 原型默认文案（兼容既有调用面）。 */
export function emptyHtml(view?: FavView, items?: FavoritesItem[]): string {
  if (view && items) {
    if (view.archived) {
      return `<div class="bz-fav-empty">${emptyHtmlStr('archive', '归档箱是空的', '归档的收藏会冷存在这里，可随时恢复')}</div>`;
    }
    if (view.tag && !visibleItems(items).some((i) => (i.tags || []).includes(view.tag as string))) {
      return `<div class="bz-fav-empty">${emptyHtmlStr('inbox', `「${view.tag}」标签下还没有收藏`, '换个标签看看，或添加一条试试')}</div>`;
    }
  }
  return `<div class="bz-fav-empty">${emptyHtmlStr('inbox', '这块板上还没有卡片', '添加第一条收藏试试')}</div>`;
}

// ==================== 行操作集 ====================

/** 行操作元语（act 为稳定语义键：插件映射 core 服务调用，评审壳映射演示行为） */
export interface FavActionSpec {
  icon: string;
  label: string;
  /** 动作语义键（打开/置顶/编辑/归档⇄取消归档/删除；ADR-0101 跳转笔记/刷新余额退役） */
  act: 'open' | 'pin' | 'edit' | 'archive' | 'unarchive' | 'del';
  danger?: boolean;
}

/** 行操作序列（动作序：打开→置顶→编辑→归档⇄取消归档→删除；原 ui.ts buildActions 迁入） */
export function actionSpecs(it: FavoritesItem): FavActionSpec[] {
  const acts: FavActionSpec[] = [];
  if ((it.url || '').trim()) acts.push({ icon: ICON.open, label: '打开', act: 'open' });
  acts.push({
    icon: it.pinned ? ICON.pinOff : ICON.pin,
    label: it.pinned ? '取消置顶' : '置顶',
    act: 'pin',
  });
  acts.push({ icon: ICON.edit, label: '编辑', act: 'edit' });
  // 归档/取消归档（已归档条目动作翻转——冷存找回入口；ADR-0074 数据仍在 favorites.json）
  acts.push(it.archived
    ? { icon: ICON.unarchive, label: '取消归档', act: 'unarchive' }
    : { icon: ICON.archive, label: '归档', act: 'archive' });
  acts.push({ icon: ICON.del, label: '删除', act: 'del', danger: true });
  return acts;
}

// 2026-09-11 收编 core/item-actions：自绘菜单/抽屉模板（ctxMenuHtml/sheetHtml）退役——
// 行动浮层壳/动作行/防 Obsidian button 压盖全归共享层，域内只留磁点头皮肤（ui.ts favSheetHead）。
// actionSpecs（动作序/语义键契约）保留：core ItemAction 映射与评审壳演示层共用。

// ==================== 表单（添加 / 编辑共用骨架） ====================

/** 表单标签多选 chips（.bz-fav-pick 内部；sel = 当前选中集，重绘由调用方触发）。
 *  issue 363：标签集 = getTags() 动态（内置 seed / data.json 设置键 favoriteTags）；
 *  图标经 safeTagIcon 白名单（UI-10：动态 ic 不直插 markup） */
export function pickChipsHtml(sel: Set<string>): string {
  return getTags().map((t) =>
    `<button type="button" class="${sel.has(t.label) ? 'bz-fav-on' : ''}" data-tag="${esc(t.label)}">${iconSpan(safeTagIcon(t.ic), 'bz-ic--xs')}<span>${esc(t.label)}</span></button>`
  ).join('');
}

/** 表单（标题/链接/简介/标签多选/置顶开关 + AI 整理钮；无大模型/关联笔记——ADR-0101 退役）。
 *  标签选区初始由 pickChipsHtml 重绘；id 契约 fz-* 由两侧行为层消费。 */
export function formHtml(it: FavoritesItem | null): string {
  const editing = !!it;
  return `<div class="bz-fav-form">
    <h2>${editing ? '编辑收藏' : '添加收藏'}</h2>
    <div class="bz-fav-fld"><label>标题</label><input id="fz-title" value="${esc(it ? it.title : '')}" placeholder="如：某篇好文"></div>
    <div class="bz-fav-fld"><label>链接</label><input id="fz-url" value="${esc(it ? it.url : '')}" placeholder="https://…"></div>
    <div class="bz-fav-fld"><label>简介</label><textarea id="fz-desc" placeholder="一句话记住它…">${esc(it ? it.description || '' : '')}</textarea></div>
    <div class="bz-fav-fld"><label>标签（可多选）</label><div class="bz-fav-pick" id="fz-tags"></div></div>
    <div class="bz-fav-fld bz-fav-inline"><span class="bz-fav-sw${it && it.pinned ? ' bz-fav-on' : ''}" id="fz-pin" role="switch" tabindex="0" aria-checked="${!!(it && it.pinned)}"></span><span class="bz-fav-fld-desc">置顶后恒排最前</span></div>
    <div class="bz-fav-err" id="fz-err"></div>
    <!-- 提交动词全域拍板（review-deep 一致#9）：编辑=保存、新建=添加（memo/cinema/diary 多数派，
         与本域标签表单 existing ? '保存' : '添加' 对齐，域内不再二分） -->
    <div class="bz-fav-btns">
      <button type="button" id="fz-ai" class="bz-fav-ai-btn">${iconSpan(ICON.ai, 'bz-ic--xs')} <span>AI 整理</span></button>
      <button type="button" data-fz-cancel>取消</button>
      <button type="button" id="fz-save" class="bz-fav-pri">${editing ? '保存' : '添加'}</button>
    </div>
  </div>`;
}
