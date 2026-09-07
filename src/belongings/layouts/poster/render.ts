/**
 * 归物本「瑞士大字报」布局（ADR-0105 布局差异层，P20 拍板稿）：
 * 面板骨架/hero/chips/年份与排序下拉/KPI/网格卡/渲染胶水。
 * 共享口径与详情/表单见 ../../shared.ts；域入口 render.ts 聚合两方。
 */
import { esc, iconSpan } from '../../../core/ui/str';
import {
  ICON, STATUS, STATUS_ORDER, STATUS_LABELS, SORT_OPTS,
  money, moneyShort, statusKeyOf, statusOf,
  isExited, daysUsed, dailyCostOf, inStock, stockCount, totalAssets, avgDailyCost, statusCount,
  yearsAvailable, resolveYear,
  itemEmHtml, catNameOf,
  filtered, heroTitleText, heroSubText,
  type BelViewState,
} from '../../shared';
import type { BelongingsItem } from '../../types';

// ==================== markup 构建器 ====================

/** 面板骨架（hero/KPI/chips/工具行/横滑条/内容区/移动记一笔；data-bel-* 钩子契约根） */
export function panelHtml(): string {
  return `<div class="bz-bel-panel bz-panel-frame bz-panel-mtop bz-bel--poster">
  <div class="bz-bel-body">
    <div class="bz-bel-hero">
      <div class="bz-bel-hero-text">
        <div class="bz-bel-hero-title" data-bel-herotitle>全部</div>
        <div class="bz-bel-hero-sub" data-bel-herosub>归物本 — NOTHING MORE, NOTHING LESS</div>
      </div>
      <div class="bz-bel-kpis" data-bel-kpis></div>
      <div class="bz-bel-mobhead">
        <div class="bz-bel-stamp"><b data-bel-stampn>0</b><span>在库</span></div>
        <div class="bz-bel-mobhead-tx">
          <div class="bz-bel-mobhead-t">归物本</div>
          <div class="bz-bel-mobhead-sub" data-bel-mobstats></div>
        </div>
        <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-bel-mob-only" data-bel-close title="关闭">${iconSpan(ICON.close)}</button>
      </div>
    </div>
    <div class="bz-bel-chips" data-bel-chips></div>
    <div class="bz-toolrow bz-bel-toolrow">
      <div class="bz-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-bel-search placeholder="搜索名称 / 分类…"></div>
      <div class="bz-bel-yearsel">
        <div class="bz-bel-select" data-bel-year role="button" tabindex="0" aria-haspopup="listbox"><span class="bz-bel-select-label">全部年份</span>${iconSpan(ICON.chevD, 'bz-bel-select-chev')}</div>
        <div class="bz-bel-dropmenu" data-bel-yearmenu role="listbox"></div>
      </div>
      <div class="bz-bel-yearsel bz-bel-mobsortsel-wrap">
        <div class="bz-bel-select" data-bel-mobsortsel role="button" tabindex="0" aria-haspopup="listbox"><span class="bz-bel-select-label">最近购入</span>${iconSpan(ICON.chevD, 'bz-bel-select-chev')}</div>
        <div class="bz-bel-dropmenu" data-bel-mobsortmenu role="listbox"></div>
      </div>
      <div class="bz-bel-sort" data-bel-sort></div>
      <button class="bz-btn bz-btn--md bz-bel-addbtn" data-bel-add>${iconSpan(ICON.add, 'bz-ic--sm')} 记一笔</button>
    </div>
    <div class="bz-mobstrip" data-bel-mobstatus></div>
    <div class="bz-bel-content" data-bel-content></div>
    <button class="bz-btn bz-btn--md bz-bel-mobadd" data-bel-add>${iconSpan(ICON.add, 'bz-ic--sm')} 记一笔</button>
  </div>
</div>`;
}

/** 桌面筛选 chips（全部/资产/四态带计数；bz-chip 库皮；active 实底） */
export function chipsHtml(items: BelongingsItem[], view: BelViewState): string {
  const defs: { key: string; label: string; cnt: number }[] = [
    { key: '__all', label: '全部', cnt: items.length },
    { key: 'asset', label: '资产', cnt: stockCount(items) },
    ...STATUS_ORDER.map((s) => ({ key: s.key, label: s.label, cnt: statusCount(items, s.label) })),
  ];
  return defs.map((d) => {
    const active = d.key === '__all' ? view.status === null : view.status === d.key;
    return `<button type="button" class="bz-chip${active ? ' bz-chip--on' : ''}" data-bel-st="${d.key}"><span>${esc(d.label)}</span><span class="bz-chip-cnt">${d.cnt}</span></button>`;
  }).join('');
}

/** 移动横滑 chips（p20 m-chips：纯文字+计数，无图标；用户拍板去资产+缩小，五枚放一行。
 *  资产筛选移动端走 KPI 两卡点按，不丢能力） */
export function mobChipsHtml(items: BelongingsItem[], view: BelViewState): string {
  const defs: { key: string; label: string; cnt: number }[] = [
    { key: '__all', label: '全部', cnt: items.length },
    ...STATUS_ORDER.map((s) => ({ key: s.key, label: s.label, cnt: statusCount(items, s.label) })),
  ];
  return defs.map((d) => {
    const active = d.key === '__all' ? view.status === null : view.status === d.key;
    return `<button class="bz-mobstrip-chip${active ? ' is-on' : ''}" data-bel-st="${d.key}"><span>${esc(d.label)}</span><span class="bz-chip-cnt">${d.cnt}</span></button>`;
  }).join('');
}

/** 年份下拉选项行（自绘菜单；cur 项挂 is-cur，点击方取 data-v） */
export function yearsOptionsHtml(items: BelongingsItem[], cur: string): string {
  return '<div class="bz-bel-dropopt' + (cur === '' ? ' is-cur' : '') + '" data-v="" role="option">全部年份</div>'
    + yearsAvailable(items).map((y) => `<div class="bz-bel-dropopt${cur === y ? ' is-cur' : ''}" data-v="${y}" role="option">${y}</div>`).join('');
}

/** 移动排序下拉选项行（同年份下拉海报皮；与桌面 seg 双向同步，用户拍板） */
export function sortOptionsHtml(cur: string): string {
  return SORT_OPTS.map((o) => `<div class="bz-bel-dropopt${cur === o.v ? ' is-cur' : ''}" data-v="${o.v}" role="option">${o.label}</div>`).join('');
}

/** 桌面排序三档 segmented（bz-segmented 库皮；data-k 挂 v） */
export function segmentedHtml(sort: string): string {
  return `<div class="bz-segmented" role="radiogroup" aria-label="排序">${SORT_OPTS.map((o) =>
    `<button type="button" class="bz-segmented-btn${sort === o.v ? ' is-on' : ''}" data-k="${o.v}" role="radio" aria-checked="${sort === o.v}">${o.label}</button>`).join('')}</div>`;
}

/** KPI 行（在库件数 hero 可点/在库投入可点/日均成本/已离场·回收；ticket 189 资产合成筛选） */
export function kpisHtml(items: BelongingsItem[]): string {
  const gone = items.filter(isExited);
  const recover = gone.reduce((s, i) => s + (Number(i.sold_price) || 0), 0);
  const kpi = (num: string, label: string, opts: { hero?: boolean; click?: boolean } = {}) =>
    `<div class="bz-bel-kpi${opts.hero ? ' bz-bel-kpi--hero' : ''}${opts.click ? ' bz-bel-kpi--click' : ''}"${opts.click ? ' data-bel-statclick="asset" title="只看在库（使用中与闲置）"' : ''}><b>${num}</b><span>${esc(label)}</span></div>`;
  return (
    kpi(String(stockCount(items)), '在库件数', { hero: true, click: true }) +
    kpi(moneyShort(totalAssets(items)), '在库投入', { click: true }) +
    kpi('￥' + avgDailyCost(items).toFixed(2), '日均成本') +
    kpi(`${gone.length} 件 · ${moneyShort(recover)}`, '已离场 · 回收')
  );
}

/** 移动印章数（H8：与桌面 KPI 在库同口径） */
export function stampCount(items: BelongingsItem[]): string {
  return String(stockCount(items));
}
/** 移动印章头小字（投入/日均，与桌面 KPI 同口径） */
export function mobStatsText(items: BelongingsItem[]): string {
  return `投入 ${moneyShort(totalAssets(items))} · 日均 ${avgDailyCost(items).toFixed(2)}`;
}

/** 空态（bz-empty 库皮；文案区分库空 vs 筛选无匹配） */
export function emptyHtml(noMatch: boolean): string {
  return `<div class="bz-empty">${iconSpan(ICON.empty, 'bz-empty-ic')}<div class="bz-empty-title">${noMatch ? '没有符合条件的物品' : '这里还没有物品'}</div><div class="bz-empty-desc">${noMatch ? '换个筛选条件，或清除搜索' : '点「记一笔」登记第一个物品'}</div></div>`;
}

/** 网格卡（P20 大字报）：NO.XX 编号 + 状态徽章 + 特大分类图标 + 名称 + 大字价格 + meta */
export function cellHtml(it: BelongingsItem, idx: number): string {
  const gone = isExited(it);
  const idle = it.current_status === '闲置';
  const days = daysUsed(it);
  const daily = dailyCostOf(it);
  const key = statusKeyOf(it.current_status);
  // 出离尾注（ADR-0089）：封口日期 + 转卖售价
  const exitNote = gone
    ? `${it.exit_date ? ' → ' + esc(String(it.exit_date).slice(0, 10)) : ''}${it.current_status === '已转卖' && Number(it.sold_price) > 0 ? ' · 售出 ' + moneyShort(Number(it.sold_price)) : ''}`
    : '';
  const dailyStr = daily < 0.01 ? daily.toFixed(4) : daily.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const mut = gone
    ? `${esc(String(it.purchase_date || '').slice(0, 10) || '日期未知')} 起 · 陪伴 ${days || '—'} 天${exitNote}`
    : `${esc(String(it.purchase_date || '').slice(0, 10) || '日期未知')} 起 · ${days || '—'} 天 · 日均 ￥${dailyStr}`;
  return `<div class="bz-bel-cell${gone ? ' bz-bel-cell--gone' : ''}${idle ? ' bz-bel-cell--idle' : ''}" data-bel-id="${esc(it.id)}">
    <span class="bz-bel-cell-idx">NO.${String(idx + 1).padStart(2, '0')} — ${esc(catNameOf(it.category) || '未分类')}</span>
    <span class="bz-bel-tag bz-bel-tag--${key}">${iconSpan(STATUS[key]?.ic || 'box', 'bz-ic--sm')}${esc(it.current_status)}</span>
    <span class="bz-bel-cell-em">${itemEmHtml(it)}</span>
    <span class="bz-bel-name">${esc(it.name)}</span>
    <span class="bz-bel-price">${moneyShort(Number(it.purchase_price) || 0)}</span>
    <span class="bz-bel-mut">${mut}</span>
  </div>`;
}

/** 网格（含 data-bel-grid 钩子；末行 filler 由 renderPanelView 量列后补） */
export function gridHtml(items: BelongingsItem[], view: BelViewState): string {
  return `<div class="bz-bel-grid" data-bel-grid>${filtered(items, view).map((it, idx) => cellHtml(it, idx)).join('')}</div>`;
}

// ==================== 面板渲染胶水（六步全量重渲；对入参 root 写 innerHTML） ====================

export interface RenderHooks {
  /** 图标兑现（插件 = core mountIcons/setIcon；评审壳 = prototype-icons.js 内联 SVG） */
  mountIcons(root: HTMLElement): void;
}

/** 全量渲染面板视图：hero/chips/年份/KPI/排序/内容六步（与历史 renderAll 族逐语义等价）。
 *  view.year 悬空时回写归位（外部数据变化后选中年份消失 → 自动回全部年份）。
 *  量列补 filler：jsdom 无布局 → gridTemplateColumns 空串回退单列，rem 恒 0 不补。 */
export function renderPanelView(root: HTMLElement, items: BelongingsItem[], view: BelViewState, hooks: RenderHooks): void {
  const q = <T extends Element = HTMLElement>(sel: string): T | null => root.querySelector(sel);
  const title = q('[data-bel-herotitle]');
  if (title) title.textContent = heroTitleText(view);
  const sub = q('[data-bel-herosub]');
  if (sub) sub.textContent = heroSubText(items, view);
  const chips = q('[data-bel-chips]');
  if (chips) chips.innerHTML = chipsHtml(items, view);
  const mob = q('[data-bel-mobstatus]');
  if (mob) mob.innerHTML = mobChipsHtml(items, view);
  view.year = resolveYear(items, view.year);
  const yearSel = q('[data-bel-year]');
  if (yearSel) {
    (yearSel.querySelector('.bz-bel-select-label') as HTMLElement | null)!.textContent = view.year || '全部年份';
    const menu = q('[data-bel-yearmenu]');
    if (menu) menu.innerHTML = yearsOptionsHtml(items, view.year);
  }
  const wrap = q('[data-bel-kpis]');
  if (wrap) wrap.innerHTML = kpisHtml(items);
  const stampN = q('[data-bel-stampn]');
  if (stampN) stampN.textContent = stampCount(items);
  const mobStats = q('[data-bel-mobstats]');
  if (mobStats) mobStats.textContent = mobStatsText(items);
  const sortHost = q('[data-bel-sort]');
  if (sortHost) sortHost.innerHTML = segmentedHtml(view.sort);
  const mobSortSel = q('[data-bel-mobsortsel]');
  if (mobSortSel) {
    (mobSortSel.querySelector('.bz-bel-select-label') as HTMLElement | null)!.textContent =
      (SORT_OPTS.find((o) => o.v === view.sort) ?? SORT_OPTS[0]).label;
    const menu = q('[data-bel-mobsortmenu]');
    if (menu) menu.innerHTML = sortOptionsHtml(view.sort);
  }

  const content = q('[data-bel-content]');
  if (!content) return;
  const list = filtered(items, view);
  if (!list.length) {
    // 空态文案区分：库空（这里还没有物品）vs 筛选/搜索无匹配（没有符合条件的物品）
    const noMatch = !!view.q || view.status !== null || view.year !== '';
    content.innerHTML = emptyHtml(noMatch);
  } else {
    content.innerHTML = gridHtml(items, view);
    // 末行空位补纸面 filler（P20：黑缝线只出现在卡与卡之间，空区保持纸面）
    const gridEl = content.querySelector('[data-bel-grid]') as HTMLElement;
    const cols = (((getComputedStyle(gridEl).gridTemplateColumns as string) || '').split(' ').filter(Boolean).length) || 1;
    const rem = list.length % cols;
    if (rem) gridEl.insertAdjacentHTML('beforeend', `<div class="bz-bel-filler" style="grid-column:span ${cols - rem}"></div>`);
  }
  hooks.mountIcons(content);
}
