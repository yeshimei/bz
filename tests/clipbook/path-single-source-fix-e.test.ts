// @vitest-environment jsdom
/**
 * 剪藏本（clipbook）· T5 剪藏目录路径单源四面一致（review-deep clipbook-arch 测试缺口 5，随 A3 立项）
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 开关 CLIPDIR_SINGLE_SOURCE 钉死的是本批基线（master @ 92dba387，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - CLIPDIR_SINGLE_SOURCE → 批 A（覆盖确认迁 flow-dialog / 路径单源 / 卸载收口，clipbook-arch A3）：
 *     save.ts clipDirOf 补尾斜杠归一并收敛为域内单源（flow/loader/index/file-sync 改引同一读取点）。
 * 并行修复合并进 master 后，主线程把开关翻 true 即断言翻转为「必须」语义
 * （四面一致 + 同名覆盖确认弹出成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 参考先例：tests/memo/flip-switches-fix-e.test.ts、tests/diary/wall-event-contract.test.ts。
 *
 * 四面 = ①writeClipNote 写盘路径 ②scanClipDirectory/loader 扫描路径（剥斜杠读取）
 *       ③flowSave 事件 clipPath（flow.dirOf 剥斜杠）④file-sync/rename 反查（同剥斜杠口径）。
 * registerAutoRefresh 的 inDir 是前缀判定（dir + '/'），双斜杠路径同样命中、不构成分叉面，不单列。
 * 设置「剪藏文件夹」带尾斜杠（合法输入）时现状写盘独走 `目录//标题.md`，
 * 其余各面全在剥斜杠路径上——覆盖确认预查 miss 不弹、扫描整批看不见、事件路径与盘上分叉。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { onDomainEvent } from '../../src/core/domain-bus';
import { writeClipNote } from '../../src/clipbook/save';
import { scanClipDirectory } from '../../src/clipbook/scan';
import { flowSave } from '../../src/clipbook/flow';
import { drainNewsWritesForTests } from '../../src/clipbook/write-queue';

/** 【期望配置】见文件头「可配置期望约定」：现状 false（钉旧基线行为），批 A 合并后翻转 */
const CLIPDIR_SINGLE_SOURCE = true; // 批 A 已合并：clipDir 单源五面一致

vi.mock('../../src/knowledge', () => ({
  openKnowledgeAddTask: vi.fn(),
  upgradeNoteSourceInternal: vi.fn(),
  retireKnowledgeSourcesForClip: vi.fn(),
}));

const RAW = (over: Record<string, unknown> = {}) => ({
  platform: '果壳科学人',
  title: '路径探针文',
  url: 'https://gk.com/path-1',
  author: '果壳',
  body: '路径往返正文。',
  date: '2026-09-01 08:00:00',
  summary: '路径探针摘要',
  tags: ['探针'],
  ...over,
});

/** 设置项带尾斜杠（A3 的合法输入病灶） */
const TAIL_SLASH_SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  articleDirectory: '归档/网页剪藏/',
} as any;

function boot(files: Record<string, string> = {}): MockVault {
  const vault = new MockVault();
  vault.files.set(
    'CONFIG/STORAGE/news.json',
    JSON.stringify({
      articles: [RAW()],
      stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
      bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: '',
      sources: { zhihu: true, guokr: true, bilibili: true }, rssFeeds: [], lastFetchAt: 0, fetchIntervalMin: 30,
    })
  );
  for (const [k, v] of Object.entries(files)) vault.files.set(k, v);
  setApp(mockAppWithVault(vault));
  setSettingsProvider(() => ({ ...TAIL_SLASH_SETTINGS }));
  return vault;
}

/** 覆盖确认是否在 DOM（现状自绘遮罩与迁移后 flow-dialog 的判定交集：主动作「覆盖」按钮） */
function findOverwriteConfirm(): HTMLButtonElement | null {
  const btns = [...document.querySelectorAll('button')] as HTMLButtonElement[];
  // 批 A 迁移 flow-dialog 后主动作文案为「覆盖更新」（自绘壳时代为「覆盖」）：取交集 = 含「覆盖」
  return btns.find((b) => (b.textContent || '').includes('覆盖')) || null;
}

/** 剥斜杠目录的扫描视图（loader.clipDir 口径）：
 *  MockVault 对 `//` 键做目录推导会无限递归（真机 TFolder 无此路径），故扫描面在
 *  「目录直接子文件」过滤副本上进行——`//` 键不属于剥斜杠目录的直接子文件，与真机
 *  目录树口径一致：现状双斜杠落盘对扫描不可见，单源落盘（clean 键）可见。 */
function scanView(vault: MockVault): MockVault {
  const view = Object.create(vault) as MockVault;
  view.files = new Map([...vault.files].filter(([k]) => !k.includes('//')));
  return view;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  const btn = findOverwriteConfirm();
  if (btn) btn.click(); // 兜底关掉悬挂确认（现状自绘 / 迁移后 flow-dialog 通用）
  document.body.innerHTML = '';
});

describe('T5 剪藏目录路径单源（开关 CLIPDIR_SINGLE_SOURCE，批 A / clipbook-arch A3）', () => {
  it('尾斜杠设置下 flowSave：写盘路径 × 扫描可见 × 事件 clipPath 按开关钉死', async () => {
    const vault = boot();
    const clipEvents: Array<{ kind: string; clipPath?: string }> = [];
    const off = onDomainEvent('news', (e: any) => clipEvents.push({ kind: e.kind, clipPath: e.clipPath }));
    try {
      const ok = await flowSave({ raw: RAW() });
      expect(ok).toBe(true);
    } finally {
      off();
    }
    await drainNewsWritesForTests();

    const slashKey = '归档/网页剪藏//路径探针文.md';
    const cleanKey = '归档/网页剪藏/路径探针文.md';
    const savedEvt = clipEvents.find((e) => e.kind === 'saved');
    expect(savedEvt).toBeTruthy();

    // ③ 事件 clipPath：flow.dirOf 剥斜杠，两态一致（smartcat/auto-summary 拿到的路径）
    expect(savedEvt!.clipPath).toBe(cleanKey);

    if (CLIPDIR_SINGLE_SOURCE) {
      // 修复后（必须）：四面同走剥斜杠单源
      expect(vault.files.has(cleanKey)).toBe(true); // ① 写盘
      expect(vault.files.has(slashKey)).toBe(false);
      const notes = await scanClipDirectory('归档/网页剪藏', { vault: scanView(vault) }); // ② 扫描
      expect(notes !== null && notes.some((n) => n.url === RAW().url)).toBe(true);
      expect(savedEvt!.clipPath).toBe(cleanKey); // ①=③ 盘上路径与事件路径一致
    } else {
      // 现状（钉死）：写盘独走双斜杠路径，扫描看不见、事件路径与盘上分叉
      expect(vault.files.has(slashKey)).toBe(true); // ① 写盘 `目录//标题.md`
      expect(vault.files.has(cleanKey)).toBe(false);
      const notes = await scanClipDirectory('归档/网页剪藏', { vault: scanView(vault) }); // ② 扫描（剥斜杠）看不到
      expect(notes === null || notes.length === 0).toBe(true);
      expect(savedEvt!.clipPath).not.toBe(slashKey); // ①≠③ 剪藏文件路径静默分叉
    }
  });

  it('尾斜杠设置下同名二次保存：覆盖确认按开关钉死（现状 miss 不弹、翻出双斜杠副本 / 单源后弹确认）', async () => {
    const vault = boot({ '归档/网页剪藏/同名文.md': '---\nurl: "https://old.example/a"\ncreated: 2026-08-01 08:00:00\n---\n旧剪藏正文' });

    const writing = writeClipNote(RAW({ title: '同名文', url: 'https://gk.com/same-name' }));
    // 让微任务跑起来（现状 miss → 直接写盘返回；单源 → 确认框挂起等待）
    await new Promise((r) => setTimeout(r, 30));
    const dialog = findOverwriteConfirm();

    if (CLIPDIR_SINGLE_SOURCE) {
      // 修复后（必须）：预查命中 → 覆盖确认弹出；点「覆盖」→ 原文件被覆盖、无双斜杠副本
      expect(dialog, '【必须】同名覆盖确认应弹出（单源路径预查命中）').toBeTruthy();
      dialog!.click();
      expect(await writing).toBe(true);
      expect(vault.files.has('归档/网页剪藏/同名文.md')).toBe(true);
      expect(vault.files.has('归档/网页剪藏//同名文.md')).toBe(false);
      expect(vault.files.get('归档/网页剪藏/同名文.md')!).toContain('url: "https://gk.com/same-name"');
    } else {
      // 现状（钉死）：预查 miss → 不弹确认、静默写出双斜杠副本（旧剪藏与新版并存两套路径）
      expect(dialog, '【现状 miss】覆盖确认不应弹出（写盘路径在双斜杠分叉上）。批 A 合并后把开关翻 true').toBeNull();
      expect(await writing).toBe(true);
      expect(vault.files.has('归档/网页剪藏//同名文.md')).toBe(true);
      expect(vault.files.get('归档/网页剪藏/同名文.md')!).toContain('旧剪藏正文'); // 旧文件未被覆盖
    }
  });
});
