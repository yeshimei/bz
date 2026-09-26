/**
 * 经纬布局（settings-panel，ADR-0105 布局差异层）：面板骨架与导航差异。
 * 当前唯一布局 = P1 系统面板：桌面 B 侧栏工作台 + 移动 M1 命令面板。
 * 骨架/导航串与 ui.ts 消费侧同一份 markup（ADR-0104/0106 单源，评审壳零自绘）；
 * 控件级工厂见 ../../shared.ts；本文件只写桌面面板骨架/头行/导航
 * （移动端骨架/列表项同落本文件：全屏推入式两页 = 首页列表 + 域设置页）。
 *
 * 使用手册 / 更新日志（issue 473/472）——2026-09-26 用户拍板：**不做常驻底栏**
 * （原桌面侧栏 footer、移动端底缘两版都撤），改挂**导航/列表末尾一组**
 * （navDocSecHtml / mobDocSecHtml）：跟其他组一样随列表滚动、能被搜索命中。
 */
import { esc, iconSpan } from '../../../core/ui/str';

/* ==================== 桌面：B 侧栏工作台 ==================== */

/** 桌面面板骨架（头行 = 面包屑「设置」+ 搜索框 + 工具位；左导航 + 右内容区）——原型 mount desk 分支。
 *  手册 / 日志入口不再常驻底缘（用户 2026-09-26 拍板），由 renderNav 在导航末尾追加一组。 */
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

/** 导航末尾「文档」组（桌面）：手册在上、日志在下。
 *  用 .bz-sp-nav-doc 而非 .bz-sp-nav-item —— 后者是域契约类（ui 层按 data-sp-domain 切域、
 *  测试按它数域项），手册/日志不是域，不得入列。data-sp-manual / data-sp-changelog 沿用原契约。 */
export function navDocSecHtml(): string {
  return `<div class="bz-sp-nav-sec"><div class="bz-sp-nav-sec-t">文档</div>` +
    `<button type="button" class="bz-sp-nav-doc" data-sp-manual>` +
    `${iconSpan('book-open', 'bz-ic bz-sp-nav-ic')}<span class="bz-sp-nav-name">使用手册</span></button>` +
    `<button type="button" class="bz-sp-nav-doc" data-sp-changelog>` +
    `${iconSpan('history', 'bz-ic bz-sp-nav-ic')}<span class="bz-sp-nav-name">更新日志</span></button>` +
    `</div>`;
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

/** 移动端列表末尾「文档」组：与桌面同口径（手册 / 日志不是域，用 .bz-sp-mob-doc
 *  而非 .bz-sp-mob-item —— 后者带 data-sp-domain，会被列表点击回查成域而推空页）。 */
export function mobDocSecHtml(): string {
  return `<div class="bz-sp-mob-sec">文档</div>` +
    `<button type="button" class="bz-sp-mob-doc" data-sp-manual>` +
    `<span class="bz-sp-mob-ic">${iconSpan('book-open')}</span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">使用手册</span>` +
    `<span class="bz-sp-mob-desc">完整功能说明，随时可查</span></span></button>` +
    `<button type="button" class="bz-sp-mob-doc" data-sp-changelog>` +
    `<span class="bz-sp-mob-ic">${iconSpan('history')}</span>` +
    `<span class="bz-sp-mob-t"><span class="bz-sp-mob-name">更新日志</span>` +
    `<span class="bz-sp-mob-desc">每个版本改了什么</span></span></button>`;
}
