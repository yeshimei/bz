/**
 * 收藏本「亚麻板」布局（ADR-0105 布局差异层）：
 * 面板骨架 / 磁贴标签行 / 卡墙渲染胶水。
 * 共享口径与卡片/表单/行操作集见 ../../shared.ts；域入口 render.ts 聚合两方。
 *
 * C5 视觉拍板定稿：磁贴单行横滑/新收藏移动端置首/桌面 900×620——markup 平移不改动任何视觉值。
 * 渲染胶水是纯层唯一的 DOM 副作用点（对入参 root 写 innerHTML）；jsdom 无布局值，移动态
 * 由 hooks.mobile 显式入参（不读 core isMobileEnv——纯层禁 core 服务）。
 */
import { esc, iconSpan } from '../../../core/ui/str';
import { getTags } from '../../config';
import {
  ICON, VIEW_ALL, VIEW_ARCHIVED, safeTagIcon,
  cardHtml, emptyHtml, tagCount, visibleItems, archivedItems, filteredItems,
  type FavView,
} from '../../shared';
import type { FavoritesItem } from '../../types';

/** 渲染钩子（两侧差异表：插件 = core mountIcons/setIcon + isMobileEnv；评审壳 = 内联 SVG + 手机框） */
export interface FavRenderHooks {
  /** 图标兑现（`<i data-lucide>` 占位 → SVG） */
  mountIcons(root: HTMLElement): void;
  /** 移动态（磁贴行平铺单行 + 新收藏置首 + 面板全屏类） */
  mobile: boolean;
}

// ==================== markup 构建器 ====================

/** 面板骨架（头行「收藏本」→ 磁贴行 → 卡墙；data-fav-* 钩子契约根）。
 *  桌面固定 900×620、点遮罩/Esc 关闭；移动全屏 + head 行 ✕ 退出。 */
export function panelHtml(mobile: boolean): string {
  const mob = mobile ? ' bz-fav-mob bz-panel-mtop' : '';
  return `<div class="bz-fav-panel bz-fav-scope${mob}">
  <div class="bz-fav-head"><h1>收藏本</h1><button class="bz-fav-mob-close bz-touch-target bz-touch-target--xl" data-fav-close title="关闭">${iconSpan(ICON.close, 'bz-ic--xs')}</button></div>
  <div class="bz-fav-tags" data-fav-tags></div>
  <div class="bz-fav-board" data-fav-content></div>
</div>`;
}

/** 磁贴标签行 markup（「图标 名 数字」白底磁贴；无计数标签不显示）；
 *  标签集 = getTags() 动态（issue 363）；
 *  「全部/已归档」贴纸 data-fav-tag 一律发哨兵值（VIEW_ALL/VIEW_ARCHIVED 单源）——
 *  发字面值时与同名用户标签撞车（UI-05/func-7：该标签筛选永不可达）；
 *  chip 激活态写 aria-pressed（UI-06：读屏可知当前筛在哪）；
 *  零计数但处于激活态的标签保渲染（灰显，UI-08）：该标签下条目被清空时面板不悬空——
 *  「全部」不高亮、激活 chip 仍在可点回，用户看得见自己正筛在哪个标签。；
 *  「新收藏」chip = lucide plus 虚线磁贴、无磁点；移动端平铺单行时置首，桌面仍居行尾） */
export function chipsHtml(items: FavoritesItem[], view: FavView, mobile: boolean): string {
  // dataVal = data-fav-tag 契约值（内置贴纸发哨兵），display = 磁贴显示文本（仍为「全部/已归档」）
  const mk = (dataVal: string, display: string, ic: string, cnt: number, active: boolean, grey = false, empty = false) =>
    `<button class="bz-fav-chip${active ? ' bz-fav-on' : ''}${grey ? ' bz-fav-chip--grey' : ''}${empty ? ' bz-fav-chip--empty' : ''}" data-fav-tag="${esc(dataVal)}"${active ? ' aria-pressed="true"' : ' aria-pressed="false"'}>${ic ? iconSpan(ic, 'bz-ic--xs') : ''}<span>${esc(display)} ${cnt}</span></button>`;
  const add = `<button class="bz-fav-chip-add" data-fav-add title="添加收藏" aria-label="添加收藏">${iconSpan(ICON.add, 'bz-ic--xs')}<span>新收藏</span></button>`;
  const chips =
    mk(VIEW_ALL, '全部', '', visibleItems(items).length, !view.archived && view.tag === null) +
    mk(VIEW_ARCHIVED, '已归档', 'archive', archivedItems(items).length, view.archived, true) +
    getTags().map((t) => {
      const n = tagCount(items, t.label);
      const active = !view.archived && view.tag === t.label;
      if (!n && !active) return ''; // 零计数且未激活不渲染（原型口径）
      return mk(t.label, t.label, safeTagIcon(t.ic), n, active, false, !n); // 零计数激活保渲染（灰显，UI-08）
    }).join('');
  return mobile ? add + chips : chips + add;
}

/** 卡墙内容 markup（筛选排序管道在 shared；空态按视图分文案 UI-09） */
export function boardHtml(items: FavoritesItem[], view: FavView): string {
  const list = filteredItems(items, view);
  if (!list.length) return emptyHtml(view, items);
  // 胶带三色轮换按下标取全量条目位。E5：Map 一次建表 O(n) 替代每卡 indexOf 的 O(n²)
  // （语义等价：两处都是引用比较，idx 映射不变）
  const idxMap = new Map(items.map((it, i) => [it, i]));
  return list.map((it) => cardHtml(it, idxMap.get(it) ?? 0)).join('');
}

// ==================== 渲染胶水（纯层唯一 DOM 副作用点） ====================

/** 磁贴标签行渲染（原 ui.ts renderTags / 原型 renderTagsInto 命名统一：issue 242 还债，对外一个名字） */
export function renderTagsInto(mount: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  mount.innerHTML = chipsHtml(items, view, hooks.mobile);
  hooks.mountIcons(mount);
}

/** 卡墙渲染。E2：innerHTML 全量重建会把 scrollTop 归零——重建前保留、重建后回写，
 *  置顶/归档/删除/编辑保存后的视野不再跳回顶部（视图切换型筛选 applyTagFilter 走同一
 *  渲染链：新视图通常列表形态相近，保留滚位无害；数据落在视野外时浏览器自然钳制到 0） */
export function renderBoardInto(board: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  const keep = board.scrollTop;
  board.innerHTML = boardHtml(items, view);
  board.scrollTop = keep;
  hooks.mountIcons(board);
}

/** 面板全量渲染：磁贴行 + 卡墙（原 ui.ts renderAll 逐语义等价） */
export function renderPanelView(panel: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  const tags = panel.querySelector('[data-fav-tags]') as HTMLElement | null;
  if (tags) renderTagsInto(tags, items, view, hooks);
  const board = panel.querySelector('[data-fav-content]') as HTMLElement | null;
  if (board) renderBoardInto(board, items, view, hooks);
}
