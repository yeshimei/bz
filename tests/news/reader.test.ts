/**
 * 聚合讯测试（ticket 09）：逐篇阅读流状态机、news-stats.json 统计、
 * 已读/跳过/完成态、剪藏保存 + dataviewjs 代码块。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  loadArticles, render, markAsRead, skipArticle, saveToClip, hide,
  loadStats, recordStat, renderMarkdown, toDatetime, localDayKey, init, show,
} from '../../src/news/reader';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, hasNotice } from '../mock-obsidian-entry';
import { onDomainEvent } from '../../src/core/domain-bus';
// ticket 076 观测点换线（域事件派发）：真实总线 + onDomainEvent('news', spy) 挂间谍，
// 断言 reader 只对「保存」发事件（跳过不发）；载荷 {kind:'read'|'saved', evt, clipPath?}
let newsSpy: import('vitest').Mock<(evt?: unknown) => void>;
let offNewsSpy: () => void = () => {};

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
  } as any;
}

/** 最近一次 read 入口载荷（保存立即形态断言用） */
function lastReadEvt(): any {
  const calls = newsSpy.mock.calls.map((c: any[]) => c[0]).filter((m: any) => m?.kind === 'read');
  return calls[calls.length - 1]?.evt;
}
/** 是否出现过 saved 入口事件 */
function hasSavedEvt(): boolean {
  return newsSpy.mock.calls.some((c: any[]) => c[0]?.kind === 'saved');
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
    newsSpy = vi.fn((_evt?: unknown) => {});
    offNewsSpy = onDomainEvent('news', (evt) => newsSpy(evt));
    await setup();
    init(false);
  });

  afterEach(() => {
    offNewsSpy();
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
    // P0-5 后 saveArticles 含写前重读（异步化）：冲刷微任务再断言落盘内容
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('.news-card-title')!.textContent).toBe('第二篇新闻');
    expect(document.querySelector('.news-counter')!.textContent).toContain('2 / 2');
    // news.json 写回 read 标记
    const saved = JSON.parse((getVault().files as Map<string, string>).get('CONFIG/STORAGE/news.json')!);
    expect(saved[0].read).toBe(true);
    expect(saved[0].body).toBeUndefined(); // delete a.body
  });

  it('跳过：不发任何 news 事件（域统计照记）', async () => {
    await loadStats(); // 重置模块级 stats（防跨用例串扰）后再动作
    await loadArticles();
    render();
    skipArticle();
    expect(newsSpy).not.toHaveBeenCalled();
    const stats = JSON.parse((getVault().files as Map<string, string>).get('CONFIG/STORAGE/news-stats.json')!);
    expect(stats.totalSkipped).toBe(1);
  });

  it('保存：仅发 read 入口事件（ticket 076 修订：三态 → 仅保存），时长取整分钟 ≥1', async () => {
    await loadArticles();
    render();
    markAsRead('saved');
    expect(newsSpy).toHaveBeenCalledTimes(1);
    expect(newsSpy).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'read',
      evt: expect.objectContaining({ title: '第一篇新闻', platform: '知乎日报', state: 'saved', durationMin: 1 }),
    }));
    expect(hasSavedEvt()).toBe(false); // 仅 saveToClip 流程登记补全，直接 markAsRead 不发 saved
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
      expect(lastReadEvt()).toMatchObject({ state: 'saved', durationMin: 4 });
      // 内部 render 已切到下一篇 → 累计清零
      vi.setSystemTime(Date.now() + 5 * 60 * 1000);          // 下一篇读 5 分钟
      markAsRead('saved');
      expect(lastReadEvt()).toMatchObject({ title: '第二篇新闻', state: 'saved', durationMin: 5 });
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
    // x2b：byDate 键为本地日（与实现同口径，避免 UTC+8 凌晨跨日断言）
    const today = localDayKey();
    expect(stats.byDate[today]).toBe(2);
  });

  it('saveToClip：写入 归档/网页剪藏/标题.md（含 url/author/site/tags/dataviewjs 代码块）并 markAsRead', async () => {
    await loadArticles();
    render();
    await saveToClip();

    const vault = getVault();
    const md = vault.files.get('归档/网页剪藏/第一篇新闻.md');
    expect(md).toContain('url: "https://zhihu.com/a"');
    expect(md).toContain('author: "甲"');
    expect(md).toContain('site: "知乎日报"');
    expect(md).toContain('tags:\n  - "AI"');
    expect(md).toContain('await dv.view(`CONFIG/SCRIPTS/DataView/摘要`)');
    expect(hasNotice(/已保存/)).toBe(true);
    // 已读后进入下一篇
    expect(document.querySelector('.news-card-title')!.textContent).toBe('第二篇新闻');
  });

  it('frontmatter 全字段转义（P1-24）：含引号/换行的作者、标签、链接生成的 frontmatter 可被 YAML 解析', async () => {
    // 注入特殊字符文章：引号作者 / 换行摘要 / 引号标签
    const vault = getVault();
    const dirty = [
      {
        title: '特殊字符新闻',
        url: 'https://x.com/a"b?next=https://y.com/c',
        platform: '站"点',
        author: '张"三"\n李四',
        date: '2025-06-10 09:00:00',
        summary: '第一行\n第二行 "引用"',
        tags: ['标"签', 'AI'],
        body: '正文',
      },
    ];
    vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify(dirty));
    await loadArticles();
    render();
    await saveToClip();

    const md = vault.files.get('归档/网页剪藏/特殊字符新闻.md')!;
    // 每个双引号标量行都保持合法 YAML 形状（内部引号均被转义，无裸换行断行）
    for (const key of ['url', 'author', 'site', 'summary', 'date']) {
      expect(md).toMatch(new RegExp(`^${key}: "(?:[^"\\\\]|\\\\.)*"$`, 'm'));
    }
    expect(md).toMatch(/^tags:\n {2}- "(?:[^"\\]|\\.)*"\n {2}- "(?:[^"\\]|\\.)*"$/m);
    // 转义可逆：YAML 解析还原出原文（引号原样、换行折叠为空格）
    const author = md.match(/^author: "((?:[^"\\]|\\.)*)"$/m)![1];
    expect(author.replace(/\\"/g, '"')).toBe('张"三"\n李四'.replace(/[\r\n]+/g, ' '));
    const tag = md.match(/^ {2}- "(标\\"[^"]*)"$/m)![1];
    expect(tag.replace(/\\"/g, '"')).toBe('标"签');
    const summary = md.match(/^summary: "((?:[^"\\]|\\.)*)"$/m)![1];
    expect(summary).toContain('第一行 第二行 \\"引用\\"');
  });

  it('剪藏保存失败 → 人话 toast（技术详情只进 console，m1b-news）', async () => {
    const vault = getVault();
    // 让 create 抛错
    vault.create = async () => {
      throw new Error('ENOSPC: no space left on device');
    };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await loadArticles();
      render();
      await saveToClip();
      expect(hasNotice(/保存失败/)).toBe(true);
      expect(hasNotice(/ENOSPC/)).toBe(false); // 技术异常不裸露给用户
      expect(errSpy).toHaveBeenCalled(); // 详情进 console
    } finally {
      errSpy.mockRestore();
    }
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