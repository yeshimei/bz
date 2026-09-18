// @vitest-environment jsdom
/**
 * clipbook 域修复批 D 回归（列表·检索·移动端·报告·样式）。
 *
 * 对号（详见 worktree 报告）：
 *  1  C-UI2/效率#18 移动触控热区 ≥40px（样式断言）
 *  2  效率#4 批量已读入口可见性（rail ✓✓ markup + 点击确认流 + 移动章头常驻灰态）
 *  3  效率#5 UP 行未读归零不消失（rail 行为）
 *  4  效率#9 AI 标签可见（readerHtml chip 行 + tocListHtml 尾标签）
 *  5  效率#13 命中 mark 高亮（高亮 + 防注入）
 *  6  效率#15 搜索域补 body/url（命中 + placeholder 如实）
 *  8  效率#8 同篇刷新正文闪空·轻版（标题节点身份不变）
 *  9  效率#20 报告 Top5 可点回看（命中行有钮、失隐行无 + revealArticleByKey）
 * 10  C-UI4 无效 CSS 负 margin
 * 11  C-UI5 桌面折叠行键盘可达（tabindex + keydown）
 * 12  C-UI6 移动 100vh → --bz-vvh
 * 13  一致#11 danger 皮肤形制（.bz-flow-dialog--danger 限定覆写亮暗两套）
 * 14  一致#12 padStart → pad2 单源（grep 断言）
 * 15  一致#16 报告字体栈 var(--clip-serif) + token 补 Songti SC
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import {
  railItemHtml, tocListHtml, readerHtml, deskFoldRowHtml, mobChHeadHtml, mobTocHtml,
  panelHtml, highlightTitleHtml, buildClipReportSections,
} from '../../src/clipbook/render';
import type { ClipArticle } from '../../src/clipbook/render';
import { articleKeyOf } from '../../src/clipbook/constants';
import { revealArticleByKey, refreshReadingViews, closePanel } from '../../src/clipbook/ui';
import { M } from '../../src/clipbook/state';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';

const repo = (p: string): string => readFileSync(fileURLToPath(new URL('../..' + p, import.meta.url)), 'utf8');
const cssOf = (): string => repo('/src/clipbook/styles.css');

function art(partial: Partial<ClipArticle>): ClipArticle {
  return {
    id: 'url:https://x.com/1',
    origin: 'news',
    title: '测试标题',
    url: 'https://x.com/1',
    site: '果壳科学人',
    domain: 'x.com',
    author: '',
    srcName: '果壳科学人',
    typeLabel: '',
    timeText: '',
    timeTs: 0,
    summary: '摘要',
    body: '',
    tags: [],
    notePath: null,
    st: 'unread',
    clipped: false,
    backlinks: [],
    ...partial,
  };
}

// ==================== render 纯层 markup ====================

describe('批 D·rail ✓✓ 批量已读钮（效率#4 markup 单源）', () => {
  it('markAllN>0 挂 data-clip-rail-markall + title 写明 N 篇；缺省/0 不挂', () => {
    const sel = { kind: 'site', site: '果壳' } as any;
    const withBtn = railItemHtml(sel, '果壳', 3, 10, 'feed', '#fff', false, '', 3);
    expect(withBtn).toContain('data-clip-rail-markall');
    expect(withBtn).toContain('全部标为已读（3 篇）');
    expect(withBtn).toContain('check-check');
    const noBtn = railItemHtml(sel, '果壳', 0, 10, 'feed', '#fff', false, '');
    expect(noBtn).not.toContain('data-clip-rail-markall');
    expect(railItemHtml(sel, '果壳', 0, 10, 'feed', '#fff', false, '', 0)).not.toContain('data-clip-rail-markall');
  });

  it('移动章头常驻灰态钮：markAllN>0 挂 data-clip-ch-markall；mobTocHtml 透传章 markAllN', () => {
    const hd = mobChHeadHtml('果壳科学人', 2, 1, 0, 2);
    expect(hd).toContain('data-clip-ch-markall');
    expect(hd).toContain('全部标为已读（2 篇）');
    expect(mobChHeadHtml('孤站', 0, 0, 0)).not.toContain('data-clip-ch-markall');
    const toc = mobTocHtml([{
      site: '果壳科学人', unread: 2, activeN: 2, readN: 0, savedN: 0, markAllN: 2,
      activeHtml: '<div></div>', readHtml: '', savedHtml: '',
    }], false, new Set());
    expect(toc).toContain('data-clip-ch-markall');
  });
});

describe('批 D·目录条目（效率#9 标签尾注 / 效率#13 mark 高亮 / 一致#12 pad2）', () => {
  it('meta 行尾追加前两个标签，超出省略号；无标签不显', () => {
    const t = (tags: string[]) => tocListHtml([art({ tags })], null, () => '昨天');
    expect(t(['AI', '经济', '政策'])).toContain('<span class="bz-clip-item-tags">#AI #经济 …</span>');
    expect(t(['AI'])).toContain('<span class="bz-clip-item-tags">#AI</span>');
    expect(t(['AI'])).not.toContain('…');
    expect(t([])).not.toContain('bz-clip-item-tags');
    // meta 段（站点 · 时间）不受高亮影响
  });

  it('序号 pad2：1→01、9→09、10→10', () => {
    const list = Array.from({ length: 10 }, (_, i) => art({ id: 'u' + i, title: 'T' + i }));
    const html = tocListHtml(list, null, () => '');
    expect(html).toContain('<span class="bz-clip-no">01</span>');
    expect(html).toContain('<span class="bz-clip-no">09</span>');
    expect(html).toContain('<span class="bz-clip-no">10</span>');
    expect(html).not.toContain('>1</span>');
  });

  it('kw 高亮：大小写不敏感 <mark> 包裹；kw 空不高亮；meta 段不高亮', () => {
    expect(highlightTitleHtml('Hello World', 'world')).toBe('Hello <mark>World</mark>');
    expect(highlightTitleHtml('Hello World', '')).toBe('Hello World');
    const html = tocListHtml([art({ title: '果壳文章一', srcName: '果壳科学人' })], null, () => '昨天', '果壳');
    expect(html).toContain('<mark>');
    // 命中在标题段
    expect(html).toMatch(/<span><mark>果壳<\/mark>文章一<\/span>/);
  });

  it('高亮防注入：title 先 esc 再包裹，原始 HTML 不复活', () => {
    const out = highlightTitleHtml('<img src=x onerror=alert(1)>', 'img');
    expect(out).toContain('<mark>img</mark>');
    expect(out).not.toContain('<img ');
    // 关键词带 HTML 也不注入（kw 同样先 esc）
    const out2 = highlightTitleHtml('abc', '<b>');
    expect(out2).toBe('abc'); // esc('<b>')='&lt;b&gt;' 在 'abc' 中无命中
    const out3 = tocListHtml([art({ title: 'a & b 计划' })], null, () => '', '&');
    expect(out3).toContain('&amp;');
    expect(out3).not.toMatch(/<mark>[^<]*&$/); // 不以残实体收尾的粗断言：实体不被劈开成裸 &
  });
});

describe('批 D·阅读面标签 chip 行（效率#9）', () => {
  it('tags 非空 → meta 行下 .bz-clip-art-tags（逐 tag chip）；空 → 不显行', () => {
    const withTags = readerHtml(art({ tags: ['AI', '经济'] }), { time: '昨天', note: '' });
    expect(withTags).toContain('bz-clip-art-tags');
    expect(withTags).toContain('<span class="bz-clip-art-tag">AI</span>');
    expect(withTags).toContain('<span class="bz-clip-art-tag">经济</span>');
    // chip 行在 meta 之后、摘要之前
    expect(withTags.indexOf('bz-clip-art-tags')).toBeGreaterThan(withTags.indexOf('bz-clip-art-meta'));
    expect(withTags.indexOf('bz-clip-art-tags')).toBeLessThan(withTags.indexOf('bz-clip-art-sum'));
    const noTags = readerHtml(art({ tags: [] }), { time: '昨天', note: '' });
    expect(noTags).not.toContain('bz-clip-art-tags');
  });
});

describe('批 D·桌面折叠行键盘可达（C-UI5 markup）', () => {
  it('deskFoldRowHtml 带 tabindex="0" + role=button + aria-expanded', () => {
    const row = deskFoldRowHtml('read', 3, false);
    expect(row).toContain('tabindex="0"');
    expect(row).toContain('role="button"');
    expect(row).toContain('aria-expanded="false"');
    expect(deskFoldRowHtml('saved', 2, true)).toContain('aria-expanded="true"');
  });
});

describe('批 D·报告 Top5 可点回看（效率#20 markup）', () => {
  const d: any = {
    period: 'week', articles: 2, sessions: 2, totalMinutes: 30,
    bySrc: [], hours: new Array<number>(24).fill(0),
    topArticles: [
      { key: 'url:https://a.com/1', title: '甲篇', src: '果壳', minutes: 20 },
      { key: 'url:https://gone.com/2', title: '失隐篇', src: '知乎', minutes: 10 },
    ],
    activeDays: 1,
  };

  it('命中 key 行挂 data-clip-rep-key + data-clip-rep-open；失隐行两者皆无', () => {
    const secs = buildClipReportSections(d, { availableKeys: new Set(['url:https://a.com/1']) });
    const overview = secs[0].generate();
    expect(overview).toContain('data-clip-rep-key="url:https://a.com/1"');
    expect(overview).toContain('data-clip-rep-open');
    expect(overview).not.toContain('data-clip-rep-key="url:https://gone.com/2"');
    // 失隐行整行不挂钮（打开钮只出现在命中行）
    const rows = overview.split('bz-clp-rep-top-row').slice(1);
    expect(rows[0]).toContain('data-clip-rep-open');
    expect(rows[1]).not.toContain('data-clip-rep-open');
  });

  it('不传 availableKeys（不可知）→ 全部不挂（现行为兼容）', () => {
    const overview = buildClipReportSections(d)[0].generate();
    expect(overview).not.toContain('data-clip-rep-open');
    expect(overview).not.toContain('data-clip-rep-key');
  });
});

describe('批 D·placeholder 如实（效率#15）', () => {
  it('桌面/移动搜索框文案 =「检索标题、摘要、站点、来源…」', () => {
    const html = panelHtml();
    expect(html).toContain('placeholder="检索标题、摘要、站点、来源…"');
  });
});

// ==================== 样式断言（锚样式源文本，jsdom 不算级联） ====================

describe('批 D·样式断言', () => {
  it('C-UI2/效率#18：移动五组触控目标 padding 抬档（高 ≥40px 口径）', () => {
    const css = cssOf();
    const blockOf = (sel: string): string => {
      const i = css.indexOf(sel);
      expect(i).toBeGreaterThan(-1);
      return css.slice(css.indexOf('{', i), css.indexOf('}', i));
    };
    expect(blockOf('.bz-clip-mob-act {')).toContain('padding: 10px 6px');
    expect(blockOf('.bz-clip-mob-fold {')).toContain('padding: 10px 2px');
    expect(blockOf('.bz-clip-mob-save {')).toContain('padding: 10px 6px');
    expect(blockOf('.bz-clip-mob-d-next {')).toContain('padding: 10px 0');
    // 报告周期 seg：移动媒体查询段内抬档 + min-height 保底（桌面基座块不动）
    const mobStart = css.indexOf('@media (max-width: 768px) {', css.indexOf('bz-clip-report-frame'));
    expect(mobStart).toBeGreaterThan(-1);
    const segPos = css.indexOf('.bz-clp-rep-seg-btn', mobStart);
    expect(segPos).toBeGreaterThan(mobStart);
    const mobSeg = css.slice(css.indexOf('{', segPos), css.indexOf('}', segPos));
    expect(mobSeg).toContain('min-height: 40px');
    expect(mobSeg).toContain('padding: 9px 14px');
  });

  it('C-UI4：负 margin 走 calc（无效声明 -var(...) 清零）', () => {
    const css = cssOf();
    expect(css).not.toMatch(/margin-right:\s*-var\(/);
    expect(css).toContain('margin-right: calc(-1 * var(--bz-space-sm))');
  });

  it('C-UI6：移动真全屏两处接 var(--bz-vvh, 100vh)', () => {
    const css = cssOf();
    const matches = [...css.matchAll(/height:\s*var\(--bz-vvh, 100vh\)/g)];
    expect(matches.length).toBeGreaterThanOrEqual(4); // frame 高/最大高 + 报告帧高/最大高
    expect(css).not.toMatch(/height:\s*100vh/); // 域内不再有裸 100vh 高度
  });

  it('一致#16：--clip-serif 定义全量补 Songti SC；确认框皮衬线走 var(--clip-serif) 单源', () => {
    const css = cssOf();
    const defs = [...css.matchAll(/--clip-serif:([^;]+);/g)].map((m) => m[1]);
    expect(defs.length).toBeGreaterThanOrEqual(4); // 域 token + selbar + 报告帧 + 确认框皮根
    for (const d of defs) expect(d).toContain('Songti SC');
    // 报告弹层漂移字面量栈（Georgia + 全后缀）清零；「Georgia, var(--clip-serif)」混合写法（.bz-clip-no 等）不在禁止列
    expect(css).not.toMatch(/font-family:\s*Georgia,\s*"Noto Serif SC"[^;]*serif/);
    expect(css.match(/font-family:\s*var\(--clip-serif\)/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it('一致#11：danger 皮肤形制覆写（.bz-flow-dialog--danger 限定，亮暗两套方角 + 危险色）', () => {
    const css = cssOf();
    const light = css.match(/#__shared_confirm_popup__\.bz-overlay-popup\.bz-clip-dialog-editorial\.bz-flow-dialog--danger #__shared_confirm_ok__\s*\{([^}]*)\}/);
    expect(light, '亮色 danger 覆写').toBeTruthy();
    expect(light![1]).toContain('border-radius: 0');
    expect(light![1]).toContain('color: var(--bz-danger)');
    const dark = css.match(/\.theme-dark #__shared_confirm_popup__\.bz-overlay-popup\.bz-clip-dialog-editorial\.bz-flow-dialog--danger #__shared_confirm_ok__\s*\{([^}]*)\}/);
    expect(dark, '暗色 danger 覆写').toBeTruthy();
    expect(dark![1]).toContain('color: var(--bz-danger)');
  });

  it('效率#4：rail ✓✓ 钮与移动章头灰态钮样式在位', () => {
    const css = cssOf();
    expect(css).toContain('.bz-clip-rail .bz-clip-rail-markall');
    expect(css).toContain('.bz-clip-rail .bz-rail-item:hover .bz-clip-rail-markall');
    expect(css).toContain('.bz-clip-mob-ch-mark');
  });

  it('效率#13：mark 高亮样式走 --text-accent 底', () => {
    expect(cssOf()).toMatch(/\.bz-clip-item-t mark\s*\{[^}]*--text-accent/);
  });

  it('一致#12：render.ts / report-stats.ts 源码零 padStart（image-save.ts 归批 A 不在断言内）', () => {
    expect(repo('/src/clipbook/render.ts')).not.toContain('padStart(');
    expect(repo('/src/clipbook/report-stats.ts')).not.toContain('padStart(');
  });
});

// ==================== UI 行为（jsdom） ====================

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文一 的内容段落。' },
      { platform: 'B站', title: '影视飓风视频', url: 'https://bilibili.com/video/BV1', author: '影视飓风', date: '2026-09-01 09:00:00', body: '视频简介内容' },
      { platform: 'B站', title: '已读旧视频', url: 'https://bilibili.com/video/BV0', author: '影视飓风', date: '2026-09-10 09:00:00', body: '旧视频', read: true, state: 'skipped' },
    ],
    stats: { totalRead: 1, totalSaved: 0, totalSkipped: 1, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    lastFetchAt: Date.now(),
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', '---\nurl: "https://example.com/clip-a"\ncreated: 2026-08-20 10:00:00\ntags: [AI, 经济]\n---\n剪藏正文第一段。\n');
  return vault;
}

async function openDesktop(): Promise<{ vault: MockVault }> {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  await vi.waitFor(() => expect(M.articles.length).toBe(3));
  return { vault };
}

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

describe('批 D·UI 行为', () => {
  it('效率#5：UP 未读归零行不消失——全已读 UP 仍在 rail 且计数 0/2', async () => {
    const { vault } = await openDesktop();
    // 把 UP 剩余一篇未读也标已读（直接改盘 + 重载触发重渲）
    const disk = JSON.parse((vault as any).files.get('CONFIG/STORAGE/news.json'));
    for (const a of disk.articles) if (a.platform === 'B站') { a.read = true; if (!a.state) a.state = 'skipped'; }
    (vault as any).files.set('CONFIG/STORAGE/news.json', JSON.stringify(disk));
    const { reloadIfOpen } = await import('../../src/clipbook/ui');
    reloadIfOpen();
    // 重载完成后再断言：行在 + 未读数照实显 0 + 无 ✓✓ 钮（一次 waitFor 内收敛，防旧 DOM 竞态）
    await vi.waitFor(() => {
      const upRows = [...document.querySelectorAll('.bz-rail-item')].filter((r) => (r as HTMLElement).textContent!.includes('影视飓风'));
      expect(upRows.length).toBe(1);
      expect(upRows[0].textContent).toContain('0/2');
      expect(upRows[0].querySelector('[data-clip-rail-markall]')).toBeNull();
    });
  });

  it('效率#4：rail 源行 ✓✓ 钮可见（有未读的行挂钮）且点击走「全部标为已读（N 篇）」确认流', async () => {
    const { vault } = await openDesktop();
    const allRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => (r as HTMLElement).textContent!.includes('全部未读')) as HTMLElement;
    const mark = allRow.querySelector('[data-clip-rail-markall]') as HTMLElement;
    expect(mark).toBeTruthy();
    expect(mark.getAttribute('title')).toContain('2 篇');
    // 剪藏本源行（无未读语义）不挂钮
    const clipRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => (r as HTMLElement).textContent!.includes('剪藏本')) as HTMLElement;
    expect(clipRow.querySelector('[data-clip-rail-markall]')).toBeNull();
    // 点击 → 同款确认框（不切源）
    mark.click();
    const popup = await vi.waitFor(() => {
      const el = document.querySelector('#__shared_confirm_popup__') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(popup.textContent).toContain('2 篇');
    expect(M.sel.kind).toBe('all'); // 点击钮不触发源切换
    (document.querySelector('#__shared_confirm_ok__') as HTMLElement).click();
    await drainNewsWritesForTests();
    await vi.waitFor(() => {
      const unread = JSON.parse((vault as any).files.get('CONFIG/STORAGE/news.json')).articles.filter((a: any) => !a.read);
      expect(unread).toHaveLength(0);
    });
    // 落盘后 rail 重渲：未读归零 → 钮消失（实时文档查询——renderRail 是 innerHTML 整列重建，
    // 旧 allRow 引用已脱管，不能拿它断言新状态）
    await vi.waitFor(() => {
      const freshAllRow = [...document.querySelectorAll('.bz-rail-item')].find((r) => (r as HTMLElement).textContent!.includes('全部未读')) as HTMLElement;
      expect(freshAllRow).toBeTruthy();
      expect(freshAllRow.querySelector('[data-clip-rail-markall]')).toBeNull();
    });
  });

  it('效率#4：移动章头常驻灰态钮点击 = 同款确认流', async () => {
    await openDesktop();
    const hd = document.querySelector('.bz-clip-mob-ch-hd') as HTMLElement;
    expect(hd).toBeTruthy();
    const mark = hd.querySelector('[data-clip-ch-markall]') as HTMLElement;
    expect(mark).toBeTruthy();
    mark.click();
    const popup = await vi.waitFor(() => {
      const el = document.querySelector('#__shared_confirm_popup__') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });
    expect(popup.textContent).toContain('全部标为已读');
    closeClipReportLike(popup);
  });

  it('C-UI5：桌面折叠行键盘开合（Enter/Space → toggleDeskFold，aria-expanded 翻转）', async () => {
    await openDesktop();
    const findFold = (): HTMLElement => document.querySelector('[data-desk-fold]') as HTMLElement;
    const fold0 = findFold();
    expect(fold0).toBeTruthy();
    expect(fold0.getAttribute('tabindex')).toBe('0');
    expect(fold0.getAttribute('aria-expanded')).toBe('false');
    fold0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // toggleDeskFold → renderList 重建 DOM：新节点上断言（旧节点脱管属性冻结）
    await vi.waitFor(() => {
      const f = findFold();
      expect(f).toBeTruthy();
      expect(f.getAttribute('aria-expanded')).toBe('true');
      expect(f.classList.contains('on')).toBe(true);
    });
    findFold().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      const f = findFold();
      expect(f).toBeTruthy();
      expect(f.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('效率#15：搜索命中 body 与 url；placeholder 域如实（body 词/链接都能召回）', async () => {
    await openDesktop();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    // body 命中（news 正文在内存）
    input.value = '内容段落';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-clip-item').length).toBe(1));
    expect(document.querySelector('.bz-clip-list')!.textContent).toContain('果壳文章一');
    // url 命中
    input.value = 'bilibili.com/video';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => {
      const items = [...document.querySelectorAll('.bz-clip-item')].filter((i) => (i as HTMLElement).textContent!.includes('影视飓风视频'));
      expect(items.length).toBe(1);
    });
    closePanel();
  });

  it('效率#13：搜索态目录标题 <mark> 高亮渲染（jsdom 真渲染链）', async () => {
    await openDesktop();
    const input = document.querySelector('[data-clip-desk-search]') as HTMLInputElement;
    input.value = '果壳';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-clip-item-t mark')).toBeTruthy());
    closePanel();
  });

  it('效率#8：同篇动作后轻版刷新——标题/摘要节点身份不变（不整栏重建）', async () => {
    await openDesktop();
    const readerEl = document.querySelector('[data-clip-reader]') as HTMLElement;
    const title = readerEl.querySelector('.bz-clip-art-title');
    const meta = readerEl.querySelector('.bz-clip-art-meta');
    const md = readerEl.querySelector('[data-clip-md]');
    expect(title).toBeTruthy();
    refreshReadingViews(M.cur!.id);
    expect(readerEl.querySelector('.bz-clip-art-title')).toBe(title);
    expect(readerEl.querySelector('.bz-clip-art-meta')).toBe(meta);
    expect(readerEl.querySelector('[data-clip-md]')).toBe(md);
    // 切篇守卫：他篇 id 不触发任何重建
    const htmlBefore = readerEl.innerHTML;
    refreshReadingViews('url:https://not-current.example/x');
    expect(readerEl.innerHTML).toBe(htmlBefore);
    closePanel();
  });

  it('效率#20：revealArticleByKey——news key 面板开着直接选中；clip key 走 revealClipArticle 链', async () => {
    await openDesktop();
    const raw = JSON.parse((getApp().vault as any).files.get('CONFIG/STORAGE/news.json')).articles[0];
    const key = articleKeyOf(raw);
    revealArticleByKey(key);
    await vi.waitFor(() => {
      expect(M.cur && M.cur.id).toBe(key);
      expect(M.sel.kind).toBe('all');
    });
    // clip key
    revealArticleByKey('clip:归档/网页剪藏/剪藏笔记A.md');
    await vi.waitFor(() => {
      expect(M.cur && M.cur.id).toBe('clip:归档/网页剪藏/剪藏笔记A.md');
      expect(M.sel.kind).toBe('clip');
    });
    closePanel();
  });

  it('效率#20：面板未开时 revealArticleByKey 开面板装载后定位', async () => {
    try { unloadClipbook(); } catch (e) { /* 幂等 */ }
    resetObsidianMocks();
    document.body.innerHTML = '';
    const vault = seedVault();
    setApp(mockAppWithVault(vault));
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
    const raw = JSON.parse((vault as any).files.get('CONFIG/STORAGE/news.json')).articles[1];
    const key = articleKeyOf(raw);
    expect(M.open).toBe(false);
    revealArticleByKey(key);
    await vi.waitFor(() => expect(M.open).toBe(true));
    await vi.waitFor(() => {
      expect(M.cur && M.cur.id).toBe(key);
      expect(M.sel.kind).toBe('all');
    });
    closePanel();
  });
});

/** 确认框善后（点取消收掉，不影响后续用例） */
function closeClipReportLike(popup: HTMLElement): void {
  const cancel = popup.querySelector('#__shared_confirm_cancel__') as HTMLElement | null;
  if (cancel) cancel.click();
}
