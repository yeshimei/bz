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
import { TAGS } from '../../config';
import {
  ICON, cardHtml, emptyHtml, tagCount, visibleItems, archivedItems, filteredItems,
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

/** 磁贴标签行 markup（「图标 名 数字」白底磁贴；无计数标签不显示；
 *  「新收藏」chip = lucide plus 虚线磁贴、无磁点；移动端平铺单行时置首，桌面仍居行尾） */
export function chipsHtml(items: FavoritesItem[], view: FavView, mobile: boolean): string {
  const mk = (label: string, ic: string, cnt: number, active: boolean, grey = false) =>
    `<button class="bz-fav-chip${active ? ' bz-fav-on' : ''}${grey ? ' bz-fav-chip--grey' : ''}" data-fav-tag="${esc(label)}">${ic ? iconSpan(ic, 'bz-ic--xs') : ''}<span>${esc(label)} ${cnt}</span></button>`;
  const add = `<button class="bz-fav-chip-add" data-fav-add title="添加收藏">${iconSpan(ICON.add, 'bz-ic--xs')}<span>新收藏</span></button>`;
  const chips =
    mk('全部', '', visibleItems(items).length, !view.archived && view.tag === null) +
    mk('已归档', 'archive', archivedItems(items).length, view.archived, true) +
    TAGS.map((t) => {
      const n = tagCount(items, t.label);
      return n ? mk(t.label, t.ic, n, !view.archived && view.tag === t.label) : '';
    }).join('');
  return mobile ? add + chips : chips + add;
}

/** 卡墙内容 markup（筛选排序管道在 shared；空态走原型文案） */
export function boardHtml(items: FavoritesItem[], view: FavView): string {
  const list = filteredItems(items, view);
  if (!list.length) return emptyHtml();
  // 胶带三色轮换按下标取全量条目位（与迁移前 M.items.indexOf 逐语义等价）
  return list.map((it) => cardHtml(it, items.indexOf(it))).join('');
}

// ==================== 渲染胶水（纯层唯一 DOM 副作用点） ====================

/** 磁贴标签行渲染（原 ui.ts renderTags / 原型 renderTagsInto 命名统一：issue 242 还债，对外一个名字） */
export function renderTagsInto(mount: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  mount.innerHTML = chipsHtml(items, view, hooks.mobile);
  hooks.mountIcons(mount);
}

/** 卡墙渲染 */
export function renderBoardInto(board: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  board.innerHTML = boardHtml(items, view);
  hooks.mountIcons(board);
}

/** 面板全量渲染：磁贴行 + 卡墙（原 ui.ts renderAll 逐语义等价） */
export function renderPanelView(panel: HTMLElement, items: FavoritesItem[], view: FavView, hooks: FavRenderHooks): void {
  const tags = panel.querySelector('[data-fav-tags]') as HTMLElement | null;
  if (tags) renderTagsInto(tags, items, view, hooks);
  const board = panel.querySelector('[data-fav-content]') as HTMLElement | null;
  if (board) renderBoardInto(board, items, view, hooks);
}
