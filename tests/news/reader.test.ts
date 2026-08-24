/**
 * 聚合讯测试（ticket 09）：逐篇阅读流状态机、news-stats.json 统计、
 * 已读/跳过/完成态、剪藏保存 + dataviewjs 代码块。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  loadArticles, render, markAsRead, skipArticle, saveToClip, hide,
  loadStats, recordStat, renderMarkdown, toDatetime, init, show,
} from '../../src/news/reader';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
// ticket 076 修订：隔离 smartcat——断言 reader 只对「保存」产观察（跳过不再调 notifyNewsRead）
import { notifyNewsRead, notifyNewsSaved } from '../../src/smartcat';
vi.mock('../../src/smartcat', () => ({ notifyNewsRead: vi.fn(), notifyNewsSaved: vi.fn() }));

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
  } as any;
}

const NEWS_JSON = [
  {
    title: '第一篇新闻',
    url: 'https://zhihu.com/a',
    platform: '知乎日报',
    author: '甲',
    date: '2025-06-10 09:00:00',
    summary: '摘要一',
    tags: ['AI'],
    body: '# 标题一\n\n正文段落 **加粗**',
  },
  {
    title: '第二篇新闻',
    url: 'https://guokr.com/b',
    platform: '果壳',
    author: '乙',
    date: '2025-06-11 10:00:00',
    summary: '摘要二',
    tags: ['科学'],
    body: '> 引用内容',
  },
];

async function setup() {
  resetObsidianMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify(NEWS_JSON));
  vault.files.set('CONFIG/STORAGE/news-stats.json', JSON.stringify({ totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }));
  const app = makeApp(vault);
  setApp(app);
  _vault = vault; // 测试内共享 vault 引用（供 getVault）
  return { vault, app };
}

describe('聚合讯阅读流', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setup();
    init(false);
  });

  it('加载未读文章并渲染单篇（标题/平台徽章/👤作者/📅日期/正文 markdown）', async () => {
    await loadArticles();
    render();

    expect(document.querySelector('.news-popup')).not.toBeNull();
    const title = document.querySelector('.news-card-title');
    expect(title!.textContent).toBe('第一篇新闻');
    const pill = document.querySelector('.platform-pill');
    expect(pill!.textContent).toContain('知乎日报');
    expect(document.querySelector('.news-card-meta')!.textContent).toContain('👤 甲');
    expect(document.querySelector('.news-card-meta')!.textContent).toContain('📅 2025-06-10');
    // markdown 渲染：h1 + <b>加粗</b>
    const body = document.querySelector('.news-card-body')!.innerHTML;
    expect(body).toContain('<h1>标题一</h1>');
    expect(body).toContain('<b>加粗</b>');
    // 底部栏计数从 1 起算（正在读的这篇算已读）
    expect(document.querySelector('.news-counter')!.textContent).toContain('1 / 2');
  });

  it('markAsRead("skipped")：标已读 + 统计 + 进入下一篇 + news.json 落盘 read=true', async () => {
    await loadArticles();
    render();
    skipArticle();

    expect(document.querySelector('.news-card-title')!.textContent).toBe('第二篇新闻');
    expect(document.querySelector('.news-counter')!.textContent).toContain('2 / 2');
    // news.json 写回 read 标记
    const saved = JSON.parse((getVault().files as Map<string, string>).get('CONFIG/STORAGE/news.json')!);
    expect(saved[0].read).toBe(true);
    expect(saved[0].body).toBeUndefined(); // delete a.body
  });

  it('跳过：不再产生观察（notifyNewsRead/notifyNewsSaved 均不调用），域统计照记', async () => {
    await loadStats(); // 重置模块级 stats（防跨用例串扰）后再动作
    await loadArticles();
    render();
    skipArticle();
    expect(notifyNewsRead).not.toHaveBeenCalled();
    expect(notifyNewsSaved).not.toHaveBeenCalled();
    const stats = JSON.parse((getVault().files as Map<string, string>).get('CONFIG/STORAGE/news-stats.json')!);
    expect(stats.totalSkipped).toBe(1);
  });

  it('保存：仅产保存观察（ticket 076 修订：三态 → 仅保存），时长取整分钟 ≥1', async () => {
    await loadArticles();
    render();
    markAsRead('saved');
    expect(notifyNewsRead).toHaveBeenCalledTimes(1);
    expect(notifyNewsRead).toHaveBeenCalledWith(expect.objectContaining({ title: '第一篇新闻', platform: '知乎日报', state: 'saved', durationMin: 1 }));
    expect(notifyNewsSaved).not.toHaveBeenCalled(); // 仅 saveToClip 流程登记补全，直接 markAsRead 不发
  });

  it('阅读时长：打开起算 → 关闭暂停 → 重开同篇续算 → 下一篇后重置（仅保存带时长）', async () => {
    vi.useFakeTimers();
    try {
      await loadArticles();
      render();                                              // 打开第一篇 → 起算
      vi.setSystemTime(Date.now() + 3 * 60 * 1000);          // 读 3 分钟
      hide();                                                // 关闭 → 暂停
      vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);     // 关着 2 小时（不计入）
      render();                                              // 重开同篇 → 续算
      vi.setSystemTime(Date.now() + 1 * 60 * 1000);          // 再读 1 分钟
      markAsRead('saved');                                   // 累计 4 分钟
      expect(notifyNewsRead).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'saved', durationMin: 4 }));
      // 内部 render 已切到下一篇 → 累计清零
      vi.setSystemTime(Date.now() + 5 * 60 * 1000);          // 下一篇读 5 分钟
      markAsRead('saved');
      const calls = vi.mocked(notifyNewsRead).mock.calls;
      expect(calls[calls.length - 1][0]).toMatchObject({ title: '第二篇新闻', state: 'saved', durationMin: 5 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('读完所有文章 → 完成态 renderDoneState（今日阅读/累计保存/总计）', async () => {
    await loadStats();
    await loadArticles();
    render();
    // 剩最后一篇时「下一篇」按钮变为完成说明（计数已是最终值 2 / 2）
    skipArticle();
    expect(document.querySelector('[data-action="next"]')!.textContent).toContain('完成阅读');
    expect(document.querySelector('[data-action="next"]')!.textContent).not.toContain('下一篇');
    expect(document.querySelector('.news-counter')!.textContent).toContain('2 / 2');
    skipArticle();

    const doneText = document.querySelector('.news-card-area')!.textContent!;
    expect(doneText).toContain('今日阅读');
    expect(doneText).toContain('2 篇');
    expect(doneText).toContain('今日文章已读完，欢迎明天再来！');
    // 完成态底部栏保留最终计数（右下角 1 / 2 → 2 / 2），且无操作按钮
    const doneCounter = document.querySelector('.news-bottombar .news-counter')!;
    expect(doneCounter).not.toBeNull();
    expect(doneCounter.textContent).toContain('2 / 2');
    expect(document.querySelectorAll('.news-bottombar .news-btn').length).toBe(0);
  });

  it('打开时只剩最后一篇：按钮即完成说明，读完显示最终计数 1 / 1', async () => {
    const vault = getVault();
    const saved = JSON.parse(vault.files.get('CONFIG/STORAGE/news.json')!);
    saved[0].read = true; // 只留第二篇未读
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify(saved));
    await loadStats();
    await loadArticles();
    render();

    expect(document.querySelector('[data-action="next"]')!.textContent).toContain('完成阅读');
    expect(document.querySelector('[data-action="next"]')!.textContent).not.toContain('下一篇');
    expect(document.querySelector('.news-counter')!.textContent).toContain('1 / 1');
    skipArticle();
    expect(document.querySelector('.news-bottombar .news-counter')!.textContent).toContain('1 / 1');
  });

  it('news-stats.json：recordStat 累计并落盘（byPlatform/byDate）', async () => {
    await loadStats();
    recordStat('skipped', NEWS_JSON[0]);
    recordStat('saved', NEWS_JSON[1]);
    const vault = getVault();
    const stats = JSON.parse(vault.files.get('CONFIG/STORAGE/news-stats.json')!);
    expect(stats.totalRead).toBe(2);
    expect(stats.totalSaved).toBe(1);
    expect(stats.totalSkipped).toBe(1);
    expect(stats.byPlatform['知乎日报']).toBe(1);
    expect(stats.byPlatform['果壳']).toBe(1);
    const today = new Date().toISOString().substring(0, 10);
    expect(stats.byDate[today]).toBe(2);
  });

  it('saveToClip：写入 归档/网页剪藏/标题.md（含 link/author/site/tags/dataviewjs 代码块）并 markAsRead', async () => {
    await loadArticles();
    render();
    await saveToClip();

    const vault = getVault();
    const md = vault.files.get('归档/网页剪藏/第一篇新闻.md');
    expect(md).toContain('link: "https://zhihu.com/a"');
    expect(md).toContain('author: "甲"');
    expect(md).toContain('site: "知乎日报"');
    expect(md).toContain('tags:\n  - "AI"');
    expect(md).toContain('await dv.view(`CONFIG/SCRIPTS/DataView/摘要`)');
    expect(hasNotice(/已保存/)).toBe(true);
    // 已读后进入下一篇
    expect(document.querySelector('.news-card-title')!.textContent).toBe('第二篇新闻');
  });

  it('剪藏保存失败 → 「❌ 保存失败」', async () => {
    const vault = getVault();
    // 让 create 抛错
    vault.create = async () => {
      throw new Error('磁盘错误');
    };
    await loadArticles();
    render();
    await saveToClip();
    expect(hasNotice(/保存失败/)).toBe(true);
  });

  it('renderMarkdown：转义 XSS 后再渲染', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('toDatetime：合法/非法日期', () => {
    expect(toDatetime('2025-06-10T09:00:00.000Z').substring(0, 10)).toBe('2025-06-10');
    expect(toDatetime('垃圾').length).toBe(19); // 回退到当前时间
  });
});

// 测试内共享 vault 引用
let _vault: MockVault | null = null;
function getVault(): MockVault {
  return _vault!;
}

describe('移动端默认全屏跟随剪藏本 + 移除 ⚙️ 入口（用户拍板）', () => {
  beforeEach(async () => {
    await setup();
    init(false);
    setSettingsProvider(() => ({}) as any);
    MockPlatform.isMobile = false;
  });

  afterEach(() => {
    MockPlatform.isMobile = false;
  });

  it('头部无 ⚙️ 设置按钮；桌面端即使剪藏本开关开也不挂 bz-win-mfs', async () => {
    setSettingsProvider(() => ({ clippingMobileDefaultFullscreen: true }) as any);
    await loadArticles();
    render();
    // ⚙️ 入口已删除（聚合讯不再设独立开关，跟随剪藏本键）
    expect(document.querySelector('.news-settings-btn')).toBeNull();
    show();
    const popupEl = document.querySelector('.news-popup') as HTMLElement;
    expect(popupEl).not.toBeNull();
    expect(popupEl.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('移动端：跟随剪藏本 clippingMobileDefaultFullscreen（开→bz-win-mfs；关→常规卡）', async () => {
    MockPlatform.isMobile = true;
    await loadArticles();
    render();
    const popupEl = document.querySelector('.news-popup') as HTMLElement;
    // 关 → 常规卡
    setSettingsProvider(() => ({ clippingMobileDefaultFullscreen: false }) as any);
    show();
    expect(popupEl.classList.contains('bz-win-mfs')).toBe(false);
    // 开 → 真全屏
    setSettingsProvider(() => ({ clippingMobileDefaultFullscreen: true }) as any);
    show();
    expect(popupEl.classList.contains('bz-win-mfs')).toBe(true);
  });
});