/**
 * 经纬布局（settings-panel，ADR-0105 布局差异层）：面板骨架与导航差异。
 * 当前唯一布局 = P1 系统面板（拍板原型 P1 落域）：桌面 B 侧栏工作台 + 移动 M1 命令面板。
 * 控件级工厂见 ../../shared.ts；本文件只写面板骨架/头行/导航/移动列表/域弹窗壳。
 */
import { esc, iconSpan } from '../../../core/ui/str';

// 再出口（布局层与共享层同为纯层，壳统一从域入口取）
export { esc, iconSpan };

/* ==================== 桌面：B 侧栏工作台 ==================== */

/** 桌面头行：面包屑「设置」+ 搜索框（.bz-sp-search 契约类：测试与过滤逻辑以此定位输入框） */
export function deskHeadHtml(): string {
  return `<div class="bz-sp-head">` +
    `<div class="bz-sp-crumb"><span class="bz-sp-head-title bz-sp-crumb-cur">设置</span></div>` +
    `<div class="bz-sp-search bz-sp-head-search">${iconSpan('search')}<input class="bz-input" placeholder="搜索域与设置项" autocomplete="off"></div>` +
    `<span class="bz-sp-head-tools"></span></div>`;
}

/** 桌面面板骨架（头行 + 左导航 + 右内容区） */
export function deskShellHtml(): string {
  return `${deskHeadHtml()}` +
    `<div class="bz-sp-desk-body">` +
    `<div class="bz-sp-desk-side"><div class="bz-sp-nav"></div></div>` +
    `<div class="bz-sp-desk-main"><div class="bz-sp-pane"></div></div>` +
    `</div>`;
}

/** 导航语义分段（基础/记录/媒体与知识/工具/其他；itemsHtml = navItemHtml 串） */
export function navSecHtml(title: string, itemsHtml: string): string {
  return `<div class="bz-sp-nav-sec"><div class="bz-sp-nav-sec-t">${esc(title)}</div>${itemsHtml}</div>`;
}

/** 导航域项（图标 + 名称 + 动态徽标；on = 当前选中域；data-sp-domain 契约供事件层回查） */
export function navItemHtml(opts: { id: string; icon: string; name: string; count: string; on?: boolean }): string {
  return `<button type="button" class="bz-sp-nav-item${opts.on ? ' on' : ''}" data-sp-domain="${esc(opts.id)}">` +
    `<i data-lucide="${esc(opts.icon)}" class="bz-ic bz-sp-nav-ic"></i>` +
    `<span class="bz-sp-nav-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-nav-count">${esc(opts.count)}</span></button>`;
}

/* ==================== 移动：M1 命令面板 ==================== */

/** 移动头行（标题 + 工具位；关闭钮由 ui 层用组件库物化进 .bz-sp-head-tools） */
export function mobHeadHtml(): string {
  return `<div class="bz-sp-head"><span class="bz-sp-head-title">设置</span><span class="bz-sp-head-tools"></span></div>`;
}

/** 移动面板骨架（头行 + 搜索 + 域列表） */
export function mobShellHtml(): string {
  return `${mobHeadHtml()}` +
    `<div class="bz-sp-mob-search"><span class="bz-input-wrap">${iconSpan('search')}<input class="bz-input" placeholder="搜索设置、域…" autocomplete="off"></span></div>` +
    `<div class="bz-sp-mob-list"></div>`;
}

/** 移动域行（图标方块 + 名称 + 描述 + ›；data-sp-domain 契约供事件层回查） */
export function mobItemHtml(opts: { id: string; icon: string; name: string; desc: string }): string {
  return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}">` +
    `<span class="bz-sp-mob-ic"><i data-lucide="${esc(opts.icon)}" class="bz-ic"></i></span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span>` +
    `<span class="bz-sp-mob-chev">${iconSpan('chevron-right')}</span></button>`;
}

/** 移动搜索「设置项」命中行（域有原型无——issue 244 保留：搜索直达设置项；kind 徽标 = 「设置」） */
export function mobRowHitHtml(opts: { id: string; icon: string; name: string; desc: string }): string {
  return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}">` +
    `<span class="bz-sp-mob-ic"><i data-lucide="${esc(opts.icon)}" class="bz-ic"></i></span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span>` +
    `<span class="bz-sp-mob-kind">设置</span></button>`;
}

/** 移动语义分段标题 */
export function mobSecHtml(title: string): string {
  return `<div class="bz-sp-mob-sec">${esc(title)}</div>`;
}

/** 移动搜索空态（域有原型无：移动搜索含「设置项」段——issue 244 保留） */
export function mobEmptyHtml(query: string): string {
  return `<div class="bz-sp-mob-empty">没有匹配「${esc(query)}」的设置或域</div>`;
}

/** 移动域设置弹窗壳（头行图标方块 + 标题 + 空 body；关闭钮由 ui 层物化进头行） */
export function mobModalShellHtml(icon: string, title: string): string {
  return `<div class="bz-sp-mob-modal-head"><span class="bz-sp-mob-modal-ic">` +
    `<i data-lucide="${esc(icon)}" class="bz-ic"></i></span>` +
    `<h3 class="bz-sp-mob-modal-title">${esc(title)}</h3></div>` +
    `<div class="bz-sp-settings-body bz-sp-mob-modal-body"></div>`;
}
