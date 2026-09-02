/**
 * 影院（cinema）UI 层测试：overlay 打开/渲染/筛选交互/详情弹窗/快速状态窗/ESC
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { createOverlay, closeOverlay, openAddModalDirect } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema } from '../../src/cinema';

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
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unloadCinema();
    document.body.innerHTML = '';
  });

  it('打开主面板：头行 + 左栏分类 + 海报网格', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-cinema-title')?.textContent).toBe('影视');
    // 左栏：类型/状态/工具
    const nav = overlay.querySelector('.bz-cinema-nav') as HTMLElement;
    expect(nav.querySelectorAll('[data-cinema-type]').length).toBeGreaterThanOrEqual(2);
    expect(nav.querySelectorAll('[data-cinema-status]').length).toBe(3);
    expect(nav.querySelectorAll('[data-cinema-tool]').length).toBe(2);
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

  it('点分类筛选 + 再点取消', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-type="电影"]') as HTMLElement).click();
    expect(M.typeFilter).toBe('电影');
    let cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(2); // 星际穿越 + 想看片
    // 再点取消（重渲染后重新取 DOM）
    (overlay.querySelector('[data-cinema-type="电影"]') as HTMLElement).click();
    expect(M.typeFilter).toBeNull();
    cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(4);
  });

  it('点状态筛选 + 取消', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    (overlay.querySelector('[data-cinema-status="想看"]') as HTMLElement).click();
    expect(M.statusFilter).toBe('想看');
    let cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('想看片');
    (overlay.querySelector('[data-cinema-status="想看"]') as HTMLElement).click();
    expect(M.statusFilter).toBeNull();
    cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(4);
  });

  it('剧集点击展开二级，点二级筛选', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const tvBtn = overlay.querySelector('[data-cinema-type="剧集"]') as HTMLElement;
    tvBtn.click();
    // 展开二级
    let subs = overlay.querySelectorAll('[data-cinema-sub]');
    expect(subs.length).toBeGreaterThan(0);
    // 点二级美剧
    const usBtn = overlay.querySelector('[data-cinema-sub="美剧"]') as HTMLElement;
    usBtn.click();
    expect(M.subFilter).toBe('美剧');
    const cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('绝命毒师');
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

  it('详情弹窗内删除 → 列表减少', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const delBtn = mask.querySelector('[data-cinema-dm-del]') as HTMLElement;
    delBtn.click();
    // 确认框
    const confirmMask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    const delConfirm = confirmMask.querySelector('#bz-cinema-d-del') as HTMLElement;
    delConfirm.click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步删除完成
    const cards = overlay.querySelectorAll('[data-cinema-idx]');
    expect(cards.length).toBe(3);
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
    // 评分滑杆存在
    expect(modal.querySelector('#bz-cinema-qs-rating')).toBeTruthy();
    // 影评 textarea
    expect(modal.querySelector('#bz-cinema-qs-review')).toBeTruthy();
    // 升级到已看 + 保存
    (modal.querySelector('[data-cinema-qs="已看"]') as HTMLElement).click();
    const rating = modal.querySelector('#bz-cinema-qs-rating') as HTMLInputElement;
    rating.value = '9.5';
    rating.dispatchEvent(new Event('input'));
    (modal.querySelector('#bz-cinema-qs-save') as HTMLElement).click();
    const item = M.items.find((i) => i.name === '想看片');
    expect(item?.status).toBe(2); // 已看
    expect(item?.rating).toBe(9.5);
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

  it('AI 荐片 / 分析页切换', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // AI 页：引导页（画像预览 + 开始按钮）；runAIRecommend 真实调用在 recommend.test 覆盖
    (overlay.querySelector('[data-cinema-tool="ai"]') as HTMLElement).click();
    expect(M.view).toBe('ai');
    expect(overlay.querySelector('.bz-cinema-ai-guide-title')?.textContent).toContain('AI 正在分析');
    expect(overlay.querySelector('[data-cinema-ai-start]')).toBeTruthy();
    // 分析页：完整版（15 板块）
    (overlay.querySelector('[data-cinema-tool="stat"]') as HTMLElement).click();
    expect(M.view).toBe('stat');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('影视分析');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('类型分布');
    expect(overlay.querySelector('.bz-cinema-page')?.textContent).toContain('年度观影趋势');
  });

  it('添加弹窗（命令直达 + 落盘创建笔记）', async () => {
    const { vault, app } = seedVault();
    openAddModalDirect(app);
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    const modal = mask.querySelector('.bz-overlay-popup') as HTMLElement;
    expect(modal.textContent).toContain('添加影视');
    expect(modal.querySelector('#bz-cinema-f-rating')).toBeTruthy(); // 评分滑杆
    // 填写并保存
    (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value = '新片';
    (modal.querySelector('#bz-cinema-f-review') as HTMLTextAreaElement).value = '好看';
    (modal.querySelector('#bz-cinema-f-save') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0)); // 等异步落盘
    const added = M.items.find((i) => i.name === '新片');
    expect(added).toBeTruthy();
    expect(added?.review).toBe('好看');
    // 落盘：笔记文件已创建，frontmatter 含 tag/评分/影评
    const filePath = '我的/影视/《新片》.md';
    const content = vault.files.get(filePath);
    expect(content).toBeTruthy();
    expect(content).toContain('- 电影');
    expect(content).toContain('评分: 5');
    expect(content).toContain('影评: 好看');
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
});
