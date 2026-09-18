// @vitest-environment jsdom
/**
 * 剪藏本域存储/数据侧评审修复回归（review-clipbook-bugs.md C9/C10/C12/C27/C28/C30/C31）。
 *
 * - C9：news.json 损坏（status='corrupt'）装载时给 error 通知（面板不再假空态静默）；
 *       missing（首用）语义不动；
 * - C10：写剪藏笔记剥外壳锚定串首（原文含 `---` 分隔线不丢段）；
 * - C12：剪藏目录以设置为唯一真理源（loader 每次扫描直读 clipDir()，M.dir 缓存已删）；
 * - C27：yamlEscape 先转义反斜杠（url/author/summary 含 `\` 不被 YAML 转义序列污染）；
 * - C28：stripClipChrome 闭合 `---` 按行锚定（frontmatter 值含 `---` 不提前截断）；
 * - C30：updateClipbookData 写盘失败上抛（消灭假成功；flowDeleteNews 侧吞错不炸）；
 * - C31：savedArchive 遗留兼容段（无产出方）——现有动线不写该段，读侧判定通道保留。
 *
 * 修复前红：C9 通知缺失 / C10 丢中段 / C12 扫旧目录 / C27 值被转义污染 /
 * C28 露 YAML 残渣 / C30 假成功 resolve。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { resetObsidianMocks, getNoticeMessages, clearNotices } from './mock-obsidian-entry';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp, getApp } from '../src/core/app';
import { setSettingsProvider } from '../src/core/settings-provider';
import { openClipbook, unloadClipbook } from '../src/clipbook';
import { M } from '../src/clipbook/state';
import { setClipDir } from './clipbook/helpers';
import { readNewsAndSidecar } from '../src/clipbook/loader';
import { getNewsFilePath } from '../src/clipbook/news-data';
import { writeClipNote } from '../src/clipbook/save';
import { stripClipChrome } from '../src/clipbook/md';
import { clipbookFilePath, readClipbookData, updateClipbookData } from '../src/clipbook/data';
import { flowDeleteNews } from '../src/clipbook/flow';

/** news.json 种子（lastFetchAt 非 0 拦住 openClipbook 的自动抓取，同 enhance.test.ts 口径） */
const NEWS_SEED = JSON.stringify({
  articles: [
    { platform: '果壳科学人', title: '文章甲', url: 'https://guokr.com/1', date: '2026-09-01 08:00:00', body: '正文甲' },
  ],
  stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
  bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
  sources: { zhihu: true, guokr: true, bilibili: true },
  lastFetchAt: Date.now(),
});

/** 种盘 + 注入三连。news: null = 不建 news.json（首用/缺失路径） */
function boot(opts: { news?: string | null; clips?: Record<string, string> } = {}): MockVault {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  const vault = new MockVault();
  const news = opts.news === undefined ? NEWS_SEED : opts.news;
  if (news !== null) vault.files.set(getNewsFilePath(), news!);
  for (const [p, c] of Object.entries(opts.clips || {})) vault.files.set(p, c);
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', articleDirectory: '归档/网页剪藏' } as any));
  return vault;
}

afterEach(() => {
  try { unloadClipbook(); } catch (e) { /* 幂等 */ }
  document.body.innerHTML = '';
});

describe('C9 news.json 损坏不再静默', () => {
  it('损坏 → 打开面板弹 error 通知；原文件不清盘（内容原样）', async () => {
    const vault = boot();
    const broken = '{"articles":';
    vault.files.set(getNewsFilePath(), broken);
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    // 翻转（效率#16 错误态分流）：损坏通知改走 notifyActionError——文案 = 动作名 + 原因 + 重试途径，
    // 且中栏以错误空态（含重试钮）替代引导空态
    const msgEl = await vi.waitFor(() => {
      const found = [...document.querySelectorAll('.bz-notice-msg')]
        .find((e) => e.textContent === '剪藏本数据读取失败：news.json 损坏（原文件已保留），请重试');
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });
    // 类型为 error（通知正文本身不带 emoji，视觉前缀由 ICONS 表承载）
    expect(msgEl.closest('.bz-notice')!.classList.contains('bz-notice--error')).toBe(true);
    expect(vault.files.get(getNewsFilePath())).toBe(broken); // 「不清盘保原文件」语义保持
    expect(M.clipNotes).toBeNull();
  });

  it('缺失（首用）不报损坏——missing 语义不动', async () => {
    boot({ news: null });
    openClipbook(getApp());
    await vi.waitFor(() => expect(M.open).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(getNoticeMessages().some((m) => m.includes('损坏'))).toBe(false);
  });
});

describe('C10 写剪藏笔记：正文剥外壳锚定串首', () => {
  it('正文含 --- 分隔线 → 原样保留（修复前中段被当 frontmatter 删掉）', async () => {
    const vault = boot();
    const body = 'intro\n\n---\n\n中段\n\n---\n\noutro';
    const ok = await writeClipNote({ title: '分段文', url: 'https://x.com/1', body });
    expect(ok).toBe(true);
    const md = vault.files.get('归档/网页剪藏/分段文.md')!;
    expect(md).toContain('intro\n\n---\n\n中段\n\n---\n\noutro');
  });

  it('正文头部真 frontmatter + dataviewjs 摘要块照常剥离（不动既有契约）', async () => {
    const vault = boot();
    const body = '---\nurl: "https://old.cn/1"\n---\n```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n正文乙';
    await writeClipNote({ title: '带壳文', url: 'https://x.com/2', body });
    const md = vault.files.get('归档/网页剪藏/带壳文.md')!;
    expect(md.endsWith('正文乙')).toBe(true);
    expect(md).not.toContain('url: "https://old.cn/1"');
  });
});

describe('C27 yamlEscape 反斜杠', () => {
  it('url/author 含 \\ → frontmatter 里转义为 \\\\（不被 YAML 转义序列污染）', async () => {
    const vault = boot();
    await writeClipNote({
      title: '反斜杠文',
      url: 'https://x.com/a\\b',
      author: 'C:\\Users\\bz',
      summary: '第一行\n第二行',
      body: '正文',
    });
    const md = vault.files.get('归档/网页剪藏/反斜杠文.md')!;
    expect(md).toContain('url: "https://x.com/a\\\\b"');
    expect(md).toContain('author: "C:\\\\Users\\\\bz"');
    expect(md).toContain('summary: "第一行 第二行"'); // 换行照旧转空格
  });
});

describe('C28 stripClipChrome 闭 --- 行锚定', () => {
  it('frontmatter 值含 --- → 不提前截断（LF）', () => {
    expect(stripClipChrome('---\nsummary: "a --- b"\nurl: x\n---\n正文')).toBe('正文');
  });

  it('frontmatter 值含 --- → 不提前截断（CRLF）', () => {
    expect(stripClipChrome('---\r\nsummary: "a --- b"\r\nurl: x\r\n---\r\n正文')).toBe('正文');
  });

  it('常规剪藏笔记：frontmatter + dataviewjs 块照常剥离（不动既有契约）', () => {
    const raw = '---\nurl: "https://x.cn/1"\ncreated: 2026-08-20 10:00:00\n---\n```dataviewjs\nawait dv.view(`CONFIG/SCRIPTS/DataView/摘要`)\n```\n\n正文丙';
    expect(stripClipChrome(raw)).toBe('正文丙');
  });
});

describe('C12 剪藏目录直读设置（无 M.dir 缓存）', () => {
  it('设置面板域改剪藏文件夹（无域内弹窗通知）→ 重读即扫新目录', async () => {
    const vault = boot({
      clips: { '归档/网页剪藏/旧藏.md': '---\nurl: "https://old.cn/1"\ncreated: 2026-08-20 10:00:00\n---\n旧' },
    });
    await readNewsAndSidecar();
    expect((M.clipNotes || []).map((n) => n.title)).toEqual(['旧藏']);
    // 模拟设置面板域改键：仅切 provider，无任何域内通知/弹窗 onClose
    setClipDir('归档/新剪藏');
    vault.files.set('归档/新剪藏/新藏.md', '---\nurl: "https://new.cn/1"\ncreated: 2026-08-21 10:00:00\n---\n新');
    await readNewsAndSidecar();
    expect((M.clipNotes || []).map((n) => n.title)).toEqual(['新藏']);
    expect(M.clipUrls.has('https://new.cn/1')).toBe(true);
  });
});

describe('C30 侧写写盘失败上抛', () => {
  it('写失败 → updateClipbookData reject（不再返回未落盘的假成功）；flowDeleteNews 侧吞错不炸', async () => {
    const vault = boot();
    vault.files.set(clipbookFilePath(), JSON.stringify({ articleOverrides: {}, savedArchive: [], order: [] }));
    const origModify = vault.modify.bind(vault);
    (vault as any).modify = async (f: any, c: string) => {
      if (f && f.path === clipbookFilePath()) throw new Error('disk full');
      return origModify(f, c);
    };
    await expect(updateClipbookData((d) => d)).rejects.toThrow('disk full');
    // 调用方 flowDeleteNews 已有 catch：整体不 reject（news 删除动作不被侧写失败放大）
    await expect(flowDeleteNews({ raw: { url: 'https://guokr.com/1', title: '文章甲' } })).resolves.toBeUndefined();
  });
});

describe('C31 savedArchive 遗留兼容段', () => {
  it('现有写入动线（侧写/删除）不产出该段；读侧判定通道保留', async () => {
    boot();
    // C29 起「在读切换」动线退役（flowToggleReading 已删）：以侧写队列原语复刻遗留 override 写入，
    // 验证删除动线仍会清理该键且不产出 savedArchive 段
    await updateClipbookData((d) => ({
      ...d,
      articleOverrides: { ...d.articleOverrides, 'url:https://x.com/1': { reading: true } },
    }));
    await flowDeleteNews({ raw: { url: 'https://x.com/1', title: 't' } });
    const sidecar = await readClipbookData();
    expect(sidecar.savedArchive).toEqual([]);
    expect(sidecar.articleOverrides).toEqual({});
  });
});
