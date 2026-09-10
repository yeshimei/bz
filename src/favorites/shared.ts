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
import { esc, iconSpan } from '../core/ui/str';
import { TAGS } from './config';
import type { FavoritesItem } from './types';

/** esc/iconSpan 再导出：评审壳演示层 markup（toast/确认框）与插件同源 */
export { esc, iconSpan };
/** 条目类型再导出（行为层统一从 render.ts 取用） */
export type { FavoritesItem } from './types';

// ==================== 常量 ====================

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

/** 视图状态切片（面板内会话态；ui.ts 的 FavState 与评审壳的 M 均结构兼容于此） */
export interface FavView {
  /** 当前标签筛选（null = 全部；存标签 label） */
  tag: string | null;
  /** 已归档视图（磁贴行「已归档」贴纸入口；数据仍 favorites.json，ADR-0074 冷存语义不变） */
  archived: boolean;
}

// ==================== 小工具 / 口径 ====================

// 本地时间 YYYY-MM-DD HH:mm:ss（created/archivedAt 写入格式）收口 core/ui/str
export { localNow } from '../core/ui/str';

/** 相对时间（原型 1:1：刚刚/N 分钟前/N 小时前/N 天前，超 7 天回落 M-D 短日期） */
export function relTime(s: string | undefined): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const diff = Date.now() - d.getTime();
  const m = 60000, h = 3600000, day = 86400000;
  if (diff < m) return '刚刚';
  if (diff < h) return Math.floor(diff / m) + ' 分钟前';
  if (diff < day) return Math.floor(diff / h) + ' 小时前';
  if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())}`;
}

/** 首标签 → 磁圆点/徽记色相（原型 hueOf 逐字；9 固定标签各占一档，未知标签兜底蓝） */
export function hueOf(label: string): number {
  const m: Record<string, number> = {
    GitHub: 215, 桌面软件: 160, 网站: 30, 大模型: 265, pi: 100, Claude: 20, skills: 50, 酒馆: 330, 'DeepSeek Harness': 195,
  };
  return m[label] != null ? m[label] : 200;
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

/** 当前展示列表：标签筛选（已归档视图不叠标签筛）+ 固定「最新收藏」排序 + 置顶恒最前（稳定分区） */
export function filteredItems(items: FavoritesItem[], view: FavView): FavoritesItem[] {
  let list = poolOf(items, view);
  if (!view.archived && view.tag) list = list.filter((i) => (i.tags || []).includes(view.tag as string));
  const byTime = (a: FavoritesItem, b: FavoritesItem) =>
    (b.created || '').localeCompare(a.created || '') || (b.id || '').localeCompare(a.id || '');
  const base = [...list].sort(byTime);
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
  return `<div class="bz-fav-card${pinnedCls}${archCls}" data-fav-id="${esc(it.id)}">
    <span class="${tape}"></span>
    <span class="bz-fav-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <h3>${esc(it.title || '无标题')}</h3>
    <p>${esc(it.description || '（这张卡只写了个名字）')}</p>
    <div class="bz-fav-ft"><span class="bz-fav-tags-row">${(it.tags || []).map((t) => {
      const h = hueOf(t);
      const ic = (TAGS.find((x) => x.label === t) || { ic: '' }).ic;
      return `<span class="bz-fav-tagb" style="background:hsl(${h} 70% 95%);color:hsl(${h} 45% 42%)">${ic ? iconSpan(ic, 'bz-ic--xs') : ''}<span>${esc(t)}</span></span>`;
    }).join('')}</span>
      <span>${esc(relTime(it.created))}</span></div>
  </div>`;
}

/** 空态（原型文案逐字） */
export function emptyHtml(): string {
  return '<div class="bz-fav-empty">这块板上还没有卡片</div>';
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

/** 桌面右键菜单内容（.bz-fav-ctx 容器由调用方建；删除红字置底，分隔线隔开） */
export function ctxMenuHtml(acts: FavActionSpec[]): string {
  return acts.map((a, k) => {
    const last = k === acts.length - 1;
    const btn = `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ''}>${iconSpan(a.icon, 'bz-ic--sm')}<span>${esc(a.label)}</span></button>`;
    return last ? `<div class="bz-fav-ctx-sep"></div>${btn}` : btn;
  }).join('');
}

/** 移动底部抽屉内容（.bz-fav-sheet 内部：磁点 + 标题 + meta + 动作列） */
export function sheetHtml(it: FavoritesItem, acts: FavActionSpec[]): string {
  const hue = hueOf((it.tags || [])[0] || '');
  return `<div class="bz-fav-sh-head"><span class="bz-fav-sh-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <div><div class="bz-fav-sh-title">${esc(it.title || '无标题')}</div>
    <div class="bz-fav-sh-meta">${esc(relTime(it.created))}${it.pinned ? ' · 已置顶' : ''}${it.archived ? ' · 已归档' : ''}</div></div></div>
  <div class="bz-fav-sh-acts">${acts.map((a, k) =>
    `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ''}>${iconSpan(a.icon)}<span>${esc(a.label)}</span></button>`).join('')}</div>`;
}

// ==================== 表单（添加 / 编辑共用骨架） ====================

/** 表单标签多选 chips（.bz-fav-pick 内部；sel = 当前选中集，重绘由调用方触发） */
export function pickChipsHtml(sel: Set<string>): string {
  return TAGS.map((t) =>
    `<button type="button" class="${sel.has(t.label) ? 'bz-fav-on' : ''}" data-tag="${esc(t.label)}">${iconSpan(t.ic, 'bz-ic--xs')}<span>${esc(t.label)}</span></button>`
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
    <div class="bz-fav-fld bz-fav-inline"><span class="bz-fav-sw${it && it.pinned ? ' bz-fav-on' : ''}" id="fz-pin"></span><span class="bz-fav-fld-desc">置顶后恒排最前</span></div>
    <div class="bz-fav-err" id="fz-err"></div>
    <div class="bz-fav-btns">
      <button type="button" id="fz-ai" class="bz-fav-ai-btn">${iconSpan(ICON.ai, 'bz-ic--xs')} <span>AI 整理</span></button>
      <button type="button" data-fz-cancel>取消</button>
      <button type="button" id="fz-save" class="bz-fav-pri">${editing ? '更新' : '保存'}</button>
    </div>
  </div>`;
}
