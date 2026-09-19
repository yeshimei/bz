import { makeApp } from '../helpers/app';
/**
 * 影院（cinema）UI 层测试：风格化面板（issue 236 / ADR-0103）
 * DOM 与 src/cinema/prototype.html 同构：午夜场 desk（d-rail/d-head/d-tools/grid）
 * / mob（m-head/chips/m-grid）、共享弹窗（cn-modal 详情/表单/确认/设置、cn-menu、cn-sheet）、
 * AI 页（ai-guide/rec-list）、分析页（stat-cards/sec）、gazette/booth 风格分支。
 * 业务回归保留：落盘/改名/tags 落盘/回收站删除/域事件/CM2 重名拦截/CM3 稳定键。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault, parseFrontmatter } from '../mock-vault';
import { resetObsidianMocks, hasNotice, Platform } from '../mock-obsidian-entry';
import { M, resetCinemaState } from '../../src/cinema/state';
import { rebuildItems } from '../../src/cinema/data';
import { runAIRecommend, runSimilarRecommend, quickAddWant, parseRecommendJson } from '../../src/cinema/recommend';
import { createOverlay, closeOverlay, openAddModalDirect, openRandomMovie, renderAll } from '../../src/cinema/ui';
import { ensureCinema, unloadCinema, openCinemaAnalysis, pickRandomCinema } from '../../src/cinema';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { emitDomainEvent, clearDomainEvents, onDomainEvent } from '../../src/core/domain-bus';


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

function seedMobile(): { app: ReturnType<typeof mockAppWithVault> } {
  Platform.isMobile = true;
  const { app } = seedVault();
  return { app };
}

/** 点面板内元素（原生 click 冒泡到 sec 委托） */
function clickEl(el: Element | null | undefined): void {
  expect(el, '目标元素应存在').toBeTruthy();
  (el as HTMLElement).click();
}

function pcardByName(root: HTMLElement, name: string): HTMLElement {
  const card = Array.from(root.querySelectorAll('.pcard')).find((c) => c.querySelector('.pname')?.textContent === name);
  expect(card, `卡片 ${name} 应存在`).toBeTruthy();
  return card as HTMLElement;
}

describe('cinema 风格化面板（issue 236）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    Platform.isMobile = false;
    unloadCinema();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  it('打开主面板（桌面午夜场）：d-rail 品牌/类型/状态/工具 + d-head 标题计数 + 排序 seg + 海报网格', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    const root = overlay.querySelector('section.bz-cinema--midnight') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.dataset.cinemaRoot).toBe('midnight');
    // 左栏：品牌 + 类型行（全部 + 6 组）+ 状态行（3）+ foot 工具 2
    expect(root.querySelector('.rail-brand h1')?.textContent).toBe('影院');
    expect(root.querySelectorAll('.j-groups [data-g]').length).toBe(7);
    expect(root.querySelectorAll('.j-status [data-s]').length).toBe(3);
    expect(root.querySelectorAll('.rail-foot .j-tool').length).toBe(2);
    // 「全部」行默认选中，计数 4
    const allRow = root.querySelector('.j-groups [data-g="全部"]');
    expect(allRow?.classList.contains('is-on')).toBe(true);
    expect(allRow?.querySelector('.n')?.textContent).toBe('4');
    // d-head：标题=全部 + · 4 部 + 添加影片
    expect(root.querySelector('.d-head .j-title')?.textContent).toBe('全部');
    expect(root.querySelector('.d-head .j-cnt')?.textContent).toBe('· 4 部');
    expect(root.querySelector('[data-cinema-add]')?.textContent).toContain('添加影片');
    // d-tools：搜索框 + 排序 seg 三档默认「最近观看」
    expect(root.querySelector('.d-search .j-q')).toBeTruthy();
    expect(root.querySelectorAll('.j-sort button').length).toBe(3);
    expect(root.querySelector('.j-sort button.is-on')?.textContent).toBe('最近观看');
    // 网格：4 卡，列数 CSS 变量来自设置（默认 5）
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(4);
    expect((root.querySelector('.grid') as HTMLElement).style.gridTemplateColumns).toContain('5');
  });

  it('组筛选/状态筛选 + 标题跟随；再点状态取消；「全部」回全', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-g="电影"]'));
    expect(M.typeFilter).toBe('电影');
    expect(root.querySelector('.d-head .j-title')?.textContent).toBe('电影');
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(2); // 星际穿越 + 想看片
    // 状态叠加：标题「电影 · 想看」
    clickEl(root.querySelector('[data-s="想看"]'));
    expect(root.querySelector('.d-head .j-title')?.textContent).toBe('电影 · 想看');
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(1);
    // 再点同状态取消（回电影组全部）
    clickEl(root.querySelector('[data-s="想看"]'));
    expect(M.statusFilter).toBeNull();
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(2);
    // 「全部」行回全
    clickEl(root.querySelector('[data-g="全部"]'));
    expect(M.typeFilter).toBeNull();
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(4);
  });

  it('海报卡：已看无徽章 + 星轨/评分；想看/在看有徽章 + 未评分灰字；稳定键 = 笔记路径（CM3）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const star = pcardByName(root, '星际穿越');
    expect(star.querySelector('.badge')).toBeNull(); // 已看不显示徽章
    expect(star.querySelector('.pstars')?.textContent).toContain('★');
    expect(star.querySelector('.pstars .num')?.textContent).toBe('9.6');
    expect(star.dataset.cinemaKey).toBe('我的/影视/《星际穿越》.md');
    const want = pcardByName(root, '想看片');
    expect(want.querySelector('.badge')?.textContent).toBe('想看');
    expect(want.querySelector('.pstars')?.textContent).toContain('未评分');
    expect(pcardByName(root, '瑞克和莫蒂').querySelector('.badge')?.textContent).toBe('在看');
  });

  it('点海报卡 → 详情弹窗（cn-modal：标题/影评/kv + 找同类/编辑/删除）；✕ 退役，点遮罩可关（issue 271）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '星际穿越'));
    const modal = root.querySelector('.cn-ovl .cn-modal') as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.querySelector('.dm-title')?.textContent).toBe('星际穿越');
    expect(modal.querySelector('.dm-review')?.textContent).toContain('爱是穿越维度');
    expect(modal.textContent).toContain('豆 瓣 信 息');
    expect(modal.querySelector('.dm-kv-k')?.textContent).toBe('导演');
    expect(modal.querySelector('.j-close')).toBeNull(); // issue 271：弹窗右上角关闭钮退役
    expect(modal.querySelector('.j-similar')?.textContent).toContain('找同类');
    expect(modal.querySelector('.j-edit')?.textContent).toContain('编辑');
    expect(modal.querySelector('.j-del')?.textContent).toContain('删除');
    clickEl(root.querySelector('.cn-ovl') as HTMLElement);
    expect(root.querySelector('.cn-ovl')).toBeNull();
  });

  // 确认框收编 core/flow-dialog（一致审查#1）：自绘 .cn-confirm 三段式退役
  it('详情删除 → core 流程框确认（域皮 bz-cinema-flow-dialog + 危险中性）→ 移入回收站（列表减少）', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '想看片'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-del'));
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup).toBeTruthy();
    expect(popup.querySelector('h4')?.textContent).toBe('删除影视');
    expect(popup.textContent).toContain('确定删除「想看片」吗？');
    expect(popup.textContent).toContain('回收站');
    // 域皮类在位（cn-skin 取午夜场调色板）+ 危险主动作中性修饰
    expect(popup.classList.contains('cn-skin')).toBe(true);
    expect(popup.classList.contains('bz-cinema-flow-dialog')).toBe(true);
    expect(popup.classList.contains('bz-flow-dialog--danger')).toBe(true);
    // 效率审查#1：危险主动作不落焦点（焦点反落取消钮，回车不再直通删除）
    expect(document.activeElement).toBe(popup.querySelector('#__shared_confirm_cancel__'));
    const trashSpy = vi.spyOn(app.vault, 'trash').mockResolvedValue(undefined);
    clickEl(popup.querySelector('#__shared_confirm_ok__'));
    await vi.waitFor(() => expect(trashSpy).toHaveBeenCalled());
    await vi.waitFor(() => expect(hasNotice(/已删除「想看片」/)).toBe(true));
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(3);
    expect(M.items.some((i) => i.name === '想看片')).toBe(false);
  });

  it('删除确认取消路径：点取消不删（回收站不动、条目保留、无删除通知）', async () => {
    const { app, vault } = seedVault();
    const trashSpy = vi.spyOn(app.vault, 'trash');
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '想看片'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-del'));
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    clickEl(popup.querySelector('#__shared_confirm_cancel__'));
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeNull());
    expect(trashSpy).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(4);
    expect(M.items.some((i) => i.name === '想看片')).toBe(true);
    expect(hasNotice(/已删除/)).toBe(false);
  });

  // 桌面菜单已统一到 core/item-actions（.bz-item-menu，挂 document.body，皮肤 cn-menu-skin）
  it('右键菜单：动作集按状态显隐；「标记已看」改走编辑窗（预选已看不落盘，保存才写 frontmatter + 域事件）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const menuSel = '.bz-item-menu.cn-menu-skin';
    const ctx = (name: string) =>
      pcardByName(root, name).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    ctx('想看片');
    const menu = document.querySelector(menuSel) as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.classList.contains('cn-skin')).toBe(true); // 取色锚（浮层挂 body，需自带午夜场调色板）
    const labels = Array.from(menu.querySelectorAll('.bz-item-menu-item')).map((b) => b.textContent);
    expect(labels[0]).toContain('打开详情');
    expect(labels.some((l) => l?.includes('标记在看'))).toBe(true);
    expect(labels.some((l) => l?.includes('标记已看'))).toBe(true);
    expect(labels.some((l) => l?.includes('找同类'))).toBe(true);
    expect(labels.some((l) => l?.includes('在豆瓣打开'))).toBe(true);
    expect(labels.some((l) => l?.includes('删除'))).toBe(true);
    // 已看卡：无标记动作项
    ctx('星际穿越');
    const labels2 = Array.from((document.querySelector(menuSel) as HTMLElement).querySelectorAll('.bz-item-menu-item')).map((b) => b.textContent);
    expect(labels2.some((l) => l?.includes('标记在看'))).toBe(false);
    expect(labels2.some((l) => l?.includes('标记已看'))).toBe(false);
    // 想看卡点「标记已看」→ 弹编辑表单（.cn-modal）：状态预选已看 + 评分滑杆预填默认分 + 影评框展开，不直接落盘
    const evts: any[] = [];
    const offMovie = onDomainEvent('movie', (e: any) => evts.push(e));
    const fmBefore = vault.files.get('我的/影视/《想看片》.md');
    ctx('想看片');
    clickEl(Array.from((document.querySelector(menuSel) as HTMLElement).querySelectorAll('.bz-item-menu-item')).find((b) => b.textContent?.includes('标记已看')));
    const form = root.querySelector('.cn-ovl .cn-modal') as HTMLElement;
    expect(form, '标记已看应弹出编辑表单而非直接落盘').toBeTruthy();
    expect(form.querySelector('.cn-modal-title')?.textContent).toBe('编辑影视');
    expect(form.querySelector('[data-f-st="已看"]')?.classList.contains('is-on')).toBe(true);
    expect((form.querySelector('.j-rating') as HTMLElement).style.display).not.toBe('none');
    expect((form.querySelector('.j-review') as HTMLElement).style.display).not.toBe('none');
    expect((form.querySelector('.j-range') as HTMLInputElement).value).toBe('5'); // 想看条目无评分 → 预填默认分
    expect(vault.files.get('我的/影视/《想看片》.md')).toBe(fmBefore);
    expect(evts.length).toBe(0);
    // 用户调整评分、写影评后点保存 → frontmatter 正确 + 域事件（status/rated，小橘行为流承接）
    const range = form.querySelector('.j-range') as HTMLInputElement;
    range.value = '8.8';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    (form.querySelector('.j-review-t') as HTMLTextAreaElement).value = '值得重看';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「/)).toBe(true)); // toast 收编 core notice（一致审查#2）
    const item = M.items.find((i) => i.name === '想看片')!;
    expect(item.status).toBe(2); // STATUS_WATCHED
    expect(item.rating).toBe(8.8);
    expect(item.review).toBe('值得重看');
    const fm = vault.files.get('我的/影视/《想看片》.md')!;
    expect(fm).toContain('评分: 8.8');
    expect(fm).toContain('影评: 值得重看');
    expect(fm).not.toContain('观影日期: 2026-05-01'); // 状态流转刷新观影日期
    expect(evts).toContainEqual(expect.objectContaining({ kind: 'status', name: '想看片', from: 'want', to: 'watched' }));
    expect(evts).toContainEqual(expect.objectContaining({ kind: 'rated', name: '想看片', fromRating: null, toRating: 8.8 }));
    offMovie();
  });

  it('详情 → 编辑弹窗：字段预选当前值，评分滑杆联动读数，保存写回 frontmatter', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    expect((form.querySelector('.j-name') as HTMLInputElement).value).toBe('星际穿越');
    expect(form.querySelector('[data-f-tag="电影"]')?.classList.contains('is-on')).toBe(true);
    expect(form.querySelector('[data-f-st="已看"]')?.classList.contains('is-on')).toBe(true);
    const range = form.querySelector('.j-range') as HTMLInputElement;
    range.value = '7.7';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.querySelector('.j-rval')?.textContent).toBe('7.7');
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「/)).toBe(true)); // toast 收编 core notice（一致审查#2）
    expect(M.items.find((i) => i.name === '星际穿越')!.rating).toBe(7.7);
  });

  // 回归（memo item-1789722741019）：编辑改「想看」保存后弹回在看——想看曾被收集成 null，
  // persistItem `?? 0` 兜底写 0（=在看），落盘自动刷新重解析当场翻回
  it('编辑已看条目改「想看」→ 落盘评分 -1（不再写 0 弹回在看）；重建解析仍想看 + status 域事件', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const evts: any[] = [];
    const offMovie = onDomainEvent('movie', (e: any) => evts.push(e));
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    clickEl(form.querySelector('[data-f-st="想看"]'));
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「/)).toBe(true)); // toast 收编 core notice（一致审查#2）
    const item = M.items.find((i) => i.name === '星际穿越')!;
    expect(item.status).toBe(0); // STATUS_WANT
    expect(item.rating).toBe(-1);
    expect(vault.files.get('我的/影视/《星际穿越》.md')).toContain('评分: -1');
    // 落盘触发自动刷新重解析（同链路 rebuildItems）：评分 -1 → 想看，不再弹回在看
    rebuildItems(app);
    expect(M.items.find((i) => i.name === '星际穿越')!.status).toBe(0);
    // 状态流转域事件语义保留（saveEdit 补发，小橘行为流承接）
    expect(evts).toContainEqual(expect.objectContaining({ kind: 'status', name: '星际穿越', from: 'watched', to: 'want' }));
    offMovie();
  });

  it('新增「想看」条目 → 落盘评分 -1（不再写 0 的在看）；重建解析仍想看', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    expect(form.querySelector('[data-f-st="想看"]')?.classList.contains('is-on')).toBe(true); // 默认想看
    (form.querySelector('.j-name') as HTMLInputElement).value = '想看新片';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《想看新片》.md')).toBe(true));
    expect(vault.files.get('我的/影视/《想看新片》.md')).toContain('评分: -1');
    expect(M.items.find((i) => i.name === '想看新片')!.status).toBe(0); // STATUS_WANT
    rebuildItems(app);
    expect(M.items.find((i) => i.name === '想看新片')!.status).toBe(0); // 重解析仍是想看
  });

  it('编辑改名 → 文件真实重命名落盘（旧路径消失、内存指向新文件）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '瑞克和莫蒂'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '瑞克和莫蒂 第一季';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《瑞克和莫蒂 第一季》.md')).toBe(true));
    expect(vault.files.has('我的/影视/《瑞克和莫蒂》.md')).toBe(false);
  });

  it('编辑改名 → 已存在同名拦截（弹窗留在原地，不落盘）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '瑞克和莫蒂'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '星际穿越';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice('已存在同名影视，请换个名称')).toBe(true)); // toast 收编 core notice（一致审查#2）
    expect(vault.files.has('我的/影视/《瑞克和莫蒂》.md')).toBe(true);
    expect(form.querySelector('.j-name')).toBeTruthy();
  });

  it('编辑改名 → 非法字符拦截（notice 报错，不重命名）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '瑞克和莫蒂'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = 'a/b';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/非法字符/)).toBe(true));
    expect(vault.files.has('我的/影视/《瑞克和莫蒂》.md')).toBe(true);
  });

  it('添加表单：默认想看（评分/影评隐藏）；切已看显隐联动；保存创建笔记 + progress 通知', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    expect(form.querySelector('.cn-modal-title')?.textContent).toBe('添加影视');
    expect((form.querySelector('.j-name') as HTMLInputElement).value).toBe('');
    expect(form.querySelector('[data-f-st="想看"]')?.classList.contains('is-on')).toBe(true);
    expect((form.querySelector('.j-rating') as HTMLElement).style.display).toBe('none');
    expect((form.querySelector('.j-review') as HTMLElement).style.display).toBe('none');
    clickEl(form.querySelector('[data-f-st="已看"]'));
    expect((form.querySelector('.j-rating') as HTMLElement).style.display).not.toBe('none');
    (form.querySelector('.j-name') as HTMLInputElement).value = '新片A';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《新片A》.md')).toBe(true));
    expect(M.items[0].name).toBe('新片A'); // 新增置首
    expect(M.items[0].status).toBe(2);
    await vi.waitFor(() => expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(5)); // renderAll 落地
  });

  it('CM2：新增重名拦截（不落盘不留幽灵条目）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '星际穿越';
    clickEl(form.querySelector('[data-f-st="已看"]'));
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice('已存在同名影视，请换个名称')).toBe(true)); // toast 收编 core notice（一致审查#2）
    expect(M.items.filter((i) => i.name === '星际穿越').length).toBe(1);
    void vault;
  });

  it('搜索过滤：防抖后局部刷新计数与网格', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const input = root.querySelector('.j-q') as HTMLInputElement;
    input.value = '瑞克';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(1), { timeout: 2000 });
    expect(root.querySelector('.d-head .j-cnt')?.textContent).toBe('· 1 部');
  });

  it('排序 seg 切换：按评分 → 高分在前', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(Array.from(root.querySelectorAll('.j-sort button')).find((b) => b.textContent === '按评分'));
    expect(M.sortMode).toBe('rating');
    expect(root.querySelector('.d-scroll .pcard .pname')?.textContent).toBe('星际穿越');
    expect(root.querySelector('.j-sort button.is-on')?.textContent).toBe('按评分');
  });

  it('AI 页按需触发：切页不自动发请求；j-back 回列表；工具再点回列表（toggle）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="ai"]'));
    expect(M.view).toBe('ai');
    expect(M.aiRunning).toBe(false);
    expect(root.querySelector('.sp-head .sp-title')?.textContent).toBe('AI 荐片');
    expect(root.querySelector('[data-cinema-ai-start]')?.textContent).toContain('开始推荐');
    clickEl(root.querySelector('.j-back'));
    expect(M.view).toBe('list');
    expect(root.querySelector('.d-head')).toBeTruthy();
    clickEl(root.querySelector('[data-tool="ai"]'));
    expect(M.view).toBe('ai');
    clickEl(root.querySelector('[data-tool="ai"]'));
    expect(M.view).toBe('list');
  });

  it('进 AI/分析页 rail 整体熄灭（含「全部」）；返回恢复先前选中高亮（桌面）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    // 先选中类型 + 状态（剧集 + 已看 → 状态行高亮）
    clickEl(root.querySelector('[data-g="剧集"]'));
    clickEl(root.querySelector('[data-s="已看"]'));
    expect(root.querySelector('.rail-item.is-on')?.textContent).toContain('已看');
    // 进 AI 页：筛选状态保留，rail 整组熄灭、一个 is-on 都不留
    clickEl(root.querySelector('[data-tool="ai"]'));
    expect(M.view).toBe('ai');
    expect(M.typeFilter).toBe('剧集');
    expect(M.statusFilter).toBe('已看');
    expect(root.querySelector('.rail-item.is-on')).toBeNull();
    // 返回：先前选中的高亮原样恢复
    clickEl(root.querySelector('.j-back'));
    expect(M.view).toBe('list');
    expect(root.querySelector('.rail-item.is-on')?.textContent).toContain('已看');
    // 分析页同样熄灭，返回恢复
    clickEl(root.querySelector('[data-tool="stat"]'));
    expect(M.view).toBe('stat');
    expect(root.querySelector('.rail-item.is-on')).toBeNull();
    clickEl(root.querySelector('.j-back'));
    expect(root.querySelector('.rail-item.is-on')?.textContent).toContain('已看');
  });

  it('AI 结果页：已在库中禁用 + 豆瓣外链 + 换一批；等待页文案', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="ai"]'));
    M.aiResult = [
      { title: '星际穿越', type: '电影', director: '诺兰', reason: '同偏好' },
      { title: '新片X', type: '电影', director: '', reason: '' },
    ];
    M.renderFn?.();
    expect(root.querySelectorAll('.rec-list .rec-card').length).toBe(2);
    const inlib = Array.from(root.querySelectorAll('.rec-add')).find((b) => b.textContent === '已在库中') as HTMLButtonElement;
    expect(inlib.disabled).toBe(true);
    const addBtn = Array.from(root.querySelectorAll('.rec-add')).find((b) => b.textContent === '＋ 想看') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(false);
    const link = root.querySelector('.rec-name a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://movie.douban.com/search?q=' + encodeURIComponent('星际穿越'));
    expect(root.querySelector('.j-ai-more')?.textContent).toContain('换一批');
    M.aiRunning = true;
    M.aiWaitMsg = 'AI 正在分析你的观影口味…';
    M.renderFn?.();
    expect(root.querySelector('.ai-guide .ai-title')?.textContent).toContain('正在分析');
    M.aiRunning = false;
    M.aiResult = null;
    M.renderFn?.();
  });

  it('错误页「重试」按基准分流：找同类失败重试仍找同类；荐片失败重试仍是荐片', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'test-key' }));
    resetAIProviderCache();
    setApp(app);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no net')));
    const { requestUrl } = await import('obsidian');
    (requestUrl as any).mockResolvedValue({ status: 200, text: 'nope' });

    const base = M.items.find((i) => i.name === '星际穿越')!;
    await runSimilarRecommend(base, app);
    expect(M.aiError).toContain('AI 分析失败');
    expect(root.querySelector('[data-cinema-ai-start]')?.textContent).toContain('重试');
    clickEl(root.querySelector('[data-cinema-ai-start]'));
    expect(M.aiBase?.name).toBe('星际穿越');
    await vi.waitFor(() => expect(M.aiRunning).toBe(false));

    await runAIRecommend(app);
    expect(M.aiError).toContain('AI 分析失败');
    clickEl(root.querySelector('[data-cinema-ai-start]'));
    expect(M.aiBase).toBeNull();
    await vi.waitFor(() => expect(M.aiRunning).toBe(false));
  });

  it('AI 结果「＋想看」：经 quickAddWant 落盘想看笔记（vault 自动刷新链回列表）', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="ai"]'));
    M.aiResult = [{ title: '推荐新片', type: '电影', reason: '' }];
    M.renderFn?.();
    clickEl(root.querySelector('.rec-add'));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《推荐新片》.md')).toBe(true));
    emitDomainEvent('vault:md-created', { path: '我的/影视/《推荐新片》.md' });
    await vi.waitFor(() => {
      const btn = Array.from(root.querySelectorAll('.rec-add')).find((b) => b.textContent === '已在库中') as HTMLButtonElement | undefined;
      expect(btn?.disabled).toBe(true); // 自动刷新后同名推荐置已在库中（闭环）
    });
  });

  it('分析页：sp-head 观影分析 + 4 统计卡 + 19 板块 + 空态带动作', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="stat"]'));
    expect(M.view).toBe('stat');
    expect(root.querySelector('.sp-head .sp-title')?.textContent).toBe('观影分析');
    expect(root.querySelector('.sp-cnt')?.textContent).toBe('· 2 部已看');
    expect(root.querySelectorAll('.stat-card').length).toBe(4);
    expect(root.querySelectorAll('.sec').length).toBe(19);
    expect(root.querySelector('.stat-cards')?.textContent).toContain('馆藏总数');
    // 空库：引导 + 添加直达
    closeOverlay();
    const app2 = makeApp(new MockVault());
    ensureCinema(app2);
    rebuildItems(app2);
    createOverlay(app2);
    openCinemaAnalysis(app2);
    const root2 = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root2.querySelector('.cn-empty-page')?.textContent).toContain('还没有可统计的影视记录');
    clickEl(root2.querySelector('[data-cinema-analysis-add]'));
    expect(root2.querySelector('.cn-modal .j-name')).toBeTruthy();
    closeOverlay();
  });

  it('openCinemaAnalysis 直达：未开面板 → 开并落分析页；已开列表 → 同一 overlay 就地切', () => {
    const { app } = seedVault();
    openCinemaAnalysis(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(M.view).toBe('stat');
    expect(overlay.querySelector('.sp-head .sp-title')?.textContent).toBe('观影分析');
    clickEl(overlay.querySelector('.j-back'));
    expect(M.view).toBe('list');
    openCinemaAnalysis(app);
    expect(M.view).toBe('stat');
    expect(document.querySelector('.bz-panel-overlay')).toBe(overlay);
  });

  it('openAddModalDirect 命令直达：未开面板先建面板再开表单', () => {
    const { app } = seedVault();
    openAddModalDirect(app);
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    expect(document.querySelector('.cn-modal .j-name')).toBeTruthy();
    closeOverlay();
  });

  it('topifyZ 动态发号；ESC 先关弹窗后关面板；点遮罩关面板', () => {
    const { app } = seedVault();
    createOverlay(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    const root = overlay.querySelector('[data-cinema-root]') as HTMLElement;
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(0);
    clickEl(root.querySelector('[data-cinema-add]'));
    expect(root.querySelector('.cn-modal')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.querySelector('.cn-modal')).toBeNull();
    expect(M.currentOverlay).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(M.currentOverlay).toBeNull();
    createOverlay(app);
    const overlay2 = document.querySelector('.bz-panel-overlay') as HTMLElement;
    overlay2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(M.currentOverlay).toBeNull();
  });

  it('关闭面板复位视图：AI 页不跨开合残留', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="ai"]'));
    expect(M.view).toBe('ai');
    closeOverlay();
    createOverlay(app);
    expect(M.view).toBe('list');
    expect(document.querySelector('[data-cinema-root] .d-head')).toBeTruthy();
    closeOverlay();
  });

  it('分析页打开期间 vault 变更自动刷新（300ms 防抖后重算）', async () => {
    const { vault, app } = seedVault();
    openCinemaAnalysis(app);
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay.querySelector('.sp-cnt')?.textContent).toBe('· 2 部已看');
    vault.files.set('我的/影视/《新片》.md', md(`---
tags: [电影]
评分: 8
观影日期: 2026-08-02
---`));
    emitDomainEvent('vault:md-created', { path: '我的/影视/《新片》.md' });
    await vi.waitFor(() => expect(overlay.querySelector('.sp-cnt')?.textContent).toBe('· 3 部已看'));
  });

  // ======================= 移动端（mob 壳） =======================

  it('移动端：mob 壳渲染（m-head 添加/AI/分析/关闭 + chips 10 + m-grid）', () => {
    setSettingsProvider(() => ({  } as any));
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.querySelectorAll('.m-acts .m-tool').length).toBe(3); // AI/分析/关闭（设置钮退役，添加钮为 .add）
    expect(root.querySelector('.j-mclose')).toBeTruthy(); // 落域适配：移动关闭钮
    expect(root.querySelectorAll('.m-chips .chip').length).toBe(10);
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(4);
    expect(root.querySelector('.j-mtitle')?.textContent).toBe('全部');
    expect(root.querySelector('.j-mcnt')?.textContent).toBe('· 4');
    expect(document.querySelector('.d-rail')).toBeNull(); // 按端渲染其一
  });

  it('移动端 chip 切换 + ✦ 再点回列表（落域适配）+ ✕ 关闭', () => {
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    clickEl(root.querySelector('.chip[data-c="剧集"]'));
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(1);
    expect(root.querySelector('.j-mtitle')?.textContent).toBe('剧集');
    clickEl(root.querySelector('.j-mai'));
    expect(root.querySelector('.j-mview')?.classList.contains('sp-body')).toBe(true);
    clickEl(root.querySelector('.j-mai'));
    expect(root.querySelector('.j-mview')?.classList.contains('m-scroll')).toBe(true);
    clickEl(root.querySelector('.j-mclose'));
    expect(M.currentOverlay).toBeNull();
  });

  it('移动端进 AI/分析页 chips 整体熄灭（含「全部」）；再点回列表恢复先前高亮（与桌面同口径）', () => {
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    clickEl(root.querySelector('.chip[data-c="剧集"]'));
    expect(root.querySelector('.chip.is-on')?.textContent).toContain('剧集');
    // 分析页：筛选状态保留，chips 整条熄灭
    clickEl(root.querySelector('.j-mstat'));
    expect(M.view).toBe('stat');
    expect(M.typeFilter).toBe('剧集');
    expect(root.querySelector('.chip.is-on')).toBeNull();
    clickEl(root.querySelector('.j-mai'));
    expect(root.querySelector('.chip.is-on')).toBeNull();
    // 再点回列表：先前选中的高亮原样恢复
    clickEl(root.querySelector('.j-mai'));
    expect(M.view).toBe('list');
    expect(root.querySelector('.chip.is-on')?.textContent).toContain('剧集');
  });

  // 回归（2026-09-10 真机反馈）：AI 荐片/观影分析页点 chips 无反应——chips 行在移动壳里常驻，
  // 但 chip 分支唯独没复位 M.view，筛选改了而页面仍停在 AI/分析页。
  it('移动端：AI/分析页点 chips 回落海报列表（类型与状态两条路径）', () => {
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    // AI 页 → 点类型 chip
    clickEl(root.querySelector('.j-mai'));
    expect(M.view).toBe('ai');
    clickEl(root.querySelector('.chip[data-c="剧集"]'));
    expect(M.view).toBe('list');
    expect(root.querySelector('.j-mview')?.classList.contains('m-scroll')).toBe(true);
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(1);
    // 分析页 → 点状态 chip（进 ai/stat 不清筛选；chip 点击回落列表并叠加所选状态）
    clickEl(root.querySelector('.j-mstat'));
    expect(M.view).toBe('stat');
    clickEl(root.querySelector('.chip[data-s="已看"]'));
    expect(M.view).toBe('list');
    expect(root.querySelectorAll('.m-grid .pcard').length).toBe(1); // 剧集 ∩ 已看 = 绝命毒师（类型筛选被保留）
  });

  it('移动端搜索：防抖全刷 + 标题/计数联动', async () => {
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    const input = root.querySelector('.j-mq') as HTMLInputElement;
    input.value = '绝命';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll('.m-grid .pcard').length).toBe(1), { timeout: 2000 });
    expect(root.querySelector('.j-mcnt')?.textContent).toBe('· 1');
  });

  // 抽屉已统一到 core/item-actions（.bz-item-sheet，挂 document.body，皮肤 cn-sheet-skin）；
  // 手势 = core/dom.longPress（touchstart 被动监听，500ms）。
  it('移动端长按 → core 底部抽屉（头=名称+meta，动作项按状态）；越过静置窗口后遮罩点击关闭', () => {
    vi.useFakeTimers();
    try {
      const { app } = seedMobile();
      createOverlay(app);
      const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
      const card = root.querySelector('.m-grid .pcard') as HTMLElement;
      card.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(600); // core longPress 500ms 阈值
      const sheet = document.querySelector('.bz-item-sheet.cn-sheet-skin') as HTMLElement;
      expect(sheet).toBeTruthy();
      expect(sheet.classList.contains('cn-skin')).toBe(true); // 取色锚（浮层挂 body，需自带午夜场调色板）
      expect(sheet.querySelector('.cn-sheet-name')).toBeTruthy();
      expect(sheet.querySelectorAll('.bz-item-sheet-item').length).toBeGreaterThanOrEqual(4);
      // 长按松手会补发一次合成 click：core 的静置窗口（400ms）内吞掉，防「抽屉刚开就被自己关掉」。
      // 窗口内点遮罩不生效 → 正是真机「长按没反应」的根因守卫。
      (document.querySelector('.bz-item-sheet-mask') as HTMLElement).click();
      expect(document.querySelector('.bz-item-sheet'), '静置窗口内遮罩点击应被吞').toBeTruthy();
      vi.advanceTimersByTime(500); // 越过静置窗口
      (document.querySelector('.bz-item-sheet-mask') as HTMLElement).click();
      expect(document.querySelector('.bz-item-sheet')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // 「标记已看」改走编辑窗（memo item-1789105594322）：抽屉与右键菜单同源动作集，移动端同语义
  it('移动端长按抽屉点「标记已看」→ 编辑表单预选已看不落盘；保存后状态流转', async () => {
    vi.useFakeTimers();
    try {
      const { app } = seedMobile();
      createOverlay(app);
      const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
      const card = Array.from(root.querySelectorAll('.m-grid .pcard')).find((c) => c.querySelector('.pname')?.textContent === '想看片') as HTMLElement;
      card.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(600); // core longPress 500ms 阈值 → 抽屉打开
      const sheet = document.querySelector('.bz-item-sheet.cn-sheet-skin') as HTMLElement;
      expect(sheet).toBeTruthy();
      const markBtn = Array.from(sheet.querySelectorAll('.bz-item-sheet-item')).find((b) => b.textContent?.includes('标记已看')) as HTMLElement;
      expect(markBtn).toBeTruthy();
      vi.advanceTimersByTime(500); // 越过合成 click 静置窗口（窗口内点击会被吞）
      clickEl(markBtn);
      const form = root.querySelector('.cn-ovl .cn-modal') as HTMLElement;
      expect(form, '抽屉标记已看应弹出编辑表单而非直接落盘').toBeTruthy();
      expect(form.querySelector('[data-f-st="已看"]')?.classList.contains('is-on')).toBe(true);
      expect((form.querySelector('.j-range') as HTMLInputElement).value).toBe('5');
      expect(M.items.find((i) => i.name === '想看片')!.status).toBe(0); // 想看未变：不直接改状态
      // 保存 → 状态流转落盘
      (form.querySelector('.j-review-t') as HTMLTextAreaElement).value = '抽屉路径影评';
      clickEl(form.querySelector('.j-save'));
      await vi.waitFor(() => {
        const it = M.items.find((i) => i.name === '想看片')!;
        expect(it.status).toBe(2);
        expect(it.review).toBe('抽屉路径影评');
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // 回归（2026-09-10 真机反馈）：触屏长按会同时发 touchstart 与 contextmenu，桌面右键菜单
  // 不分流就会多弹一个鼠标菜单；移动端长按只应出抽屉。
  it('移动端：长按 + contextmenu 同发时只出抽屉，不出桌面跟手菜单', () => {
    vi.useFakeTimers();
    try {
      const { app } = seedMobile();
      createOverlay(app);
      const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
      const card = root.querySelector('.m-grid .pcard') as HTMLElement;
      const r = card.getBoundingClientRect();
      // 真机触屏长按的真实事件序列：touchstart →(500ms)→ contextmenu
      card.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(600);
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 20 }));
      expect(document.querySelector('.bz-item-sheet'), '抽屉应在').toBeTruthy();
      expect(document.querySelector('.bz-item-menu'), '移动端不应出桌面跟手菜单').toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('移动端头行钮序：添加最前、关闭最后，设置钮退役（影院设置并入插件设置页）', () => {
    const { app } = seedMobile();
    createOverlay(app);
    const root = document.querySelector('section.mob.bz-cinema--midnight') as HTMLElement;
    const acts = [...root.querySelectorAll('.m-acts button')];
    expect(acts.map((b) => b.className)).toEqual([
      'add j-madd bz-touch-target bz-touch-target--lg',
      'm-tool j-mai bz-touch-target bz-touch-target--lg',
      'm-tool j-mstat bz-touch-target bz-touch-target--lg',
      'm-tool j-mclose bz-touch-target bz-touch-target--lg',
    ]);
    expect(root.querySelector('.j-mgear')).toBeNull();
  });

  it('非法 cinemaStyle 回默认午夜场（风格键扩展口，本批仅午夜场上岸）', () => {
    setSettingsProvider(() => ({ cinemaStyle: 'nope' } as any));
    const { app } = seedVault();
    createOverlay(app);
    expect(document.querySelector('section.bz-cinema--midnight')).toBeTruthy();
  });
});

describe('G7：快速标记落盘失败回滚', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
  });
  afterEach(() => {
    unloadCinema();
    vi.restoreAllMocks();
  });

  it('标记「在看」persistItem 失败 → 内存状态回滚（面板与磁盘一致）', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const want = M.items.find((i) => i.name === '想看片')!;
    const prevStatus = want.status;
    const prevRating = want.rating;
    const prevDate = want.watchDate;
    const spy = vi.spyOn(app.fileManager, 'processFrontMatter').mockRejectedValue(new Error('磁盘占用'));
    const menuSel = '.bz-item-menu.cn-menu-skin';
    pcardByName(root, '想看片').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })
    );
    clickEl(
      Array.from((document.querySelector(menuSel) as HTMLElement).querySelectorAll('.bz-item-menu-item')).find(
        (b) => b.textContent?.includes('标记在看')
      )
    );
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    // 旧缺陷：先改内存再落盘、失败不回滚（saveEdit 有回滚此处没有）→ 面板显示与磁盘相反
    expect(want.status).toBe(prevStatus);
    expect(want.rating).toBe(prevRating);
    expect(want.watchDate).toBe(prevDate);
  });
});

/**
 * 补扫 C 回归：「随机抽一部」面板已开时只 createOverlay 不 renderAll——
 * pickRandomCinema 把 M.view 回落 list 后画面还停在旧 ai/stat 页，详情弹窗叠在
 * 旧页上、状态与画面错位。修法对齐 openCinemaAnalysis 样板：已开先 renderAll 再 openDetail。
 */
describe('补扫 C：随机抽一部（已开面板先整刷再叠详情）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    Platform.isMobile = false;
    unloadCinema();
    document.body.innerHTML = '';
  });

  it('面板已开且停在分析页：先整刷回落列表页再叠详情（不叠旧 stat 页）', () => {
    const { app } = seedVault();
    createOverlay(app);
    // 模拟用户停在分析页
    M.view = 'stat';
    renderAll(app);
    const root0 = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root0.querySelector('.sp-body')).toBeTruthy(); // 分析页在
    expect(root0.querySelector('.d-scroll')).toBeNull();

    // 想看池只有《想看片》→ 抽取确定
    pickRandomCinema(app);

    expect(M.view).toBe('list');
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root.querySelector('.d-scroll .pcard')).toBeTruthy(); // 列表页已渲染
    expect(root.querySelector('.sp-body')).toBeNull(); // 旧分析页已被整刷掉
    expect(root.querySelector('.cn-modal')).toBeTruthy(); // 详情弹窗叠在列表页上
    expect(hasNotice(/抽到「想看片」/)).toBe(true);
  });

  it('面板未开：冷开面板落列表页再叠详情（原有口径不变）', () => {
    const { app } = seedVault();
    openRandomMovie(app);
    expect(M.view).toBe('list');
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root.querySelector('.d-scroll .pcard')).toBeTruthy();
    expect(root.querySelector('.cn-modal')).toBeTruthy();
  });
});

/**
 * 剧集按季合并（issue 376 / ADR-0168）：设置开 → 渲染层分组出一张合集卡 + 季进度条（D1），
 * 点合集卡开各季明细、点某一季钻进单季详情；关 → 逐季一卡（现状不动）。
 * 计数口径随卡片走（rail「全部/剧集」= 卡片数，不是笔记数）——否则「点了对不上」。
 */
describe('cinema 剧集按季合并（issue 376）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    Platform.isMobile = false;
    unloadCinema();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  /** 老友记三季（已看/在看/想看）+ 一部电影 = 4 篇笔记 */
  function seedSeasons(): { app: ReturnType<typeof mockAppWithVault> } {
    const vault = new MockVault();
    vault.files.set('我的/影视/《老友记 第一季》.md', md(`---
tags: [美剧]
评分: 9.2
观影日期: 2026-06-18
主演: 詹妮弗·安妮斯顿
导演: 大卫·克拉尼
---`));
    vault.files.set('我的/影视/《老友记 第二季》.md', md(`---
tags: [美剧]
评分: 0
观影日期: 2026-08-18
---`));
    vault.files.set('我的/影视/《老友记 第三季》.md', md(`---
tags: [美剧]
评分: -1
观影日期:
---`));
    vault.files.set('我的/影视/《奥本海默》.md', md(`---
tags: [电影]
评分: 9
观影日期: 2026-09-01
---`));
    const app = makeApp(vault);
    ensureCinema(app);
    rebuildItems(app);
    return { app };
  }

  it('关掉开关：逐季一卡（现状不变）', () => {
    setSettingsProvider(() => ({}) as any);
    const { app } = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(4);
    expect(root.querySelectorAll('.pcard-series').length).toBe(0);
    expect(root.querySelectorAll('.season-dots').length).toBe(0);
  });

  it('开启：三季合成一张合集卡（进度条 3 段 + 在看注释），计数随卡片走', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(2); // 老友记合集 + 奥本海默
    const series = root.querySelector('.pcard-series') as HTMLElement;
    expect(series).toBeTruthy();
    expect(series.dataset.cinemaKey).toBe('series:剧集:老友记');
    expect(series.querySelector('.pname')?.textContent).toBe('老友记'); // 标题 = 归一名称
    // 季圆点：贴在**海报区内**（左下角 CSS 定位），一个圆点 = 一季，金/橙/空三态
    const dots = Array.from(series.querySelectorAll('.pw .season-dots i'));
    expect(dots.map((s) => s.className)).toEqual(['watched', 'watching', 'empty']);
    expect(series.querySelector('.bar-note')).toBeNull(); // 注释行已按用户要求去掉
    expect(series.querySelectorAll('.pw').length).toBe(1);
    expect(series.querySelector('.badge')?.textContent).toBe('在看'); // 聚合角标：任一看在 → 在看
    // 计数口径：rail 与头行都按卡片数（不是 4 篇笔记）
    expect(root.querySelector('.d-head .j-cnt')?.textContent).toBe('· 2 部');
    expect(root.querySelector('[data-g="全部"] .n')?.textContent).toBe('2');
    expect(root.querySelector('[data-g="剧集"] .n')?.textContent).toBe('1');
    expect(root.querySelector('[data-g="电影"] .n')?.textContent).toBe('1');
  });

  it('点合集卡开各季明细；点某一季关掉合集、钻进单季详情', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('.pcard-series'));
    let modal = root.querySelector('.cn-modal') as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.querySelector('.dm-title')?.textContent).toContain('老友记');
    expect(modal.querySelector('.dm-n')?.textContent).toBe('共 3 季');
    const rows = Array.from(modal.querySelectorAll('.s-row'));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.querySelector('.s-name')?.textContent)).toEqual(['老友记 第一季', '老友记 第二季', '老友记 第三季']);
    expect(rows[0].querySelector('.s-rate')?.textContent).toBe('9.2');
    expect(rows[2].querySelector('.s-rate')?.textContent).toBe('—'); // 想看季无评分
    expect(modal.querySelector('.dm-actions')).toBeNull(); // 合集上不落单季动作

    clickEl(rows[1]);
    modal = root.querySelector('.cn-modal') as HTMLElement;
    expect(root.querySelectorAll('.cn-modal')).toHaveLength(1); // 合集弹窗已关，只留单季详情
    expect(modal.querySelector('.dm-title')?.textContent).toBe('老友记 第二季');
    expect(modal.querySelectorAll('.s-row')).toHaveLength(0); // 单季详情不再有季明细行
    expect(modal.querySelector('.dm-actions')).toBeTruthy(); // 单季详情才有 找同类/编辑/删除
  });

  it('合集卡右键 → 只有「查看全部」一条（点它开合集弹窗），不像单卡那样出笔记级动作', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const series = root.querySelector('.pcard-series') as HTMLElement;
    series.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    // 合集上不放标记/编辑/删除（都是笔记级动作，卡片没有具体条目可指）
    expect(menuLabels(menu)).toEqual(['查看全部']);
    expect(root.querySelectorAll('.s-row')).toHaveLength(0); // 右键不再直接开合集弹窗
    clickEl(menuBtn(menu, '查看全部'));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(root.querySelectorAll('.s-row')).toHaveLength(3);
  });

  /** 老友记两季（已看 9.2 / 在看 0）+ 电影版特别篇 = 3 篇笔记 → 合并后 1 张合集卡 */
  function seedSpecial(): { app: ReturnType<typeof mockAppWithVault> } {
    const vault = new MockVault();
    vault.files.set('我的/影视/《老友记 第一季》.md', md('---\ntags: [美剧]\n评分: 9.2\n观影日期: 2026-06-18\n---'));
    vault.files.set('我的/影视/《老友记 第二季》.md', md('---\ntags: [美剧]\n评分: 0\n观影日期: 2026-08-18\n---'));
    vault.files.set('我的/影视/《老友记：重聚特辑》.md', md('---\ntags: [电影]\n评分: 8.6\n观影日期: 2026-09-19\n---'));
    const app = makeApp(vault);
    ensureCinema(app);
    rebuildItems(app);
    return { app };
  }

  const menuLabels = (menu: HTMLElement): (string | null)[] =>
    [...menu.querySelectorAll('.bz-item-menu-label')].map((x) => x.textContent);
  const menuBtn = (menu: HTMLElement, label: string): HTMLElement =>
    [...menu.querySelectorAll<HTMLElement>('.bz-item-menu-item')].find((b) => b.textContent?.includes(label)) as HTMLElement;

  it('合并卡弹窗：特别篇单列一段（不进季圆点、不单独出卡），点特别篇行钻该条详情', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSpecial();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    // 特别篇被并入合集：网格只有 1 张卡，季圆点仍只算季（2 个）
    expect(root.querySelectorAll('.d-scroll .pcard')).toHaveLength(1);
    expect(root.querySelectorAll('.season-dots i')).toHaveLength(2);
    clickEl(root.querySelector('.pcard-series'));
    const modal = () => root.querySelector('.cn-modal') as HTMLElement;
    expect(modal().querySelector('.dm-n')?.textContent).toBe('共 2 季 · 1 部电影');
    const spRow = modal().querySelector('.s-row-special') as HTMLElement;
    expect(spRow).toBeTruthy();
    expect(spRow.querySelector('.s-name')?.textContent).toBe('老友记：重聚特辑');
    expect(spRow.querySelector('.s-sub')?.textContent).toContain('电影'); // 标出组：看着不像「某一季」
    expect(spRow.querySelector('.s-rate')?.textContent).toBe('8.6');
    expect(modal().querySelectorAll('.s-row')).toHaveLength(3); // 季行与特别篇行同构
    clickEl(spRow);
    expect(root.querySelectorAll('.cn-modal')).toHaveLength(1);
    expect(modal().querySelector('.dm-title')?.textContent).toBe('老友记：重聚特辑');
    expect(modal().querySelector('.dm-actions')).toBeTruthy(); // 单条详情才有 找同类/编辑/删除
  });

  it('弹窗季行右键 → 该季跟手菜单（弹窗留着）；点动作先收弹窗再执行', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSpecial();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('.pcard-series'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.s-row'));
    expect(rows.map((r) => r.querySelector('.s-name')?.textContent))
      .toEqual(['老友记 第一季', '老友记 第二季', '老友记：重聚特辑']);
    rows[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    // 动作集 = **第二季** 的（在看 → 无「标记在看」，有「标记已看」）
    expect(menuLabels(menu)).toEqual(['打开详情', '标记已看', '找同类', '在豆瓣打开', '编辑', '删除']);
    // 菜单是独立浮层：弹窗留着（ESC / 点外部关掉菜单后还能接着操作别的季）
    expect(root.querySelectorAll('.s-row')).toHaveLength(3);
    clickEl(menuBtn(menu, '编辑'));
    expect(document.querySelector('.bz-item-menu')).toBeNull();
    expect(root.querySelectorAll('.s-row')).toHaveLength(0); // 动作前先收弹窗
    expect((root.querySelector('.j-name') as HTMLInputElement).value).toBe('老友记 第二季');
  });

  it('弹窗特别篇行右键 → 出的是该特别篇的动作（行级落点按行取条目，不是某一季）', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSpecial();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('.pcard-series'));
    const spRow = root.querySelector('.s-row-special') as HTMLElement;
    spRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 60, clientY: 60 }));
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    // 已看 + 有评分：无「标记在看 / 标记已看」
    expect(menuLabels(menu)).toEqual(['打开详情', '找同类', '在豆瓣打开', '编辑', '删除']);
    clickEl(menuBtn(menu, '编辑'));
    expect((root.querySelector('.j-name') as HTMLInputElement).value).toBe('老友记：重聚特辑');
  });

  it('移动端：季行右键只拦原生菜单（不出桌面菜单）；长按出抽屉且弹窗不关，点动作才收', () => {
    vi.useFakeTimers();
    try {
      setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
      Platform.isMobile = true;
      const { app } = seedSpecial();
      createOverlay(app);
      const root = document.querySelector('section.mob[data-cinema-root]') as HTMLElement;
      clickEl(root.querySelector('.m-grid .pcard-series'));
      const row = root.querySelector('.s-row') as HTMLElement;
      expect(row).toBeTruthy();
      // 真机触屏长按会同时发 contextmenu：只应拦住原生菜单
      const ctx = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 });
      row.dispatchEvent(ctx);
      expect(ctx.defaultPrevented).toBe(true);
      expect(document.querySelector('.bz-item-menu'), '移动端不出桌面跟手菜单').toBeNull();

      row.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(600); // core longPress 500ms 阈值 → 抽屉
      const sheet = document.querySelector('.bz-item-sheet.cn-sheet-skin') as HTMLElement;
      expect(sheet).toBeTruthy();
      expect(sheet.querySelector('.cn-sheet-name')?.textContent).toBe('老友记 第一季');
      // 弹窗必须留着：longPress 靠元素级捕获吞长按后的合成 click，元素一被移除，合成 click 落到
      // document 层就被当成「外部点击」→ 抽屉开出即关（真机「长按没反应」根因守卫）
      expect(root.querySelectorAll('.s-row'), '长按开抽屉时弹窗不能关').toHaveLength(3);
      (document.querySelector('.bz-item-sheet-mask') as HTMLElement).click();
      expect(document.querySelector('.bz-item-sheet'), '静置窗口内合成 click 应被吞，抽屉留住').toBeTruthy();
      vi.advanceTimersByTime(500); // 越过静置窗口
      const edit = [...sheet.querySelectorAll<HTMLElement>('.bz-item-sheet-item')]
        .find((b) => b.textContent?.includes('编辑')) as HTMLElement;
      clickEl(edit);
      expect(document.querySelector('.bz-item-sheet')).toBeNull();
      expect(root.querySelectorAll('.s-row')).toHaveLength(0); // 动作前先收弹窗
      expect((root.querySelector('.j-name') as HTMLInputElement).value).toBe('老友记 第一季');
    } finally {
      vi.useRealTimers();
    }
  });

  it('移动端长按合集卡 → 抽屉只有「查看全部」（头 = 剧名 + 共 N 季 · M 部电影）', () => {
    vi.useFakeTimers();
    try {
      setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
      Platform.isMobile = true;
      const { app } = seedSpecial();
      createOverlay(app);
      const root = document.querySelector('section.mob[data-cinema-root]') as HTMLElement;
      const card = root.querySelector('.m-grid .pcard-series') as HTMLElement;
      card.dispatchEvent(new Event('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(600); // core longPress 500ms 阈值 → 抽屉
      const sheet = document.querySelector('.bz-item-sheet.cn-sheet-skin') as HTMLElement;
      expect(sheet).toBeTruthy();
      // 头部指卡片自身（归一剧名 + 计数），不是某一季；动作只有一条
      expect(sheet.querySelector('.cn-sheet-name')?.textContent).toBe('老友记');
      expect(sheet.querySelector('.cn-sheet-sub')?.textContent).toBe('共 2 季 · 1 部电影');
      expect([...sheet.querySelectorAll('.bz-item-sheet-label')].map((x) => x.textContent)).toEqual(['查看全部']);
      expect(root.querySelectorAll('.s-row')).toHaveLength(0); // 长按不再直接开合集弹窗
      vi.advanceTimersByTime(500); // 越过合成 click 静置窗口
      clickEl(sheet.querySelector('.bz-item-sheet-item'));
      expect(document.querySelector('.bz-item-sheet')).toBeNull();
      expect(root.querySelectorAll('.s-row')).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('鼠标落在季圆点上：卡片正脸换成该季（海报 + 名字/meta/星级），离开复原', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    const { app } = seedSeasons();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const series = root.querySelector('.pcard-series') as HTMLElement;
    const dots = Array.from(series.querySelectorAll<HTMLElement>('.pw .season-dots i'));
    expect(dots).toHaveLength(3);
    // 静息态：正脸 = 最近看的那季（第二季 08-18），名字是归一名称、评分取最新已评季（9.2）
    expect(series.querySelector('.pname')?.textContent).toBe('老友记');
    expect(series.querySelector('.pstars')?.textContent).toContain('9.2');
    expect(series.querySelector('.pw .pw-face')).toBeTruthy(); // 海报内芯独立包裹层
    expect(series.querySelector('.pw-face .season-dots')).toBeNull(); // 圆点是它的兄弟，换脸不会碰掉

    // 悬浮第 3 枚（想看季，无评分）→ 换脸
    dots[2].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(series.querySelector('.pname')?.textContent).toBe('老友记 第三季');
    expect(series.querySelector('.pstars')?.textContent).toContain('未评分');
    expect(series.classList.contains('is-peek')).toBe(true);
    expect(series.querySelectorAll('.pw .season-dots i')).toHaveLength(3); // 圆点原地不动

    // 离开 → 回快照（不是重算：合并卡正脸口径与单季不同）
    dots[2].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(series.querySelector('.pname')?.textContent).toBe('老友记');
    expect(series.querySelector('.pstars')?.textContent).toContain('9.2');
    expect(series.classList.contains('is-peek')).toBe(false);
  });

  it('移动端不挂悬浮换脸（触屏 tap 只发 mouseover 不发 mouseout，换脸会滞留）', () => {
    setSettingsProvider(() => ({ cinemaMergeSeasons: true } as any));
    Platform.isMobile = true;
    const vault = new MockVault();
    vault.files.set('我的/影视/《老友记 第一季》.md', md('---\ntags: [美剧]\n评分: 9.2\n观影日期: 2026-06-18\n---'));
    vault.files.set('我的/影视/《老友记 第二季》.md', md('---\ntags: [美剧]\n评分: 0\n观影日期: 2026-08-18\n---'));
    const app = makeApp(vault);
    ensureCinema(app);
    rebuildItems(app);
    createOverlay(app);
    const root = document.querySelector('section.mob[data-cinema-root]') as HTMLElement;
    const dot = root.querySelector<HTMLElement>('.m-grid .season-dots i');
    expect(dot).toBeTruthy();
    dot!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(root.querySelector('.pcard-series')?.classList.contains('is-peek')).toBe(false);
  });
});

/**
 * 深审修复批 A（写路径与 ui 行为）回归：
 * P2-1 建档影评经 processFrontMatter 写入 / P2-2 非已看态影评保留 / P2-3 review 域事件 /
 * P2-4 桌面搜索空态回焦 / P2-5 搜索 ESC 二段清词 / P2-6 renderAll 滚位记忆 /
 * P3-7 三入口非法字符校验 / P3-8 建档日期引号 / P3-9 openDouban 走 openExternalUrl /
 * P3-10 closeOverlay 收口弹窗层 / P3-11 改名半失败回滚 / P3-13 表单 Enter 提交 /
 * P3-14 list 页惰性构建 / P3-15 parseRecommendJson 围栏放宽
 */
describe('深审批A：写路径与 ui 行为回归', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetCinemaState();
    clearDomainEvents();
    M.folderPath = '我的/影视';
    document.body.innerHTML = '';
  });
  afterEach(() => {
    Platform.isMobile = false;
    unloadCinema();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  // P2-1：建档模板只写最小安全集，影评走 processFrontMatter 同通道——多行/含「: 」的影评
  // 裸拼模板会写破 YAML → 影片从面板黏性消失、豆瓣 sweep 永不补抓（mock fail-closed 后旧实现必红）
  it('P2-1：建档写多行影评 → frontmatter 可解析、重开面板影片可见且影评完整', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    clickEl(form.querySelector('[data-f-st="已看"]'));
    (form.querySelector('.j-name') as HTMLInputElement).value = '多行影评片';
    (form.querySelector('.j-review-t') as HTMLTextAreaElement).value = '第一幕: 开场\n第二幕: 高潮 #好';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《多行影评片》.md')).toBe(true));
    const content = vault.files.get('我的/影视/《多行影评片》.md')!;
    // P3-8：建档日期双引号（裸日期真机被 YAML 解析成 timestamp → Moment → 英文星期）
    expect(content).toContain('观影日期: "');
    // 模板本身无影评裸值 + 影评经 processFrontMatter 写入 → YAML 整体合法
    const fm = parseFrontmatter(content);
    expect(fm, 'frontmatter 应可解析（多行/含「: 」影评不再写破 YAML）').toBeTruthy();
    expect(fm!['影评']).toBe('第一幕: 开场\n第二幕: 高潮 #好');
    // 模拟重开面板（清内存从盘解析）：破 FM 下真机影片黏性消失、sweep 永不补抓
    resetCinemaState();
    M.folderPath = '我的/影视';
    rebuildItems(app);
    const it = M.items.find((i) => i.name === '多行影评片');
    expect(it, '重建后影片应可见').toBeTruthy();
    expect(it!.review).toBe('第一幕: 开场\n第二幕: 高潮 #好');
  });

  // P2-2：非「已看」态保留原影评不写空（空影评在已看态显式清空保存 = 显式删除，语义不变）
  it('P2-2：编辑已看影片改回想看/在看保存 → 影评保留不静默清空；已看态清空影评仍可显式删除', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    let form = root.querySelector('.cn-modal') as HTMLElement;
    clickEl(form.querySelector('[data-f-st="在看"]'));
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「/)).toBe(true));
    const item = M.items.find((i) => i.name === '星际穿越')!;
    expect(item.status).toBe(1); // STATUS_WATCHING
    // 旧缺陷：表单强置 review='' + persistItem delete fm['影评'] → 影评静默清空
    expect(item.review).toBe('爱是穿越维度的唯一力量');
    expect(vault.files.get('我的/影视/《星际穿越》.md')).toContain('影评: 爱是穿越维度的唯一力量');
    // 已看态影评框清空 → 保存 = 显式删除（FM 影评键移除）
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    form = root.querySelector('.cn-modal') as HTMLElement;
    clickEl(form.querySelector('[data-f-st="已看"]'));
    (form.querySelector('.j-review-t') as HTMLTextAreaElement).value = '';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(M.items.find((i) => i.name === '星际穿越')!.review).toBe(''));
    expect(vault.files.get('我的/影视/《星际穿越》.md')).not.toContain('影评');
  });

  // P2-3：影评写/改/删补发 review 域事件（契约与文案层俱在唯缺 emitter）；无变化不发
  it('P2-3：编辑写/改影评 → movie 域 review 事件（fromReview/toReview）；影评不变时零噪音', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const evts: any[] = [];
    const offMovie = onDomainEvent('movie', (e: any) => evts.push(e));
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-review-t') as HTMLTextAreaElement).value = '新影评文本';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「/)).toBe(true));
    expect(evts).toContainEqual(
      expect.objectContaining({ kind: 'review', name: '星际穿越', fromReview: '爱是穿越维度的唯一力量', toReview: '新影评文本' })
    );
    // 再保存一次（影评不变）：不补发 review 事件
    const reviewCount = evts.filter((e) => e.kind === 'review').length;
    clickEl(pcardByName(root, '星际穿越'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/已保存「星际穿越」/)).toBe(true));
    expect(evts.filter((e) => e.kind === 'review').length).toBe(reviewCount);
    offMovie();
  });

  // P2-4：桌面搜索空态整刷重建工具行，焦点跨过空态落 body → 后续输入无效
  it('P2-4：桌面搜索整刷出空态后焦点回到搜索框且光标在尾', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const input = root.querySelector('.j-q') as HTMLInputElement;
    input.focus();
    input.value = '库里有也搜不到的片名xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelector('.cn-empty-page')).toBeTruthy(), { timeout: 2000 });
    const q = root.querySelector('.j-q') as HTMLInputElement;
    expect(document.activeElement, '空态整刷后焦点应回到搜索框').toBe(q);
    expect(q.selectionStart).toBe(q.value.length);
    expect(q.selectionEnd).toBe(q.value.length);
  });

  // P2-5：搜索框 ESC 二段清词——有词先清词（回焦不断打字），无词放行关面板语义不变
  it('P2-5：搜索框有词 ESC → 只清词不关面板且焦点回框；无词 ESC → 放行关面板', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const input = root.querySelector('.j-q') as HTMLInputElement;
    input.value = '瑞克';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(1), { timeout: 2000 });
    (root.querySelector('.j-q') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(M.searchKeyword).toBe('');
    expect(M.currentOverlay, '有词 ESC 不应关面板').not.toBeNull();
    await vi.waitFor(() => expect(root.querySelectorAll('.d-scroll .pcard').length).toBe(4));
    expect(document.activeElement).toBe(root.querySelector('.j-q'));
    // 无词放行：keydown 不被消费，冒泡到 escManager 关面板
    (root.querySelector('.j-q') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(M.currentOverlay).toBeNull();
  });

  // P2-6：renderAll 整写 innerHTML 销毁滚动容器——渲染前存 scrollTop、渲染后恢复
  it('P2-6：renderAll 前后 d-scroll/m-scroll 滚位保持（标记/保存/筛选不再跳顶）', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    (root.querySelector('.d-scroll') as HTMLElement).scrollTop = 240;
    renderAll(app);
    expect((root.querySelector('.d-scroll') as HTMLElement).scrollTop).toBe(240);
    // mob 壳同口径
    Platform.isMobile = true;
    closeOverlay();
    createOverlay(app);
    const mobRoot = document.querySelector('section.mob[data-cinema-root]') as HTMLElement;
    (mobRoot.querySelector('.m-scroll') as HTMLElement).scrollTop = 120;
    renderAll(app);
    expect((mobRoot.querySelector('.m-scroll') as HTMLElement).scrollTop).toBe(120);
  });

  // P3-7：非法字符三入口统一校验（原只有编辑改名把关）
  it('P3-7：新增建档名称含非法字符 → 拦截不落盘；AI ＋想看同名拦截', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '非法/片名';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(hasNotice(/非法字符/)).toBe(true));
    expect(vault.files.has('我的/影视/《非法/片名》.md')).toBe(false);
    expect(root.querySelector('.cn-modal .j-name'), '弹窗留在原地').toBeTruthy();
    // quickAddWant 入口（AI title 不受控）
    await quickAddWant(app, '坏:名字', '电影');
    expect(hasNotice(/非法字符/)).toBe(true);
    expect(vault.files.has('我的/影视/《坏:名字》.md')).toBe(false);
  });

  // P3-9：openDouban 走 core openExternalUrl 单源（私有裸 window.open + try/catch 退役）
  it('P3-9：菜单「在豆瓣打开」→ openExternalUrl 链路（window.open 收到豆瓣搜索地址）', async () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as any);
    pcardByName(root, '想看片').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })
    );
    const menu = document.querySelector('.bz-item-menu.cn-menu-skin') as HTMLElement;
    clickEl(Array.from(menu.querySelectorAll('.bz-item-menu-item')).find((b) => b.textContent?.includes('在豆瓣打开')));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(String(openSpy.mock.calls[0][0])).toContain('movie.douban.com');
    expect(String(openSpy.mock.calls[0][0])).toContain(encodeURIComponent('想看片'));
  });

  // P3-10：关面板统一结算活跃弹窗层（ESC 层固定 id + closeOverlay 遍历句柄）
  it('P3-10：closeOverlay 收口面板内弹窗（cn-ovl 无残留），重开面板行为正常', () => {
    const { app } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    expect(root.querySelector('.cn-ovl .cn-modal')).toBeTruthy();
    closeOverlay();
    expect(document.querySelectorAll('.cn-ovl').length).toBe(0);
    createOverlay(app);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(M.currentOverlay).toBeNull();
  });

  // P3-11：改名半失败（renameFile 成功、processFrontMatter 失败）→ renameFile 回旧路径
  it('P3-11：改名半失败 → 文件回滚到旧路径、内存条目与文件一致', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    const spy = vi.spyOn(app.fileManager, 'processFrontMatter').mockRejectedValue(new Error('磁盘占用'));
    clickEl(pcardByName(root, '瑞克和莫蒂'));
    clickEl((root.querySelector('.cn-modal') as HTMLElement).querySelector('.j-edit'));
    const form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '瑞克和莫蒂 第二季';
    clickEl(form.querySelector('.j-save'));
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(vault.files.has('我的/影视/《瑞克和莫蒂》.md'), '改名应回滚到旧路径').toBe(true);
    expect(vault.files.has('我的/影视/《瑞克和莫蒂 第二季》.md')).toBe(false);
    const it = M.items.find((i) => i.name === '瑞克和莫蒂');
    expect(it, '内存条目应回滚旧名').toBeTruthy();
    expect(it!.file?.path).toBe('我的/影视/《瑞克和莫蒂》.md');
    expect(hasNotice(/保存失败/)).toBe(true);
  });

  // P3-13：表单 Enter 提交（core bindFormSubmit）——名称框纯 Enter 直存，Ctrl+Enter 恒提交
  it('P3-13：表单名称框 Enter 提交建档；影评框 Ctrl+Enter 恒提交', async () => {
    const { app, vault } = seedVault();
    createOverlay(app);
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-cinema-add]'));
    let form = root.querySelector('.cn-modal') as HTMLElement;
    const nameInput = form.querySelector('.j-name') as HTMLInputElement;
    nameInput.value = '回车新片';
    nameInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《回车新片》.md')).toBe(true));
    // 影评 textarea 聚焦时 Ctrl+Enter 恒提交（纯 Enter 换行不拦由 core 契约保证）
    clickEl(root.querySelector('[data-cinema-add]'));
    form = root.querySelector('.cn-modal') as HTMLElement;
    (form.querySelector('.j-name') as HTMLInputElement).value = '组合键影片';
    clickEl(form.querySelector('[data-f-st="已看"]'));
    const review = form.querySelector('.j-review-t') as HTMLTextAreaElement;
    review.value = '组合键写的影评';
    review.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(vault.files.has('我的/影视/《组合键影片》.md')).toBe(true));
    expect(M.items.find((i) => i.name === '组合键影片')!.review).toBe('组合键写的影评');
  });

  // P3-14：list 页不预算 AI 页/分析页两份大字符串（分析页 19 板块全量统计），进页才构建
  it('P3-14：list 页惰性构建——buildAnalysisHTML 仅在进分析页时调用', async () => {
    const analysisMod = await import('../../src/cinema/analysis');
    const spy = vi.spyOn(analysisMod, 'buildAnalysisHTML');
    const { app } = seedVault();
    createOverlay(app);
    expect(spy).not.toHaveBeenCalled();
    const root = document.querySelector('[data-cinema-root]') as HTMLElement;
    clickEl(root.querySelector('[data-tool="stat"]'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll('.sec').length).toBe(19); // 分析页内容不受惰性影响
    clickEl(root.querySelector('.j-back'));
    expect(M.view).toBe('list');
  });

  // P3-15：parseRecommendJson 围栏放宽——裸 ``` 与任意语言标注均可解析
  it('P3-15：parseRecommendJson 兼容裸 ``` 围栏与任意语言标注', () => {
    const data = [{ title: 'A', type: '电影' }];
    expect(parseRecommendJson('```json\n' + JSON.stringify(data) + '\n```')).toEqual(data); // 既有口径
    expect(parseRecommendJson('```\n' + JSON.stringify(data) + '\n```')).toEqual(data); // 裸围栏（AI 实测会出）
    expect(parseRecommendJson('```JSON\n' + JSON.stringify(data) + '\n```')).toEqual(data); // 大写标注
    expect(parseRecommendJson('```text\n' + JSON.stringify(data) + '\n```')).toEqual(data); // 其他标注
  });
});
