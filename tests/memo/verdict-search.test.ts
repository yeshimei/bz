/**
 * memo 拍板执行批回归 · 搜索三连（呈报#4/#5/#7，2026-09-21 拍板）：
 * - 4A 搜索框 ESC 二段清词：有词先清词（面板不关、光标送回），没词才放行关面板
 *   （registerPanelEsc 口径不变；clipbook 效率#11 定稿范式）。
 *   修复前必红：ESC 直接冒泡 escManager 关掉整个面板。
 * - 5A 搜索框尾部 ✕ 一键清词（有词才现，点了清词 + 光标回框）+ 空态「清除搜索」按钮
 *   （兑现空态文案「或清除搜索」的承诺；clipbook 效率#12 定稿范式）。
 *   修复前必红：✕ 与空态按钮均不存在。
 * - 7A 搜索范围补网址字段（hay 五字段 + url）。
 *   修复前必红：按网址片段搜索零命中。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState, M } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel, registerEscapeHandler } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  memoAutoArchive: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

/** 自造 fixture（铁律：绝不触碰用户 memo.json） */
function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault> } {
  const vault = new MockVault();
  const items = [
    { id: 'v1', title: '完成阅读报告', scene: '学习', priority: 'minor', created: at(-1, '10:00'), completed: null, due: null },
    { id: 'v2', title: '剪藏一篇好文', scene: '剪藏', priority: 'minor', created: at(-1, '09:00'), completed: null, due: null, url: 'https://example.com/great-post' },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app };
}

/** 往搜索框输入（触发 input 事件；M.search 要等 180ms 防抖尾触才落） */
function typeSearch(input: HTMLInputElement, word: string): void {
  input.value = word;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('呈报#7（7A）：搜索范围补网址字段', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('按网址主机/路径片段能搜出带链接条目', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    typeSearch(input, 'great-post');
    await wait(260); // 过 180ms 防抖尾触
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-memo-card')];
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('剪藏一篇好文');
    });
    // 主机片段同样命中（卡片 meta 渲染的就是域名）
    typeSearch(input, 'example.com');
    await wait(260);
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(1));
  });
});

describe('呈报#4（4A）：搜索框 ESC 二段清词', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
    registerEscapeHandler(); // escManager 'bz-memo' 层（幂等），供「放行关面板」分支
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('有词按 ESC：只清词不关面板，光标送回搜索框', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    typeSearch(input, '阅读');
    await wait(260); // 等 M.search 落地（列表已过滤为 1 条）
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(1));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    // 清词：框空、状态空、列表还原，面板还在
    expect(input.value).toBe('');
    expect(M.search).toBe('');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy(); // 面板未关
    expect(document.activeElement).toBe(input); // 光标送回（换词直达）
  });

  it('防抖窗口内 ESC 清词：尾触不把旧词写回（词复活防）', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    typeSearch(input, '阅读');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); // 防抖未落即 ESC
    expect(input.value).toBe('');
    await wait(260); // 若尾触未被 cancel，此刻 M.search 会被旧词写回
    expect(M.search).toBe('');
    expect(document.querySelectorAll('.bz-memo-card').length).toBe(2);
  });

  it('没词按 ESC：放行关面板（registerPanelEsc 口径不变）', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('.bz-panel-overlay')).toBeNull());
  });
});

describe('呈报#5（5A）：✕ 一键清词 + 空态「清除搜索」按钮', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetMemoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeMemoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('✕ 有词才出现；点击清词 + 光标回框', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    const clearBtn = (await vi.waitFor(() => document.querySelector('[data-memo-search-clear]'))) as HTMLButtonElement;
    expect(clearBtn.hidden).toBe(true); // 无词不现
    typeSearch(input, '阅读');
    expect(clearBtn.hidden).toBe(false); // 有词即现（不等防抖）
    clearBtn.click();
    expect(input.value).toBe('');
    expect(M.search).toBe('');
    expect(clearBtn.hidden).toBe(true);
    expect(document.activeElement).toBe(input);
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
  });

  it('提醒定位预填长路径后 ✕ 可见（回全量列表一键可达）', async () => {
    const { vault, app } = seedVault();
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    raw[0].notePath = '笔记/深度学习/注意力机制.md';
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(raw, null, 2));
    MemoData.init({ ...SETTINGS } as any);
    openMemoPanel(app, { notePath: '笔记/深度学习/注意力机制.md' });
    const clearBtn = (await vi.waitFor(() => {
      const b = document.querySelector('[data-memo-search-clear]') as HTMLButtonElement | null;
      expect(b?.hidden).toBe(false); // 预填即有词
      return b;
    })) as HTMLButtonElement;
    const input = document.querySelector('[data-memo-search]') as HTMLInputElement;
    clearBtn.click();
    expect(input.value).toBe('');
    expect(M.search).toBe('');
  });

  it('搜索空态补「清除搜索」按钮，点击回全量列表', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    typeSearch(input, 'zzz不存在的词');
    await wait(260);
    await vi.waitFor(() => expect(document.querySelector('.bz-empty')).toBeTruthy());
    const clearBtn = (await vi.waitFor(() => {
      const b = [...document.querySelectorAll('.bz-empty button')].find((x) => x.textContent?.includes('清除搜索'));
      expect(b, '空态缺「清除搜索」按钮').toBeTruthy();
      return b!;
    })) as HTMLButtonElement;
    clearBtn.click();
    expect(input.value).toBe('');
    expect(M.search).toBe('');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
  });

  it('6A（UI 侧）：命中词在卡片标题包 mark 高亮', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    const input = (await vi.waitFor(() => document.querySelector('[data-memo-search]'))) as HTMLInputElement;
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-memo-card').length).toBe(2));
    typeSearch(input, 'ffmpeg');
    await wait(260);
    // fixture 无 ffmpeg——换成命中标题的词
    typeSearch(input, '阅读');
    await wait(260);
    await vi.waitFor(() => {
      const title = document.querySelector('.bz-memo-card .bz-memo-card-title');
      expect(title?.innerHTML).toContain('<mark class="bz-memo-hit">阅读</mark>');
    });
  });
});
