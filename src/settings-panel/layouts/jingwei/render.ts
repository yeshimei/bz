/**
 * 经纬布局（settings-panel，ADR-0105 布局差异层）：面板骨架与导航差异。
 * 当前唯一布局 = P1 系统面板：桌面 B 侧栏工作台 + 移动 M1 命令面板。
 * 骨架/导航串与 ui.ts 消费侧同一份 markup（ADR-0104/0106 单源，评审壳零自绘）；
 * 控件级工厂见 ../../shared.ts；本文件只写面板骨架/头行/导航/移动列表/域弹窗壳。
 */
import { esc, iconSpan } from '../../../core/ui/str';

// 再出口（布局层与共享层同为纯层，壳统一从域入口取）
export { esc, iconSpan };

/* ==================== 桌面：B 侧栏工作台 ==================== */

/** 桌面面板骨架（头行 = 面包屑「设置」+ 搜索框 + 工具位；左导航 + 右内容区）——原型 mount desk 分支 */
export function deskShellHtml(): string {
  return `<div class="bz-sp-head">` +
    `<div class="bz-sp-crumb"><span class="bz-sp-head-title bz-sp-crumb-cur">设置</span></div>` +
    `<div class="bz-sp-search bz-sp-head-search">${iconSpan('search')}<input class="bz-input" placeholder="搜索域与设置项" autocomplete="off"></div>` +
    `<span class="bz-sp-head-tools"></span></div>` +
    `<div class="bz-sp-desk-body"><aside class="bz-sp-desk-side"><div class="bz-sp-nav"></div></aside>` +
    `<main class="bz-sp-desk-main"><div class="bz-sp-pane"></div></main></div>`;
}

/** 导航语义分段（基础/记录/媒体与知识/工具/其他；itemsHtml = navItemHtml 串）——原型 renderNav 分组 */
export function navSecHtml(title: string, itemsHtml: string): string {
  return `<div class="bz-sp-nav-sec"><div class="bz-sp-nav-sec-t">${esc(title)}</div>${itemsHtml}</div>`;
}

/** 导航域项（图标 + 名称 + 动态徽标；on = 当前选中域；data-sp-domain 契约供事件层回查） */
export function navItemHtml(opts: { id: string; icon: string; name: string; count: string; on?: boolean }): string {
  return `<button type="button" class="bz-sp-nav-item${opts.on ? ' on' : ''}" data-sp-domain="${esc(opts.id)}">` +
    `${iconSpan(opts.icon, 'bz-ic bz-sp-nav-ic')}` +
    `<span class="bz-sp-nav-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-nav-count">${esc(opts.count)}</span></button>`;
}

/* ==================== 移动：M1 命令面板 ==================== */

/** 移动面板骨架（头行 + 搜索 + 域列表）——原型 mount mob 分支 */
export function mobShellHtml(): string {
  return `<div class="bz-sp-head"><span class="bz-sp-head-title">设置</span><span class="bz-sp-head-tools"></span></div>` +
    `<div class="bz-sp-mob-search">${iconSpan('search')}<input class="bz-input" placeholder="搜索设置、域…" autocomplete="off"></div>` +
    `<div class="bz-sp-mob-list"></div>`;
}

/** 移动语义分段标题 */
export function mobSecHtml(title: string): string {
  return `<div class="bz-sp-mob-sec">${esc(title)}</div>`;
}

/** 移动域行（图标方块 + 名称 + 描述 + ›；data-sp-domain 契约供事件层回查）——原型 renderMobList 行 */
export function mobItemHtml(opts: { id: string; icon: string; name: string; desc: string }): string {
  return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}">` +
    `<span class="bz-sp-mob-ic">${iconSpan(opts.icon)}</span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span>` +
    `<span class="bz-sp-mob-chev">${iconSpan('chevron-right')}</span></button>`;
}

/** 移动搜索「设置项」命中行（域有原型无——issue 244 保留：搜索直达设置项；kind 徽标 = 「设置」） */
export function mobRowHitHtml(opts: { id: string; icon: string; name: string; desc: string }): string {
  return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}">` +
    `<span class="bz-sp-mob-ic">${iconSpan(opts.icon)}</span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span>` +
    `<span class="bz-sp-mob-kind">设置</span></button>`;
}

/** 移动搜索空态（域有原型无：移动搜索含「设置项」段——issue 244 保留） */
export function mobEmptyHtml(query: string): string {
  return `<div class="bz-sp-mob-empty">没有匹配「${esc(query)}」的设置或域</div>`;
}

/** 移动域设置弹窗壳（头行图标方块 + 标题 + 空 body）——原型 openDomain 移动分支 */
export function mobModalShellHtml(icon: string, title: string): string {
  return `<div class="bz-sp-mob-modal-head"><span class="bz-sp-mob-modal-ic">` +
    `${iconSpan(icon)}</span>` +
    `<div class="bz-sp-mob-modal-title">${esc(title)}</div></div>` +
    `<div class="bz-sp-settings-body bz-sp-mob-modal-body"></div>`;
}
