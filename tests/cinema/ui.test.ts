/**
 * 影院（cinema）UI 层测试：overlay 打开/渲染/筛选交互/详情弹窗/快速状态窗/ESC
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
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
    // 评分滑杆存在（组件库 .bz-range 自绘外观）
    expect(modal.querySelector('#bz-cinema-qs-rating')).toBeTruthy();
    expect((modal.querySelector('#bz-cinema-qs-rating') as HTMLElement).classList.contains('bz-range')).toBe(true);
    // 影评 textarea（.bz-field 字段行：label 上置，不与 textarea 同排）
    expect(modal.querySelector('#bz-cinema-qs-review')).toBeTruthy();
    expect(modal.querySelector('.bz-cinema-qs-review .bz-field-label')?.textContent).toBe('影评');
    // 目标状态按钮为平铺单选（组件库 .bz-choice），默认选中第一项
    expect(modal.querySelector('.bz-cinema-qs-btns .bz-choice-btn.is-on')?.getAttribute('data-value')).toBe('在看');
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

  it('AI 荐片（点击后页内等待态）/ 分析页切换', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    // 点 AI 工具 → 立即切 AI 页，等待消息就地在页内显示（不弹窗）
    (overlay.querySelector('[data-cinema-tool="ai"]') as HTMLElement).click();
    expect(M.view).toBe('ai');
    expect(M.aiRunning).toBe(true);
    // 无任何弹窗
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
    // 等 runAIRecommend 结束（无 provider → aiError 置位，仍在页内）
    await new Promise((r) => setTimeout(r, 0));
    expect(M.aiRunning).toBe(false);
    expect(document.querySelector('.bz-overlay-mask')).toBeNull();
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
    expect((modal.querySelector('#bz-cinema-f-rating') as HTMLElement).classList.contains('bz-range')).toBe(true);
    // 字段行 = .bz-field（label 上置，不与控件同排）；类型/状态 = 平铺单选 .bz-choice（非下拉）
    // 需求：不显示观影日期（6 字段 → 5：名称/类型/状态/评分/影评）
    expect(modal.querySelectorAll('.bz-cinema-form .bz-field')).toHaveLength(5);
    expect(modal.querySelector('#bz-cinema-f-date')).toBeNull();
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
    // 需求：选「想看」→ 评分与影评隐藏（状态联动）
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
    expect(hasNotice('已保存')).toBe(true);
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
    expect(hasNotice('已保存')).toBe(false);
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
    expect(hasNotice('已保存')).toBe(false);
  });

  it('删除失败 → 报错并保留条目（不摘列表、不假报成功）', async () => {
    const { vault, app } = seedVault();
    // Windows 文件被占用场景：vault.delete 抛错
    (vault as any).delete = async () => { throw new Error('EBUSY: resource busy'); };
    createOverlay(app);
    const overlay = document.querySelector('.bz-cinema-overlay') as HTMLElement;
    const card = overlay.querySelector('[data-cinema-idx]') as HTMLElement;
    card.click();
    const mask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (mask.querySelector('[data-cinema-dm-del]') as HTMLElement).click();
    const confirmMask = document.querySelector('.bz-overlay-mask') as HTMLElement;
    (confirmMask.querySelector('#bz-cinema-d-del') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    // 条目仍在列表，文件未删；报错而非「影视已删除」
    expect(overlay.querySelectorAll('[data-cinema-idx]').length).toBe(4);
    expect(vault.files.has('我的/影视/《星际穿越》.md')).toBe(true);
    expect(hasNotice(/删除失败/)).toBe(true);
    expect(hasNotice('影视已删除')).toBe(false);
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
});
