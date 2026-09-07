/**
 * 归物本渲染纯层（issue 237/ADR-0104：原型 × 插件 markup 单源）
 *
 * 本文件是归物本 UI 的唯一 markup 事实源：
 *   - 插件侧：ui.ts 直接 import（面板/网格/详情/表单的 innerHTML 全部出自这里）；
 *   - 评审壳侧：esbuild 打成 IIFE → 同目录 prototype-render.js（window.BZR_belongings），
 *     prototype.html 壳脚本消费同一批函数。
 *
 * 纯度契约（tests/core/render-purity.test.ts 守卫，违者门禁红）：
 *   - import 白名单：`../core/ui/str`（零依赖字符串工具）、`./types`、`./emoji-icon-map`；
 *   - 禁 obsidian / moment / core 服务 / 组件库 barrel；
 *   - 禁模块级可变状态：数据与视图状态一律显式入参（items + BelViewState）；
 *   - 禁 DOM 副作用（唯一例外 renderPanelView 胶水：对入参 root 做 innerHTML 赋值与量列）。
 *
 * 图标 = `<i data-lucide>` 占位串（str.ts iconSpan），由两侧各自 mountIcons 兑现。
 * data-bel-* 钩子即两侧事件绑定与测试断言的共同契约，改钩子先改这里。
 * 计算口径（ADR-0089）：总资产/在库投入 = 在用+闲置原价合计；日均成本 =（总购入 - 转卖回本
 * Σ售价）/ 累计持有天数；单件日均 = 价格/已用天数（0 天 = 全价）；出离条目天数封口 exit_date。
 */
import { esc, iconSpan } from '../core/ui/str';
import { EMOJI_ICON } from './emoji-icon-map';
import type { BelongingsItem } from './types';

/** splitEmojiCategory 原样再导出：评审壳迁移演示数据复用（剥 emoji 前缀 + 补 icon） */
export { splitEmojiCategory } from './emoji-icon-map';
/** esc/iconSpan 再导出：评审壳演示层 markup（toast/确认框/菜单/抽屉动作串）与插件同源 */
export { esc, iconSpan } from '../core/ui/str';

// ==================== 常量 ====================

export const ICON = {
  add: 'plus',
  search: 'search',
  close: 'x',
  del: 'trash-2',
  empty: 'package',
  chevR: 'chevron-right',
};

/** 状态（数据四态精确串；key = 稳定英文标识） */
export const STATUS: Record<string, { label: string; key: string; ic: string }> = {
  using: { label: '使用中', key: 'using', ic: 'check-circle' },
  idle: { label: '闲置', key: 'idle', ic: 'package' },
  sold: { label: '已转卖', key: 'sold', ic: 'banknote' },
  discard: { label: '已丢弃', key: 'discard', ic: 'archive' },
};
export const STATUS_LABELS = ['使用中', '闲置', '已转卖', '已丢弃'];
export const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'using', label: '使用中' },
  { key: 'idle', label: '闲置' },
  { key: 'sold', label: '已转卖' },
  { key: 'discard', label: '已丢弃' },
];

/** 排序三档（纯视图增强：最近购入默认 / 投入最高 / 日均最高；视图档不落盘） */
export const SORT_OPTS: { v: string; label: string }[] = [
  { v: 'recent', label: '最近购入' },
  { v: 'price', label: '投入最高' },
  { v: 'daily', label: '日均最高' },
];

/** 视图状态切片（面板内会话态；ui.ts 的 BelState 与评审壳的 M 均结构兼容于此） */
export interface BelViewState {
  /** 状态筛选 key（null = 全部；asset = 在库合成） */
  status: string | null;
  /** 年份筛选（'' = 全部） */
  year: string;
  /** 搜索词 */
  q: string;
  /** 排序档（SORT_OPTS.v） */
  sort: string;
}

// ==================== 展示格式化 ====================

export function money(n: number): string {
  return '￥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function moneyShort(n: number): string {
  return '￥' + (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 分类 emoji（取首段 emoji；无 emoji 显示首字） */
export function catEmoji(cat: string): string {
  const m = String(cat || '').match(/^(\p{Extended_Pictographic})/u);
  return m ? m[1] : String(cat || '')[0] || '📦';
}
export function catNameOf(cat: string): string {
  return String(cat || '').replace(/^\p{Extended_Pictographic}\s*/u, '');
}
/** 分类图标名（首字符 emoji 查映射表；未入表返回 null，调用方回退 emoji/首字文本） */
export function catIconOf(cat: string): string | null {
  const m = String(cat || '').match(/^(\p{Extended_Pictographic})/u);
  return m ? (EMOJI_ICON[m[1]] ?? null) : null;
}
/** 分类视觉 HTML：emoji（含空分类 📦 兜底）查映射出 lucide 占位，未映射回退 emoji/首字文本 */
export function catEmHtml(cat: string): string {
  const em = catEmoji(cat);
  const name = catIconOf(cat) || (EMOJI_ICON[em] ?? null);
  return name ? iconSpan(name) : esc(em);
}
/** 物品图标名优先级：icon 字段（issue 231）→ 遗留 emoji 分类映射（含 📦 兜底）→ null（文本兜底） */
export function itemIconOf(it: BelongingsItem): string | null {
  const raw = String(it.icon || '').trim();
  if (raw && /^[a-z0-9-]+$/i.test(raw)) return raw;
  return catIconOf(it.category) || (EMOJI_ICON[catEmoji(it.category)] ?? null);
}
/** 物品分类视觉 HTML：优先 icon 字段，遗留 emoji 走映射，未映射回退 emoji/首字文本 */
export function itemEmHtml(it: BelongingsItem): string {
  const name = itemIconOf(it);
  return name ? iconSpan(name) : catEmHtml(it.category);
}
export function statusKeyOf(label: string): string {
  return STATUS_ORDER.find((s) => s.label === label)?.key ?? label;
}
export function statusOf(keyOrLabel: string): { key: string; label: string } {
  const byKey = STATUS_ORDER.find((s) => s.key === keyOrLabel);
  if (byKey) return byKey;
  const byLabel = STATUS_ORDER.find((s) => s.label === keyOrLabel);
  return byLabel || { key: 'using', label: '使用中' };
}

// ==================== 计算口径（items 显式入参；唯一实现，data.ts/ui.ts/评审壳共用） ====================

/** 是否出离态串（转卖/丢弃）——B4：流转前旧状态也按此判定，出离内流转保留原封口 */
export function exitedStatus(st: string): boolean {
  return st === '已转卖' || st === '已丢弃';
}
/** 是否出离态（转卖/丢弃） */
export function isExited(it: BelongingsItem): boolean {
  return exitedStatus(it.current_status);
}
/** 出离日期（非出离态恒 null；ADR-0089 陪伴天数封口锚点） */
export function exitDateOf(it: BelongingsItem): string | null {
  return isExited(it) ? (it.exit_date || null) : null;
}
function parseLocalDay(raw: string | null | undefined): Date | null {
  const parts = String(raw || '').slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
/** 已用天数：本地日历日口径（原 data.ts moment 版逐语义等价的零依赖实现，随单源迁入）。
 *  出离条目封口在 exit_date（无效封口回落今天）；其余截至今天；当天/无效/早于购买日 = 0 天（全价） */
export function daysUsed(it: BelongingsItem): number {
  const start = parseLocalDay(it.purchase_date);
  if (!start) return 0;
  const ex = exitDateOf(it);
  let end = new Date();
  if (ex) {
    const parsed = parseLocalDay(ex);
    if (parsed) end = parsed;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 864e5));
}
export function dailyCostOf(it: BelongingsItem): number {
  const days = daysUsed(it);
  const price = Number(it.purchase_price) || 0;
  return days > 0 ? price / days : price;
}
/** 在库 = 使用中 + 闲置 */
export function inStock(it: BelongingsItem): boolean {
  return it.current_status === '使用中' || it.current_status === '闲置';
}
export function stockCount(items: BelongingsItem[]): number {
  return items.filter(inStock).length;
}
/** 在库投入 = 在用 + 闲置原价合计 */
export function totalAssets(items: BelongingsItem[]): number {
  return items.filter(inStock).reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
}
/** 日均成本 =（总购入 - 转卖回本 Σ售价）/ 累计持有天数（ADR-0089：售价可选，未记 = 0 回本） */
export function avgDailyCost(items: BelongingsItem[]): number {
  let cost = 0;
  let days = 0;
  for (const it of items) {
    cost += Number(it.purchase_price) || 0;
    if (it.current_status === '已转卖' && Number(it.sold_price) > 0) cost -= Number(it.sold_price);
    days += daysUsed(it);
  }
  return days ? cost / days : 0;
}
export function statusCount(items: BelongingsItem[], label: string): number {
  return items.filter((i) => i.current_status === label).length;
}
/** 筛选 + 排序后的在列清单（状态/年份/搜索三重过滤；ticket 189 资产合成筛选） */
export function filtered(items: BelongingsItem[], view: BelViewState): BelongingsItem[] {
  return items
    .filter((i) => {
      if (!view.status) return true;
      // ticket 189：资产（在库）合成筛选（使用中+闲置）
      if (view.status === 'asset') return inStock(i);
      return i.current_status === statusOf(view.status).label;
    })
    .filter((i) => (view.year ? String(i.purchase_date || '').startsWith(view.year) : true))
    .filter((i) => {
      if (!view.q) return true;
      const q = view.q.toLowerCase();
      return [i.name, i.category, i.description].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (view.sort === 'price') return (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0);
      if (view.sort === 'daily') return dailyCostOf(b) - dailyCostOf(a);
      return String(b.purchase_date || '').localeCompare(String(a.purchase_date || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
}
export function yearsAvailable(items: BelongingsItem[]): string[] {
  const set = new Set<string>();
  items.forEach((i) => {
    const y = String(i.purchase_date || '').slice(0, 4);
    if (y) set.add(y);
  });
  return [...set].sort().reverse();
}
/** 外部数据变化后选中年份可能悬空（列表恒空但 UI 显示「全部年份」）——重置回全部 */
export function resolveYear(items: BelongingsItem[], year: string): string {
  return year && yearsAvailable(items).includes(year) ? year : '';
}
/** 海报大字标题 = 筛选名（issue 208 头行标题语义） */
export function heroTitleText(view: BelViewState): string {
  if (!view.status) return '全部';
  if (view.status === 'asset') return '资产';
  return statusOf(view.status).label;
}
export function heroSubText(items: BelongingsItem[], view: BelViewState): string {
  return view.status
    ? `归物本 — ${filtered(items, view).length} 件在列 · FILTERED VIEW`
    : '归物本 — BELONGINGS · NOTHING MORE, NOTHING LESS';
}

// ==================== markup 构建器 ====================

/** 面板骨架（hero/KPI/chips/工具行/横滑条/内容区/移动记一笔；data-bel-* 钩子契约根） */
export function panelHtml(): string {
  return `<div class="bz-bel-panel bz-panel-frame bz-panel-mtop bz-bel--poster">
  <div class="bz-bel-body">
    <div class="bz-bel-hero">
      <div class="bz-bel-hero-text">
        <div class="bz-bel-hero-title" data-bel-herotitle>全部</div>
        <div class="bz-bel-hero-sub" data-bel-herosub>BELONGINGS — NOTHING MORE, NOTHING LESS</div>
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
        <select class="bz-bel-select" data-bel-year></select>
        ${iconSpan(ICON.chevR, 'bz-bel-select-chev')}
      </div>
      <div class="bz-bel-yearsel bz-bel-mobsortsel-wrap">
        <select class="bz-bel-select" data-bel-mobsortsel></select>
        ${iconSpan(ICON.chevR, 'bz-bel-select-chev')}
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

/** 年份下拉 options（不含选中态回填——调用方对 select.value 赋值） */
export function yearsOptionsHtml(items: BelongingsItem[], cur: string): string {
  return '<option value="">全部年份</option>' + yearsAvailable(items).map((y) => `<option value="${y}"${cur === y ? ' selected' : ''}>${y}</option>`).join('');
}

/** 移动排序下拉 options（同年份下拉样式；与桌面 seg 双向同步，用户拍板） */
export function sortOptionsHtml(): string {
  return SORT_OPTS.map((o) => `<option value="${o.v}">${o.label}</option>`).join('');
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

/** 详情弹窗（P20 桌面点卡）：字段全览 + 四态流转条挂点 + 编辑/删除 */
export function belDetailHtml(it: BelongingsItem): string {
  const gone = isExited(it);
  const key = statusKeyOf(it.current_status);
  return `<div class="bz-bel-detail">
    <div class="bz-bel-detail-head">
      <div class="bz-bel-detail-title">${esc(it.name)}</div>
      <button class="bz-icon-btn" data-bd-close title="关闭">${iconSpan(ICON.close)}</button>
    </div>
    <div class="bz-bel-detail-idrow">
      <span class="bz-bel-cell-em">${itemEmHtml(it)}</span>
      <div class="bz-bel-detail-idinfo">
        <div class="bz-bel-detail-cat">${esc(catNameOf(it.category) || '未分类')}</div>
        <div class="bz-bel-detail-desc">${esc(it.description || '无备注')}</div>
      </div>
      <span class="bz-bel-tag bz-bel-tag--${key}">${iconSpan(STATUS[key]?.ic || 'box', 'bz-ic--sm')}${esc(it.current_status)}</span>
    </div>
    <div class="bz-bel-detail-fields">
      <div class="bz-bel-dfield"><span>购买价</span><b>${money(Number(it.purchase_price) || 0)}</b></div>
      <div class="bz-bel-dfield"><span>购买日期</span><b>${esc(String(it.purchase_date || '').slice(0, 10) || '—')} · ${daysUsed(it)} 天</b></div>
      <div class="bz-bel-dfield"><span>日均成本</span><b>￥${dailyCostOf(it).toFixed(2)}${gone ? '（已封口）' : '/天 · 越用越便宜'}</b></div>
      ${gone ? `<div class="bz-bel-dfield"><span>出离日期</span><b>${esc(it.exit_date || '—')}${it.current_status === '已转卖' && Number(it.sold_price) > 0 ? ' · 售出 ' + money(Number(it.sold_price)) : ''}</b></div>` : ''}
      <div class="bz-bel-dfield"><span>录入 / 更新</span><b>${esc(String(it.created_date || '').slice(0, 10))} / ${esc(String(it.last_updated || '').slice(0, 10))}</b></div>
    </div>
    <div class="bz-bel-detail-acts" data-bd-acts></div>
    <div class="bz-btn-row bz-bel-detail-btns">
      <div class="bz-bel-form-spacer"></div>
      <button type="button" class="bz-btn bz-btn--ghost" data-bd-edit>${iconSpan('pencil', 'bz-ic--sm')} 编辑</button>
      <button type="button" class="bz-btn bz-btn--primary bz-bel-delbtn" data-bd-del>${iconSpan(ICON.del, 'bz-ic--sm')} 删除</button>
    </div>
  </div>`;
}

/** 详情四态流转条（当前态高亮 is-cur；闲置走 c2） */
export function flowBtnsHtml(curStatus: string): string {
  return STATUS_LABELS.map((s) =>
    `<button type="button" class="bz-bel-flowbtn${s === curStatus ? ' is-cur' : ''}${s === '闲置' ? ' bz-bel-c2' : ''}" data-bd-flow="${esc(s)}">${esc(s)}</button>`
  ).join('');
}

/** 表单字段初值（记一笔/编辑；与 belFormHtml 展示值同源——ui.ts 防丢基线 ticket 189 消费同一套） */
export interface BelFormInit {
  priceVal: string;
  dateVal: string;
  catVal: string;
  descVal: string;
  exitDateVal: string;
  soldPriceVal: string;
  exitedInit: boolean;
}
export function belFormInit(it: BelongingsItem | null): BelFormInit {
  return {
    priceVal: it ? String(it.purchase_price ?? '') : '',
    dateVal: it ? String(it.purchase_date || '').slice(0, 10) : todayStr(),
    catVal: it?.category ?? '', // 新记不回填默认分类（issue 202），留空待选
    descVal: it?.description ?? '',
    // 出离字段初值（ADR-0089）：编辑回填 exit_date；新记 = 今天
    exitDateVal: it?.exit_date ? String(it.exit_date).slice(0, 10) : todayStr(),
    soldPriceVal: it?.sold_price != null && Number.isFinite(Number(it.sold_price)) ? String(it.sold_price) : '',
    exitedInit: !!it && isExited(it),
  };
}

/** 表单（记一笔/编辑共用骨架；字段初值在构建时算好，id 契约 bm-* 由两侧绑定消费） */
export function belFormHtml(it: BelongingsItem | null): string {
  const editing = !!it;
  const { priceVal, dateVal, catVal, descVal, exitDateVal, soldPriceVal, exitedInit } = belFormInit(it);
  return `
  <div class="bz-bel-form">
    <div class="bz-bel-form-title">${editing ? '编辑物品' : '记一笔'}</div>
    <div class="bz-bel-form-body">
      <div class="bz-field"><span class="bz-field-label">名称</span><input class="bz-input" id="bm-name" value="${esc(it?.name ?? '')}" placeholder="如：iPhone 15 Pro"></div>
      <div class="bz-field"><span class="bz-field-label">分类</span><span class="bz-bel-catrow"><span class="bz-bel-form-icon" id="bm-icon" title="分类图标（AI 归类或选历史分类自动带上）"></span><input class="bz-input" id="bm-cat" value="${esc(catVal)}" placeholder="输入或从历史分类选择" autocomplete="off"><button type="button" class="bz-icon-btn bz-bel-aibtn" id="bm-ai" title="AI 归类：按名称建议分类与图标">${iconSpan('sparkles', 'bz-ic--sm')}</button></span></div>
      <div class="bz-bel-form-row">
        <div class="bz-field"><span class="bz-field-label">购买价格（元）</span><input class="bz-input" id="bm-price" type="number" min="0" step="0.01" value="${esc(priceVal)}" placeholder="0.00"></div>
        <div class="bz-field"><span class="bz-field-label">购买日期</span><input class="bz-input" id="bm-date" type="date" value="${esc(dateVal)}"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">状态</span><span class="bz-bel-statuspick" id="bm-status"></span></div>
      <div class="bz-bel-form-row" id="bm-exit"${exitedInit ? '' : ' hidden'}>
        <div class="bz-field"><span class="bz-field-label">出离日期</span><input class="bz-input" id="bm-exitdate" type="date" value="${esc(exitDateVal)}"></div>
        <div class="bz-field" id="bm-soldfield"${it?.current_status === '已转卖' ? '' : ' hidden'}><span class="bz-field-label">转卖售价（可选）</span><input class="bz-input" id="bm-soldprice" type="number" min="0" step="0.01" value="${esc(soldPriceVal)}" placeholder="留空不记售价"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">描述（可选）</span><textarea class="bz-input" id="bm-desc" placeholder="规格、颜色、购买原因等…">${esc(descVal)}</textarea></div>
      <div class="bz-bel-form-err" id="bm-err"></div>
      <div class="bz-btn-row bz-bel-form-actions">
        <div class="bz-bel-form-spacer"></div>
        <button type="button" class="bz-btn bz-btn--ghost" data-bm-cancel>取消</button>
        <button type="button" class="bz-btn bz-btn--primary" id="bm-save">${editing ? '更新' : '保存'}</button>
      </div>
    </div>
  </div>`;
}

/** 表单状态单选（p20 .choice 平铺四格 + 闲置 c2；data-status 契约） */
export function statusPickHtml(curStatus: string): string {
  return STATUS_LABELS.map((s) =>
    `<button type="button" class="bz-choice-btn${s === curStatus ? ' is-on' : ''}${s === '闲置' ? ' bz-bel-c2' : ''}" data-status="${esc(s)}">${iconSpan(STATUS[statusKeyOf(s)]?.ic || 'box', 'bz-ic--sm')}${esc(s)}</button>`
  ).join('');
}

/** 底部抽屉头（海报皮：图标/名称/分类·价格·已用天数） */
export function sheetHeadHtml(it: BelongingsItem): string {
  const catName = catNameOf(it.category);
  const days = daysUsed(it);
  return `<div class="bz-item-sheet-entry"><div class="bz-bel-sheet-head">
      <span class="bz-item-sheet-emoji">${itemEmHtml(it)}</span>
      <div class="bz-bel-sheet-info"><div class="bz-item-sheet-title">${esc(it.name)}</div>
      <div class="bz-item-sheet-sub">${esc(catName)} · ${money(Number(it.purchase_price) || 0)} · 已用 ${days} 天</div></div></div></div>`;
}

// ==================== 行操作集 ====================

export interface BelActionSpec {
  icon: string;
  label: string;
  /** 流转/编辑/删除（onClick 行为两侧各自实现——插件走 core 服务，评审壳自绘演示） */
  act: 'flow' | 'edit' | 'del';
  /** 流转目标态（act=flow 专有） */
  status?: string;
  keepOpen?: boolean;
  danger?: boolean;
}

/** 行操作序列（旧动作契约：四态流转 keepOpen → 编辑 keepOpen → 删除 danger） */
export function actionSpecs(it: BelongingsItem): BelActionSpec[] {
  const specs: BelActionSpec[] = [];
  STATUS_LABELS.forEach((s) => {
    if (s === it.current_status) return;
    specs.push({ icon: STATUS[statusKeyOf(s)]?.ic || 'box', label: `标记为${s}`, act: 'flow', status: s, keepOpen: true });
  });
  specs.push({ icon: 'pencil', label: '编辑', act: 'edit', keepOpen: true });
  specs.push({ icon: 'trash-2', label: '删除', act: 'del', danger: true });
  return specs;
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
  const yearSel = q<HTMLSelectElement>('[data-bel-year]');
  if (yearSel) {
    yearSel.innerHTML = yearsOptionsHtml(items, view.year);
    yearSel.value = view.year;
  }
  const wrap = q('[data-bel-kpis]');
  if (wrap) wrap.innerHTML = kpisHtml(items);
  const stampN = q('[data-bel-stampn]');
  if (stampN) stampN.textContent = stampCount(items);
  const mobStats = q('[data-bel-mobstats]');
  if (mobStats) mobStats.textContent = mobStatsText(items);
  const sortHost = q('[data-bel-sort]');
  if (sortHost) sortHost.innerHTML = segmentedHtml(view.sort);
  const mobSortSel = q<HTMLSelectElement>('[data-bel-mobsortsel]');
  if (mobSortSel && mobSortSel.options.length) mobSortSel.value = view.sort;

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
