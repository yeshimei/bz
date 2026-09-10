/**
 * 设置面板渲染纯层 · 共享层（settings-panel，ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 本文件是「插件 × 评审壳」控件级 markup 的唯一实现（ADR-0104/0105 markup 单源；
 * 2026-09-07 拍板 ADR-0106：行为唯一真理 = 域 ui.ts，原型壳退化为双 iframe 评审壳，
 * 旧 prototype.app.js 自绘脚本退役删除——本层不再以壳脚本为真理，两侧 markup 均由
 * 真 ui.ts / renderer.ts 消费同一份）：
 *   - 插件侧：renderer.ts / ui.ts 消费串工厂后按契约类绑事件（core 服务/落盘留行为层）；
 *   - 原型侧：prototype-behavior.js（fake-sim 构建）跑同一依赖链，壳零自绘。
 * 本域 schema 驱动，纯层收「输入 schema 节点视图 + 值 → 输出 HTML 串」的工厂，schema 本体不进纯层。
 *
 * 纯层契约（tests/core/render-purity.test.ts 守卫）：import 白名单仅 `../core/ui/str`；
 * settings-schema 仅 type-only（编译期剥除）；禁 obsidian/moment/core 服务/组件库 barrel；
 * 禁模块级可变状态；图标一律 `<i data-lucide>` 占位（iconSpan），由各端 mountIcons 物化。
 */
import { esc, iconSpan } from '../core/ui/str';

// 再出口（壳经 window.BZR_settings_panel 取用；插件 renderer/ui 亦统一从这里取）
export { esc, iconSpan };

/* ==================== 控件级工厂（跨布局/跨面板复用；源出原型定稿 renderCtl 口径） ==================== */

/** 开关（button.bz-sw；role=switch；on = 选中态）——原型 toggle 分支 */
export function toggleHtml(on: boolean): string {
  return `<button type="button" class="bz-sw${on ? ' on' : ''}" role="switch" aria-checked="${String(on)}"></button>`;
}

/** 下拉触发器（菜单 open 时动态渲——selectMenuHtml / selectItemHtml 同为纯串）
 *  原型 select 分支：bz-select = 值 span + chevron 右转箭头（旋转由 styles.css .bz-select-car 单源承载） */
export function selectTriggerHtml(label: string): string {
  return `<div class="bz-select"><span class="bz-select-val">${esc(label)}</span>` +
    `${iconSpan('chevron-right', 'bz-select-car')}</div>`;
}

/** 下拉菜单项（is-on = 当前值；勾标 icon 占位由 mountIcons 兑现）——原型菜单循环项 */
export function selectItemHtml(label: string, on: boolean): string {
  return `<button type="button" class="bz-select-item${on ? ' is-on' : ''}"><span>${esc(label)}</span>` +
    `<span class="bz-ic bz-select-item-ck">${iconSpan('check')}</span></button>`;
}

/** 文本/数字输入（mono/num/secret 修饰；契约类 bz-input）——原型 text/textarea/number 分支 */
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

/** 滑杆行（轻量读数 span）——原型 slider 分支 bz-sp-slider-row */
export function sliderHtml(min: number | undefined, max: number | undefined, step: number | undefined, value: number): string {
  return `<div class="bz-sp-slider-row">` +
    `<input type="range"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''} step="${step ?? 1}" value="${value}">` +
    `<span class="bz-sp-slider-val">${value}</span></div>`;
}


/** 行操作按钮（cta → accent 实底）——原型 button 分支 */
export function rowBtnHtml(label: string, cta?: boolean): string {
  return `<button type="button" class="bz-sp-btn${cta ? ' bz-sp-btn--primary' : ''}">${esc(label)}</button>`;
}

/** 通用列表行控件区（core ListRow 同构；条目 = 头像可选 + 主文案 + 副文案 + 移除按钮，data-key 定位契约） */
export function listHtml(items: Array<{ key: string; label: string; sub?: string; imageUrl?: string }>, removeLabel = '移除'): string {
  if (items.length === 0) return '';
  return items.map((it) =>
    `<div class="bz-setlist-item" data-key="${esc(it.key)}">` +
    (it.imageUrl ? `<img class="bz-setlist-avatar" src="${esc(it.imageUrl)}" alt="">` : '') +
    `<div class="bz-setlist-text"><div class="bz-setlist-name">${esc(it.label)}</div>` +
    (it.sub ? `<div class="bz-setlist-sub">${esc(it.sub)}</div>` : '') +
    `</div><button type="button" class="bz-setlist-remove bz-touch-target--xl">${esc(removeLabel)}</button></div>`
  ).join('');
}

/** 通用列表行空态（域侧不出条目时由渲染器回退 emptyText） */
export function listEmptyHtml(text: string): string {
  return `<div class="bz-setlist-empty">${esc(text)}</div>`;
}

/** 信息徽标（info 行） */
export function badgeHtml(label: string): string {
  return `<span class="bz-badge">${esc(label)}</span>`;
}

/** 迷你皮肤预览（choiceCards 卡内；逐字提取原型 renderMini 七种 kind——内联样式为原型真理） */
export function miniHtml(kind: string | undefined, prev: Record<string, unknown>): string {
  const st = (extra: string): string => ` style="${extra}"`;
  const bg = st(`background:${prev.bg}`);
  if (kind === 'memo') {
    const headCls = 'm-head' + (prev.head === 'stripe' ? ' m-stripe' : '');
    const headBg = prev.head === 'stripe' ? prev.bg : prev.ink;
    const headBorder = prev.head === 'stripe' ? `border-bottom:2px solid ${prev.ink};` : '';
    const lines = [[18, 16], [28, 24], [24, 32]].map(([w, top], i) =>
      `<div class="m-line"${st(`top:${top}px;width:${w}px;background:${prev.ink};opacity:${i === 2 ? 0.35 : 0.55}`)}></div>`).join('');
    return `<div class="bz-sp-mini"${bg}><div class="${headCls}"${st(`background:${headBg};${headBorder}`)}></div>${lines}` +
      `<div class="m-chip"${st(`background:${prev.ac}`)}></div></div>`;
  }
  if (kind === 'shelf') {
    const books = (prev.books as string[] | undefined || []).map((c, i) =>
      `<div class="m-book"${st(`left:${10 + i * 14}px;height:${[24, 32, 20][i]}px;background:${c};border-top:2px solid ${prev.ac}`)}></div>`).join('');
    return `<div class="bz-sp-mini"${bg}><div class="m-ac"${st(`background:${prev.ac}`)}></div>${books}</div>`;
  }
  if (kind === 'layout') {
    // 布局缩略：head 横条 + 形态块（mode: system/compact/iconrail/outline）
    const mk = (css: string): string => `<div${st(`position:absolute;border-radius:2px;background:rgba(90,70,40,.22);${css}`)}></div>`;
    let blocks = '';
    if (prev.mode === 'system') blocks = mk('left:4px;top:14px;width:14px;bottom:4px;') + mk('left:21px;top:14px;right:4px;height:26px;');
    else if (prev.mode === 'compact') blocks = mk('left:4px;top:14px;width:14px;bottom:4px;') + mk('left:21px;top:14px;width:26px;height:12px;') +
      mk('left:21px;top:28px;width:26px;height:12px;') + mk('left:50px;top:14px;width:10px;bottom:10px;');
    else if (prev.mode === 'iconrail') blocks = mk('left:2px;top:2px;bottom:2px;width:8px;') + mk('left:14px;top:4px;width:16px;bottom:4px;') +
      mk('left:34px;top:4px;right:4px;bottom:4px;');
    else if (prev.mode === 'outline') blocks = mk('left:4px;top:14px;right:24px;bottom:4px;') + mk('right:4px;top:14px;width:16px;height:20px;');
    return `<div class="bz-sp-mini"${bg}><div class="m-head"${st('background:rgba(90,70,40,.28)')}></div>${blocks}</div>`;
  }
  if (kind === 'skin') {
    // 主题套装预览：亮暗双块（自动亮暗，无需指定）
    return `<div class="bz-sp-mini"${bg}>` +
      `<div${st(`position:absolute;inset:0 50% 0 0;background:${prev.light || '#f6f2e9'}`)}></div>` +
      `<div${st(`position:absolute;inset:0 0 0 50%;background:${prev.dark || '#242429'}`)}></div>` +
      `<div${st(`position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:${prev.ac || 'var(--sp-accent)'};border:2px solid #fff;`)}></div></div>`;
  }
  if (kind === 'themecard') {
    return `<div class="bz-sp-mini"${bg}>` +
      `<div${st(`position:absolute;left:5px;top:50%;transform:translateY(-50%);width:5px;height:26px;border-radius:3px;background:${prev.ac};`)}></div></div>`;
  }
  if (kind === 'poster') {
    // 归物本海报缩略（P20 大字报）：hero 大字墨块 + 右上赤橙 KPI + 三列缝线网格带
    const mk = (css: string): string => `<div${st(`position:absolute;${css}`)}></div>`;
    return `<div class="bz-sp-mini"${bg}>` +
      mk(`left:6%;top:12%;width:44%;height:20%;background:${prev.ink || '#171512'};`) +
      mk(`left:86%;top:14%;width:8%;height:16%;background:${prev.ac || '#e8481f'};`) +
      mk(`left:6%;top:44%;width:88%;height:46%;background:rgba(23,21,18,.1);`) +
      mk(`left:38%;top:44%;width:2px;height:46%;background:rgba(23,21,18,.28);`) +
      mk(`left:66%;top:44%;width:2px;height:46%;background:rgba(23,21,18,.28);`) +
      `</div>`;
  }
  if (kind === 'cat') {
    const ears = ['ear l', 'ear r'].map(() =>
      `<div class="ear"${st(`background:transparent;border-bottom-color:${prev.fur}`)}></div>`).join('');
    const eyes = ['eye l', 'eye r'].map(() => `<div class="eye"${st('background:rgba(20,15,8,.75)')}></div>`).join('');
    return `<div class="bz-sp-mini"${bg}><div class="m-cat">${ears}` +
      `<div class="face"${st(`background:${prev.fur}`)}></div>` +
      (prev.patch ? `<div class="patch"${st(`background:${prev.patch}`)}></div>` : '') + eyes + `</div></div>`;
  }
  return `<div class="bz-sp-mini"${bg}></div>`;
}

/** choiceCards 卡组（radiogroup；卡 = mini 预览 + 名称；is-on = 当前值；data-sp-card 契约供事件层回查）。
 *  每卡预览二选一：kind+prev（原型 renderMini 数据内联构建）或 prevClass（插件端 CSS 承载）——结构同源。 */
export function cardpickHtml(cards: Array<{ value: string; label: string; on: boolean; kind?: string; prev?: Record<string, unknown>; prevClass?: string }>): string {
  return `<div class="bz-sp-cardpick" role="radiogroup">` + cards.map((c) => {
    const mini = c.kind
      ? miniHtml(c.kind, c.prev || {})
      : `<div class="bz-sp-mini${c.prevClass ? ` ${c.prevClass}` : ''}" aria-hidden="true"></div>`;
    return `<button type="button" class="bz-sp-cardpick-card${c.on ? ' is-on' : ''}" data-sp-card="${esc(c.value)}">` +
      mini + `<span class="bz-sp-cardpick-name">${esc(c.label)}</span></button>`;
  }).join('') + `</div>`;
}

/* ==================== 行 / 组骨架（源出原型定稿 rowEl / renderGroupsInto 口径） ==================== */

/** 行视图模型（renderer 从 schema 行摘出的纯数据投影视图） */
export interface SpRowVm {
  /** 行定位契约（原型 rowEl：data-key = 绑定键 || 行名；搜索命中/显隐重算同构钩子） */
  key?: string;
  /** 行语义修饰类（child） */
  cls?: string;
  /** info 区：名称/描述/备注（↳ 前缀 note）；custom 行 = info + 自定义内容 */
  name?: string;
  desc?: string;
  note?: string;
  /** 控件区 HTML（isCards 时容器用 .bz-sp-set-cards；isCustom 时为整行自定义内容） */
  ctrlHtml?: string;
  isCards?: boolean;
  isCustom?: boolean;
}

/** 单行骨架（返回完整行串；契约类 .bz-sp-set-ctrl / .bz-sp-set-cards / data-key 供事件层定位）。
 *  custom 行 = info（名称/描述）+ 自定义内容占满整行（原型 renderCustom 子行串或插件插槽串由 ctrlHtml 注入）。 */
export function rowHtml(vm: SpRowVm): string {
  const cls = ['bz-sp-set-row'];
  if (vm.cls) cls.push(vm.cls);
  if (vm.isCards) cls.push('bz-sp-set-row--cards');
  if (vm.isCustom) cls.push('bz-sp-set-row--custom');
  const open = `<div class="${cls.join(' ')}"${vm.key ? ` data-key="${esc(vm.key)}"` : ''}>`;
  const name = vm.name ? `<div class="bz-sp-set-name">${esc(vm.name)}</div>` : '';
  const desc = vm.desc ? `<div class="bz-sp-set-desc">${esc(vm.desc)}</div>` : '';
  if (vm.isCustom) {
    return `${open}<div class="bz-sp-set-info">${name}${desc}</div>${vm.ctrlHtml ?? ''}</div>`;
  }
  const note = vm.note ? `<div class="bz-sp-set-note">↳ ${esc(vm.note)}</div>` : '';
  const info = `<div class="bz-sp-set-info">${name}${desc}${note}</div>`;
  const ctrlCls = vm.isCards ? 'bz-sp-set-cards' : 'bz-sp-set-ctrl';
  return `${open}${info}<div class="${ctrlCls}">${vm.ctrlHtml ?? ''}</div></div>`;
}

/** 分组卡骨架（图标块 + 名称 + 项数徽标 + 空 body；body 由调用方逐行填）——原型 renderGroupsInto（section） */
export function groupCardHtml(icon: string | undefined, name: string, count: string): string {
  const ic = icon ? iconSpan(icon, 'bz-sp-group-icon') : '';
  return `<section class="bz-sp-group"><div class="bz-sp-group-head">${ic}` +
    `<span class="bz-sp-group-name">${esc(name)}</span>` +
    `<span class="bz-sp-group-count">${esc(count)}</span></div>` +
    `<div class="bz-sp-group-body"></div></section>`;
}

/** 域页头（域名 + 描述 + 右侧项数/组数徽标）——原型 render desk 分支 */
export function pageHeadHtml(name: string, desc: string, tag: string): string {
  return `<div class="bz-sp-page-head"><div><div class="bz-sp-page-title">${esc(name)}</div>` +
    `<div class="bz-sp-page-desc">${esc(desc)}</div></div>` +
    `<span class="bz-sp-page-tag">${esc(tag)}</span></div>`;
}

/** 加载态（spinner + 文案） */
export function loadingHtml(text = '加载设置…'): string {
  return `<div class="bz-sp-loading"><span class="bz-spinner"></span><span>${esc(text)}</span></div>`;
}


