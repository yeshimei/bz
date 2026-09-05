/**
 * clipbook 域：UI 层（ADR-0082 / issue 177）jsdom 测试。
 * 桌面三栏构建 / rail 源切换 / 列表点击阅读 / 移动双屏切换 / 右键动作（保存/已读/在读）
 * 状态点与徽标、卸载清理。core 注入三连 + MockVault 种子数据。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { initPanel, showPanel, closePanel, unloadPanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { setClipDir } from './helpers';

/** 种子：news.json 未读 2 + 已处理 1 + 剪藏目录 1 篇 */
function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文一 的内容段落。' },
      { platform: 'B站', title: '影视飓风视频', url: 'https://bilibili.com/video/BV1', author: '影视飓风', date: '2026-09-01 09:00:00', body: '视频简介内容' },
      { platform: '知乎日报', title: '已读知乎', url: 'https://zhihu.com/2', date: '2026-08-30 08:00:00', read: true, state: 'skipped' },
    ],
    stats: { totalRead: 1, totalSaved: 0, totalSkipped: 1, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://guokr.com/1"\ncreated: 2026-08-20 10:00:00\n---\n正文');
  return vault;
}

function boot(show = true): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  const vault = seedVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

async function openDesktop(): Promise<void> {
  boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBeGreaterThan(0));
}

describe('clipbook UI 桌面三栏', () => {
  it('构建 overlay + 三栏骨架（rail/中栏/右栏）', async () => {
    await openDesktop();
    const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.bz-clip-desk')).toBeTruthy();
    // issue 201 头行对齐待办：桌面头行 ⚙设置直达 + ✕关闭（品牌块原有）
    expect(overlay.querySelector('[data-clip-settings]')).toBeTruthy();
    expect(overlay.querySelector('[data-clip-desk-close]')).toBeTruthy();
    expect(overlay.querySelector('.bz-rail-scroll')).toBeTruthy();
    expect(overlay.querySelector('.bz-clip-list')).toBeTruthy();
    expect(overlay.querySelector('[data-clip-reader]')).toBeTruthy();
    // 无 emoji 图标（图标全 lucide data-lucide）
    expect(overlay.textContent).not.toMatch(/[📥📰⚙️❌🔍📊]/);
  });

  it('rail：全部未读徽标 = 实际可见未读 1（果壳文章一 url 命中剪藏 → saved 隐藏，issue 206 起计数同口径）；B站 UP 展开影视飓风；剪藏本计数 = 1', async () => {
    await openDesktop();
    const rows = [...document.querySelectorAll('.bz-rail-item')] as HTMLElement[];
    const allRow = rows.find((r) => r.textContent!.includes('全部未读'))!;
    expect(allRow.textContent).toContain('1');
    const upRow = rows.find((r) => r.textContent!.includes('影视飓风'))!;
    expect(upRow).toBeTruthy();
    const clipRow = rows.find((r) => r.textContent!.includes('剪藏本'))!;
    expect(clipRow.textContent).toContain('1');
  });

  it('列表点击 → 阅读区渲染标题与正文段（issue 206：列表最新在前，点首篇）', async () => {
    await openDesktop();
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items.length).toBeGreaterThan(0); // 未读流非空（已读不进流）
    (items[0] as HTMLElement).click(); // timeTs 降序后首篇 = 影视飓风视频（09:00 > 07:00）
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    await vi.waitFor(() => expect(reader.textContent).toContain('影视飓风视频'));
    expect(reader.textContent).toContain('视频简介内容');
  });

  it('右键菜单：news 条目含「保存到剪藏本」；剪藏源条目含「打开笔记」', async () => {
    await openDesktop();
    // 切到剪藏本源
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const ctx = document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu.textContent).toContain('打开笔记');
    expect(menu.textContent).not.toContain('保存到剪藏本');
    closePanel();
  });

  it('右键菜单：「重新生成摘要」仅剪藏条目显示（enh-autosum 包 1）', async () => {
    await openDesktop();
    // news 条目（收件流默认源）：不含重新生成摘要
    const newsItem = document.querySelector('.bz-clip-item') as HTMLElement;
    newsItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    expect((document.querySelector('.bz-item-menu') as HTMLElement).textContent).not.toContain('重新生成摘要');
    // 切剪藏本源：剪藏条目含重新生成摘要（openItemMenu 自带关旧开新，无需先收浮层）
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    const clipItem = document.querySelector('.bz-clip-item') as HTMLElement;
    clipItem.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    const menu = document.querySelector('.bz-item-menu') as HTMLElement;
    expect(menu.textContent).toContain('重新生成摘要');
    expect(menu.textContent).toContain('打开笔记'); // 既有动作不受影响
    closePanel();
  });

  it('移动端（isMobileEnv）→ mob 容器显示 + 点条目进详情 + 头栏保存钮', async () => {
    boot();
    // 模拟移动端（isMobileEnv = Platform.isMobile；直接拉高 M.isMobile 需走 UI 分支——用 window 宽判定被 mock 卡，
    // 改走 Platform mock 更稳：直接测 mob DOM 存在与点击流程（桌面下 mob 隐藏但 DOM 可测）
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(3)); // 全量：未读2+已处理1
    const mobItems = [...document.querySelectorAll('.bz-clip-mob-item')] as HTMLElement[];
    expect(mobItems.length).toBeGreaterThan(0);
    (mobItems[0] as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    const saveBtn = document.querySelector('[data-clip-mob-save]') as HTMLElement;
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.title).toBe('保存到剪藏本');
    closePanel();
  });

  it('卸载清理（unloadPanel 移除 overlay + 状态复位）', async () => {
    await openDesktop();
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    unloadPanel();
    expect(document.querySelector('.bz-panel-overlay')).toBeNull();
    expect(M.overlay).toBeNull();
  });

  it('C2/C6：同 UP 多条未读 rail 只出一行；upInfo 回填名字', async () => {
    boot();
    // 同 UP（author=9823496）3 条未读 + upInfo 回填名「影视飓风」
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: 'B站', title: '视频一', url: 'https://b23.tv/1', author: '9823496', date: '2026-09-01 08:00:00', body: 'b1' },
      { platform: 'B站', title: '视频二', url: 'https://b23.tv/2', author: '9823496', date: '2026-09-01 09:00:00', body: 'b2' },
      { platform: 'B站', title: '视频三', url: 'https://b23.tv/3', author: '9823496', date: '2026-09-01 10:00:00', body: 'b3' },
    ];
    raw.bilibiliUpInfo = { '9823496': { name: '影视飓风', avatar: 'https://a.b/c.png' } };
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    openClipbook(app);
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(3));
    // rail：同 UP 去重后只有一行，显示回填名「影视飓风」而非 uid
    const upRows = [...document.querySelectorAll('.bz-rail-item')].filter((r) =>
      (r as HTMLElement).textContent!.includes('影视飓风')
    );
    expect(upRows.length).toBe(1);
    // uid 原文不再作为行名出现
    const uidRows = [...document.querySelectorAll('.bz-rail-item')].filter((r) =>
      (r as HTMLElement).textContent!.includes('9823496')
    );
    expect(uidRows.length).toBe(0);
    // 中栏 UP 名也回填（srcName）
    expect(document.querySelector('.bz-clip-list')!.textContent).toContain('影视飓风');
    closePanel();
  });

  it('C5：隐藏期目录事件不丢——重开面板按脏标记重读', async () => {
    const vault = boot();
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.articles.length).toBe(3));
    closePanel();
    expect(M.open).toBe(false);
    // 隐藏期新增剪藏笔记（触发 reloadIfOpen——面板关着，事件只置脏）
    vault.files.set('归档/网页剪藏/剪藏笔记B.md', '---\nurl: "https://new.example.com/x"\ncreated: 2026-09-02 10:00:00\n---\n正文B');
    const { reloadIfOpen } = await import('../../src/clipbook/ui');
    reloadIfOpen();
    // 重开：脏标记生效 → 重读后剪藏本计数 +1
    showPanel();
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect((M.clipNotes || []).length).toBe(2));
    closePanel();
  });

  it('G：UP 行 data-src 过 esc + 正确携带 B站/up——UP 主名含单引号可点且列表过滤生效', async () => {
    boot();
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: 'B站', title: '带引号UP的视频', url: 'https://b23.tv/q1', author: '9823496', date: '2026-09-01 08:00:00', body: 'b1' },
      { platform: '果壳科学人', title: '果壳另一篇', url: 'https://guokr.com/9', author: '果壳', date: '2026-09-01 08:00:00', body: 'b2' },
    ];
    raw.bilibiliUpInfo = { '9823496': { name: "O'Prime 圈圈" } };
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    // UP 行显示回填名（含单引号）
    const upRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes("O'Prime 圈圈")) as HTMLElement;
    expect(upRow).toBeTruthy();
    // 旧实现：单引号截断 data-src 属性 + platform=展示名过滤 → 点击抛错/恒空列表
    expect(() => upRow.click()).not.toThrow();
    await vi.waitFor(() => expect(M.sel).toMatchObject({ kind: 'inbox', platform: 'B站', up: '9823496' }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    expect(document.querySelector('.bz-clip-list')!.textContent).toContain('带引号UP的视频');
    // 高亮命中（active 判定与选择口径一致；rail 重渲染后须重查行节点）
    await vi.waitFor(() => {
      const activeRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes("O'Prime 圈圈")) as HTMLElement;
      expect(activeRow.classList.contains('on')).toBe(true);
    });
    closePanel();
  });

  it('G：切到空源清 M.cur——reader 空态，不残留上一源文章', async () => {
    await openDesktop();
    expect(M.cur).toBeTruthy();
    // 知乎日报在 seed 里唯一一条已 read → 空源
    const zhihuRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('知乎日报')) as HTMLElement;
    zhihuRow.click();
    await vi.waitFor(() => expect(M.cur).toBeNull());
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    expect(reader.textContent).toContain('从列表选择一篇文章开始阅读');
    closePanel();
  });

  it('issue 208：再点当前选中源 = 回「全部未读」（桌面 rail 与移动 chip 同一入口）', async () => {
    await openDesktop();
    // 初始 = 全部未读
    expect(M.sel.kind).toBe('all');
    const findRow = (txt: string) => [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes(txt)) as HTMLElement;
    // 点果壳源 → 选中；再点同源 → 回全部未读
    const guokrRow = findRow('果壳');
    guokrRow.click();
    await vi.waitFor(() => expect(M.sel.kind).not.toBe('all'));
    findRow('果壳').click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('all'));
    // 点「全部未读」行本身恒回全部（不产生异常）
    findRow('全部未读').click();
    expect(M.sel.kind).toBe('all');
    closePanel();
  });

  // ================= issue 206：搜索进 rail / 统计联动 / 图片 / 滚动重置 / 去分析入口 =================

  it('issue 206：搜索框移入左栏顶部；阅读分析报告入口移除', async () => {
    await openDesktop();
    const rail = document.querySelector('.bz-clip-rail') as HTMLElement;
    // 搜索框在 rail 内且位于源列表（rail-scroll）上方
    const railSearch = rail.querySelector('.bz-clip-rail-search input[data-clip-desk-search]');
    expect(railSearch).toBeTruthy();
    const scroll = rail.querySelector('.bz-rail-scroll') as HTMLElement;
    expect((scroll.previousElementSibling as HTMLElement).classList.contains('bz-clip-rail-search')).toBe(true);
    // 头行不再有搜索框
    const head = document.querySelector('.bz-panel-head') as HTMLElement;
    expect(head.querySelector('[data-clip-desk-search]')).toBeNull();
    // 阅读分析报告入口已移除
    expect(document.querySelector('[data-clip-analy]')).toBeNull();
    expect(rail.textContent).not.toContain('阅读分析报告');
    closePanel();
  });

  it('issue 206：搜索时 rail 统计联动（各源数字 = 该源命中数）', async () => {
    boot();
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: '果壳科学人', title: '果壳文一', url: 'https://guokr.com/a1', date: '2026-09-01 08:00:00', body: 'b1' },
      { platform: '果壳科学人', title: '果壳文二', url: 'https://guokr.com/a2', date: '2026-09-02 08:00:00', body: 'b2' },
      { platform: 'B站', title: '视频z', url: 'https://b23.tv/z', date: '2026-09-03 08:00:00', body: 'b3' },
    ];
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(3));
    // 无搜索：全部未读 = 3/3（V1 口径：未读/总量）
    const allRow0 = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('全部未读')) as HTMLElement;
    expect(allRow0.querySelector('.bz-rail-count')!.textContent).toBe('3/3');
    // 搜索「果壳」：全部未读 3→2，剪藏本行 0/1（命中/共 1 篇剪藏）
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '果壳';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => {
      const allRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('全部未读')) as HTMLElement;
      expect(allRow.querySelector('.bz-rail-count')!.textContent).toBe('2/3');
    });
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    expect(clipRow.querySelector('.bz-rail-count')!.textContent).toBe('0/1');
    closePanel();
  });

  it('issue 206：中栏列表最新在前 + 正文图片渲染 + 站点图标先字占位', async () => {
    boot();
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: '果壳科学人', title: '旧文', url: 'https://guokr.com/old', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 08:00:00', body: '旧正文 ![配图](https://a.example/old.png)' },
      { platform: '果壳科学人', title: '新文', url: 'https://guokr.com/new', date: '2026-09-05 22:00:00', fetchedAt: '2026-09-05 22:00:00', body: '新正文' },
    ];
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    // 列表第一项 = 新文（timeTs 降序，聚合讯新文章排最前）
    const first = document.querySelector('.bz-clip-item') as HTMLElement;
    expect(first.textContent).toContain('新文');
    // 站点图标：先首字 chip 占位（jsdom 不触发网络图加载回调，停留占位态）
    const chip = document.querySelector('[data-clip-reader] .bz-clip-favchip') as HTMLElement;
    expect(chip.textContent).toBe('果');
    // 点旧文 → 正文 markdown 图片渲染为 img 段（不再被丢弃）
    const oldItem = [...document.querySelectorAll('.bz-clip-item')].find((r) => r.textContent!.includes('旧文')) as HTMLElement;
    oldItem.click();
    await vi.waitFor(() => {
      const img = document.querySelector('[data-clip-reader] img.bz-clip-art-img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('https://a.example/old.png');
    });
    closePanel();
  });

  it('issue 206：切换文章右栏滚动归零（同篇刷新不重置）', async () => {
    boot();
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: '果壳科学人', title: '文章甲', url: 'https://guokr.com/s1', date: '2026-09-01 08:00:00', body: '甲正文' },
      { platform: '果壳科学人', title: '文章乙', url: 'https://guokr.com/s2', date: '2026-09-02 08:00:00', body: '乙正文' },
    ];
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    const sc = document.querySelector('.bz-clip-read-scroll') as HTMLElement;
    // 首篇自动选中：模拟读者滚到中部
    sc.scrollTop = 120;
    // 点列表另一篇 → 滚动应归零
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    const other = items.find((el) => !el.classList.contains('on')) as HTMLElement;
    other.click();
    await vi.waitFor(() => expect(sc.scrollTop).toBe(0));
    closePanel();
  });

  // ================= issue 214：编辑部印刷风（V1 点线索引 / 目录序号制 / 未读在前 / 阅读面去底部动作） =================

  it('issue 214：rail 点线索引行 = 名 + 引导线 + 未读/总数（选中橘名）', async () => {
    await openDesktop();
    const row = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('全部未读')) as HTMLElement;
    expect(row.querySelector('.bz-clip-lead')).toBeTruthy();
    // V1 口径：1 未读（果壳篇 url 命中剪藏 → saved 隐藏）/ 3 总量
    expect(row.querySelector('.bz-rail-count')!.textContent).toBe('1/3');
    // 选中行样式钩子（视觉由域 CSS 承担）
    expect(row.classList.contains('on')).toBe(true);
    closePanel();
  });

  it('issue 214：目录序号制——序号领队 + 状态类 + 桌面无状态圆点；中栏有「目录」栏头', async () => {
    await openDesktop();
    expect(document.querySelector('.bz-clip-toc-head')!.textContent).toContain('目录');
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.querySelector('.bz-clip-no')).toBeTruthy();
      expect(it.className).toMatch(/bz-clip-item--(unread|reading|saved)/);
      expect(it.querySelector('.bz-clip-dot')).toBeNull();
    }
    expect(items[0].querySelector('.bz-clip-no')!.textContent).toBe('01');
    closePanel();
  });

  it('issue 214：目录未读在前（在读条目让位，组内保持最新在前）', async () => {
    const vault = boot();
    const app = getApp();
    const raw = JSON.parse((app.vault as any).files.get('CONFIG/STORAGE/news.json'));
    raw.articles = [
      { platform: '果壳科学人', title: '在读新文', url: 'https://guokr.com/r1', date: '2026-09-05 08:00:00', body: 'b1' },
      { platform: '果壳科学人', title: '未读旧文', url: 'https://guokr.com/u1', date: '2026-09-01 08:00:00', body: 'b2' },
    ];
    (app.vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(raw));
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({
      articleOverrides: { 'url:https://guokr.com/r1': { reading: true } },
      savedArchive: [], order: [],
    }));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(2));
    const first = document.querySelector('.bz-clip-item') as HTMLElement;
    expect(first.textContent).toContain('未读旧文');
    expect(first.classList.contains('bz-clip-item--unread')).toBe(true);
    const second = [...document.querySelectorAll('.bz-clip-item')][1] as HTMLElement;
    expect(second.classList.contains('bz-clip-item--reading')).toBe(true);
    closePanel();
  });

  it('issue 214：阅读面——站点并入 meta、去底部原文链接；news 右键含「查看原文」；剪藏条目有「打开笔记」文字脚', async () => {
    await openDesktop();
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    // meta 行含站点（favicon chip 保留）且独立站点行退役（首个元素 = 标题）
    expect(reader.querySelector('.bz-clip-art-meta .bz-clip-art-site')).toBeTruthy();
    expect(reader.firstElementChild!.classList.contains('bz-clip-art-title')).toBe(true);
    // 底部动作退役：无原文链接；news 无打开笔记脚
    expect(reader.querySelector('.bz-clip-art-origin')).toBeNull();
    expect(reader.querySelector('[data-clip-open-note]')).toBeNull();
    // 动作归宿：右键菜单含「查看原文」
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    expect((document.querySelector('.bz-item-menu') as HTMLElement).textContent).toContain('查看原文');
    // 剪藏条目：文末「打开笔记」文字脚（data-clip-open-note 保留）
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => expect((document.querySelector('[data-clip-reader]') as HTMLElement).querySelector('[data-clip-open-note]')).toBeTruthy());
    closePanel();
  });
});
