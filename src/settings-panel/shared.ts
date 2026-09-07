/**
 * 设置面板渲染纯层 · 共享层（settings-panel，ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 本文件是「原型 × 插件」控件级 markup 的唯一事实源：开关/下拉/输入/滑杆/路径 chips/
 * 按钮徽标/choiceCards 卡组/行骨架/分组卡/域页头/加载态——全部出自这里——
 *   - 插件侧：renderer.ts / ui.ts 拼 innerHTML 后按契约类绑事件（core 服务/落盘留行为层）；
 *   - 原型侧：dev 打成 prototype-render.js（IIFE，挂 window.BZR_settings_panel），壳消费同一份。
 * 与模板串孪生域（bookshelf/belongings）不同：本域是 schema 驱动，纯层收的是
 * 「输入 schema 节点视图 + 值 → 输出 HTML 串」的工厂，schema 本体不进纯层。
 *
 * 纯层契约（tests/core/render-purity.test.ts 守卫）：import 白名单仅 `../core/ui/str`；
 * settings-schema 仅 type-only（编译期剥除）；禁 obsidian/moment/core 服务/组件库 barrel；
 * 禁模块级可变状态；图标一律 `<i data-lucide>` 占位（iconSpan），由各端 mountIcons 物化。
 */
import { esc, iconSpan } from '../core/ui/str';

// 再出口（壳经 window.BZR_settings_panel 取用；插件 renderer/ui 亦统一从这里取）
export { esc, iconSpan };

/* ==================== 控件级工厂（跨布局/跨面板复用） ==================== */

/** 开关（button.bz-sw；role=switch；on = 选中态） */
export function toggleHtml(on: boolean): string {
  return `<button type="button" class="bz-sw${on ? ' on' : ''}" role="switch" aria-checked="${String(on)}"></button>`;
}

/** 下拉触发器（菜单 open 时动态渲——selectMenuHtml / selectItemHtml 同为纯串） */
export function selectTriggerHtml(label: string): string {
  return `<div class="bz-select"><span class="bz-select-val">${esc(label)}</span>` +
    // 箭头旋转由 styles.css .bz-select-car 统一承载（样式单源，两侧同构）
    `${iconSpan('chevron-right', 'bz-select-car')}</div>`;
}

/** 下拉菜单项（is-on = 当前值；勾标 icon 占位由 mountIcons 兑现） */
export function selectItemHtml(label: string, on: boolean): string {
  return `<button type="button" class="bz-select-item${on ? ' is-on' : ''}"><span>${esc(label)}</span>` +
    `<span class="bz-ic bz-select-item-ck">${iconSpan('check')}</span></button>`;
}

/** 文本/数字输入（mono/num/secret 修饰；契约类 bz-input） */
export function textInputHtml(opts: {
  value: string;
  type?: 'text' | 'number';
  mono?: boolean;
  num?: boolean;
  secret?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}): string {
  const cls = ['bz-input'];
  if (opts.mono) cls.push('mono');
  if (opts.num) cls.push('num');
  if (opts.secret) cls.push('secret');
  const attrs: string[] = [`class="${cls.join(' ')}"`, `value="${esc(opts.value)}"`];
  attrs.push(opts.type === 'number' ? 'type="number"' : 'type="text"');
  if (opts.placeholder) attrs.push(`placeholder="${esc(opts.placeholder)}"`);
  if (opts.min !== undefined) attrs.push(`min="${opts.min}"`);
  if (opts.max !== undefined) attrs.push(`max="${opts.max}"`);
  if (opts.step !== undefined) attrs.push(`step="${opts.step}"`);
  return `<input ${attrs.join(' ')} autocomplete="off">`;
}

/** 多行文本（bz-input bz-sp-textarea） */
export function textareaHtml(value: string, placeholder?: string): string {
  return `<textarea class="bz-input bz-sp-textarea" autocomplete="off"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}>${esc(value)}</textarea>`;
}

/** 滑杆行（轻量读数 span） */
export function sliderHtml(min: number | undefined, max: number | undefined, step: number | undefined, value: number): string {
  return `<div class="bz-sp-slider-row">` +
    `<input type="range"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''} step="${step ?? 1}" value="${value}">` +
    `<span class="bz-sp-slider-val">${value}</span></div>`;
}

/** 路径行 chips 项串（无容器——容器 .bz-sp-chips 由调用方持有，重渲只换内部串） */
export function pathChipsItemsHtml(chips: Array<{ path: string; label: string; locked?: boolean; muted?: boolean; multi?: boolean }>): string {
  return chips.map((c) => {
    const cls = c.muted ? 'bz-sp-chip bz-sp-chip--muted' : c.locked ? 'bz-sp-chip bz-sp-chip--locked' : 'bz-sp-chip';
    return `<span class="${cls}" data-sp-path="${esc(c.path)}"${c.label ? ` title="${esc(c.label)}"` : ''}>${esc(c.label)}` +
      (c.multi && !c.muted && !c.locked ? '<i class="x">✕</i>' : '') + `</span>`;
  }).join('');
}

/** 路径行 chips（容器版；域内路径行走容器版逐项重渲时用 pathChipsItemsHtml） */
export function pathChipsHtml(chips: Array<{ path: string; label: string; locked?: boolean; muted?: boolean; multi?: boolean }>): string {
  return `<div class="bz-sp-chips">${pathChipsItemsHtml(chips)}</div>`;
}

/** 路径行「选择…/添加…」按钮 */
export function pathAddBtnHtml(text: string): string {
  return `<button type="button" class="bz-sp-btn bz-sp-path-btn">${esc(text)}</button>`;
}

/** 行操作按钮（cta → accent 实底） */
export function rowBtnHtml(label: string, cta?: boolean): string {
  return `<button type="button" class="bz-sp-btn${cta ? ' bz-sp-btn--primary' : ''}">${esc(label)}</button>`;
}

/** 信息徽标（info 行） */
export function badgeHtml(label: string): string {
  return `<span class="bz-badge">${esc(label)}</span>`;
}

/** choiceCards 卡组（radiogroup；卡片 = 迷你预览 div + 名称；is-on = 当前值；
 *  卡上 data-sp-card 契约供事件层回查选项值） */
export function cardpickHtml(cards: Array<{ value: string; label: string; on: boolean; prevClass?: string }>): string {
  return `<div class="bz-sp-cardpick" role="radiogroup">` + cards.map((c) =>
    `<button type="button" class="bz-sp-cardpick-card${c.on ? ' is-on' : ''}" data-sp-card="${esc(c.value)}">` +
    `<div class="bz-sp-mini${c.prevClass ? ` ${c.prevClass}` : ''}" aria-hidden="true"></div>` +
    `<span class="bz-sp-cardpick-name">${esc(c.label)}</span></button>`
  ).join('') + `</div>`;
}

/* ==================== 行 / 组骨架 ==================== */

/** 行视图模型（renderer 从 schema 行摘出的纯数据投影视图） */
export interface SpRowVm {
  /** 行语义修饰类（child / bz-sp-set-row--cards 等） */
  cls?: string;
  /** info 区：名称/描述/备注（↳ 前缀 note）；custom 行不渲 info（插槽自带标题描述） */
  name?: string;
  desc?: string;
  note?: string;
  /** 控件区 HTML（isCards 时容器用 .bz-sp-set-cards；isCustom 时整行 = 插槽） */
  ctrlHtml?: string;
  isCards?: boolean;
  isCustom?: boolean;
}

/** 单行骨架（返回完整行串；契约类 .bz-sp-set-ctrl / .bz-sp-set-cards / .bz-sp-custom-slot 供事件层定位） */
export function rowHtml(vm: SpRowVm): string {
  const cls = ['bz-sp-set-row'];
  if (vm.cls) cls.push(vm.cls);
  if (vm.isCards) cls.push('bz-sp-set-row--cards');
  if (vm.isCustom) cls.push('bz-sp-set-row--custom');
  if (vm.isCustom) {
    // custom 行：内容插槽自带标题/描述（各域 new Setting().setName/setDesc），面板不渲 info 区，
    // 插槽占满整行（避免标题描述两遍——ticket 设置面板内容重复 a/c）
    return `<div class="${cls.join(' ')}"><div class="bz-sp-custom-slot bz-sp-custom-slot--full">${vm.ctrlHtml ?? ''}</div></div>`;
  }
  const name = vm.name ? `<div class="bz-sp-set-name">${esc(vm.name)}</div>` : '';
  const desc = vm.desc ? `<div class="bz-sp-set-desc">${esc(vm.desc)}</div>` : '';
  const note = vm.note ? `<div class="bz-sp-set-note">↳ ${esc(vm.note)}</div>` : '';
  const info = `<div class="bz-sp-set-info">${name}${desc}${note}</div>`;
  const ctrlCls = vm.isCards ? 'bz-sp-set-cards' : 'bz-sp-set-ctrl';
  return `<div class="${cls.join(' ')}">${info}<div class="${ctrlCls}">${vm.ctrlHtml ?? ''}</div></div>`;
}

/** 分组卡骨架（图标块 + 名称 + 项数徽标 + 空 body；body 由 renderer 逐行填） */
export function groupCardHtml(icon: string | undefined, name: string, count: string): string {
  // 图标块 = 单元素占位（mountIcons 物化后 .bz-sp-group-icon 自身带 data-icon——契约与旧 setIcon 一致）
  const ic = icon ? iconSpan(icon, 'bz-sp-group-icon') : '';
  return `<div class="bz-sp-group"><div class="bz-sp-group-head">${ic}` +
    `<span class="bz-sp-group-name">${esc(name)}</span>` +
    `<span class="bz-sp-group-count">${esc(count)}</span></div>` +
    `<div class="bz-sp-group-body"></div></div>`;
}

/** 域页头（域名 + 描述 + 右侧项数/组数徽标；tag 可后填） */
export function pageHeadHtml(name: string, desc: string, tag: string): string {
  return `<div class="bz-sp-page-head"><div><div class="bz-sp-page-title">${esc(name)}</div>` +
    `<div class="bz-sp-page-desc">${esc(desc)}</div></div>` +
    `<span class="bz-sp-page-tag">${esc(tag)}</span></div>`;
}

/** 加载态（spinner + 文案） */
export function loadingHtml(text = '加载设置…'): string {
  return `<div class="bz-sp-loading"><span class="bz-spinner"></span><span>${esc(text)}</span></div>`;
}

/** 头行工具位图标钮占位（bz-sp-mob-close 等由 ui 层用组件库物化，此处仅头行容器契约） */
export function headToolsHtml(): string {
  return `<span class="bz-sp-head-tools"></span>`;
}
