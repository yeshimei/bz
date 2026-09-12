/**
 * 归物本渲染纯层测试（issue 237/ADR-0104）：
 * 计算口径（原 data.ts「纯函数」用例随单源迁入）+ markup 构建器 + renderPanelView 胶水。
 * render.ts 是原型 × 插件 markup 单源，这里锁口径与钩子契约（data-bel-* / bm-* / bd-*）。
 */
import { describe, it, expect, vi } from 'vitest';
import {
  daysUsed, dailyCostOf, avgDailyCost, totalAssets, stockCount, statusCount,
  filtered, yearsAvailable, resolveYear, heroTitleText, heroSubText,
  panelHtml, cellHtml, chipsHtml, mobChipsHtml, kpisHtml, segmentedHtml, sortOptionsHtml,
  emptyHtml, belDetailHtml, belFormHtml, belFormInit, statusPickHtml, sheetHeadHtml,
  actionSpecs, flowBtnsHtml, renderPanelView,
  moneyShort, money, moneyWith, moneyUnitLabel, catNameOf, catEmHtml, itemEmHtml,
} from '../../src/belongings/render';
import type { BelongingsItem } from '../../src/belongings/types';

const it0 = (over: Partial<BelongingsItem> = {}): BelongingsItem => ({
  id: 'item_x',
  name: '测试物品',
  category: '灯具',
  purchase_price: 100,
  purchase_date: '2025-01-01',
  current_status: '使用中',
  description: '',
  created_date: '2025-01-01T00:00:00.000Z',
  last_updated: '2025-01-01T00:00:00.000Z',
  ...over,
});

// ==================== 计算口径（ADR-0089） ====================

describe('daysUsed / dailyCostOf（原 data.ts 纯函数用例随单源迁入）', () => {
  it('本地日历日口径：当天买 = 0 天；昨天买 = 1 天（UTC 口径会多算一天）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    expect(daysUsed(it0({ purchase_date: '2025-06-15' }))).toBe(0);
    expect(daysUsed(it0({ purchase_date: '2025-06-15T00:30:00' }))).toBe(0);
    expect(daysUsed(it0({ purchase_date: '2025-06-14' }))).toBe(1);
    expect(daysUsed(it0({ purchase_date: '2025-05-16T12:00:00' }))).toBe(30);
    // 跨时区确定：本地同一自然日内任意时刻都算 0 天
    vi.setSystemTime(new Date('2025-06-15T23:59:00'));
    expect(daysUsed(it0({ purchase_date: '2025-06-15' }))).toBe(0);
    vi.useRealTimers();
  });

  it('出离封口（ticket 189/ADR-0089）：封口在 exit_date 不随今天增长；脏数据回落', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    // 封口在出离日：05-16 → 06-01 = 16 天
    expect(daysUsed(it0({ purchase_date: '2025-05-16T12:00:00', current_status: '已转卖', exit_date: '2025-06-01' }))).toBe(16);
    expect(daysUsed(it0({ purchase_date: '2025-05-16', current_status: '已丢弃', exit_date: '2025-05-17' }))).toBe(1);
    // 出离日早于购买日（脏数据）= 0 天
    expect(daysUsed(it0({ purchase_date: '2025-06-10', current_status: '已转卖', exit_date: '2025-06-01' }))).toBe(0);
    // 出离日无效 → 回落今天口径
    expect(daysUsed(it0({ purchase_date: '2025-05-16T12:00:00', current_status: '已转卖', exit_date: 'not-a-date' }))).toBe(30);
    // 购买日无效 = 0
    expect(daysUsed(it0({ purchase_date: '' }))).toBe(0);
    vi.useRealTimers();
  });

  it('dailyCostOf：0 天 = 全价（不产出 NaN）；日均随天数摊薄', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    expect(dailyCostOf(it0({ purchase_price: 300, purchase_date: '' }))).toBe(300);
    expect(dailyCostOf(it0({ purchase_price: 300, purchase_date: '2025-05-16T12:00:00' }))).toBe(10);
    vi.useRealTimers();
  });
});

describe('汇总口径（在库 / 投入 / 日均 / 计数）', () => {
  const items = [
    it0({ id: 'a', current_status: '使用中', purchase_price: 100, purchase_date: '2025-01-01' }),
    it0({ id: 'b', current_status: '闲置', purchase_price: 50, purchase_date: '2025-02-01' }),
    it0({ id: 'c', current_status: '已转卖', purchase_price: 200, purchase_date: '2024-01-01', exit_date: '2025-03-01', sold_price: 120 }),
    it0({ id: 'd', current_status: '已丢弃', purchase_price: 30, purchase_date: '2024-06-01', exit_date: '2025-04-01' }),
  ];

  it('在库 = 使用中 + 闲置；投入 = 在库原价合计', () => {
    expect(stockCount(items)).toBe(2);
    expect(totalAssets(items)).toBe(150);
    expect(statusCount(items, '已转卖')).toBe(1);
  });

  it('日均成本 =（总购入 - 转卖回本 Σ售价）/ 累计持有天数（未记售价 = 0 回本）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    const cost = items.reduce((s, i) => s + Number(i.purchase_price), 0) - 120;
    const days = items.reduce((s, i) => s + daysUsed(i), 0);
    expect(avgDailyCost(items)).toBeCloseTo(cost / days, 10);
    vi.useRealTimers();
  });
});

describe('filtered / years / hero', () => {
  const items = [
    it0({ id: 'a', name: '松下s5', category: '相机', purchase_price: 900, purchase_date: '2025-03-01', description: '' }),
    it0({ id: 'b', name: '落地灯', category: '灯具', purchase_price: 200, purchase_date: '2024-03-01', description: '客厅' }),
    it0({ id: 'c', name: '旧键盘', category: '外设', purchase_price: 3000, purchase_date: '2025-01-01', current_status: '闲置' }),
  ];
  const view = { status: null, year: '', q: '', sort: 'recent' };

  it('筛选：状态（含 asset 合成）/年份/搜索三重；排序三档', () => {
    expect(filtered(items, view).map((i) => i.id)).toEqual(['a', 'c', 'b']); // 购入日期降序
    expect(filtered(items, { ...view, status: 'asset' }).map((i) => i.id)).toEqual(['a', 'c', 'b']); // b 默认使用中，亦在库
    expect(filtered(items, { ...view, status: 'idle' }).map((i) => i.id)).toEqual(['c']);
    expect(filtered(items, { ...view, year: '2025' }).map((i) => i.id)).toEqual(['a', 'c']);
    expect(filtered(items, { ...view, q: '松下' }).map((i) => i.id)).toEqual(['a']);
    expect(filtered(items, { ...view, q: '客厅' }).map((i) => i.id)).toEqual(['b']); // 描述命中
    expect(filtered(items, { ...view, sort: 'price' })[0].id).toBe('c');
    expect(filtered(items, { ...view, sort: 'daily' })[0].id).toBe('c');
  });

  it('年份降序；悬空年份回全部；标题 = 筛选名；副题随筛选切 FILTERED VIEW', () => {
    expect(yearsAvailable(items)).toEqual(['2025', '2024']);
    expect(resolveYear(items, '2024')).toBe('2024');
    expect(resolveYear(items, '2099')).toBe('');
    expect(heroTitleText(view)).toBe('全部');
    expect(heroTitleText({ ...view, status: 'asset' })).toBe('资产');
    expect(heroTitleText({ ...view, status: 'idle' })).toBe('闲置');
    expect(heroSubText(items, view)).toContain('NOTHING MORE');
    expect(heroSubText(items, { ...view, status: 'asset' })).toContain('3 件在列');
  });
});

// ==================== markup 构建器 ====================

describe('markup 构建器（钩子契约 = 两侧绑定与测试断言的共同事实源）', () => {
  it('panelHtml 骨架钩子齐全（data-bel-*）', () => {
    const html = panelHtml();
    for (const hook of ['data-bel-herotitle', 'data-bel-herosub', 'data-bel-kpis', 'data-bel-stampn', 'data-bel-mobstats', 'data-bel-close', 'data-bel-chips', 'data-bel-search', 'data-bel-year', 'data-bel-mobsortsel', 'data-bel-sort', 'data-bel-add', 'data-bel-mobstatus', 'data-bel-content']) {
      expect(html).toContain(hook);
    }
    expect(html).toContain('bz-bel--poster');
  });

  it('cellHtml：编号/徽章/图标位/名称/价格/meta；出离灰化 + 尾注；闲置 accent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    const using = cellHtml(it0({ id: 'a1', name: '台灯< pro', category: '灯具', purchase_price: 100, purchase_date: '2025-06-15' }), 0); // 当天购入 = 0 天全价
    expect(using).toContain('NO.01 — 灯具');
    expect(using).toContain('bz-bel-tag--using');
    expect(using).toContain('data-bel-id="a1"');
    expect(using).toContain('日均 ￥100'); // 0 天全价
    expect(using).not.toContain('bz-bel-cell--gone');
    // esc 注入安全：名称含 <>& 不破 markup
    expect(using).toContain('台灯&lt; pro');

    const sold = cellHtml(it0({ id: 'a2', current_status: '已转卖', purchase_date: '2025-01-01', exit_date: '2025-06-01', sold_price: 88 }), 1);
    expect(sold).toContain('bz-bel-cell--gone');
    expect(sold).toContain('陪伴 151 天');
    expect(sold).toContain('售出 ￥88');

    const idle = cellHtml(it0({ id: 'a3', current_status: '闲置' }), 2);
    expect(idle).toContain('bz-bel-cell--idle');
    vi.useRealTimers();
  });

  it('chips 桌面六枚（含资产）+ 选中态；移动五枚无资产', () => {
    const items = [it0({ current_status: '使用中' }), it0({ current_status: '闲置' })];
    const desk = chipsHtml(items, { status: null, year: '', q: '', sort: 'recent' });
    expect(desk.match(/data-bel-st=/g)?.length).toBe(6);
    expect(desk).toContain('data-bel-st="asset"');
    expect(desk).toContain('bz-chip--on'); // 全部选中
    const mob = mobChipsHtml(items, { status: 'using', year: '', q: '', sort: 'recent' });
    expect(mob.match(/bz-mobstrip-chip/g)?.length).toBe(5);
    expect(mob).not.toContain('"asset"');
    expect(mob).toContain('is-on'); // using 选中
  });

  it('kpisHtml 四卡：hero 可点 + 投入可点；segmented/sortOptions 三档', () => {
    const kpis = kpisHtml([it0({}), it0({ current_status: '闲置' })]);
    expect(kpis.match(/class="bz-bel-kpi/g)?.length).toBe(4);
    expect(kpis.match(/data-bel-statclick/g)?.length).toBe(2);
    const seg = segmentedHtml('price');
    expect(seg.match(/bz-segmented-btn/g)?.length).toBe(3);
    expect(seg).toContain('data-k="price"');
    expect(seg).toContain('is-on');
    expect(sortOptionsHtml('recent').match(/bz-bel-dropopt/g)?.length).toBe(3);
    expect(sortOptionsHtml('price')).toContain('is-cur');
  });

  it('emptyHtml 两态文案；statusPickHtml 选中态 + 闲置 c2；flowBtnsHtml is-cur', () => {
    expect(emptyHtml(true)).toContain('没有符合条件的物品');
    expect(emptyHtml(false)).toContain('这里还没有物品');
    const pick = statusPickHtml('闲置');
    expect(pick.match(/bz-choice-btn/g)?.length).toBe(4);
    expect(pick).toContain('is-on');
    expect(pick.match(/bz-bel-c2/g)?.length).toBe(1);
    const flow = flowBtnsHtml('使用中');
    expect(flow.match(/bz-bel-flowbtn/g)?.length).toBe(4);
    expect(flow).toContain('is-cur');
  });

  it('belDetailHtml：出离行显隐；belFormHtml 编辑/新增标题 + 出离行 hidden + 初值', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    const gone = belDetailHtml(it0({ current_status: '已转卖', exit_date: '2025-06-01', sold_price: 88 }));
    expect(gone).toContain('出离日期');
    const alive = belDetailHtml(it0({}));
    expect(alive).not.toContain('出离日期');

    const editForm = belFormHtml(it0({ name: '台灯', category: '灯具', purchase_price: 99.5 }));
    expect(editForm).toContain('编辑物品');
    expect(editForm).toContain('value="99.5"');
    expect(editForm).toContain('更新');
    const newForm = belFormHtml(null);
    expect(newForm).toContain('记一笔');
    expect(newForm).toContain('保存');
    expect(belFormInit(null).exitedInit).toBe(false);
    expect(belFormInit(it0({ current_status: '已转卖', exit_date: '2025-06-01' })).exitedInit).toBe(true);
    expect(belFormInit(null).dateVal).toBe('2025-06-15'); // 新记日期默认今天
    vi.useRealTimers();
  });

  it('sheetHeadHtml + actionSpecs 序列（当前态不出现；编辑 keepOpen；删除 danger）', () => {
    const head = sheetHeadHtml(it0({ name: '台灯', category: '灯具', purchase_price: 100 }));
    expect(head).toContain('bz-item-sheet-entry');
    expect(head).toContain('台灯');

    const specs = actionSpecs(it0({ current_status: '使用中' }));
    expect(specs.map((s) => s.act)).toEqual(['flow', 'flow', 'flow', 'edit', 'del']);
    expect(specs[0].status).toBe('闲置');
    expect(specs.map((s) => s.label)).not.toContain('标记为使用中');
    expect(specs[3].keepOpen).toBe(true);
    expect(specs[4].danger).toBe(true);
  });

  it('图标兜底链（issue 231）：icon 字段优先；未映射 emoji 回退文本；空分类 📦 兜底 package', () => {
    expect(itemEmHtml(it0({ icon: 'lamp' }))).toContain('data-lucide="lamp"');
    expect(itemEmHtml(it0({ icon: null, category: '灯具' }))).toBe('灯'); // 无 icon/emoji → 首字文本兜底（裸文本无标签）
    expect(catEmHtml('📦')).toContain('package'); // 空分类 📦 → 映射 package（ui.test 同款口径）
    expect(catNameOf('💡 灯具')).toBe('灯具');
    expect(moneyShort(12345)).toBe('￥12,345');
  });

  it('金额单位（issue 294）：cny 前缀 / yuan 后缀 / usd 前缀 / none 无符号；moneyWith 包裹预格式化串', () => {
    expect(money(1234.5)).toBe('￥1,234.50');
    expect(money(1234.5, 'yuan')).toBe('1,234.50 元');
    expect(money(1234.5, 'usd')).toBe('$1,234.50');
    expect(money(1234.5, 'none')).toBe('1,234.50');
    expect(moneyShort(12345, 'yuan')).toBe('12,345 元');
    expect(moneyWith('0.0025', 'usd')).toBe('$0.0025'); // 卡片日均小值 4 位档原样包裹
    expect(moneyUnitLabel('none')).toBe('');
    expect(moneyUnitLabel('yuan')).toBe('元');
  });
});

// ==================== renderPanelView 胶水 ====================

describe('renderPanelView（六步全量渲染胶水）', () => {
  function mount(items: BelongingsItem[], view: { status: string | null; year: string; q: string; sort: string }) {
    const root = document.createElement('div');
    root.innerHTML = panelHtml();
    const panel = root.querySelector('.bz-bel-panel') as HTMLElement;
    const icons: string[] = [];
    renderPanelView(panel, items, view, { mountIcons: (r) => r.querySelectorAll('i[data-lucide]').forEach((i) => icons.push((i as HTMLElement).dataset.lucide || '')) });
    return { panel, icons };
  }

  it('六步渲染：标题/副题/chips/年份/KPI/排序/内容 + 图标兑现回调', () => {
    const items = [
      it0({ id: 'a', name: '台灯', category: '灯具', purchase_date: '2025-01-01' }),
      it0({ id: 'b', current_status: '闲置', purchase_date: '2024-01-01' }),
    ];
    const { panel, icons } = mount(items, { status: 'idle', year: '', q: '', sort: 'recent' });
    expect(panel.querySelector('[data-bel-herotitle]')!.textContent).toBe('闲置');
    expect(panel.querySelector('[data-bel-herosub]')!.textContent).toContain('1 件在列');
    expect(panel.querySelectorAll('[data-bel-chips] .bz-chip').length).toBe(6);
    expect(panel.querySelector('[data-bel-content]')!.querySelectorAll('.bz-bel-cell').length).toBe(1);
    expect(panel.querySelector('[data-bel-sort]')!.querySelectorAll('.bz-segmented-btn').length).toBe(3);
    expect(panel.querySelector('[data-bel-stampn]')!.textContent).toBe('2'); // 印章 = 全局在库（不随筛选）
    expect(icons).toContain('package'); // 状态徽章图标（闲置）
  });

  it('空态分支 + 年份悬空回写（view.year 归位全部）', () => {
    const view = { status: 'sold', year: '2099', q: '', sort: 'recent' };
    const { panel } = mount([it0({})], view);
    expect(panel.querySelector('[data-bel-content]')!.textContent).toContain('没有符合条件的物品');
    expect(view.year).toBe(''); // 悬空年份被胶水归位（回写 view）
  });
});
