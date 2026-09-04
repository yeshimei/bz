/**
 * 影院（cinema）UI 层测试：overlay 打开/渲染/筛选交互/详情弹窗/快速状态窗/ESC
 * + 增强包回归：右键菜单/长按抽屉、空态两种、AI 按需触发与结果页闭环、回收站删除、
 *   豆瓣直达、观影日期、升级默认已看、组件库修饰符类
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { runAIRecommend, runSimilarRecommend } from '../../src/cinema/recommend';
import { createOverlay, closeOverlay, openAddModalDirect } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema, openCinemaAnalysis } from '../../src/cinema';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { closeItemMenu } from '../../src/core/item-actions';

function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}

function md(content: string): string {
  return content;
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  vault.files.set('我的/影视/《星际穿越》.md', md(`---
tags: [电影]
评分: 9.6
观影日期: 2026-08-01
影评: 爱是穿越维度的唯一力量
导演: 诺兰
---`));
  vault.files.set('我的/影视/《绝命毒师 第一季》.md', md(`---
tags: [美剧]
评分: 9.4
观影日期: 2026-07-01
---`));
  vault.files.set('我的/影视/《瑞克和莫蒂》.md', md(`---
tags: [美漫]
评分: 0
观影日期: 2026-06-01
---`));
  vault.files.set('我的/影视/《想看片》.md', md(`---
tags: [电影]
评分: -1
观影日期: 2026-05-01
---`));
  const app = makeApp(vault);
  ensureCinema(app);
  rebuildItems(app);
  return { vault, app };
}

describe('cinema overlay', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents(); // 域事件订阅隔离：ensureCinema 的自动刷新订阅不跨用例残留
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    closeItemMenu(); // 右键菜单/长按抽屉若开着，清理 document 级监听
    Platform.isMobile = false;
    unloadCinema();
    document.body.innerHTML = '';
  });

  it('打开主面板：头行 + 左栏分类 + 海报网格', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-cinema-title')?.textContent).toBe('影视');
    // 主头行：标题=全部（默认）+ 计数 + 添加按钮
    const mainHead = overlay.querySelector('.bz-cinema-main-head') as HTMLElement;
    expect(mainHead).toBeTruthy();
    expect(overlay.querySelector('[data-cinema-main-title]')?.textContent).toBe('全部');
    expect(overlay.querySelector('[data-cinema-main-count]')?.textContent).toBe('· 4 部');
    expect(overlay.querySelector('[data-cinema-add]')).toBeTruthy();
    // 左栏：类型区「全部」+ 组；状态区「全部」+ 想看/在看/已看
    const nav = overlay.querySelector('.bz-cinema-nav') as HTMLElement;
    expect(nav.querySelector('[data-cinema-type="all"]')?.textContent).toContain('全部');
    expect(nav.querySelectorAll('[data-cinema-type]').length).toBeGreaterThanOrEqual(3);
    expect(nav.querySelector('[data-cinema-status="all"]')?.textContent).toContain('全部');
    expect(nav.querySelectorAll('[data-cinema-status]').length).toBe(4);
    expect(nav.querySelectorAll('[data-cinema-tool]').length).toBe(2);
    // 搜索框后排序 segmented（最近观看/按创建/按评分）
    const sortEl = overlay.querySelector('.bz-cinema-sort') as HTMLElement;
    expect(sortEl).toBeTruthy();
    expect(sortEl.querySelectorAll('.bz-segmented-btn').length).toBe(3);
    expect(sortEl.querySelector('.bz-segmented-btn.is-on')?.textContent).toBe('最近观看');
    // 海报网格：4 张卡片（含 1 想看 + 1 在看）
    const cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(4);
    // 桌面端关闭按钮隐藏（bz-cinema-mob-only，仅移动端显示）
    const closeBtn = overlay.querySelector('.bz-cinema-close');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn?.classList.contains('bz-cinema-mob-only')).toBe(true);
  });

  it('点遮罩关闭主面板（桌面端无关闭按钮，靠遮罩/ESC）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    overlay.click();
    expect(document.querySelector('.bz-cinema-overlay')).toBeNull();
    expect(M.currentOverlay).toBeNull();
  });

  it('点分类筛选 + 点「全部」取消；主头行标题/计数跟随', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-type="电影"]') as HTMLElement).click();
    expect(M.typeFilter).toBe('电影');
    let cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(2); // 星际穿越 + 想看片
    expect(overlay.querySelector('[data-cinema-main-title]')?.textContent).toBe('电影');
    expect(overlay.querySelector('[data-cinema-main-count]')?.textContent).toBe('· 2 部');
    // 再点已选组不取消（组保持选中）
    (overlay.querySelector('[data-cinema-type="电影"]') as HTMLElement).click();
    expect(M.typeFilter).toBe('电影');
    // 点「全部」回全部
    (overlay.querySelector('[data-cinema-type="all"]') as HTMLElement).click();
    expect(M.typeFilter).toBeNull();
    cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(4);
    expect(overlay.querySelector('[data-cinema-main-title]')?.textContent).toBe('全部');
  });

  it('点状态筛选 + 点「全部」取消', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-status="想看"]') as HTMLElement).click();
    expect(M.statusFilter).toBe('想看');
    let cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('想看片');
    (overlay.querySelector('[data-cinema-status="all"]') as HTMLElement).click();
    expect(M.statusFilter).toBeNull();
    cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(4);
  });

  it('剧集点击筛组+展开二级；点二级筛选；再点同二级回该组全部', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const tvBtn = overlay.querySelector('[data-cinema-type="剧集"]') as HTMLElement;
    tvBtn.click();
    expect(M.typeFilter).toBe('剧集');
    expect(M.subFilter).toBeNull();
    // 展开二级（美剧）
    let subs = overlay.querySelectorAll('[data-cinema-sub]');
    expect(subs.length).toBeGreaterThan(0);
    // 点二级美剧
    const usBtn = overlay.querySelector('[data-cinema-sub="美剧"]') as HTMLElement;
    usBtn.click();
    expect(M.subFilter).toBe('美剧');
    expect(overlay.querySelector('[data-cinema-main-title]')?.textContent).toBe('美剧');
    let cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('绝命毒师');
    // 再点同二级 → 回该组全部（清二级，保持剧集组）
    const usBtn2 = overlay.querySelector('[data-cinema-sub="美剧"]') as HTMLElement;
    usBtn2.click();
    expect(M.subFilter).toBeNull();
    expect(M.typeFilter).toBe('剧集');
    expect(overlay.querySelector('[data-cinema-main-title]')?.textContent).toBe('剧集');
  });

  it('搜索过滤', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const input = overlay.querySelector('[data-cinema-search]') as HTMLInputElement;
    input.value = '星际';
    input.dispatchEvent(new Event('input'));
    // 防抖 300ms
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const cards = overlay.querySelectorAll('[data-cinema-idx]');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('星际穿越');
        resolve();
      }, 350);
    });
  });

  it('点海报卡片 → 详情弹窗（含影评/编辑/删除按钮，无关闭按钮）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('星际穿越');
    expect(modal.textContent).toContain('爱是穿越维度的唯一力量'); // 影评
    expect(modal.textContent).toContain('诺兰');
    expect(modal.querySelector('[data-cinema-dm-edit]')).toBeTruthy();
    expect(modal.querySelector('[data-cinema-dm-del]')).toBeTruthy();
    expect(modal.textContent).not.toContain('关闭');
  });

  it('详情弹窗内删除 → 确认框三段式 + 移入回收站（列表减少）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const delBtn = mask.querySelector('[data-cinema-dm-del]') as HTMLElement;
    delBtn.click();
    // 确认框（增强包需求 5 三段式：标题「删除影视」+ 问句「」引号 + 回收站后果说明）
    const confirmMask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    expect(confirmMask.querySelector('.bz-cinema-confirm-title')?.textContent).toBe('删除影视');
    expect(confirmMask.textContent).toContain('确定删除「星际穿越」吗？');
    expect(confirmMask.textContent).toContain('将移入系统回收站，可在回收站恢复');
    const delConfirm = confirmMask.querySelector('#bz-cinema-d-del') as HTMLElement;
    delConfirm.click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步删除完成
    const cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(3);
    // vault.trash(file, true)：原路径消失，.trash/ 留档可恢复
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(false);
    expect(vault.files.has('.trash/《星际穿越》.md')).toBe(true);
    expect(hasNotice('已删除「星际穿越」，已移入系统回收站')).toBe(true);
  });

  it('想看灰色小字 → 快速状态窗（升级在看/已看 + 滑杆 + 影评）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // 先筛「想看」状态，保证只有想看片可升级
    (overlay.querySelector('[data-cinema-status="想看"]') as HTMLElement).click();
    const up = overlay.querySelector('[data-cinema-upgrade]') as HTMLElement;
    expect(up).toBeTruthy();
    up.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('想看片');
    // 目标状态按钮（想看 → 在看/已看）
    const qsBtns = modal.querySelectorAll('[data-cinema-qs]');
    expect(qsBtns.length).toBe(2);
    // 评分滑杆存在（组件库 .bz-range 自绘外观）
    expect(modal.querySelector('#bz-cinema-qs-rating')).toBeTruthy();
    expect((modal.querySelector('#bz-cinema-qs-rating') as HTMLElement).classList.contains('bz-range')).toBe(true);
    // 影评 textarea（.bz-field 字段行：label 上置，不与 textarea 同排）
    expect(modal.querySelector('#bz-cinema-qs-review')).toBeTruthy();
    expect(modal.querySelector('.bz-cinema-qs-review .bz-field-label')?.textContent).toBe('影评');
    // 目标状态按钮为平铺单选（组件库 .bz-choice），默认选中「已看」（增强包需求 9）
    expect(modal.querySelector('.bz-cinema-qs-btns .bz-choice-btn.is-on')?.getAttribute('data-value')).toBe('已看');
    expect(modal.textContent).not.toContain('取消'); // 无取消钮：点遮罩/ESC 关闭
    // 升级到已看 + 保存
    (modal.querySelector('[data-cinema-qs="已看"]') as HTMLElement).click();
    const rating = modal.querySelector('#bz-cinema-qs-rating') as HTMLInputElement;
    rating.value = '9.5';
    rating.dispatchEvent(new Event('input'));
    (modal.querySelector('#bz-cinema-qs-save') as HTMLElement).click();
    const item = M.items.find((i) => i.name === '想看片');
    expect(item?.status).toBe(2); // 已看
    expect(item?.rating).toBe(9.5);
    // CM1：流转已看时观影日期刷新为当前时间（统计口径按看完时间，非加入时间）
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    expect(item?.watchDate).not.toBe('2026-05-01');
    expect(item?.watchDate).toContain(today);
  });

  it('ESC 关闭：先弹窗后主面板', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    expect(document.querySelector('.bz-overlay-mask')).toBeTruthy();
    // ESC 关弹窗
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    expect(document.querySelector('.bz-cinema-overlay')).toBeTruthy();
    // ESC 关主面板
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bz-cinema-overlay')).toBeNull();
  });

  it('排序切换：按评分 → 高分在前', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const sortBtns = overlay.querySelectorAll('.bz-cinema-sort .bz-segmented-btn');
    // 找「按评分」按钮（组件库 segmented 按钮文案）
    const ratingBtn = Array.from(sortBtns).find((b) => b.textContent === '按评分') as HTMLElement;
    ratingBtn.click();
    expect(M.sortMode).toBe('rating');
    // 列表按评分降序：星际穿越 9.6 > 绝命毒师 9.4 > 想看/在看片（未看靠后）
    const names = Array.from(overlay.querySelectorAll('.bz-cinema-p-name')).map((n) => n.textContent);
    expect(names[0]).toBe('星际穿越');
    expect(names[1]).toBe('绝命毒师 第一季');
  });

  it('AI 页按需触发：切页不发请求、引导页出「开始 AI 荐片」；分析页切换保留', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // 点 AI 工具 → 只切页（增强包需求 4：按需触发，不自动发请求）
    (overlay.querySelector('[data-cinema-tool="ai"]') as HTMLElement).click();
    expect(M.view).toBe('ai');
    expect(M.aiRunning).toBe(false);
    let content = overlay.querySelector('.bz-cinema-content') as HTMLElement;
    expect(content.querySelector('[data-cinema-ai-start]')?.textContent).toContain('开始 AI 荐片');
    expect(document.querySelector('.bz-overlay-mask')).toBeNull(); // 不弹窗
    // 分析页：完整版（ADR-0090 后 19 板块 + 头行小计）
    (overlay.querySelector('[data-cinema-tool="stat"]') as HTMLElement).click();
    expect(M.view).toBe('stat');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('影视分析');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('类型分布');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('年度观影趋势');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('追剧深度');
    // 头行小计（4 部 · 已看 2 · 2026）
    expect(overlay.querySelector('.bz-cinema-page-sub')?.textContent).toBe('4 部 · 已看 2 · 2026');
  });

  it('分析页空态带动作：点「添加影视」直达添加表单（ADR-0090）', () => {
    const vault = new MockVault(); // 空库
    const app = makeApp(vault);
    ensureCinema(app);
    rebuildItems(app);
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-tool="stat"]') as HTMLElement).click();
    const content = overlay.querySelector('.bz-cinema-content') as HTMLElement;
    expect(content.textContent).toContain('还没有可统计的影视记录');
    // 点空态动作按钮 → 添加表单弹窗（名称输入出现）
    (content.querySelector('[data-cinema-analysis-add]') as HTMLElement).click();
    expect(document.querySelector('.bz-overlay-mask')).not.toBeNull();
    expect(document.querySelector('#bz-cinema-f-name')).not.toBeNull();
    closeOverlay();
  });

  it('openCinemaAnalysis（bz-cinema-analysis 直达，ADR-0090）：未开面板 → 开并落分析页；已开列表 → 就地切分析页', () => {
    const { app } = seedVault();
    openCinemaAnalysis(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(M.view).toBe('stat');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('影视分析');
    // 已开面板（切回列表）→ 再执行命令：同一 overlay 就地切分析页，不关闭重开
    (overlay.querySelector('[data-cinema-type="all"]') as HTMLElement).click();
    expect(M.view).toBe('list');
    const same = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(same).toBe(overlay);
    openCinemaAnalysis(app);
    expect(M.view).toBe('stat');
    expect((document.querySelector('.bz-cinema-overlay') as HTMLElement)).toBe(overlay);
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('类型分布');
  });

  it('分析页打开期间 vault 变更自动刷新（ADR-0090 需求 6：只重算内容区）', async () => {
    const { vault, app } = seedVault();
    openCinemaAnalysis(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(overlay.querySelector('.bz-cinema-page-sub')?.textContent).toBe('4 部 · 已看 2 · 2026');
    // 外部落盘新条目 → vault:md-created 域事件 → 300ms 防抖后自动重算分析页（轮询等防抖落地，不钉时长）
    vault.files.set('我的/影视/《新片》.md', md(`---
tags: [电影]
评分: 8
观影日期: 2026-08-02
---`));
    emitDomainEvent('vault:md-created', { path: '我的/影视/《新片》.md' });
    await vi.waitFor(() => {
      expect(overlay.querySelector('.bz-cinema-page-sub')?.textContent).toBe('5 部 · 已看 3 · 2026');
    });
  });

  it('AI 结果页反馈闭环：上次结果先展示 + 换一批 + 已在库中禁用 + 豆瓣外链 + 等待页大 spinner', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-tool="ai"]') as HTMLElement).click();
    // 种上次结果（含一条已在库中的「星际穿越」）：切页应先展示
    M.aiResult = [
      { title: '星际穿越', year: '2014', type: '电影', reason: '同偏好' },
      { title: '新片X', type: '电影', reason: '' },
    ];
    M.renderFn?.();
    const content = overlay.querySelector('.bz-cinema-content') as HTMLElement;
    // 头部「换一批」（增强包需求 3）
    expect(content.querySelector('[data-cinema-ai-refresh]')?.textContent).toContain('换一批');
    // 已入库推荐卡：check 图标 + 「已在库中」禁用态（M.items 名称比对）
    const inlib = content.querySelector('[data-rec-inlib]') as HTMLButtonElement;
    expect(inlib).toBeTruthy();
    expect(inlib.disabled).toBe(true);
    expect(inlib.textContent).toContain('已在库中');
    expect(inlib.querySelector('svg, [data-lucide], .bz-ic')).toBeTruthy(); // check 图标
    // 未入库推荐卡：加入想看钮 = 强调图标钮修饰符（增强包需求 11）
    const addBtn = content.querySelector('[data-rec-add]') as HTMLElement;
    expect(addBtn.classList.contains('bz-icon-btn--accent')).toBe(true);
    // 片名旁豆瓣搜索外链（增强包需求 6）
    const doubanLink = content.querySelector('.bz-cinema-rec-douban') as HTMLAnchorElement;
    expect(doubanLink).toBeTruthy();
    expect(doubanLink.getAttribute('href')).toBe('https://movie.douban.com/search?q=' + encodeURIComponent('星际穿越'));
    expect(doubanLink.target).toBe('_blank');
    // 等待页：大号 spinner（.bz-spinner--lg）
    M.aiRunning = true;
    M.renderFn?.();
    expect(overlay.querySelector('.bz-cinema-content .bz-spinner--lg')).toBeTruthy();
    M.aiRunning = false;
    M.renderFn?.();
  });

  it('错误页「重试」按基准分流：找同类失败后重试重跑找同类（不退化成全库荐片）；荐片失败重试仍是荐片', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // AI 返回非法 JSON → 两轮都失败落错误页
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(app);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: 'nope' });

    // 找同类（基准：星际穿越）失败 → 错误页渲染「重试」按钮（data-cinema-ai-start）
    const base = M.items.find((i) => i.name === '星际穿越')!;
    await runSimilarRecommend(base, app);
    expect(M.aiError).toContain('AI 分析失败');
    expect(overlay.querySelector('[data-cinema-ai-start]')?.textContent).toContain('重试');
    // 点「重试」→ 按基准影片重跑找同类（修复点：此前无分流，重试会走全库荐片改写标题/基准）
    (overlay.querySelector('[data-cinema-ai-start]') as HTMLElement).click();
    expect(M.aiTitle).toContain('找同类');
    expect(M.aiTitle).toContain('星际穿越');
    expect(M.aiBase?.name).toBe('星际穿越');
    await vi.waitFor(() => expect(M.aiRunning).toBe(false)); // 第二轮失败收尾，不留挂起状态机

    // 全库荐片失败（runAIRecommend 已清基准）→ 重试仍是全库荐片
    await runAIRecommend(app);
    expect(M.aiError).toContain('AI 分析失败');
    (overlay.querySelector('[data-cinema-ai-start]') as HTMLElement).click();
    expect(M.aiTitle).toBe('AI 荐片');
    expect(M.aiBase).toBeNull();
    await vi.waitFor(() => expect(M.aiRunning).toBe(false));
  });

  it('添加弹窗（命令直达 + 落盘创建笔记）', async () => {
    const { vault, app } = seedVault();
    openAddModalDirect(app);
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('添加影视');
    expect(modal.querySelector('#bz-cinema-f-rating')).toBeTruthy(); // 评分滑杆
    expect((modal.querySelector('#bz-cinema-f-rating') as HTMLElement).classList.contains('bz-range')).toBe(true);
    // 字段行 = .bz-field（label 上置，不与控件同排）；类型/状态 = 平铺单选 .bz-choice（非下拉）
    // 增强包需求 8：新增观影日期字段（6 字段：名称/类型/状态/观影日期/评分/影评），默认今天
    expect(modal.querySelectorAll('.bz-cinema-form .bz-field')).toHaveLength(6);
    const dateInput = modal.querySelector('#bz-cinema-f-date') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    const d0 = new Date();
    const p0 = (n: number) => String(n).padStart(2, '0');
    expect(dateInput.value).toBe(`${d0.getFullYear()}-${p0(d0.getMonth() + 1)}-${p0(d0.getDate())}`);
    expect(modal.querySelectorAll('.bz-cinema-form .bz-choice')).toHaveLength(2);
    expect(modal.querySelector('select')).toBeNull();
    expect(modal.querySelector('.bz-choice-btn.is-on[data-cinema-f-tag]')?.getAttribute('data-value')).toBe('电影');
    expect(modal.querySelector('.bz-choice-btn.is-on[data-cinema-f-status]')?.getAttribute('data-value')).toBe('已看');
    // 需求：默认「已看」显示评分与影评（初始联动）
    expect((modal.querySelector('#bz-cinema-f-rating-field') as HTMLElement).style.display).not.toBe('none');
    expect((modal.querySelector('#bz-cinema-f-review-field') as HTMLElement).style.display).not.toBe('none');
    expect(modal.textContent).not.toContain('取消'); // 无取消钮：点遮罩/ESC 关闭
    // 填写并保存
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '新片';
    (modal.querySelector('#bz-cinema-f-review') as HTMLTextAreaElement).value = '好看';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    const added = M.items.find((i) => i.name === '新片');
    expect(added).toBeTruthy();
    expect(added?.review).toBe('好看');
    // 落盘：笔记文件已创建，frontmatter 含 tag/评分/影评；观影日期默认为当前日期（今日）
    const filePath = '我的/影视/《新片》.md';
    const content = vault.files.get(filePath);
    expect(content).toBeTruthy();
    expect(content).toContain('- 电影');
    expect(content).toContain('评分: 5');
    expect(content).toContain('影评: 好看');
    expect(content).toContain(`观影日期: ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`);
  });

  it('CM2：新增重名影视被拦截（不落盘不留幽灵条目）', async () => {
    const { vault, app } = seedVault();
    openAddModalDirect(app);
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    const before = M.items.length;
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '星际穿越';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 未新增条目、未新建文件（同名笔记保持原内容）
    expect(M.items.length).toBe(before);
    expect(vault.files.get('我的/影视/《星际穿越》.md')).toContain('评分: 9.6');
    expect(modal.textContent).toContain('添加影视'); // 弹窗未关，可改名重试
  });

  it('CM3：卡片 data-cinema-idx 为稳定路径键，异步重排后点击仍指对条目', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    // 键 = file.path（非数组下标）
    expect(card.getAttribute('data-cinema-idx')).toBe('我的/影视/《星际穿越》.md');
    // 模拟异步刷新重排（M.items 反转，旧 DOM 顺序已失效）
    M.items.reverse();
    card.click();
    // 点击仍打开星际穿越详情（稳定键回查），而非重排后的其它条目
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.querySelector('.bz-cinema-dm-title')?.textContent).toBe('星际穿越');
  });

  it('添加弹窗：类型/状态平铺点选生效（无彩色圆 + 想看隐藏评分影评）', async () => {
    const { vault, app } = seedVault();
    openAddModalDirect(app);
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    // 点「日漫」→ 原默认「电影」取消选中；点「想看」
    (modal.querySelector('[data-cinema-f-tag][data-value="日漫"]') as HTMLElement).click();
    (modal.querySelector('[data-cinema-f-status][data-value="想看"]') as HTMLElement).click();
    expect(modal.querySelectorAll('[data-cinema-f-tag].is-on')).toHaveLength(1);
    expect(modal.querySelector('[data-cinema-f-tag].is-on')?.getAttribute('data-value')).toBe('日漫');
    expect(modal.querySelector('[data-cinema-f-status].is-on')?.getAttribute('data-value')).toBe('想看');
    // 需求：类型/状态选项前不添加彩色圆点
    expect(modal.querySelector('.bz-cinema-form .bz-choice-dot')).toBeNull();
    // 需求：选「想看」→ 观影日期/评分与影评隐藏（状态联动；观影日期只对已看有统计意义）
    expect((modal.querySelector('#bz-cinema-f-date-field') as HTMLElement).style.display).toBe('none');
    expect((modal.querySelector('#bz-cinema-f-rating-field') as HTMLElement).style.display).toBe('none');
    expect((modal.querySelector('#bz-cinema-f-review-field') as HTMLElement).style.display).toBe('none');
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '海贼王';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    const added = M.items.find((i) => i.name === '海贼王');
    expect(added?.typeTag).toBe('日漫');
    expect(added?.group).toBe('动漫');
    expect(added?.status).toBe(0); // 想看
    expect(added?.rating).toBe(-1);
    // 想看状态不保存影评（空字符串，不落盘）
    expect(added?.review).toBe('');
    const content = vault.files.get('我的/影视/《海贼王》.md');
    expect(content).toContain('- 日漫');
    expect(content).toContain('评分: -1');
  });

  it('快速状态窗升级 → 写 frontmatter 落盘', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-status="想看"]') as HTMLElement).click();
    const up = overlay.querySelector('[data-cinema-upgrade]') as HTMLElement;
    up.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    (modal.querySelector('[data-cinema-qs="已看"]') as HTMLElement).click();
    const rating = modal.querySelector('#bz-cinema-qs-rating') as HTMLInputElement;
    rating.value = '9.5';
    rating.dispatchEvent(new Event('input'));
    (modal.querySelector('#bz-cinema-qs-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    const item = M.items.find((i) => i.name === '想看片');
    expect(item?.status).toBe(2); // 已看
    expect(item?.rating).toBe(9.5);
    // 落盘：frontmatter 评分已更新
    const content = vault.files.get('我的/影视/《想看片》.md');
    expect(content).toContain('评分: 9.5');
  });

  it('详情 → 编辑弹窗：字段预选当前值，保存写回 frontmatter', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const editMask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const modal = editMask.querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('编辑影视');
    // 预选：类型 电影（默认第一项）/ 状态 已看；名称与影评回填
    expect((modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value).toBe('星际穿越');
    expect((modal.querySelector('#bz-cinema-f-review') as HTMLTextAreaElement).value).toBe('爱是穿越维度的唯一力量');
    expect(modal.querySelector('[data-cinema-f-tag].is-on')?.getAttribute('data-value')).toBe('电影');
    expect(modal.querySelector('[data-cinema-f-status].is-on')?.getAttribute('data-value')).toBe('已看');
    // 改状态为「在看」+ 保存 → frontmatter 评分 0
    (modal.querySelector('[data-cinema-f-status][data-value="在看"]') as HTMLElement).click();
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    const content = vault.files.get('我的/影视/《星际穿越》.md');
    expect(content).toContain('评分: 0');
  });

  it('编辑改名 → 文件真实重命名落盘（旧路径消失、frontmatter 字段保留、内存指向新文件）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement; // 星际穿越
    card.click();
    let mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '星际穿越2';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    // 旧文件已重命名，新文件落盘且原字段保留
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(false);
    const content = vault.files.get('我的/影视/《星际穿越2》.md');
    expect(content).toBeTruthy();
    expect(content).toContain('评分: 9.6');
    expect(content).toContain('导演: 诺兰'); // 未动海报/豆瓣等字段
    expect(content).toContain('电影'); // tags 保留
    // 内存条目同步指向新文件（300ms 重建后不会弹回旧名）
    const item = M.items.find((i) => i.name === '星际穿越2');
    expect(item).toBeTruthy();
    expect(item!.file?.path).toBe('我的/影视/《星际穿越2》.md');
    expect(hasNotice('已保存「星际穿越2」')).toBe(true);
  });

  it('编辑改类型 → frontmatter tags 落盘（替换类型 tag、字段保留）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement; // 星际穿越（电影）
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    (modal.querySelector('[data-cinema-f-tag][data-value="日漫"]') as HTMLElement).click();
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const content = vault.files.get('我的/影视/《星际穿越》.md');
    expect(content).toContain('日漫');
    expect(content).not.toContain('- 电影');
    expect(content).toContain('评分: 9.6'); // 其余字段不动
    const item = M.items.find((i) => i.name === '星际穿越');
    expect(item?.typeTag).toBe('日漫');
  });

  it('编辑改名为已存在名称 → 拦截（不重命名、弹窗留在原地可改后重试）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement; // 星际穿越
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '绝命毒师 第一季';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 未重命名，原文件原值不动；弹窗未关（可改名重试）；无「已保存」假提示
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(true);
    expect(vault.files.get('我的/影视/《星际穿越》.md')).toContain('评分: 9.6');
    expect(vault.files.has('我的/影视/《绝命毒师 第一季》.md')).toBe(true); // 同名文件未被覆盖
    expect(modal.textContent).toContain('编辑影视');
    expect(hasNotice('已保存「星际穿越2」')).toBe(false);
  });

  it('编辑改名为非法字符 → 拦截（不重命名）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '非法/名称';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(true);
    expect(hasNotice(/非法字符/)).toBe(true);
    expect(hasNotice('已保存「星际穿越2」')).toBe(false);
  });

  it('删除失败 → 报错并保留条目（不摘列表、不假报成功）', async () => {
    const { vault, app } = seedVault();
    // Windows 文件被占用场景：vault.trash 抛错
    (vault as any).trash = async () => { throw new Error('EBUSY: resource busy'); };
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-del]') as HTMLElement).click();
    const confirmMask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (confirmMask.querySelector('#bz-cinema-d-del') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 条目仍在列表，文件未删；报错而非「已移入回收站」
    expect(overlay.querySelectorAll('[data-cinema-idx]').length).toBe(4);
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(true);
    expect(hasNotice(/删除失败/)).toBe(true);
    expect(hasNotice('已移入回收站')).toBe(false);
  });

  it('主面板动态发号（topifyZ）：overlay 持有高于静态档的 z-index', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const z = Number(overlay.style.zIndex);
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThanOrEqual(100000); // ADR-0067 动态分配器起点
  });

  it('关闭面板复位视图：重开回落列表页（AI 页不跨开合残留）', () => {
    const { app } = seedVault();
    createOverlay(app);
    M.view = 'stat';
    closeOverlay();
    expect(M.view).toBe('list');
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(M.view).toBe('list');
    expect(overlay.querySelector('[data-cinema-idx]')).toBeTruthy(); // 列表页（海报网格）
  });

  // ---------- 增强包回归：海报卡统一右键菜单 / 长按抽屉 ----------

  it('海报卡右键菜单（桌面）：想看卡含标记在看/已看；点「标记已看」生效并通知', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx="我的/影视/《想看片》.md"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    // 全项：打开详情/标记在看/标记已看/找同类/在豆瓣打开/编辑/删除
    for (const label of ['打开详情', '标记在看', '标记已看', '找同类', '在豆瓣打开', '编辑', '删除']) {
      expect(menu.textContent).toContain(label);
    }
    // 已看卡右键：不再出现「标记在看/标记已看」
    const watchedCard = overlay.querySelector('[data-cinema-idx="我的/影视/《星际穿越》.md"]') as HTMLElement;
    watchedCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    const menu2 = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu2).toBeTruthy();
    expect(menu2.textContent).not.toContain('标记已看');
    // 点「标记已看」→ 状态流转 + 默认评分 + 观影日期刷新（CM1）+ 通知
    const watchBtn = Array.from(menu.querySelectorAll('button')).find((b) => b.textContent === '标记已看') as HTMLElement;
    watchBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    const item = M.items.find((i) => i.name === '想看片');
    expect(item?.status).toBe(2);
    expect(item?.rating).toBe(5); // DEFAULT_RATING
    expect(item?.watchDate).not.toBe('2026-05-01');
    expect(hasNotice('已把「想看片」标记为已看')).toBe(true);
  });

  it('海报卡移动端长按 → 底部抽屉（.bz-item-sheet）：同名项 + 抽屉头部信息', async () => {
    const { app } = seedVault();
    Platform.isMobile = true; // isMobileEnv 口径（Platform.isMobile）
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx="我的/影视/《想看片》.md"]') as HTMLElement;
    // 模拟触屏长按：touchstart（带 touches）→ 500ms 计时 → 触发
    const ts = new Event('touchstart', { bubbles: true }) as any;
    Object.defineProperty(ts, 'touches', { value: [{ clientX: 10, clientY: 10 }] });
    card.dispatchEvent(ts);
    await new Promise((r) => setTimeout(r, 650));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    // 抽屉头部（网易云式条目信息）
    expect(sheet.querySelector('.bz-cinema-sheet-title')?.textContent).toBe('想看片');
    expect(sheet.querySelector('.bz-cinema-sheet-sub')?.textContent).toContain('想看');
    // 同项动作
    expect(sheet.textContent).toContain('打开详情');
    expect(sheet.textContent).toContain('标记已看');
    expect(sheet.textContent).toContain('删除');
    card.dispatchEvent(new Event('touchend', { bubbles: true }));
  });

  // ---------- 增强包回归：空态两种 ----------

  it('空态两种：筛选无结果 → 「清空筛选」一键回全部；库为空 → 引导添加', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // 筛选无结果（搜索关键词无命中）
    const input = overlay.querySelector('[data-cinema-search]') as HTMLInputElement;
    input.value = '绝不存在的片名';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // 过防抖
    let content = overlay.querySelector('.bz-cinema-content') as HTMLElement;
    expect(content.querySelector('.bz-empty')).toBeTruthy();
    expect(content.querySelector('.bz-empty-title')?.textContent).toBe('没有符合条件的影视');
    const clearBtn = content.querySelector('.bz-cinema-empty-clear') as HTMLElement;
    expect(clearBtn.textContent).toBe('清空筛选');
    clearBtn.click();
    expect(M.statusFilter).toBeNull();
    expect(M.typeFilter).toBeNull();
    expect(M.searchKeyword).toBe('');
    expect((overlay.querySelector('[data-cinema-search]') as HTMLInputElement).value).toBe('');
    expect(overlay.querySelectorAll('[data-cinema-idx]').length).toBe(4);
    // 库为空 → 「还没有收藏的影视」+「添加第一部影视」
    closeOverlay();
    const emptyVault = new MockVault();
    const emptyApp = mockAppWithVault(emptyVault);
    ensureCinema(emptyApp);
    M.folderPath = '我的/影视';
    createOverlay(emptyApp);
    const overlay2 = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    content = overlay2.querySelector('.bz-cinema-content') as HTMLElement;
    expect(content.querySelector('.bz-empty-title')?.textContent).toBe('还没有收藏的影视');
    const addBtn = content.querySelector('.bz-cinema-empty-add') as HTMLElement;
    expect(addBtn.textContent).toBe('添加第一部影视');
    addBtn.click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('添加影视');
  });

  // ---------- 增强包回归：豆瓣直达 / 彩色徽标修饰符 / 观影日期 ----------

  it('详情弹窗：豆瓣链接行出「豆瓣页面」外链钮；类型/状态徽标换 bz-chip--tint 修饰符', () => {
    const { vault, app } = seedVault();
    vault.files.set('我的/影视/《豆瓣片》.md', '---\ntags: [电影]\n评分: 8\n观影日期: 2026-08-02\n豆瓣链接: https://movie.douban.com/subject/123/\n---');
    rebuildItems(app);
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx="我的/影视/《豆瓣片》.md"]') as HTMLElement;
    card.click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    // 外链按钮（增强包需求 6）
    const doubanBtn = modal.querySelector('.bz-cinema-dm-douban') as HTMLAnchorElement;
    expect(doubanBtn).toBeTruthy();
    expect(doubanBtn.textContent).toContain('豆瓣页面');
    expect(doubanBtn.getAttribute('href')).toBe('https://movie.douban.com/subject/123/');
    expect(doubanBtn.target).toBe('_blank');
    // 彩色徽标（增强包需求 11）：bz-chip--tint + 变量注入（不再用被 !important 压制的 --locked+内联 background）
    const chips = modal.querySelectorAll('.bz-cinema-dm-badges .bz-chip--tint');
    expect(chips.length).toBe(1); // 豆瓣片评分 8 = 已看 → 仅类型徽标（状态徽标仅未看时出）
    expect((chips[0] as HTMLElement).style.getPropertyValue('--bz-chip-tint')).toBeTruthy();
    expect(modal.querySelectorAll('.bz-cinema-dm-badges .bz-chip--locked').length).toBe(0);
  });

  it('编辑表单：观影日期回填原值；改日期保存写回 frontmatter（统计按指定日期）', async () => {
    const { vault, app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx="我的/影视/《星际穿越》.md"]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-edit]') as HTMLElement).click();
    const modal = (document.querySelector('.bz-overlay-mask') as HTMLElement).querySelector('.bz-overlay-popup') as HTMLElement;
    // 回填原观影日期的日期部分（增强包需求 8）
    const dateInput = modal.querySelector('#bz-cinema-f-date') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-08-01');
    // 补录指定日期
    dateInput.value = '2026-07-15';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const content = vault.files.get('我的/影视/《星际穿越》.md');
    expect(content).toContain('观影日期: 2026-07-15');
    const item = M.items.find((i) => i.name === '星际穿越');
    expect(item?.watchDate).toBe('2026-07-15');
  });
});
