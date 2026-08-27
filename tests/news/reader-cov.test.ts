/**
 * 聚合讯 reader 补测（覆盖率目标）：init(true)/重复 show、stats 缺失与损坏容错、
 * saveStats 建目录与改写两路、recordStat 未知平台、覆盖保存确认弹窗四路（覆盖/取消/遮罩/ESC）、
 * 空标题防御、空队列 markAsRead、checkNewArticles 分支、renderMarkdown 全模式、
 * unloadNews 清理、loadArticles 文件缺失。
 * 独立文件：vi.resetModules 保证每例拿到全新模块状态（currentIndex/allArticles/stats 干净）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, hasNotice, getNoticeMessages, clearNotices } from '../mock-obsidian-entry';

const NEWS_JSON = 'CONFIG/STORAGE/news.json';
const STATS_JSON = 'CONFIG/STORAGE/news-stats.json';

type ReaderModule = typeof import('../../src/news/reader');

function makeArticle(title: string, extra: any = {}) {
  return {
    title,
    url: `https://x.com/${encodeURIComponent(title)}`,
    platform: '站',
    author: '甲',
    date: '2025-06-10 09:00:00',
    summary: `${title}摘要`,
    tags: ['AI'],
    body: `${title} 正文`,
    ...extra,
  };
}

describe('聚合讯补测（每例全新模块状态）', () => {
  let reader: ReaderModule;
  let setAppFresh: typeof import('../../src/core/app').setApp;
  let vault: MockVault;

  beforeEach(async () => {
    vi.resetModules();
    reader = await import('../../src/news/reader');
    ({ setApp: setAppFresh } = await import('../../src/core/app'));
    resetObsidianMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    clearNotices();
    vault = new MockVault();
    vault.files.set(NEWS_JSON, JSON.stringify({ articles: [makeArticle('A'), makeArticle('B')], stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} }, bilibiliUps: [], sources: { zhihu: true, guokr: true, bilibili: true } }));
    setAppFresh({ vault, metadataCache: {}, workspace: { openLinkText: vi.fn() } } as any);
  });

  /** 冲刷异步链（show/loadStats/saveArticles 等） */
  function flush(ms = 30) {
    return new Promise((r) => setTimeout(r, ms));
  }

  it('init(true)：立即展示（遮罩可见 + 首篇渲染）；再次 show 不重建弹窗', async () => {
    reader.init(true);
    await flush();
    const maskEl = document.querySelector('.news-mask') as HTMLElement;
    expect(maskEl.style.visibility).toBe('visible');
    expect(document.querySelector('.news-card-title')!.textContent).toBe('A');
    // 二次 show：popup 已存在 → 不再 createMaskAndPopup
    reader.show();
    await flush();
    expect(document.querySelectorAll('.news-popup').length).toBe(1);
    // 收尾隐藏：否则本代模块的 esc 层恒「可见」，吞掉后续用例的 ESC（ghost 层）
    reader.hide();
    expect(maskEl.style.visibility).toBe('hidden');
  });

  it('hide() 未开过阅读会话（openedAt=0）→ 安全无累计；重复 hide 幂等', async () => {
    reader.init(false);
    reader.hide();
    reader.hide();
    await reader.loadArticles();
    reader.render();
    expect(() => reader.markAsRead('saved')).not.toThrow(); // 时长下限 1 分钟（未开过会话也不炸）
  });

  it('loadStats：news.json 无 stats 段（旧纯数组）→ 默认 0 起算；旧 news-stats.json 自动迁移并入', async () => {
    // ① 旧纯数组（无 stats 段）+ 旧 news-stats.json 有真实统计 → loadStats 迁移并入 stats 段
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A'), makeArticle('B')]));
    vault.files.set(STATS_JSON, JSON.stringify({ totalRead: 100, totalSaved: 50, totalSkipped: 50, byPlatform: { x: 5 }, byDate: { '2020-01-01': 9 } }));
    reader.init(false);
    await reader.loadStats();
    await reader.loadArticles();
    reader.skipArticle(); // A 读 → B
    reader.skipArticle(); // 全读完 → 完成态
    await flush(); // 冲刷 saveArticles/saveStats 写回链
    const doneText = document.querySelector('.news-card-area')!.textContent!;
    expect(doneText).toContain('总计阅读102 篇'); // 迁移 100 + 本会话 2
    // 迁移后落盘：news.json 升级为四段，stats 段含旧统计
    const migrated = JSON.parse(vault.files.get(NEWS_JSON)!);
    expect(migrated.articles.length).toBe(2);
    expect(migrated.stats.totalRead).toBe(102);
    expect(migrated.stats.byPlatform['x']).toBe(5);

    // ② 损坏 JSON → 解析失败保留默认（不抛错；错误态而非完成态）
    vi.resetModules();
    reader = await import('../../src/news/reader');
    ({ setApp: setAppFresh } = await import('../../src/core/app'));
    resetObsidianMocks();
    document.body.innerHTML = '';
    const vault2 = new MockVault();
    vault2.files.set(NEWS_JSON, '{broken json');
    setAppFresh({ vault: vault2, metadataCache: {}, workspace: {} } as any);
    reader.init(false);
    await reader.loadStats();
    await reader.loadArticles();
    reader.render(); // 损坏 → 错误态（不渲染完成态/引导态）
    const errEl = document.querySelector('.news-done');
    expect(errEl).not.toBeNull();
    expect(errEl!.textContent).toContain('新闻数据读取失败');
  });

  it('saveStats：news.json 存在 → stats 段改写；news.json 缺失 → 静默不落盘（首用引导一致）', async () => {
    // ① 已有 news.json（四段）→ recordStat 写回 stats 段（保留 articles/bilibiliUps/sources）
    reader.recordStat('saved', makeArticle('X', { platform: '' }));
    await flush();
    const disk1 = JSON.parse(vault.files.get(NEWS_JSON)!);
    expect(disk1.stats.totalSaved).toBe(1);
    expect(disk1.stats.byPlatform['未知']).toBe(1); // platform 为空串 → 归「未知」桶
    expect(disk1.articles.length).toBe(2); // 非 stats 段保留
    const beforeModifies = vault.modifiedPaths.filter((p) => p === NEWS_JSON).length;

    // ② 既有 stats 段 → modify 更新累计
    reader.recordStat('skipped', makeArticle('Y', { platform: '果壳' }));
    await flush();
    const disk2 = JSON.parse(vault.files.get(NEWS_JSON)!);
    expect(disk2.stats.totalSkipped).toBe(1);
    expect(disk2.stats.byPlatform['果壳']).toBe(1);
    expect(vault.modifiedPaths.filter((p) => p === NEWS_JSON).length).toBeGreaterThan(beforeModifies);

    // ③ news.json 缺失（首用引导态）→ 静默不建文件不落盘
    const emptyVault = new MockVault();
    setAppFresh({ vault: emptyVault, metadataCache: {}, workspace: {} } as any);
    reader.recordStat('saved', makeArticle('Z'));
    await flush();
    expect(emptyVault.files.has(NEWS_JSON)).toBe(false);
  });

  /** 轮询等待条件成立（防 CPU 争抢下的 DOM 就绪抖动） */
  async function waitForDialog(): Promise<HTMLElement> {
    const start = Date.now();
    let dlg: HTMLElement | null = null;
    while (Date.now() - start < 3000) {
      dlg = [...document.querySelectorAll('body > div')].find((d) =>
        d.textContent!.includes('已存在同名文件，覆盖？')
      ) as HTMLElement | null;
      if (dlg) return dlg;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('覆盖确认弹窗未出现');
  }

  it('saveToClip 同名文件 → 确认弹窗「覆盖」改写原文件并继续下一篇', async () => {
    vault.files.set('归档/网页剪藏/A.md', '旧内容');
    reader.init(false);
    await reader.loadArticles();
    reader.render();
    const p = reader.saveToClip();
    const dialog = await waitForDialog();
    (dialog.querySelector('.y') as HTMLElement).click();
    await p;
    const md = vault.files.get('归档/网页剪藏/A.md')!;
    expect(md).toContain('await dv.view(`CONFIG/SCRIPTS/DataView/摘要`)'); // 已被剪藏格式覆盖
    expect(getNoticeMessages().some((m) => m.startsWith('已保存'))).toBe(true);
    expect(document.querySelector('.news-card-title')!.textContent).toBe('B'); // 进入下一篇
  });

  it('saveToClip 同名文件 → 「取消」/点遮罩/ESC 三路取消均不落盘不推进', async () => {
    vault.files.set('归档/网页剪藏/A.md', '旧内容');
    reader.init(false);
    await reader.loadArticles();
    reader.render();

    async function cancelVia(action: 'btn' | 'mask' | 'esc') {
      const p = reader.saveToClip();
      const dlg = await waitForDialog();
      if (action === 'btn') {
        (dlg.querySelector('.n') as HTMLElement).click();
      } else if (action === 'mask') {
        const siblings = [...document.body.children];
        const ov = siblings[siblings.indexOf(dlg) - 1] as HTMLElement;
        ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
      await p;
      expect(vault.files.get('归档/网页剪藏/A.md')).toBe('旧内容'); // 未覆写
      expect(document.querySelector('.news-card-title')!.textContent).toBe('A'); // 停留在当前篇
      expect(getNoticeMessages().some((m) => m.includes('已保存'))).toBe(false); // 无保存成功通知
    }

    await cancelVia('btn');
    await cancelVia('mask');
    await cancelVia('esc');
  });

  it('标题清洗后为空（全非法字符）→ 「标题为空」且不建文件', async () => {
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('???:*"<>|')]));
    await reader.loadArticles();
    reader.render();
    await reader.saveToClip();
    expect(hasNotice('标题为空')).toBe(true);
    expect(vault.files.has('归档/网页剪藏/.md')).toBe(false);
  });

  it('markAsRead 空队列：返回 null 并渲染完成态', async () => {
    vault.files.set(NEWS_JSON, '[]');
    reader.init(false);
    await reader.loadArticles();
    const evt = reader.markAsRead('skipped');
    expect(evt).toBeNull();
    expect(document.querySelector('.news-card-area')!.textContent).toContain('今日文章已读完');
  });

  it('checkNewArticles：文件缺失静默；外部新增弹「新增 N 篇」；减少不提示', async () => {
    reader.init(false);
    // ① 文件缺失
    vault.files.delete(NEWS_JSON);
    await reader.checkNewArticles(0);
    expect(getNoticeMessages().some((m) => m.startsWith('新增'))).toBe(false);

    // ② 新增 1 篇
    vault.files.set(NEWS_JSON, JSON.stringify([makeArticle('A'), makeArticle('B'), makeArticle('C')]));
    await reader.checkNewArticles(2);
    expect(getNoticeMessages()).toContain('新增 1 篇文章');

    // ③ 减少
    clearNotices();
    await reader.checkNewArticles(10);
    expect(getNoticeMessages().some((m) => m.startsWith('新增'))).toBe(false);
  });

  it('renderMarkdown：h1-h4/粗斜体/引用/列表包 ul/段落与换行', () => {
    const html = reader.renderMarkdown('# H1\n## H2\n### H3\n#### H4\n\n**粗**和*斜*\n\n> 引用行\n\n- 甲\n- 乙');
    expect(html).toContain('<h1>H1</h1>');
    expect(html).toContain('<h2>H2</h2>');
    expect(html).toContain('<h3>H3</h3>');
    expect(html).toContain('<h4>H4</h4>');
    expect(html).toContain('<b>粗</b>');
    expect(html).toContain('<i>斜</i>');
    expect(html).toContain('<blockquote'); // 引用按转义后 &gt; 前缀匹配成 blockquote
    expect(html).not.toContain('&gt; 引用行');
    expect(html).toContain('<ul');
    expect(html).toContain('<li>甲</li>');
    expect(html).toContain('<li>乙</li>');
    // 链接渲染
    const linkHtml = reader.renderMarkdown('[链接](https://x.com)');
    expect(linkHtml).toContain('<a href="https://x.com" target="_blank" rel="noopener">链接</a>');
    // 图片渲染
    const imgHtml = reader.renderMarkdown('![图](https://x.com/i.png)');
    expect(imgHtml).toContain('<img src="https://x.com/i.png"');
  });

  it('unloadNews：移除全部遮罩/弹窗并清空模块引用（render 静默返回）', async () => {
    reader.init(false);
    reader.show();
    await flush();
    expect(document.querySelector('.news-mask')).not.toBeNull();
    reader.unloadNews();
    expect(document.querySelector('.news-mask')).toBeNull();
    expect(document.querySelector('.news-popup')).toBeNull();
    expect(() => reader.render()).not.toThrow(); // container=null 早退
    expect(() => reader.hide()).not.toThrow();
  });

  it('loadArticles：news.json 缺失 → 首用引导态（数据从哪来），不渲染完成态', async () => {
    vault.files.delete(NEWS_JSON);
    reader.init(false);
    await reader.loadArticles();
    reader.render();
    const text = document.querySelector('.news-done')!.textContent!;
    expect(text).toContain('数据从哪里来');
    expect(text).toContain('obsidian-news');
    expect(text).not.toContain('今日文章已读完');
  });
});
