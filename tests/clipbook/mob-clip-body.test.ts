// @vitest-environment jsdom
/**
 * issue 329 第三批回归：
 * - Bug A：已收剪藏（clip 来源）移动详情正文可读——对齐桌面懒加载（clipBodyCache →
 *   loadClipBody 双端原位水合），旧占位语「请在 Obsidian 中打开」退役；
 * - Bug B：正文容器（桌面 .bz-clip-art-md / 移动 .bz-clip-mob-d-md）长词防撑破样式
 *   （jsdom 不算 CSS 级联，锚样式源文本，menu-skin-vars.test.ts 同法）。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../../src/clipbook';
import { M } from '../../src/clipbook/state';

const CLIP_A = '---\nurl: "https://example.com/clip-a"\ncreated: 2026-08-20 10:00:00\n---\n```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n剪藏正文第一段，用于移动详情阅读。\n\n> 引用一句话\n';
const CLIP_EMPTY = '---\nurl: "https://example.com/clip-empty"\ncreated: 2026-08-21 10:00:00\n---\n';
const CLIP_LATER = '---\nurl: "https://example.com/clip-a"\ncreated: 2026-08-20 10:00:00\n---\n读盘完成后原位出现的剪藏正文。\n';

function seedVault(): MockVault {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/news.json', JSON.stringify({
    articles: [
      { platform: '果壳科学人', title: '果壳文章一', url: 'https://guokr.com/1', author: '果壳', date: '2026-09-01 08:00:00', fetchedAt: '2026-09-01 07:00:00', body: '正文一 的内容段落。' },
    ],
    stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
    bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
    sources: { zhihu: true, guokr: true, bilibili: true },
    // 锚住自动抓取：本文件只关心移动详情正文渲染
    lastFetchAt: Date.now(),
  }));
  vault.files.set('归档/网页剪藏/剪藏笔记A.md', CLIP_A);
  vault.files.set('归档/网页剪藏/空正文剪藏.md', CLIP_EMPTY);
  return vault;
}

function boot(): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
  const vault = seedVault();
  setApp(mockAppWithVault(vault));
  const settings = { storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' };
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  return vault;
}

async function openPanel(): Promise<MockVault> {
  const vault = boot();
  openClipbook(getApp());
  await vi.waitFor(() => expect(M.open).toBe(true));
  return vault;
}

/** 进移动详情（mob 层 DOM 桌面下同样构建；openMobDetail 不分端，toolbar.test 同法）。
 *  卡片以 waitFor 等出现——clip 条目来自剪藏目录异步扫描，面板打开后未必即时在 DOM */
async function openMobDetailByTitle(title: string): Promise<void> {
  const card = await vi.waitFor(() => {
    const el = [...document.querySelectorAll('.bz-clip-mob-item')].find((c) => c.textContent!.includes(title)) as HTMLElement | undefined;
    expect(el).toBeTruthy();
    return el!;
  });
  card.click();
  await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
}

const mobMd = (): HTMLElement | null => document.querySelector('[data-clip-mob-md]') as HTMLElement | null;

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  MockPlatform.isMobile = false;
  document.body.innerHTML = '';
});

describe('移动详情已收剪藏正文可读（issue 329 Bug A）', () => {
  it('clip 条目进移动详情：懒加载读盘 → 剥壳渲染正文（不再占位「请在 Obsidian 中打开」）', async () => {
    await openPanel();
    await openMobDetailByTitle('剪藏笔记A');
    await vi.waitFor(() => {
      const md = mobMd();
      expect(md).toBeTruthy();
      expect(md!.textContent).toContain('剪藏正文第一段');
    });
    // 旧占位语退役 + 外壳（frontmatter/dataviewjs）不进正文
    const md = mobMd()!;
    expect(md.textContent).not.toContain('请在 Obsidian 中打开');
    expect(md.textContent).not.toContain('dataviewjs');
    expect(md.textContent).not.toContain('url:');
    expect(md.textContent).toContain('引用一句话');
  });

  it('缓存未命中先显「正在读取剪藏正文…」，读盘完成后原位水合（追加语义：占位清空不残留）', async () => {
    const vault = await openPanel();
    // 拖长 cachedRead，稳定断言「正在读取」中间态
    const orig = vault.cachedRead.bind(vault);
    vi.spyOn(vault, 'cachedRead').mockImplementation(async (f: any) => {
      await new Promise((r) => setTimeout(r, 40));
      return orig(f);
    });
    await openMobDetailByTitle('剪藏笔记A');
    const loading = mobMd()!;
    expect(loading.textContent).toContain('正在读取剪藏正文…');
    // 读盘完成 → 占位被清掉（铁律 6 追加语义：水合前容器必须清空），正文原位出现
    await vi.waitFor(() => expect(mobMd()!.textContent).toContain('剪藏正文第一段'));
    expect(mobMd()!.textContent).not.toContain('正在读取剪藏正文…');
  });

  it('缓存命中直接出正文（二次打开同条不再读盘）', async () => {
    const vault = await openPanel();
    await openMobDetailByTitle('剪藏笔记A');
    await vi.waitFor(() => expect(mobMd()!.textContent).toContain('剪藏正文第一段'));
    // 返回目录再进详情：缓存路径，不触发第二次 cachedRead
    const spy = vi.spyOn(vault, 'cachedRead');
    const back = document.querySelector('[data-clip-mob-back]') as HTMLElement;
    back.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(false));
    const card = [...document.querySelectorAll('.bz-clip-mob-item')].find((c) => c.textContent!.includes('剪藏笔记A')) as HTMLElement;
    card.click();
    await vi.waitFor(() => expect(M.mobDetailOpen).toBe(true));
    await vi.waitFor(() => expect(mobMd()!.textContent).toContain('剪藏正文第一段'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('空正文剪藏：显「（笔记暂无正文）」终态占位', async () => {
    await openPanel();
    await openMobDetailByTitle('空正文剪藏');
    await vi.waitFor(() => {
      const md = mobMd();
      expect(md).toBeTruthy();
      expect(md!.textContent).toContain('（笔记暂无正文）');
    });
    expect(mobMd()!.textContent).not.toContain('请在 Obsidian 中打开');
  });

  it('读盘失败：移动详情同桌面显「正文读取失败，可打开笔记查看」', async () => {
    const vault = await openPanel();
    vi.spyOn(vault, 'cachedRead').mockRejectedValue(new Error('disk boom'));
    await openMobDetailByTitle('剪藏笔记A');
    await vi.waitFor(() => expect(mobMd()!.textContent).toContain('正文读取失败'));
  });

  it('同篇双 kick（桌面渲染 + 移动详情）只读盘一次，正文不因追加语义叠出重复', async () => {
    const vault = await openPanel();
    const spy = vi.spyOn(vault, 'cachedRead');
    // 先进移动详情（kick#1 读盘在途），再经桌面路径重渲同篇（renderReader kick#2 撞在途位）
    await openMobDetailByTitle('剪藏笔记A');
    await vi.waitFor(() => expect(mobMd()!.textContent).toContain('剪藏正文第一段'));
    const { reloadIfOpen } = await import('../../src/clipbook/ui');
    reloadIfOpen(); // 全量重渲：renderReader 与 renderMobDetail 对同篇连续渲染
    await vi.waitFor(() => {
      const md = mobMd();
      expect(md!.textContent).toContain('剪藏正文第一段');
      // 追加语义下若双水合：同一段落出现两次（textContent 双份）
      expect(md!.textContent.indexOf('剪藏正文第一段')).toBe(md!.textContent.lastIndexOf('剪藏正文第一段'));
    });
    // 缓存已就绪 → 重渲路径零读盘
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('正文容器长词防撑破样式（issue 329 Bug B）', () => {
  // jsdom 环境 import.meta.url 非 file 协议（fileURLToPath 不可用）——按 vitest 运行根拼路径
  const cssOf = (): string => readFileSync(join(process.cwd(), 'src/clipbook/styles.css'), 'utf8');

  /** 取选择器所在规则体（选择器段回溯上一规则 '}'，与 menu-skin-vars.test 同法） */
  function ruleBodyOf(css: string, selectorNeedle: string): string {
    const at = css.indexOf(selectorNeedle);
    expect(at).toBeGreaterThan(-1);
    const bodyStart = css.indexOf('{', at);
    const bodyEnd = css.indexOf('}', bodyStart);
    return css.slice(bodyStart, bodyEnd + 1);
  }

  it('桌面/移动两个正文容器均有 overflow-wrap:anywhere + word-break + min-width:0', () => {
    const css = cssOf();
    for (const sel of ['.bz-clip-art-md', '.bz-clip-mob-d-md']) {
      const body = ruleBodyOf(css, sel + ' {');
      expect(body).toContain('overflow-wrap: anywhere');
      expect(body).toContain('word-break: break-word');
      expect(body).toContain('min-width: 0');
    }
  });

  it('两容器内 img/video 兜底 max-width:100%（MarkdownRenderer 直出的无记号媒体同防撑破）', () => {
    const css = cssOf();
    const at = css.indexOf('正文媒体兜底');
    expect(at).toBeGreaterThan(-1);
    const bodyStart = css.indexOf('{', at);
    const bodyEnd = css.indexOf('}', bodyStart);
    const sel = css.slice(at, bodyStart);
    const body = css.slice(bodyStart, bodyEnd + 1);
    expect(sel).toContain('.bz-clip-art-md img');
    expect(sel).toContain('.bz-clip-art-md video');
    expect(sel).toContain('.bz-clip-mob-d-md img');
    expect(sel).toContain('.bz-clip-mob-d-md video');
    expect(body).toContain('max-width: 100%');
    expect(body).toContain('height: auto');
  });

  it('不引入 overflow-x 掩盖式方案（换行真正生效）', () => {
    const css = cssOf();
    expect(css).not.toContain('overflow-x: hidden');
    expect(css).not.toContain('overflow-x:hidden');
  });
});
