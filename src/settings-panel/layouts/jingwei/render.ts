/**
 * 经纬布局（settings-panel，ADR-0105 布局差异层）：面板骨架与导航差异。
 * 当前唯一布局 = P1 系统面板：桌面 B 侧栏工作台 + 移动 M1 命令面板。
 * 骨架/导航串与 ui.ts 消费侧同一份 markup（ADR-0104/0106 单源，评审壳零自绘）；
 * 控件级工厂见 ../../shared.ts；本文件只写桌面面板骨架/头行/导航
 * （移动端骨架/列表项同落本文件：全屏推入式两页 = 首页列表 + 域设置页）。
 */
import { esc, iconSpan } from '../../../core/ui/str';

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

/* ==================== 移动端：全屏推入式两页（首页列表 ⇆ 域设置页） ==================== */

/** 移动端骨架：viewport 承载两页横推（home 常驻；domain 页 transform 进出场，见 styles.css） */
export function mobShellHtml(): string {
  return `<div class="bz-sp-mob-viewport">` +
    `<section class="bz-sp-mob-page bz-sp-mob-page--home">` +
    `<div class="bz-sp-head"><span class="bz-sp-head-title">设置</span>` +
    `<span class="bz-sp-head-tools" data-sp-mob-tools="home"></span></div>` +
    `<div class="bz-sp-mob-search">${iconSpan('search')}<input class="bz-input" placeholder="搜索设置、域…" autocomplete="off"></div>` +
    `<div class="bz-sp-mob-list"></div></section>` +
    `<section class="bz-sp-mob-page bz-sp-mob-page--domain">` +
    `<div class="bz-sp-head"><span class="bz-sp-mob-nav" data-sp-mob-back></span>` +
    `<span class="bz-sp-mob-title"></span>` +
    `<span class="bz-sp-head-tools" data-sp-mob-tools="domain"></span></div>` +
    `<div class="bz-sp-settings-body bz-sp-mob-page-body"></div></section>` +
    `</div>`;
}

/** 移动端列表域项（图标方块 + 名称 + 描述 + ›/「设置」签；data-sp-domain 契约供事件层回查）。
 *  row（2026-09-12 补）：搜索命中的**设置项**行 → 推入该域后滚动定位并高亮该行。 */
export function mobItemHtml(opts: { id: string; icon: string; name: string; desc: string; kind?: string; row?: string }): string {
  const tail = opts.kind
    ? `<span class="bz-sp-mob-kind">${esc(opts.kind)}</span>`
    : `<span class="bz-sp-mob-chev">${iconSpan('chevron-right')}</span>`;
  return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}"${opts.row ? ` data-sp-row="${esc(opts.row)}"` : ''}>` +
    `<span class="bz-sp-mob-ic">${iconSpan(opts.icon)}</span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span>` +
    `<span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span>${tail}</button>`;
}
