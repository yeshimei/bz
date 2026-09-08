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
    // issue 214 三轮用户拍板：头行去 ⚙/✕（关闭 = 点遮罩/ESC；设置走命令/设置面板）
    expect(overlay.querySelector('[data-clip-settings]')).toBeNull();
    expect(overlay.querySelector('[data-clip-desk-close]')).toBeNull();
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
    expect(saveBtn.textContent).toBe('存为剪藏'); // 文字钮（m3 原型）
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

  it('G：空列表清 M.cur——reader 空态，不残留上一源文章（issue 222 起 rail 站点行恒非空，空态经搜索零命中驱动同一 renderList 分支）', async () => {
    await openDesktop();
    expect(M.cur).toBeTruthy();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '绝对不存在的关键词xyz';
    input.dispatchEvent(new Event('input'));
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
    // 点 B站 站点源（issue 222 site 行）→ 选中；再点同源 → 回全部未读
    const biliRow = findRow('B站');
    biliRow.click();
    await vi.waitFor(() => expect(M.sel.kind).not.toBe('all'));
    findRow('B站').click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('all'));
    // 点「全部未读」行本身恒回全部（不产生异常）
    findRow('全部未读').click();
    expect(M.sel.kind).toBe('all');
    closePanel();
  });

  it('issue 222：rail 站点行——news 站点=平台、剪藏缺 site 归「未知」、saved 命中不建行；点行看该站列表', async () => {
    await openDesktop();
    const rows = [...document.querySelectorAll('.bz-rail-item')] as HTMLElement[];
    const texts = rows.map((r) => r.textContent!);
    expect(texts.some((t) => t.includes('B站'))).toBe(true);        // 未读 news 站点（site 缺省回落 platform）
    expect(texts.some((t) => t.includes('未知'))).toBe(true);        // 剪藏笔记A 缺 site → 「未知」桶
    expect(texts.some((t) => t.includes('果壳科学人'))).toBe(false); // 唯一果壳文 url 命中剪藏（saved）→ 不建行
    expect(texts.some((t) => t.includes('知乎日报'))).toBe(false);   // 唯一知乎文已 read → 不进池
    // 点击「未知」站点行 → 列表 = 该站剪藏
    const unkRow = rows.find((r) => r.textContent!.includes('未知'))!;
    unkRow.click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('site'));
    await vi.waitFor(() => expect(document.querySelector('.bz-clip-list')!.textContent).toContain('剪藏笔记A'));
    closePanel();
  });

  // ================= issue 206：搜索进 rail / 统计联动 / 图片 / 滚动重置 / 去分析入口 =================

  it('issue 214：搜索框在头行右缘（原型对齐），rail 只有栏头/源列表/今日脚注；阅读分析报告入口移除', async () => {
    await openDesktop();
    // 搜索框在头行（issue 214 原型对齐，回归 issue 206 的 rail 位置）
    const head = document.querySelector('.bz-panel-head') as HTMLElement;
    expect(head.querySelector('input[data-clip-desk-search]')).toBeTruthy();
    const rail = document.querySelector('.bz-clip-rail') as HTMLElement;
    expect(rail.querySelector('[data-clip-desk-search]')).toBeNull();
    // rail 结构：栏头 + 源列表 + 今日脚注
    expect(rail.querySelector('.bz-clip-rail-label')!.textContent).toContain('SITE');
    expect(rail.querySelector('.bz-rail-scroll')).toBeTruthy();
    expect(rail.querySelector('[data-clip-rail-foot]')!.textContent).toContain('今日已读');
    // 阅读分析报告入口已移除
    expect(document.querySelector('[data-clip-analy]')).toBeNull();
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
    // meta = 「站点短名 · 时间」（issue 214：favicon 链退役，站点短名 果壳科学人→果壳）
    expect(first.querySelector('.bz-clip-item-meta')!.textContent).toContain('果壳 · ');
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

  it('issue 214：目录序号制——序号领队 + 状态类 + 桌面无状态圆点/无摘要；中栏有「目录」栏头', async () => {
    await openDesktop();
    expect(document.querySelector('.bz-clip-toc-head')!.textContent).toContain('目录');
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.querySelector('.bz-clip-no')).toBeTruthy();
      expect(it.className).toMatch(/bz-clip-item--(unread|reading|saved|read)/); // ADR-0108：折叠段含 read 条目
      expect(it.querySelector('.bz-clip-dot')).toBeNull();
      // 原型对齐：摘要不入目录，meta 一行「站点 · 时间」
      expect(it.querySelector('.bz-clip-item-sum')).toBeNull();
      expect(it.querySelector('.bz-clip-item-meta')!.textContent).toMatch(/·/);
    }
    // 首条 = 未读常显段（已读知乎在「已读」折叠段内，不在首位）
    expect(items[0].querySelector('.bz-clip-no')!.textContent).toBe('01');
    expect(items[0].classList.contains('bz-clip-item--unread')).toBe(true);
    closePanel();
  });

  it('去在读（issue 248 追）：目录全为未读，源序展示（reading 侧写不再派生）', async () => {
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
    const items = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
    expect(items[0].textContent).toContain('在读新文'); // 无「在读」让位语义，均未读按源序
    expect(items[0].classList.contains('bz-clip-item--unread')).toBe(true);
    expect(items[1].classList.contains('bz-clip-item--unread')).toBe(true);
    closePanel();
  });

  it('issue 214：阅读面——站点并入 meta、去底部原文链接；news 右键动作（去查看原文）；剪藏条目有「打开笔记」文字脚', async () => {
    await openDesktop();
    const reader = document.querySelector('[data-clip-reader]') as HTMLElement;
    // meta 行：时间 + 站点短名（橘，首篇 = B站 UP 影视飓风）；无 favicon/类型胶囊（issue 214 原型对齐）
    expect(reader.querySelector('.bz-clip-art-meta .bz-clip-art-site-name')!.textContent).toBe('影视飓风');
    expect(reader.querySelector('.bz-clip-art-state')).toBeNull(); // 标题下状态章（未读标识）已去
    expect(reader.querySelector('.bz-clip-favchip')).toBeNull();
    expect(reader.querySelector('.bz-clip-art-type')).toBeNull();
    expect(reader.firstElementChild!.classList.contains('bz-clip-art-title')).toBe(true);
    // 底部动作退役：无原文链接；news 无打开笔记脚
    expect(reader.querySelector('.bz-clip-art-origin')).toBeNull();
    expect(reader.querySelector('[data-clip-open-note]')).toBeNull();
    // 动作归宿：右键菜单不含「查看原文」（issue 248 追：入口退役，原文靠长按/桌面本地打开）
    const item = document.querySelector('.bz-clip-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
    expect((document.querySelector('.bz-item-menu') as HTMLElement).textContent).not.toContain('查看原文');
    // 编辑部换肤靠根挂类生效（菜单挂 body，域内后代选择器不可达）
    expect(document.querySelector('.bz-item-menu')!.classList.contains('bz-clip-menu-editorial')).toBe(true);
    // 剪藏条目：文末「打开笔记」文字脚（data-clip-open-note 保留）
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('剪藏本')) as HTMLElement;
    clipRow.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    (document.querySelector('.bz-clip-item') as HTMLElement).click();
    await vi.waitFor(() => expect((document.querySelector('[data-clip-reader]') as HTMLElement).querySelector('[data-clip-open-note]')).toBeTruthy());
    closePanel();
  });


  it('去在读（issue 248 追）：overrides.reading 不再派生状态——两篇均未读按源序展示', async () => {
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
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
    // 目录化后：常显 active 段直属于 ch-items（已收折叠段 arch 内条目不计入）
    const mobTitles = () => [...document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-ch-items > .bz-clip-mob-item .bz-clip-mob-ttl')].map((e) => e.textContent);
    expect(mobTitles()).toEqual(['在读新文', '未读旧文']); // 去在读后无让位语义，按源序
    closePanel();
  });
});

describe('移动章目录（issue 248：site 章 + 已收折叠）', () => {
  /** fixture：果壳章 = 未读 1 + 已收剪藏 1（fold 行）；B站章 = 仅未读 */
  function seedToc(): MockVault {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '未读果壳文', url: 'https://guokr.com/n1', author: '果壳', date: '2026-09-02 08:00:00', body: '正文甲' },
        { platform: 'B站', title: '未读B站视频', url: 'https://bilibili.com/video/BV2', author: 'UP甲', date: '2026-09-02 09:00:00', body: '正文乙' },
      ],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    vault.files.set('CONFIG/STORAGE/clipbook.json', JSON.stringify({ articleOverrides: {}, savedArchive: [], order: [] }));
    vault.files.set('归档/网页剪藏/旧剪藏.md', '---\nurl: "https://guokr.com/old"\ncreated: 2026-08-01 10:00:00\nsite: "果壳科学人"\n---\n剪藏旧文正文');
    return vault;
  }
  async function openToc(): Promise<void> {
    try { unloadClipbook(); } catch (e) { /* 幂等 */ }
    resetObsidianMocks();
    const app = mockAppWithVault(seedToc());
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(2));
  }

  it('章 = site：果壳章 未读常显 + 「已收 1 篇」折叠行，点击展开/收起（详情往返保持展开）', async () => {
    await openToc();
    const chNames = () => [...document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-ch-name')].map((e) => e.textContent);
    await vi.waitFor(() => expect(chNames()).toEqual(['果壳科学人', 'B站'])); // 总数降序（果壳 2 > B站 1）
    const fold = [...document.querySelectorAll('[data-clip-mob-list] [data-fold]')].find((f) => f.textContent!.includes('已收 1 篇')) as HTMLElement;
    expect(fold).toBeTruthy();
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    // 展开（原型 .c-fold.on + arch.hidden 翻转）
    fold.click();
    expect(fold.classList.contains('on')).toBe(true);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect((fold.querySelector('.bz-clip-mob-fold-lab') as HTMLElement).textContent).toBe('收起');
    const arch = fold.closest('.bz-clip-mob-ch')!.querySelector('.bz-clip-mob-arch') as HTMLElement;
    expect(arch.hidden).toBe(false);
    // 展开段点剪藏条目 → 详情（arch 内 clip 可进，全量索引）
    const clipCard = [...arch.querySelectorAll('.bz-clip-mob-item')].find((c) => c.textContent!.includes('旧剪藏')) as HTMLElement;
    clipCard.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    expect(document.querySelector('[data-clip-mob-detail] .bz-clip-mob-d-title')!.textContent).toContain('旧剪藏');
    expect(document.querySelector('[data-clip-mob-detail] .bz-clip-mob-d-kicker')).toBeTruthy(); // 原型期次行
    // 返回 → 折叠态保持展开（expanded 记忆重渲 .on）
    (document.querySelector('[data-clip-mob-back]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    const fold2 = [...document.querySelectorAll('[data-clip-mob-list] [data-fold]')].find((f) => f.classList.contains('on')) as HTMLElement;
    expect(fold2).toBeTruthy();
    expect((fold2.querySelector('.bz-clip-mob-fold-lab') as HTMLElement).textContent).toBe('收起');
    // 再点收起
    fold2.click();
    expect(fold2.classList.contains('on')).toBe(false);
    expect(fold2.getAttribute('aria-expanded')).toBe('false');
    closePanel();
  });

  it('检索态命中平铺：折叠行消失、已收命中直接可见', async () => {
    await openToc();
    const input = document.querySelector('[data-clip-mob-input]') as HTMLInputElement;
    input.value = '旧剪藏';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-clip-mob-list] [data-fold]').length).toBe(0));
    expect([...document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-item')].some((c) => c.textContent!.includes('旧剪藏'))).toBe(true);
    // 无命中章整体不渲染
    input.value = '绝不命中xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-clip-mob-list] .bz-clip-mob-ch').length).toBe(0));
    closePanel();
  });
});

describe('会话冻结序（ADR-0108：桌面打开即已读 + 原位保留 + 重开面板才重排 + 双折叠段）', () => {
  /** 站点种子：果壳 = 未读 2 + 已读骨架 1（30 天内回看）+ 承接剪藏 1；知乎独立未读 1 */
  function seedFrozen(): MockVault {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
      articles: [
        { platform: '果壳科学人', title: '果壳未读甲', url: 'https://guokr.com/fa', author: '果壳', date: '2026-09-02 08:00:00', body: '正文甲' },
        { platform: '果壳科学人', title: '果壳未读乙', url: 'https://guokr.com/fb', author: '果壳', date: '2026-09-01 08:00:00', body: '正文乙' },
        { platform: '果壳科学人', title: '果壳已读旧', url: 'https://guokr.com/old', author: '果壳', date: '2026-08-20 08:00:00', read: true, state: 'skipped' },
        { platform: '知乎日报', title: '知乎未读', url: 'https://zhihu.com/z1', date: '2026-09-03 08:00:00', body: '正文知' },
      ],
      stats: { totalRead: 1, totalSaved: 0, totalSkipped: 1, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true },
    }));
    vault.files.set('归档/网页剪藏/果壳承接.md', '---\nurl: "https://guokr.com/keep"\ncreated: 2026-08-10 10:00:00\nsite: "果壳科学人"\n---\n已承接剪藏正文');
    return vault;
  }

  async function openFrozen(): Promise<void> {
    try { unloadClipbook(); } catch (e) { /* 幂等 */ }
    resetObsidianMocks();
    const vault = seedFrozen();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.articles.length).toBe(4));
  }

  it('桌面：打开即已读——打开一条未读后原位保留（不消失、不重排），rail 徽标计数即时减', async () => {
    await openFrozen();
    // 初始目录（全部未读源）：知乎/果壳未读，未读在前
    const first = [...document.querySelectorAll('.bz-clip-item')].find((c) => c.textContent!.includes('知乎未读')) as HTMLElement;
    expect(first).toBeTruthy();
    first.click(); // 打开 → 桌面也「打开即已读」（Q5）
    await vi.waitFor(() => expect(M.cur!.id).toBe('url:https://zhihu.com/z1'));
    // 原位保留：条目仍在目录（灰显类 read），rail 未读计数即时 4 → 3
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-clip-item')] as HTMLElement[];
      const mine = cards.find((c) => c.textContent!.includes('知乎未读'));
      expect(mine).toBeTruthy();
      expect(mine!.classList.contains('bz-clip-item--read')).toBe(true); // 已读灰显在原位
      expect(M.cur!.id).toBe('url:https://zhihu.com/z1'); // 不跳位
    });
    // rail「全部未读」计数：3/4（读 1 后即时减）
    const allRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('全部未读')) as HTMLElement;
    expect(allRow.querySelector('.bz-rail-count')!.textContent).toBe('3/4');
    closePanel();
  });

  it('桌面：已读/已收折叠段——打开含已读+承接的站点源，已读沉折叠、承接进已收；折叠行开合', async () => {
    await openFrozen();
    const siteRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('果壳科学人')) as HTMLElement;
    siteRow.click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('site'));
    await vi.waitFor(() => expect(document.querySelectorAll('[data-desk-fold]').length).toBe(2)); // 已读 + 已收
    // 未读常显两则
    const titles = [...document.querySelectorAll('.bz-clip-list .bz-clip-item:not(.bz-clip-desk-fold-body *)')].map((e) => e.textContent);
    expect(titles.some((t) => t!.includes('果壳未读甲'))).toBe(true);
    // 折叠行文案：已读 1 篇 / 已收 1 篇（默认收起）
    const foldLabs = [...document.querySelectorAll('.bz-clip-desk-fold-lab')].map((e) => e.innerHTML);
    expect(foldLabs.some((t) => t!.includes('已读 <b>1</b> 篇'))).toBe(true);
    expect(foldLabs.some((t) => t!.includes('已收 <b>1</b> 篇'))).toBe(true);
    // 点击已读折叠行展开 → body 出现（已读骨架灰显条目）；toggle 重渲 DOM，须重查元素
    const foldRead = [...document.querySelectorAll('[data-desk-fold="read"]')][0] as HTMLElement;
    foldRead.click();
    await vi.waitFor(() => {
      const cur = [...document.querySelectorAll('[data-desk-fold="read"]')][0] as HTMLElement;
      return expect(cur.getAttribute('aria-expanded')).toBe('true');
    });
    const readBody = document.querySelector('.bz-clip-desk-fold-body:not([hidden])') as HTMLElement;
    expect(readBody.textContent).toContain('果壳已读旧');
    // 再点收起
    ([...document.querySelectorAll('[data-desk-fold="read"]')][0] as HTMLElement).click();
    await vi.waitFor(() => {
      const cur = [...document.querySelectorAll('[data-desk-fold="read"]')][0] as HTMLElement;
      return expect(cur.getAttribute('aria-expanded')).toBe('false');
    });
    closePanel();
  });

  it('桌面：无未读目录默认展开「已收」（已收空则已读）——只读已读站打开即有内容不空场', async () => {
    await openFrozen();
    // 构造只读站（无未读、无承接）：先把知乎未读也标读（同会话标读原位保留，不动桶）
    // 直接验证展开规则：点开「果壳科学人」后把两未读标读（会话内不沉段），重开面板 → 新会话快照重排
    const siteRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => r.textContent!.includes('果壳科学人')) as HTMLElement;
    siteRow.click();
    await vi.waitFor(() => expect(M.sel.kind).toBe('site'));
    // 逐条右键标读（显式动作同原位；重开面板才让位）；标读后 refresh 重建 DOM，须重查元素
    for (const t of ['果壳未读甲', '果壳未读乙']) {
      const card = [...document.querySelectorAll('.bz-clip-item')].find((c) => c.textContent!.includes(t)) as HTMLElement;
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
      await vi.waitFor(() => expect(document.querySelector('.bz-item-menu')).toBeTruthy());
      const menu = document.querySelector('.bz-item-menu') as HTMLElement;
      const readBtn = [...menu.querySelectorAll('.bz-item-menu-item')].find((b) => b.textContent!.includes('标记为已读')) as HTMLElement;
      readBtn.click();
      await vi.waitFor(() => {
        const cur = [...document.querySelectorAll('.bz-clip-item')].find((c) => c.textContent!.includes(t)) as HTMLElement;
        return expect(cur.classList.contains('bz-clip-item--read')).toBe(true); // 原位灰显
      });
    }
    // 关闭 → 重开面板（新会话）→ 重排：目录无未读 → 默认展开「已收」（承接剪藏）不空场
    closePanel();
    showPanel();
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => expect(M.sel.kind).toBe('site')); // 选中源保留
    const openBodies = [...document.querySelectorAll('.bz-clip-desk-fold-body:not([hidden])')] as HTMLElement[];
        const savedOpen = openBodies.find((b) => b.textContent!.includes('果壳承接'));
    expect(savedOpen).toBeTruthy(); // 已收有货默认展开
    closePanel();
  });

  it('移动：打开即已读后返回目录原位灰显（不沉折叠段）；重开面板才沉「已读」段', async () => {
    // 移动目录：seedFrozen 站集合 = 果壳（未读2+已读骨架1+承接剪藏1）/ 知乎（未读1）
    // 桌面环境直接复用（renderMobToc 独立于 Platform，DOM 同渲染）
    await openFrozen();
    // 打开果壳未读甲 → 打开即已读（m3 语义保持）
    const mobTitle = [...document.querySelectorAll('.bz-clip-mob-item')].find((c) => c.textContent!.includes('果壳未读甲')) as HTMLElement;
    expect(mobTitle).toBeTruthy();
    mobTitle.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    expect(M.cur!.id).toContain('guokr.com/fa');
    // 返回目录 → 未读甲原位灰显（仍常显，不进已读折叠段）
    (document.querySelector('[data-clip-mob-back]') as HTMLElement).click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    const backTitles = [...document.querySelectorAll('.bz-clip-mob-item')].map((e) => e.textContent);
    expect(backTitles.some((t) => t!.includes('果壳未读甲'))).toBe(true); // 仍在常显
    const readCard = [...document.querySelectorAll('.bz-clip-mob-item')].find((c) => c.textContent!.includes('果壳未读甲')) as HTMLElement;
    expect(readCard.classList.contains('read')).toBe(true); // 灰显
    // 已读折叠段（快照 read 桶）此时只含装载时已读的骨架，不含刚读的甲
    const foldRead = [...document.querySelectorAll('[data-fold-kind="read"]')][0] as HTMLElement;
    expect(foldRead).toBeTruthy();
    closePanel();
  });
});
