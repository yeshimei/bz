import { makeApp } from '../helpers/app';
/**
 * 影院（cinema）深审批 B（视图层与样式）回归：
 * #1 移动端列表空态（筛选无命中/空库两态，与 desk 同构）
 * #2 mob 搜索框值回显（会话内搜索词存续，重开面板不再「隐形筛选」）
 * #3 搜索框尾 ✕ 一键清词（有词才显示；点击走 data-cinema-clear 既有委托出口）
 * #4 卡片键盘可达（tabindex/role/aria-label + 委托层 Enter/Space 开详情）
 * #5 日期类统计已看守卫（想看条目的建档日期不计入节奏桶）
 * #6 合并卡季行单位原文（seasonText 自带单位不再拼「 集」）
 * #7/#8 触控热区修饰类 + 搜索占位文案统一（markup 断言）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { createOverlay, closeOverlay, renderAll } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema } from '../../src/cinema';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { deriveYb } from '../../src/cinema/yearbook';
import { mergeSeasonCards } from '../../src/cinema/seasons';
import { seriesDetailModalHtml } from '../../src/cinema/shared';
import { clearDomainEvents } from '../../src/core/domain-bus';

const SEARCH_PH = '搜索片名、类型、导演、主演、影评…';

function md(content: string): string {
  return content;
}

/** 四条夹具：已看（星际穿越）/ 想看（想看片，观影日期=建档日期）/ 剧集两季（合并卡，第二季带季集原文） */
function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('我的/影视/《星际穿越》.md', md(`---
tags: [电影]
评分: 9.6
观影日期: 2026-08-01
---`));
  vault.files.set('我的/影视/《想看片》.md', md(`---
tags: [电影]
评分: -1
观影日期: 2026-05-01
---`));
  vault.files.set('我的/影视/《老友记 第一季》.md', md(`---
tags: [美剧]
评分: 9
观影日期: 2026-07-01
---`));
  vault.files.set('我的/影视/《老友记 第二季》.md', md(`---
tags: [美剧]
评分: 9.5
观影日期: 2026-08-15
季集: "2季"
---`));
  const app = makeApp(vault);
  ensureCinema(app);
  rebuildItems(app);
  return { vault, app };
}

/** 点面板内元素（原生 click 冒泡到 sec 委托） */
function clickEl(el: Element | null | undefined): void {
  expect(el, '目标元素应存在').toBeTruthy();
  (el as HTMLElement).click();
}

function pressKey(el: Element, key: string): void {
  (el as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function mobRoot(): HTMLElement {
  return document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
}

describe('cinema 深审批 B #5：日期类统计已看守卫', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
  });

  it('想看条目的建档日期不计入年份/月份/星期（已看 3 条、想看 1 条夹具）', () => {
    seedVault();
    const d = deriveYb(M.items);
    expect(d.total).toBe(4);
    expect(d.watchedCount).toBe(3);
    // 观影日期桶只数已看：想看片的 2026-05-01 是建档日期
    const yearMap = Object.fromEntries(d.years.map((y) => [y.y, y.films.length]));
    expect(yearMap[2026]).toBe(3);
    expect(d.months[4]).toBe(0); // 5 月只有想看的建档日期（索引 4 = 5 月）
    expect(d.months[7]).toBe(2); // 8 月：星际穿越 + 老友记第二季（索引 7 = 8 月）
    expect(d.weekN.reduce((s, n) => s + n, 0)).toBe(3);
    const monthKeys = new Set([...d.days.keys()].map((k) => k.slice(0, 7)));
    expect(monthKeys.size).toBe(2); // 2026-07 / 2026-08（不含 2026-05）
    // 月均 = 有观影日期的已看部数 / 有观影记录的月数 = 3 / 2
    expect(d.monthFreq).toBe('1.5');
  });
});

describe('cinema 深审批 B #1/#2/#3/#4/#6/#7/#8：视图层', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
    setSettingsProvider(() => ({ cinemaMergeSeasons: true }) as any); // 合并开：老友记两季合一张卡
    document.body.innerHTML = '';
  });
  afterEach(() => {
    Platform.isMobile = false;
    unloadCinema();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  it('#1 mob 筛选无命中出空态页（无匹配影片 + 清空筛选按钮恢复网格）', () => {
    Platform.isMobile = true;
    const { app } = seedVault();
    createOverlay(app);
    const root = mobRoot();
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(3); // 合并开：老友记两季一张卡
    // 状态筛「在看」：库里只有已看/想看 → 无命中 → 空态页（此前恒渲染 m-grid 整片空白）
    clickEl(root.querySelector('.chip[data-s="在看"]'));
    const empty = root.querySelector('.j-mview .cn-empty-page');
    expect(empty).toBeTruthy();
    expect(empty?.querySelector('.big')?.textContent).toContain('无匹配影片');
    // 清空筛选走 data-cinema-clear 既有委托出口
    clickEl(root.querySelector('.cn-empty-page [data-cinema-clear]'));
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(3);
    expect(root.querySelector('.j-mview .cn-empty-page')).toBeNull();
  });

  it('#1 mob 空库出「影片空空如也」引导态（无清空筛选按钮）；desk 空态回归', () => {
    Platform.isMobile = true;
    const vault = new MockVault();
    const app = makeApp(vault);
    ensureCinema(app);
    rebuildItems(app);
    createOverlay(app);
    const empty = mobRoot().querySelector('.j-mview .cn-empty-page');
    expect(empty?.querySelector('.big')?.textContent).toContain('影片空空如也');
    expect(empty?.querySelector('[data-cinema-clear]')).toBeNull(); // 空库态没有筛选可清
    // desk 同构回归（desk 分支既有，守此不退化）
    closeOverlay();
    Platform.isMobile = false;
    M.searchKeyword = '查无此片';
    createOverlay(app);
    const deskEmpty = document.querySelector('section.bz-cinema--midnight:not(.mob) .cn-empty-page');
    expect(deskEmpty?.querySelector('.big')?.textContent).toContain('无匹配影片');
  });

  it('#2 mob 搜索框回显：重开面板框内可见旧词（desk 输入 → 关面板 → mob 重开），✕ 同步显示', () => {
    const { app } = seedVault();
    createOverlay(app); // desk 会话：置搜索词（防抖结果态，语义同 ui.ts onSearchInput 落值）
    M.searchKeyword = '星际';
    renderAll(app);
    expect((document.querySelector('.j-q') as HTMLInputElement).value).toBe('星际'); // desk 同源回显
    closeOverlay();
    Platform.isMobile = true;
    createOverlay(app); // mob 重开：旧词仍生效过滤，框内必须可见（此前空白 = 隐形筛选）
    const root = mobRoot();
    expect((root.querySelector('.j-mq') as HTMLInputElement).value).toBe('星际');
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(1);
    expect((root.querySelector('.m-search .q-clear') as HTMLElement).hidden).toBe(false);
  });

  it('#3 ✕ 有词才显示；点击清词（desk + mob，走 data-cinema-clear 委托）', () => {
    const { app } = seedVault();
    createOverlay(app);
    let root = document.querySelector('section.bz-cinema--midnight:not(.mob)') as HTMLElement;
    const deskClear = () => root.querySelector('.d-search .q-clear') as HTMLElement;
    expect(deskClear().hidden).toBe(true); // 无词隐藏
    M.searchKeyword = '星际';
    renderAll(app);
    expect(deskClear().hidden).toBe(false);
    clickEl(deskClear());
    expect(M.searchKeyword).toBe('');
    expect(root.querySelectorAll('.grid .pcard').length).toBe(3); // 清词后网格恢复全量
    // mob 同出口
    closeOverlay();
    Platform.isMobile = true;
    createOverlay(app);
    root = mobRoot();
    const mobClear = root.querySelector('.m-search .q-clear') as HTMLElement;
    expect(mobClear.hidden).toBe(true);
    M.searchKeyword = '星际';
    renderAll(app);
    expect(mobClear.hidden).toBe(false);
    clickEl(mobClear);
    expect(M.searchKeyword).toBe('');
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(3);
  });

  it('#4 卡片键盘可达：tabindex=0/role=button/aria-label（片名+状态），Enter/Space 开详情', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('section.bz-cinema--midnight:not(.mob)') as HTMLElement;
    const card = Array.from(root.querySelectorAll('.pcard')).find((c) => c.getAttribute('aria-label') === '星际穿越，已看') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('aria-label')).toContain('星际穿越');
    expect(card.getAttribute('aria-label')).toContain('已看');
    pressKey(card, 'Enter');
    expect(root.querySelector('.cn-modal .dm-title')?.textContent).toBe('星际穿越');
    // Space 开另一张（想看态卡）：委托以事件目标卡片为准
    clickEl(root.querySelector('.cn-ovl')); // 点遮罩关详情
    const wantCard = Array.from(root.querySelectorAll('.pcard')).find((c) => c.getAttribute('aria-label') === '想看片，想看');
    pressKey(wantCard as HTMLElement, ' ');
    expect(root.querySelector('.cn-modal .dm-title')?.textContent).toBe('想看片');
    // 合并卡 Enter → 各季明细弹窗
    clickEl(root.querySelector('.cn-ovl'));
    const seriesCard = root.querySelector('.pcard-series') as HTMLElement;
    expect(seriesCard.getAttribute('aria-label')).toContain('老友记');
    pressKey(seriesCard, 'Enter');
    expect(root.querySelector('.cn-modal .s-list')?.querySelectorAll('.s-row').length).toBe(2);
  });

  it('#6 合并卡季行展示季集原文（自带单位），不再拼「 集」叠字', () => {
    const { app } = seedVault();
    const card = mergeSeasonCards(M.items, true).find((e) => e.kind === 'series');
    expect(card && card.kind === 'series').toBe(true);
    const html = seriesDetailModalHtml(card as any, () => null);
    const host = document.createElement('div');
    host.innerHTML = html;
    const subs = Array.from(host.querySelectorAll('.s-sub')).map((el) => el.textContent ?? '');
    expect(subs.some((s) => s.includes('2季'))).toBe(true);
    expect(subs.every((s) => !s.includes('2季 集'))).toBe(true);
    void app;
  });

  it('#7/#8 触控热区修饰类挂载 + 两端搜索占位文案统一', () => {
    Platform.isMobile = true;
    const { app } = seedVault();
    createOverlay(app);
    const root = mobRoot();
    // 移动头行四钮（.add + .m-tool×3）全挂 core 修饰类（触屏 ::after 外扩，视觉零改动）
    expect(root.querySelectorAll('.m-acts .bz-touch-target.bz-touch-target--lg').length).toBe(4);
    // chips 横条全挂修饰类（全部 + 6 组 + 3 状态）
    expect(root.querySelectorAll('.chip.bz-touch-target--lg').length).toBe(10);
    expect((root.querySelector('.j-mq') as HTMLInputElement).placeholder).toBe(SEARCH_PH);
    // desk 同一占位口径
    closeOverlay();
    Platform.isMobile = false;
    createOverlay(app);
    expect((document.querySelector('.j-q') as HTMLInputElement).placeholder).toBe(SEARCH_PH);
  });
});
