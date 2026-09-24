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
import { readFileSync } from 'node:fs';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { __resetNoticeForTests } from '../../src/core/notice';
import { topifyZ } from '../../src/core/dom';
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
  runWeeklyIfDue,
  runWeeklyManual,
  scheduleWeeklyDigest,
  unloadWeeklyDigest,
  __setWeeklyScheduleDelayMsForTests,
} from '../../src/secondbrain/weekly-ui';
import { SecondBrainPanel } from '../../src/secondbrain/panel';
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
    scale: 'cos', // issue 425/ADR-0185 起新产出摘要自带口径标记（分数即原始余弦，显示不换算）
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

  it('存量摘要（无 scale 标记）：向量通道分数按旧锐化尺换算后再显示，TF-IDF 覆盖率不换算', async () => {
    const { vault, app } = makeEnv(false);
    const legacy = makeDigest();
    delete (legacy as { scale?: 'cos' }).scale;
    // 两条撞车：向量通道 0.91 是旧锐化尺（0.91^(1/0.35)≈0.76），TF-IDF 0.85 是覆盖率（本就有绝对标尺）
    legacy.collisions = [
      { path: '卡片盒/番茄钟实践.md', targetPath: '文献盒/旧番茄笔记.md', score: 0.91, mode: 'vector' },
      { path: '卡片盒/费曼.md', targetPath: '文献盒/费曼学习法.md', score: 0.85, mode: 'tfidf' },
    ];
    await seedDigestOnly(vault, legacy);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().querySelector('#bz-sb-weekly-body')!.innerHTML).toContain('主题撞车提示'));
    const pcts = [...weeklyPanel().querySelectorAll('.bz-sb-weekly-row-pct')].map((el) => el.textContent);
    expect(pcts).toEqual(['76%', '85%']); // 旧尺 91% 换算成 76%；TF-IDF 85% 原样
  });

  it('行跳转：新增笔记行点击 → workspace.openFile 打开对应文件；撞车行仅两段名字段各跳各的（行容器不带 data-path）', async () => {
    const { vault, app, openFile } = makeEnv(true);
    vault.files.set('文献盒/费曼学习法.md', '正文');
    vault.files.set('文献盒/旧番茄笔记.md', '旧正文'); // 撞车目标也在库内
    vault.files.set('卡片盒/番茄钟实践.md', '撞车新笔记正文'); // 撞车行新笔记名字段也在库内
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().querySelector('#bz-sb-weekly-body')!.innerHTML).toContain('主题撞车提示'));

    const noteRow = weeklyPanel().querySelector('#bz-sb-weekly-notes .bz-sb-weekly-row') as HTMLElement;
    noteRow.click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(openFile.mock.calls[0][0].path).toBe('文献盒/费曼学习法.md');
    openFile.mockClear();

    // 撞车行：目标名字段跳目标
    const hitRow = weeklyPanel().querySelector('#bz-sb-weekly-hits .bz-sb-weekly-row') as HTMLElement;
    (hitRow.querySelector('[data-path="文献盒/旧番茄笔记.md"]') as HTMLElement).click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(openFile.mock.calls[0][0].path).toBe('文献盒/旧番茄笔记.md');
    openFile.mockClear();
    // 新笔记名字段跳新笔记（data-path 收敛到名字段，审查修复⑪）
    (hitRow.querySelector('[data-path="卡片盒/番茄钟实践.md"]') as HTMLElement).click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalled());
    expect(openFile.mock.calls[0][0].path).toBe('卡片盒/番茄钟实践.md');
    openFile.mockClear();
    // 行容器已摘 data-path/role：点行其余处（箭头、百分比）不再跳转
    expect(hitRow.hasAttribute('data-path')).toBe(false);
    expect(hitRow.getAttribute('role')).toBeNull();
    (hitRow.querySelector('.bz-sb-weekly-row-hit-arrow') as HTMLElement).click();
    hitRow.click();
    expect(openFile).not.toHaveBeenCalled();
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

  it('遮罩随弹层显隐（开 block / 关 none）：遮罩真实可见，点弹层外落在遮罩上可关闭（P1①）', async () => {
    const { app } = makeEnv(true);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    const mask = document.getElementById('bz-sb-weekly-mask') as HTMLElement;
    expect(mask).toBeTruthy();
    expect(mask.style.display).toBe('block'); // 显示即显遮罩（此前永不显示，遮罩点击是死代码）
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.style.display).toBe('none');
    expect(weeklyPanel().style.display).toBe('none');
  });

  it('复用重开统一重发 z 号：后开面板盖过旧弹层时，重开弹层与遮罩重新抬顶（P1②）', async () => {
    const { app } = makeEnv(true);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    (weeklyPanel().querySelector('#bz-sb-weekly-close') as HTMLElement).click();
    expect(weeklyPanel().style.display).toBe('none');

    // 模拟主面板后开（panel.open 每次显示 topifyZ 重发号，panel.ts:112 同款）：此刻它压过早先的周报弹层
    const { createOverlay } = await import('../../src/core/dom');
    const later = createOverlay({ maskId: 'bz-test-later-mask', popupId: 'bz-test-later-popup' });
    document.body.appendChild(later.mask);
    document.body.appendChild(later.popup);
    topifyZ(later.mask, later.popup);

    openWeeklyDigest(app); // 复用重开：必须重新发号压回后开面板之上（否则「点了没反应」）
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    const mask = document.getElementById('bz-sb-weekly-mask') as HTMLElement;
    expect(mask.style.display).toBe('block');
    expect(Number(mask.style.zIndex)).toBeGreaterThan(Number(later.popup.style.zIndex));
    expect(Number(weeklyPanel().style.zIndex)).toBeGreaterThan(Number(mask.style.zIndex)); // 本体紧贴遮罩之上（成对发号）
    later.mask.remove();
    later.popup.remove();
  });

  it('列表超 30 条：只显最近 30 条并补人话脚注（撞车节脚注同范式，审查修复⑩）', async () => {
    const { vault, app } = makeEnv(false);
    const d = makeDigest();
    d.aiSummary = undefined; // 计数总览形态
    d.newNotes = Array.from({ length: 35 }, (_, i) => ({ path: `盒/n${String(i).padStart(2, '0')}.md`, mtime: T0 - i }));
    await seedDigestOnly(vault, d);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().querySelector('#bz-sb-weekly-notes')).toBeTruthy());
    expect(weeklyPanel().querySelectorAll('#bz-sb-weekly-notes .bz-sb-weekly-row')).toHaveLength(30);
    expect(weeklyPanel().textContent).toContain('新增笔记较多，仅显示最近 30 条');
    // 未超限的关联节不出现脚注
    expect(weeklyPanel().textContent).not.toContain('新增关联较多');
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

  it('正文 = 一句自然句（不用「·」拼串，文案规范③）；「查看详情」动作打开详情弹层', async () => {
    const { app } = makeEnv(true);
    notifyWeeklyDigest(makeDigest());
    const msgs = getNoticeMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toBe('本周新增笔记 2 篇，新增关联 1 条，1 篇与既有内容高度重合。');
    expect(msgs[0]).not.toContain('·'); // 「·」符号串退役（审查修复⑨）
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

  it('有摘要：卡片显示计数一行 + 「最近一份」区间（回放旧摘要不冒充当周，审查修复⑫），点击打开详情弹层', async () => {
    const { app } = makeEnv(true); // 摘要落盘：卡片点击后的弹层读盘渲染
    const popup = makePopup();
    renderPanelWeeklyCard(popup, app, makeDigest());
    const card = popup.querySelector('#bz-sb-weekly-card') as HTMLElement;
    expect(card.style.display).not.toBe('none');
    expect((popup.querySelector('#bz-sb-weekly-range') as HTMLElement).textContent).toContain('最近一份');
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

describe('卸载与在途聚合（generation 旗标，审查修复⑧）', () => {
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

  it('聚合在途时卸载：完成回调检查代际后静默丢弃，不弹通知', async () => {
    const { app } = makeEnv(true); // knownPaths=[]：任意新笔记差分即 done 语义
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const store = {
      meta: { notes: { '文献盒/新.md': { mtime: T0, chunks: [{ text: '新' }] } } },
      vectorSearch: vi.fn().mockResolvedValue([]),
    };
    const run = runWeeklyIfDue(app, store as any, {
      now: T0 + 8 * DAY, // 距基线 T0 已超 7 天：到期
      probe: () => gate.then(() => true), // 用探针挂起聚合，制造「在途」窗口
    });
    await Promise.resolve(); // 让 runWeeklyIfDue 进入在途 await
    unloadWeeklyDigest(); // 卸载发生在聚合期间
    release();
    await run;
    expect(getNoticeMessages()).toHaveLength(0); // 卸载后不再打扰
  });

  it('未卸载的对照：同场景正常弹通知（generation 未变）', async () => {
    const { app } = makeEnv(true);
    const store = {
      meta: { notes: { '文献盒/新.md': { mtime: T0, chunks: [{ text: '新' }] } } },
      vectorSearch: vi.fn().mockResolvedValue([]),
    };
    await runWeeklyIfDue(app, store as any, { now: T0 + 8 * DAY, probe: async () => true });
    expect(getNoticeMessages().some((m) => m.startsWith('本周新增笔记'))).toBe(true);
  });
});

describe('主面板头行入口 bz-sb-weekly-open（issue 360 真机回归）', () => {
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

  /** 就绪库 fake store（panel-close-reset.test.ts 同款：内容态直接进统计） */
  function makeReadyStore(): any {
    return {
      initialLoad: Promise.resolve(),
      isIndexReady: () => true,
      hasPendingChanges: () => false,
      isRefreshing: () => false,
      needsModelRebuild: () => false,
      refresh: async () => {},
      meta: {
        notes: {
          '我的/日记/A.md': { mtime: 1, chunks: [{ text: '甲' }] },
          '卡片盒/B.md': { mtime: 2, chunks: [{ text: '乙' }] },
        },
        _dim: 2,
      },
      vectors: [],
    };
  }

  it('头行右侧有「本周知识动态」图标钮，点击打开详情弹层且主面板保持打开（只读挂入口）', async () => {
    const { app } = makeEnv(true); // 周报摘要已落盘：弹层打开即渲染结果
    const panel = new SecondBrainPanel(app, makeReadyStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await vi.waitFor(() => expect(document.getElementById('bz-sb-weekly-open')).toBeTruthy());
    const openBtn = document.getElementById('bz-sb-weekly-open') as HTMLElement;
    expect(openBtn.getAttribute('aria-label')).toBe('本周知识动态');
    expect(openBtn.classList.contains('bz-sb-panel-func')).toBe(true); // 图标钮形制随头行既有钮
    openBtn.click();
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    await vi.waitFor(() => expect(weeklyPanel().textContent).toContain('费曼学习法'));
    // 只读入口：主面板不被关（区别于对话/参考的 close→跳转语义）
    expect((document.querySelector('.bz-sb-panel') as HTMLElement).style.display).toBe('flex');
    panel.destroy();
  });

  it('详情弹层规范锚：popup 挂 .bz-panel-mtop（移动全屏 + 44px 顶距）；遮罩点击与 #bz-sb-weekly-close 双收口；样式源 ≤768px 真全屏', async () => {
    const { app } = makeEnv(true);
    openWeeklyDigest(app);
    await vi.waitFor(() => expect(weeklyPanel().style.display).toBe('flex'));
    // 移动范式类挂 popup 根（panel.ts:311 同款）；桌面 560px 形制不受影响
    expect(weeklyPanel().classList.contains('bz-panel-mtop')).toBe(true);
    expect(weeklyPanel().classList.contains('bz-overlay-popup')).toBe(true);
    expect(document.getElementById('bz-sb-weekly-close')).toBeTruthy(); // 既有关闭钮保留
    // 样式锚：≤768px 真全屏（!important 覆写 createOverlay 内联宽）+ 44px 顶距归 .bz-panel-mtop
    const css = readFileSync('src/secondbrain/styles.css', 'utf8');
    const mediaIdx = css.lastIndexOf('@media (max-width: 768px)');
    expect(mediaIdx).toBeGreaterThan(-1);
    const ruleIdx = css.indexOf('.bz-sb-weekly-modal', mediaIdx);
    const rule = css.slice(ruleIdx, css.indexOf('}', ruleIdx));
    expect(rule).toContain('width: 100vw !important');
    expect(rule).toContain('max-width: none !important');
    expect(rule).toContain('transform: none');
    expect(rule).toContain('height: var(--bz-vvh, 100vh)');
    // 桌面基准仍在：560px 高度 / 居中位移原样保留
    expect(css).toMatch(/\.bz-sb-weekly-modal\s*\{[^}]*height:\s*560px/);
    expect(css).toMatch(/\.bz-sb-weekly-modal\s*\{[^}]*transform:\s*translate\(-50%, -50%\)/);
    // 桌面遮罩点击关闭（onMaskClick 委托）
    (document.getElementById('bz-sb-weekly-mask') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(weeklyPanel().style.display).toBe('none');
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
