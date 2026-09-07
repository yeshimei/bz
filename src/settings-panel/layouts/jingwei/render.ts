/**
 * 经纬布局（settings-panel，ADR-0105 布局差异层）：面板骨架与导航差异。
 * 当前唯一布局 = P1 系统面板：桌面 B 侧栏工作台 + 移动 M1 命令面板。
 * 骨架/导航串与 ui.ts 消费侧同一份 markup（ADR-0104/0106 单源，评审壳零自绘）；
 * 控件级工厂见 ../../shared.ts；本文件只写桌面面板骨架/头行/导航
 * （移动端列表 markup 由 ui.ts buildMobile 手搓，移动工厂已随纯清理批退役）。
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
