/**
 * 每周知识动态 · UI/通知/调度层测试（issue 360，jsdom）：
 * - 详情弹层 openWeeklyDigest：已存摘要渲染（区间/概要/三节列表）、行跳转（workspace.openFile）、
 *   文件已删人话提示、无摘要空态、读取失败兜底态；
 * - 通知入口 notifyWeeklyDigest：正文计数无 emoji、「查看详情」动作打开弹层；
 * - 主面板入口卡 renderPanelWeeklyCard：有摘要显示 + 计数文案，无摘要隐藏，点击开弹层；
 * - 命令路径 runWeeklyManual：强制重聚后原位刷新（loading → 结果/空态）；
 * - 启动调度 scheduleWeeklyDigest：延迟到点静默聚合落盘，cancelWeeklySchedule 摘定时器。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { __resetNoticeForTests } from '../../src/core/notice';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { getSecondBrainStorePath, mutateStore } from '../../src/secondbrain/store-file';
import type { WeeklyDigest } from '../../src/secondbrain/store-file';
import {
  cancelWeeklySchedule,
  notifyWeeklyDigest,
  openWeeklyDigest,
  renderPanelWeeklyCard,
  runWeeklyManual,
  scheduleWeeklyDigest,
  unloadWeeklyDigest,
  __setWeeklyScheduleDelayMsForTests,
} from '../../src/secondbrain/weekly-ui';
import { panelShellHtml } from '../../src/secondbrain/render';

const T0 = Date.parse('2026-09-08T08:00:00');
const DAY = 24 * 3600 * 1000;

/** 一份有实质内容的摘要（AI 文案 + 2 新增 + 1 关联 + 1 撞车） */
function makeDigest(): WeeklyDigest {
  return {
    generatedAt: T0,
    since: T0 - 7 * DAY,
    until: T0,
    newNotes: [
      { path: '文献盒/费曼学习法.md', mtime: T0 - DAY },
      { path: '卡片盒/番茄钟实践.md', mtime: T0 - 2 * DAY },
    ],
    newLinks: [{ path: '文献盒/费曼学习法.md', linkedAt: new Date(T0 - DAY).toISOString() }],
    collisions: [
      { path: '卡片盒/番茄钟实践.md', targetPath: '文献盒/旧番茄笔记.md', score: 0.91, mode: 'vector' },
    ],
    aiSummary: '本周新增两篇笔记，其中番茄钟实践与旧文高度重合，建议合并。',
  };
}

function makeEnv(seedWeeklySection: boolean) {
  const vault = new MockVault();
  const base = mockAppWithVault(vault);
  const openFile = vi.fn(async (_f: { path: string }) => {});
  const app: any = {
    ...base,
    workspace: { ...base.workspace, getLeaf: (_any: boolean) => ({ openFile }) },
  };
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE' }) as any);
  if (seedWeeklySection) {
    vault.files.set(
      getSecondBrainStorePath(),
      JSON.stringify({
        version: 1,
        meta: { version: 9, notes: {}, _dim: 0 },
        panel: null,
        link: { queue: [], state: {} },
        chatHistory: [],
        weekly: { lastRunAt: T0, knownPaths: [], digest: makeDigest() },
      })
    );
  }
  return { vault, app, openFile };
}

async function seedDigestOnly(vault: MockVault, digest: WeeklyDigest | null): Promise<void> {
  vault.files.set(
    getSecondBrainStorePath(),
    JSON.stringify({
      version: 1,
      meta: { version: 9, notes: {}, _dim: 0 },
      panel: null,
      link: { queue: [], state: {} },
      chatHistory: [],
      weekly: digest ? { lastRunAt: T0, knownPaths: [], digest } : null,
    })
  );
}

function weeklyPanel(): HTMLElement {
  return document.getElementById('bz-sb-weekly-panel')!;
}

describe('详情弹层 openWeeklyDigest（issue 360）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    clearNotices();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    unloadWeeklyDigest();
    document.body.innerHTML = '';
  });

  it('已存摘要：头行区间 + AI 概要 + 撞车/新增笔记/新增关联三节齐备', async () => {
    const { app } = makeEnv(true);
    openWeeklyDigest(app);
    await vi.waitFor(() => {
      expect(weeklyPanel().style.display).toBe('flex');
      expect(weeklyPanel().querySelector('#bz-sb-weekly-body')!.innerHTML).toContain('主题撞车提示');
    });
    expect(weeklyPanel().textContent).toContain('本周知识动态');
    expect(weeklyPanel().querySelector('#bz-sb-weekly-range-head')!.textContent).toContain('9 月 1 日');
    expect(weeklyPanel().querySelector('#bz-sb-weekly-summary-text')!.textContent).toContain('番茄钟实践与旧文高度重合');
    // 三节行数：撞车 1 / 新增笔记 2 / 新增关联 1（节题旁计数）
    const counts = [...weeklyPanel().querySelectorAll('.bz-sb-weekly-section .bz-sb-ct-n')].map((el) => el.textContent);
    expect(counts).toEqual(['1', '2', '1']);
  });

  it('行跳转：新增笔记行点击 → workspace.openFile 打开对应文件；撞车行名字段各跳各的', async () => {
    const { vault, app, openFile } = makeEnv(true);
    vault.files.set('文献盒/费曼学习法.md', '正文');
    vault.files.set('文献盒/旧番茄笔记.md', '旧正文'); // 撞车目标也在库内
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().querySelector('#bz-sb-weekly-body')!.innerHTML).toContain('主题撞车提示'));

    const noteRow = weeklyPanel().querySelector('#bz-sb-weekly-notes .bz-sb-weekly-row') as HTMLElement;
    noteRow.click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(openFile.mock.calls[0][0].path).toBe('文献盒/费曼学习法.md');
    openFile.mockClear();

    // 撞车行：点目标名字段跳目标（整行 default 态不跳，跳转落字段）
    const hitRow = weeklyPanel().querySelector('#bz-sb-weekly-hits .bz-sb-weekly-row') as HTMLElement;
    (hitRow.querySelector('[data-path="文献盒/旧番茄笔记.md"]') as HTMLElement).click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(openFile.mock.calls[0][0].path).toBe('文献盒/旧番茄笔记.md');
  });

  it('跳转目标文件已删：给「文件不存在」人话提示，不抛错', async () => {
    const { app } = makeEnv(true); // vault 里没有对应文件
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().querySelector('#bz-sb-weekly-body')!.innerHTML).toContain('主题撞车提示'));
    const noteRow = weeklyPanel().querySelector('#bz-sb-weekly-notes .bz-sb-weekly-row') as HTMLElement;
    noteRow.click();
    await vi.waitFor(() => expect(getNoticeMessages().some((m) => m.includes('文件不存在'))).toBe(true));
  });

  it('无摘要（weekly 段空）：弹层开空态，不报错', async () => {
    const { vault, app } = makeEnv(false);
    await seedDigestOnly(vault, null);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    expect(weeklyPanel().textContent).toContain('最近一周没有新入脑的笔记与关联');
  });

  it('关闭：✕ 钮隐藏弹层；重开重渲（DOM 复用）', async () => {
    const { app } = makeEnv(true);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    (weeklyPanel().querySelector('#bz-sb-weekly-close') as HTMLElement).click();
    expect(weeklyPanel().style.display).toBe('none');
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    expect(weeklyPanel().textContent).toContain('费曼学习法');
  });
});

describe('通知入口 notifyWeeklyDigest（有实质内容才弹，动作开详情）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    clearNotices();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    unloadWeeklyDigest();
    document.body.innerHTML = '';
  });

  it('正文 = 计数（撞车附加），不带 emoji；「查看详情」动作打开详情弹层', async () => {
    const { app } = makeEnv(true);
    notifyWeeklyDigest(makeDigest());
    const msgs = getNoticeMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('新增笔记 2 篇');
    expect(msgs[0]).toContain('新增关联 1 条');
    expect(msgs[0]).toContain('1 篇与既有内容高度重合');
    expect(msgs[0]).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u); // 正文无 emoji
    // 动作出口：openWeeklyDigest 注入 appRef 后，关掉的弹层可从通知动作重新打开
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    (weeklyPanel().querySelector('#bz-sb-weekly-close') as HTMLElement).click();
    expect(weeklyPanel().style.display).toBe('none');
    (document.querySelector('.bz-notice-action') as HTMLElement).click();
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex')); // 通知动作 → 详情弹层
  });

  it('无撞车时正文不提撞车', () => {
    const d = makeDigest();
    d.collisions = [];
    notifyWeeklyDigest(d);
    expect(getNoticeMessages()[0]).not.toContain('重合');
  });
});

describe('主面板入口卡 renderPanelWeeklyCard（最小侵入：右栏一枚只读卡）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    clearNotices();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    unloadWeeklyDigest();
    document.body.innerHTML = '';
  });

  function makePopup(): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = panelShellHtml();
    document.body.appendChild(host);
    return host;
  }

  it('有摘要：卡片显示计数一行 + 区间，点击打开详情弹层', async () => {
    const { app } = makeEnv(true); // 摘要落盘：卡片点击后的弹层读盘渲染
    const popup = makePopup();
    renderPanelWeeklyCard(popup, app, makeDigest());
    const card = popup.querySelector('#bz-sb-weekly-card') as HTMLElement;
    expect(card.style.display).not.toBe('none');
    expect(card.textContent).toContain('2 篇新增');
    expect(card.textContent).toContain('1 条关联');
    expect(card.textContent).toContain('1 处撞车');
    card.click();
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    await vi.waitFor(() => expect(weeklyPanel().textContent).toContain('费曼学习法'));
  });

  it('无摘要：卡片整卡隐藏（面板保持原结构）', () => {
    const { app } = makeEnv(false);
    const popup = makePopup();
    renderPanelWeeklyCard(popup, app, null);
    expect((popup.querySelector('#bz-sb-weekly-card') as HTMLElement).style.display).toBe('none');
  });
});

describe('命令路径 runWeeklyManual（bz-secondbrain-weekly：强制重聚 + 原位刷新）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    clearNotices();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    unloadWeeklyDigest();
    document.body.innerHTML = '';
  });

  it('force 聚合出内容：弹层从「聚合中」切到结果，不弹通知（手动触发就地可见）', async () => {
    const { vault, app } = makeEnv(false);
    await seedDigestOnly(vault, null);
    vault.files.set(getSecondBrainStorePath(), JSON.stringify({
      version: 1,
      meta: { version: 9, notes: {}, _dim: 0 },
      panel: null,
      link: { queue: [], state: {} },
      chatHistory: [],
      weekly: null, // 首轮：手动 force 亦只立基线 → 弹层如实空态
    }));
    const store = {
      meta: { notes: { '文献盒/新.md': { mtime: T0, chunks: [{ text: '新内容' }] } } },
      vectorSearch: vi.fn().mockResolvedValue([]),
    };
    await runWeeklyManual(app, store as any, { probe: async () => true, now: T0 });
    expect(weeklyPanel().style.display).toBe('flex');
    expect(weeklyPanel().textContent).toContain('最近一周没有新入脑的笔记与关联'); // 首轮基线：空态
    expect(getNoticeMessages()).toHaveLength(0); // 手动路径不弹通知
  });

  it('聚合抛错：弹层给人话兜底态，不白屏、不弹未处理异常', async () => {
    const { app } = makeEnv(false);
    const store = {
      get meta(): any {
        throw new Error('disk on fire');
      },
      vectorSearch: vi.fn(),
    };
    await runWeeklyManual(app, store as any, { probe: async () => true, now: T0 });
    expect(weeklyPanel().style.display).toBe('flex');
    expect(weeklyPanel().textContent).toContain('读取动态数据失败');
  });
});

describe('启动调度 scheduleWeeklyDigest（延迟静默聚合，cancel 摘定时器）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    __resetNoticeForTests();
    clearNotices();
    document.body.innerHTML = '';
    __setWeeklyScheduleDelayMsForTests(5);
  });

  afterEach(() => {
    cancelWeeklySchedule();
    document.body.innerHTML = '';
  });

  it('延迟到点后聚合首轮基线落盘（无 lastRunAt → baseline，不弹通知）', async () => {
    vi.useFakeTimers();
    try {
      const { app } = makeEnv(false);
      const store = {
        meta: { notes: { '文献盒/a.md': { mtime: T0, chunks: [{ text: '内容' }] } } },
        vectorSearch: vi.fn().mockResolvedValue([]),
      };
      scheduleWeeklyDigest(app, store as any, null);
      expect(document.getElementById('bz-sb-weekly-panel')).toBeNull(); // 未到点无任何 UI
      await vi.advanceTimersByTimeAsync(50);
      const { loadStore } = await import('../../src/secondbrain/store-file');
      const s = await loadStore();
      expect(s.weekly?.lastRunAt).toBeGreaterThan(0); // 基线已立
      expect(s.weekly?.knownPaths).toEqual(['文献盒/a.md']);
      expect(getNoticeMessages()).toHaveLength(0); // 静默
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelWeeklySchedule：到点前取消 → 不再聚合', async () => {
    vi.useFakeTimers();
    try {
      const { app } = makeEnv(false);
      const store = {
        meta: { notes: { '文献盒/a.md': { mtime: T0, chunks: [{ text: '内容' }] } } },
        vectorSearch: vi.fn().mockResolvedValue([]),
      };
      scheduleWeeklyDigest(app, store as any, null);
      cancelWeeklySchedule();
      await vi.advanceTimersByTimeAsync(50);
      const { loadStore } = await import('../../src/secondbrain/store-file');
      const s = await loadStore();
      expect(s.weekly).toBeNull(); // 未跑
    } finally {
      vi.useRealTimers();
    }
  });
});
