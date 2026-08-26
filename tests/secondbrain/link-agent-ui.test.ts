/**
 * 自动双链 UI/通知层测试（ticket 111 + 115 + 119，jsdom）：
 * - ⚙️ 弹窗「自动双链」总开关联动明细显隐（onChange 即时重渲染、各键独立持久化、重开还原）；
 * - 管线写入（单侧幂等 / 上限截断 / 入队 / 裁判失败入队）；
 * - 通知触发条件（本批新建 N 条 / N=0 静默 / 队列消费完成 / 死链清理有移除才报）；
 * - 监听器聚合与守卫；命令 bz-secondbrain-rebuild-links 注册守卫分支；
 * - 存量补链（ticket 115）：目标清单扫描 / 可达门 / 队列排除 / 串行锁；命令 bz-secondbrain-link-all 守卫分支；
 * - 正文大改自动重跑（v1.4/ticket 119）：成功建链后记基准哈希；修改过滤（实质变化才重跑）；
 *   修改监听聚合与删除清基准；自写 related 不触发循环重跑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearDomainEvents } from '../../src/core/domain-bus';
import { closeSettingsModal } from '../../src/core/settings-modal';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { openSecondBrainSettings } from '../../src/secondbrain/panel';
import { LinkAgent, __setLinkBatchMsForTests } from '../../src/secondbrain/link-agent/pipeline';
import {
  LinkAgentWatcher,
  __resetLinkAgentGuideForTests,
  __setLinkCleanDebounceMsForTests,
} from '../../src/secondbrain/link-agent/watch';
import { enqueuePaths, loadQueue, loadLinkState, computeHash } from '../../src/secondbrain/link-agent/data';
import { AI } from '../../src/secondbrain/ai';
import { rebuildSecondBrainLinks, runSecondBrainLinkAll, unloadSecondBrain } from '../../src/secondbrain/index';

function baseSettings() {
  return { ...DEFAULT_SETTINGS, secondBrainAllowPaths: '卡片盒,文献盒' } as any;
}

/** 取指定设置行的触发器（MockToggle/MockText 均有 trigger） */
function rowTrigger(popup: HTMLElement, name: string): (v: any) => void {
  const el = [...popup.querySelectorAll('.setting-item')].find(
    (n) => (n as HTMLElement).dataset.name === name
  ) as any;
  expect(el, `设置行「${name}」应存在`).toBeTruthy();
  const ctrl = el.__setting.controls.find((c: any) => typeof c.trigger === 'function');
  expect(ctrl).toBeTruthy();
  return (v: any) => ctrl.trigger(v);
}

describe('⚙️ 弹窗「自动双链」开关联动显隐', () => {
  let settings: ReturnType<typeof baseSettings>;

  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    closeSettingsModal();
    settings = baseSettings();
    setSettingsProvider(() => settings);
    setSettingsSaver(() => Promise.resolve());
    setApp({ vault: new MockVault() } as any);
  });

  it('开启态：组名与五行明细渲染', () => {
    openSecondBrainSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('自动双链');
    for (const name of ['单篇候选数量 TopK', '每篇关联上限', '完成通知', '失效关联自动清理', '关联范围']) {
      expect([...popup.querySelectorAll('.setting-item')].some((el) => (el as HTMLElement).dataset.name === name)).toBe(true);
    }
    closeSettingsModal();
  });

  it('onChange 关闭总开关：明细即时隐藏且键持久化；重开弹窗还原关闭态', async () => {
    openSecondBrainSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    rowTrigger(popup, '自动双链')(false);
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.linkAgentEnabled).toBe(false);
    // 明细整体隐藏（区块重渲染后无明细行，含新增的关联范围行）
    expect(
      [...popup.querySelectorAll('.setting-item')].some(
        (el) => (el as HTMLElement).dataset.name === '单篇候选数量 TopK' || (el as HTMLElement).dataset.name === '关联范围'
      )
    ).toBe(false);
    closeSettingsModal();

    // 重开弹窗按当前状态还原：仍关闭、无明细
    openSecondBrainSettings();
    const popup2 = document.getElementById('bz-settings-modal-popup')!;
    expect([...popup2.querySelectorAll('.setting-item')].some((el) => (el as HTMLElement).dataset.name === '关联范围')).toBe(false);
    closeSettingsModal();
  });

  it('重开还原开启态；各键独立持久化（TopK/上限/范围文本、通知与清理 toggle）', async () => {
    settings.linkAgentEnabled = false;
    settings.linkAgentTopK = 12;
    settings.linkAgentMaxLinks = 3;
    settings.linkAgentNotify = false;
    settings.linkAgentAutoClean = false;
    openSecondBrainSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    // 开启态还原（master 值来自当前设置）
    rowTrigger(popup, '自动双链')(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.linkAgentEnabled).toBe(true);
    // 各键独立持久化
    rowTrigger(popup, '单篇候选数量 TopK')('6');
    rowTrigger(popup, '每篇关联上限')('5');
    rowTrigger(popup, '完成通知')(true);
    rowTrigger(popup, '失效关联自动清理')(true);
    rowTrigger(popup, '关联范围')('文献盒,卡片盒');
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.linkAgentTopK).toBe(6);
    expect(settings.linkAgentMaxLinks).toBe(5);
    expect(settings.linkAgentNotify).toBe(true);
    expect(settings.linkAgentAutoClean).toBe(true);
    expect(settings.linkAgentScopes).toBe('文献盒,卡片盒');
    closeSettingsModal();
  });
});

// ---------------- 管线写入与通知 ----------------

interface WorldOpts {
  hits?: { path: string; chunk: string; score: number }[];
  reachable?: boolean;
}

function makeWorld(opts: WorldOpts = {}) {
  const vault = new MockVault();
  vault.files.set('文献盒/A.md', '---\ntitle: 向量笔记\ntags: vec\n---\n\n关于向量数据库与近邻检索的正文内容，足够长用于档案卡。');
  vault.files.set('文献盒/B.md', '另一篇讲向量检索相似度的文章。');
  vault.files.set('文献盒/D.md', '一篇讲知识管理方法的旧文章。');
  const app = mockAppWithVault(vault);
  setApp(app as any);
  const store = {
    refresh: vi.fn(async () => {}),
    vectorSearch: vi.fn(async (_query: string) => opts.hits ?? []),
  };
  const agent = new LinkAgent({
    app: app as any,
    store: store as any,
    probe: vi.fn(async () => opts.reachable !== false),
  });
  const askSpy = vi.spyOn(AI, 'ask');
  askSpy.mockReset(); // AI 为模块级单例：清掉跨用例残留的调用史与实现
  return { vault, app, store, agent, askSpy };
}

describe('管线：related 幂等写入与可达性门', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('可达完整管线：裁判通过的对子写入 related（缺文件候选过滤），幂等重跑不加重复链', async () => {
    const { vault, agent, store, askSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B 首块内容', score: 0.9 },
        { path: '文献盒/GONE.md', chunk: '已删除文件不应入选', score: 0.8 },
      ],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"},{"id":2,"reason":"引用"}]');
    const r1 = await agent.processNote('文献盒/A.md');
    expect(r1).toEqual({ status: 'done', created: 1 });
    expect(store.refresh).toHaveBeenCalled();
    const fmOfA = vault.files.get('文献盒/A.md')!;
    expect(fmOfA).toContain('related');
    expect(fmOfA).toContain('[[文献盒/B]]');
    expect(fmOfA).not.toContain('GONE');

    // 幂等：同一裁决重跑不再新增
    const r2 = await agent.processNote('文献盒/A.md');
    expect(r2).toEqual({ status: 'done', created: 0 });
    expect((fmOfA.match(/\[\[文献盒\/B\]\]/g) || []).length).toBe(1);
  });

  it('linkAgentMaxLinks>0 时截断：只保留前 N 条新增', async () => {
    const s = { ...baseSettings(), linkAgentMaxLinks: 1 };
    setSettingsProvider(() => s);
    const { vault, agent, askSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"},{"id":2,"reason":"b"}]');
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    const fm = vault.files.get('文献盒/A.md')!;
    expect(fm).toContain('[[文献盒/B]]');
    expect(fm).not.toContain('[[文献盒/D]]');
  });

  it('embedding 不可达 → 入队保留（带内容哈希），不写 related', async () => {
    const { vault, agent } = makeWorld({ reachable: false });
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'queued' });
    const q = await loadQueue();
    expect(q.map((i) => i.path)).toEqual(['文献盒/A.md']);
    expect(q[0].hash).toBeTruthy();
    expect(vault.files.get('文献盒/A.md')).not.toContain('related');
  });

  it('裁判失败 → failed 且入队待下次重试', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockRejectedValue(new Error('服务商不可用'));
    const r = await agent.processNote('文献盒/A.md');
    expect(r.status).toBe('failed');
    const q = await loadQueue();
    expect(q.some((i) => i.path === '文献盒/A.md')).toBe(true);
  });

  it('无文献盒候选 → 直接完成零新建，不调裁判', async () => {
    const { agent, askSpy } = makeWorld({ hits: [] });
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 0 });
    expect(askSpy).not.toHaveBeenCalled();
  });

  it('encrypt 目录内文件一律跳过', async () => {
    const { agent } = makeWorld({});
    const r = await agent.processNote('CONFIG/.ENCRYPT/x.md');
    expect(r).toEqual({ status: 'skipped' });
  });

  it('候选来源 = 白名单索引库全部笔记：不按关联范围过滤，仅剔除自身/缺失文件/encrypt 锁定', async () => {
    const { vault, agent } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '卡片盒/K.md', chunk: 'K', score: 0.85 },
        { path: '其他/X.md', chunk: 'X', score: 0.8 }, // 范围外照常入选（候选不受范围限制）
        { path: '文献盒/A.md', chunk: '自身', score: 0.99 }, // 自身剔除
        { path: 'CONFIG/.ENCRYPT/E.md', chunk: 'E', score: 0.7 }, // encrypt 锁定剔除
        { path: '文献盒/GONE.md', chunk: 'G', score: 0.6 }, // 文件不存在剔除
      ],
    });
    vault.files.set('卡片盒/K.md', 'k');
    vault.files.set('其他/X.md', 'x');
    // 空范围（ticket 116 默认）与显式范围都不影响候选来源
    const r1 = await agent.findCandidates('文献盒/A.md', '正文');
    expect(r1.map((c) => c.path)).toEqual(['文献盒/B.md', '卡片盒/K.md', '其他/X.md']);
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    const r2 = await agent.findCandidates('文献盒/A.md', '正文');
    expect(r2.map((c) => c.path)).toEqual(['文献盒/B.md', '卡片盒/K.md', '其他/X.md']);
  });

  it('查询端全文嵌入（ticket 118）：不再 800 字截断；超长按 LINK_QUERY_MAX_CHARS 安全截尾', async () => {
    const { store, agent } = makeWorld({ hits: [] });
    // 常规笔记：全文（2000+ 字）直接进向量化，而非 800 字截断
    const longBody = '关于精神分析与文明批判的论述段落。'.repeat(150); // ~2100 字
    await agent.findCandidates('文献盒/A.md', longBody);
    const q1 = store.vectorSearch.mock.calls[0][0] as string;
    expect(q1.length).toBeGreaterThan(1500);
    expect(q1).toContain('论述段落。');
    // 超长笔记：截尾到上限
    const huge = 'x'.repeat(20000);
    await agent.findCandidates('文献盒/A.md', huge);
    const q2 = store.vectorSearch.mock.calls[1][0] as string;
    expect(q2.length).toBeLessThanOrEqual(8000);
  });
});

describe('正文大改自动重跑（v1.4/ticket 119）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('成功建链后记录基准哈希；幂等重跑（无新增）同样刷新基准；入队/失败不记', async () => {
    const { vault, app, store, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    // ① 成功建链 → 记录基准（写入后内容哈希，含本次 related）
    const r1 = await agent.processNote('文献盒/A.md');
    expect(r1).toEqual({ status: 'done', created: 1 });
    let state = await loadLinkState();
    expect(state['文献盒/A.md'].hash).toBe(computeHash(vault.files.get('文献盒/A.md')!));
    // ② 幂等重跑（created=0）→ 基准刷新为当前内容（幂等返回 done 仍记）
    const r2 = await agent.processNote('文献盒/A.md');
    expect(r2).toEqual({ status: 'done', created: 0 });
    state = await loadLinkState();
    expect(state['文献盒/A.md'].hash).toBe(computeHash(vault.files.get('文献盒/A.md')!));

    clearNotices();
    // ③ 不可达（入队）→ 不记基准：先大改正文（文件变了），入队后基准仍是旧内容哈希
    vault.files.set('文献盒/A.md', '---\ntitle: 向量笔记\ntags: vec\n---\n\n入队后不更新基准的正文。');
    const agent2 = new LinkAgent({
      app: app as any,
      store: store as any,
      probe: vi.fn(async () => false), // 同 vault 不同探测：不可达
    });
    expect((await agent2.processNote('文献盒/A.md')).status).toBe('queued');
    state = await loadLinkState();
    expect(state['文献盒/A.md'].hash).not.toBe(computeHash(vault.files.get('文献盒/A.md')!)); // 基准未随入队刷新
  });

  it('filterChangedForRelink：基准相同（自写/保存未实质变化）剔除；无基准保留；文件缺失/encrypt 剔除', async () => {
    const { vault, agent } = makeWorld({ hits: [] });
    await agent.recordLinkBaseline('文献盒/A.md'); // 记基准（当前内容）
    // ① 内容未变 → 剔除
    expect(await agent.filterChangedForRelink(['文献盒/A.md'])).toEqual([]);
    // ② 正文大改 → 保留
    vault.files.set('文献盒/A.md', '---\ntitle: 向量笔记\ntags: vec\n---\n\n大改后的正文内容，主题完全不同了。');
    expect(await agent.filterChangedForRelink(['文献盒/A.md'])).toEqual(['文献盒/A.md']);
    // ③ 无基准（从未建链过的存量）→ 保留（重跑一次并从结果重建基准）
    vault.files.set('文献盒/C.md', '---\nrelated: ["[[文献盒/B]]"]\n---\n\n老笔记，升级前已连接但无基准。');
    expect(await agent.filterChangedForRelink(['文献盒/C.md'])).toEqual(['文献盒/C.md']);
    // ④ 文件缺失 / 非 md / encrypt 锁定 → 剔除
    expect(await agent.filterChangedForRelink(['文献盒/GONE.md', '文献盒/notes.txt', 'CONFIG/.ENCRYPT/e.md'])).toEqual([]);
  });

  it('删除事件清基准：dropLinkBaseline 移除条目', async () => {
    const { agent } = makeWorld({ hits: [] });
    await agent.recordLinkBaseline('文献盒/A.md');
    expect(await loadLinkState()).toHaveProperty('文献盒/A.md');
    await agent.dropLinkBaseline('文献盒/A.md');
    expect(await loadLinkState()).not.toHaveProperty('文献盒/A.md');
    await agent.dropLinkBaseline('文献盒/不存在.md'); // 空操作不抛
  });
});

describe('通知触发条件（自绘 toast）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('批次完成 N>0：同键单条动态更新为「本批新建关联 N 条」', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"},{"id":2,"reason":"b"}]');
    await agent.processBatch(['文献盒/A.md']);
    const msgs = getNoticeMessages();
    expect(msgs.length).toBe(1); // 进行中帧同键合并为一条
    expect(msgs[0]).toContain('本批新建关联 2 条');
  });

  it('批次 N=0：静默（不出现完成文案）', async () => {
    const { agent } = makeWorld({ hits: [] });
    await agent.processBatch(['文献盒/A.md']);
    expect(getNoticeMessages().some((m) => m.includes('本批新建关联'))).toBe(false);
  });

  it('linkAgentNotify=false：全程静默', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentNotify: false }));
    const { agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"}]');
    await agent.processBatch(['文献盒/A.md']);
    expect(getNoticeMessages()).toEqual([]);
  });

  it('队列消费成功：移除条目并通知「待处理关联已处理完毕：N 篇 / 新建 M 条」', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    await enqueuePaths(['文献盒/A.md']);
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"}]');
    const summary = await agent.consumeQueue();
    expect(summary).toMatchObject({ total: 1, processed: 1, created: 1, failed: 0 });
    expect((await loadQueue()).length).toBe(0); // 消费成功即移除
    expect(getNoticeMessages().some((m) => m.includes('待处理关联已处理完毕：1 篇 / 新建 1 条'))).toBe(true);
  });

  it('队列消费不可达：静默保留队列', async () => {
    const { agent } = makeWorld({ reachable: false });
    await enqueuePaths(['文献盒/A.md']);
    const summary = await agent.consumeQueue();
    expect(summary).toBeNull();
    expect((await loadQueue()).map((i) => i.path)).toEqual(['文献盒/A.md']);
    expect(getNoticeMessages().some((m) => m.includes('待处理关联已处理完毕'))).toBe(false);
  });

  it('队列消费：对应文件已删除的条目顺带清理，不产生完成通知', async () => {
    const { agent } = makeWorld({});
    await enqueuePaths(['文献盒/GONE.md']); // vault 中不存在
    const summary = await agent.consumeQueue();
    expect(summary).toBeNull();
    expect((await loadQueue()).length).toBe(0);
    expect(getNoticeMessages().some((m) => m.includes('待处理关联已处理完毕'))).toBe(false);
  });

  it('死链清理：有移除才报「已清理 N 条失效关联」；零变化静默；扫描范围随 linkAgentScopes', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set(
      '文献盒/C.md',
      '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n  - "[[文献盒/B]]"\n---\n\n正文'
    );
    // 多范围：卡片盒也在范围内，其失效链一并清理
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒,卡片盒' }));
    vault.files.set('卡片盒/E.md', '---\nrelated:\n  - "[[卡片盒/DEAD.md]]"\n---\n\n正文');
    const n1 = await agent.cleanDeadLinks();
    expect(n1).toBe(2);
    expect(getNoticeMessages().some((m) => m.includes('已清理 2 条失效关联'))).toBe(true);
    expect(vault.files.get('文献盒/C.md')).not.toContain('GONE');
    expect(vault.files.get('文献盒/C.md')).toContain('[[文献盒/B]]');
    expect(vault.files.get('卡片盒/E.md')).not.toContain('DEAD');

    clearNotices();
    const n2 = await agent.cleanDeadLinks();
    expect(n2).toBe(0);
    expect(getNoticeMessages().some((m) => m.includes('已清理'))).toBe(false);

    // 范围收回仅文献盒：卡片盒的失效链不再被扫描
    vault.files.set('卡片盒/F.md', '---\nrelated:\n  - "[[卡片盒/DEAD2.md]]"\n---\n\n正文');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    const n3 = await agent.cleanDeadLinks();
    expect(n3).toBe(0);
    expect(vault.files.get('卡片盒/F.md')).toContain('DEAD2');
  });

  it('死链清理：encrypt 锁定态（保险箱清单存在且未解锁）一律跳过', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', 'cipher');
    vault.files.set('文献盒/C.md', '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n---\n\n正文');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    const n = await agent.cleanDeadLinks();
    expect(n).toBe(0);
    expect(vault.files.get('文献盒/C.md')).toContain('GONE');
  });
});

describe('监听器：防抖聚合与开关门', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    __setLinkBatchMsForTests(30);
    __setLinkCleanDebounceMsForTests(30);
    __resetLinkAgentGuideForTests();
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  function makeWatcher(vault: MockVault) {
    const app = mockAppWithVault(vault);
    setApp(app as any);
    const agent = {
      processBatch: vi.fn(async () => ({ total: 0, processed: 0, created: 0, queued: 0, failed: 0 })),
      cleanDeadLinks: vi.fn(async () => 0),
      // v1.4：修改过滤与基准移除（stub：默认全部保留，测试按需覆写）
      filterChangedForRelink: vi.fn(async (paths: string[]) => paths),
      dropLinkBaseline: vi.fn(async () => {}),
    } as any;
    const watcher = new LinkAgentWatcher(app as any, agent);
    return { vault, agent, watcher };
  }

  it('文献盒内创建事件聚合成批；非文献盒忽略；缓冲内已删除文件不进批次', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/X.md', 'x');
    vault.files.set('其他/Y.md', 'y');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.onCreated('文献盒/DEAD.md'); // 防抖窗口内将被删除
    watcher.onCreated('其他/Y.md');
    watcher.onDeleted('文献盒/DEAD.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/X.md']);
    watcher.destroy();
  });

  it('多范围目录：监听随 linkAgentScopes 同步生效；缺键（空）时什么也不录、不触发', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/X.md', 'x');
    vault.files.set('卡片盒/K.md', 'k');
    vault.files.set('其他/Y.md', 'y');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒,卡片盒' }));
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.onCreated('卡片盒/K.md'); // 第二个范围目录同样触发
    watcher.onCreated('其他/Y.md'); // 范围外忽略
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/X.md', '卡片盒/K.md']);
    watcher.destroy();

    // 设置对象缺 linkAgentScopes 键（空）：范围 = 什么也不录，任何路径都不触发监听
    clearDomainEvents();
    const w2env = makeWatcher(new MockVault());
    w2env.vault.files.set('文献盒/Z.md', 'z');
    setSettingsProvider(() => {
      const s = { ...baseSettings(), secondBrainAllowPaths: '文献盒' };
      delete (s as any).linkAgentScopes;
      return s;
    });
    w2env.watcher.start();
    w2env.watcher.onCreated('文献盒/Z.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(w2env.agent.processBatch).not.toHaveBeenCalled();
    w2env.watcher.destroy();
  });

  it('v1.4 修改事件：范围内聚合 → 经 filterChangedForRelink 过滤后并入批次（创建+修改混合）', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/X.md', 'x');
    vault.files.set('文献盒/M.md', 'm');
    vault.files.set('文献盒/UNCHANGED.md', 'u');
    vault.files.set('文献盒/DEAD.md', 'd');
    vault.files.set('其他/Y.md', 'y');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    // 修改过滤 stub：只保留 M 与 X（UNCHANGED 被滤掉；X 虽来自 created 也并入批次去重）
    agent.filterChangedForRelink.mockImplementation(async (paths: string[]) =>
      paths.filter((p) => p.includes('M.md') || p.includes('X.md'))
    );
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.onModified('文献盒/M.md');
    watcher.onModified('文献盒/UNCHANGED.md'); // 过滤剔除
    watcher.onModified('文献盒/DEAD.md'); // 防抖窗口内被删除 → 缓冲剔除
    watcher.onModified('其他/Y.md'); // 范围外忽略
    watcher.onDeleted('文献盒/DEAD.md');
    expect(agent.dropLinkBaseline).toHaveBeenCalledWith('文献盒/DEAD.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/X.md', '文献盒/M.md']);
    watcher.destroy();
  });

  it('v1.4 修改过滤异常时按全部修改保留兜底（不丢事件）', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/M.md', 'm');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    agent.filterChangedForRelink.mockRejectedValue(new Error('状态文件损坏'));
    watcher.start();
    watcher.onModified('文献盒/M.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/M.md']);
    watcher.destroy();
  });

  it('v1.4 修改事件校验：范围外/开关关闭不缓冲，删除清两缓冲', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/M.md', 'm');
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    watcher.start();
    watcher.onModified('其他/Y.md'); // 范围外
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).not.toHaveBeenCalled();
    // 缓冲累积后删除 → 冲刷空批次（不调 processBatch）
    watcher.onCreated('文献盒/X.md');
    watcher.onModified('文献盒/X.md');
    watcher.onDeleted('文献盒/X.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).not.toHaveBeenCalled();
    watcher.destroy();

    // 开关关闭：start 不订阅，onModified 不缓冲
    clearDomainEvents();
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const w2 = makeWatcher(new MockVault());
    w2.vault.files.set('文献盒/M.md', 'm');
    w2.watcher.start();
    w2.watcher.onModified('文献盒/M.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(w2.agent.processBatch).not.toHaveBeenCalled();
    w2.watcher.destroy();
  });

  it('destroy 清空定时器：销毁后不再冲刷批次', async () => {
    const { watcher, agent } = makeWatcher(new MockVault());
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.destroy();
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).not.toHaveBeenCalled();
  });

  it('linkAgentEnabled=false：start 不订阅、onCreated 不缓冲（无任何监听与写入）', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const { watcher, agent } = makeWatcher(new MockVault());
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).not.toHaveBeenCalled();
    watcher.destroy();
  });

  it('引导提示泛化：范围内出现白名单未含目录时一次性提示；补齐后与重复 start 不再提示', () => {
    // 多目录范围：只点名缺失目录（书库缺失被提示，已在白名单内的文献盒/卡片盒不提）
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒,卡片盒,书库', secondBrainAllowPaths: '卡片盒,文献盒' }));
    const { watcher } = makeWatcher(new MockVault());
    watcher.start();
    const guide = getNoticeMessages().find((m) => m.includes('白名单'));
    expect(guide).toBeTruthy();
    expect(guide).toContain('书库');
    expect(guide!.includes('「文献盒」')).toBe(false);
    watcher.destroy();

    // 第二个 watcher（同会话）：不再重复提示
    clearNotices();
    const w2 = makeWatcher(new MockVault()).watcher;
    w2.start();
    expect(getNoticeMessages().some((m) => m.includes('白名单'))).toBe(false);
    w2.destroy();

    // 白名单已包含全部范围：无提示
    __resetLinkAgentGuideForTests();
    clearNotices();
    setSettingsProvider(baseSettings);
    const w3 = makeWatcher(new MockVault()).watcher;
    w3.start();
    expect(getNoticeMessages()).toEqual([]);
    w3.destroy();
  });
});

describe('命令 bz-secondbrain-rebuild-links 守卫分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
    unloadSecondBrain();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    unloadSecondBrain();
  });

  function makeCommandApp(activePath: string | null) {
    const vault = new MockVault();
    if (activePath) vault.files.set(activePath, '正文');
    const app = mockAppWithVault(vault);
    (app.workspace as any).getActiveFile = () => (activePath ? { path: activePath } : null);
    setApp(app as any);
    return app;
  }

  it('无活动笔记：提示先打开笔记', async () => {
    makeCommandApp(null);
    await rebuildSecondBrainLinks({ workspace: { getActiveFile: () => null } } as any);
    expect(getNoticeMessages().some((m) => m.includes('请先打开一个笔记'))).toBe(true);
  });

  it('手动触发不受范围限制：范围外笔记也进入管线（候选仍按范围过滤），完成后按结果通知', async () => {
    const app = makeCommandApp('我的/日记/x.md'); // 不在任何 linkAgentScopes 内
    // mock 掉管线本体（避免真实探测网络），验证命令放行进入管线而非被范围守卫拦截
    const spy = vi.spyOn(LinkAgent.prototype, 'processNote').mockResolvedValue({ status: 'done', created: 2 });
    await rebuildSecondBrainLinks(app as any);
    expect(spy).toHaveBeenCalledWith('我的/日记/x.md');
    expect(getNoticeMessages().some((m) => m.includes('已新建关联 2 条'))).toBe(true);
  });

  it('自动双链已关闭：提示且不进入管线', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const app = makeCommandApp('文献盒/a.md');
    await rebuildSecondBrainLinks(app as any);
    expect(getNoticeMessages().some((m) => m.includes('自动双链已在第二大脑设置中关闭'))).toBe(true);
  });
});

// ---------------- 存量补链与串行锁（ticket 115） ----------------

describe('存量补链（backfillMissingLinks，ticket 115 + 116）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '文献盒' }));
    setSettingsSaver(() => Promise.resolve());
  });

  it('可达且有目标：批量跑管线并写 related，done 汇总计数正确', async () => {
    const { vault, agent, askSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const result = await agent.backfillMissingLinks();
    expect(result.status).toBe('done');
    const summary = (result as { summary: { total: number; processed: number; created: number } }).summary;
    // 目标 = 文献盒内缺 related 的三篇（A/B/D），各建 1 条
    expect(summary).toMatchObject({ total: 3, processed: 3, created: 3 });
    // 每个目标都写入了 related
    for (const f of ['文献盒/A.md', '文献盒/B.md', '文献盒/D.md']) {
      expect(vault.files.get(f)).toContain('related');
    }
  });

  it('embedding 不可达：返回 unreachable，无写入无通知', async () => {
    const { agent, vault, askSpy } = makeWorld({ reachable: false });
    const result = await agent.backfillMissingLinks();
    expect(result).toEqual({ status: 'unreachable' });
    expect(askSpy).not.toHaveBeenCalled();
    expect(vault.files.get('文献盒/A.md')).not.toContain('related');
    expect(getNoticeMessages()).toEqual([]);
  });

  it('范围内全部已连接：返回 no-targets，不调裁判', async () => {
    const { vault, agent, askSpy } = makeWorld({});
    // 全部目标自带 related（已连接）
    vault.files.set(
      '文献盒/A.md',
      '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文'
    );
    vault.files.set(
      '文献盒/B.md',
      '---\nrelated: ["[[文献盒/A]]"]\n---\n\n正文'
    );
    vault.files.set(
      '文献盒/D.md',
      '---\nrelated: ["[[文献盒/A]]"]\n---\n\n正文'
    );
    const result = await agent.backfillMissingLinks();
    expect(result).toEqual({ status: 'no-targets' });
    expect(askSpy).not.toHaveBeenCalled();
  });

  it('队列内待重试条目排除在目标外（不重复算力）', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"r"}]');
    await enqueuePaths(['文献盒/A.md']); // A 在队列中 → 本次补链跳过它
    const result = await agent.backfillMissingLinks();
    expect(result.status).toBe('done');
    const summary = (result as { summary: { total: number; processed: number } }).summary;
    expect(summary.total).toBe(2); // 只处理 B、D
    expect(summary.processed).toBe(2);
    const q = await loadQueue();
    expect(q.map((i) => i.path)).toEqual(['文献盒/A.md']); // 队列条目未被消费（归队列消费管）
  });

  it('空关联范围：目标为空，返回 no-targets（ticket 116：什么也不录）', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentScopes: '' }));
    const { agent, askSpy } = makeWorld({});
    const result = await agent.backfillMissingLinks();
    expect(result).toEqual({ status: 'no-targets' });
    expect(askSpy).not.toHaveBeenCalled();
    expect(getNoticeMessages()).toEqual([]);
  });

  it('串行锁：并发批次排队执行，refresh 绝不同时运行', async () => {
    const vault = new MockVault();
    vault.files.set('文献盒/A.md', 'a');
    vault.files.set('文献盒/B.md', 'b');
    const app = mockAppWithVault(vault);
    setApp(app as any);
    let active = 0;
    let maxActive = 0;
    const store = {
      refresh: vi.fn(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 15));
        active--;
      }),
      vectorSearch: vi.fn(async () => []),
    };
    const agent = new LinkAgent({ app: app as any, store: store as any, probe: vi.fn(async () => true) });
    await Promise.all([
      agent.processBatch(['文献盒/A.md']),
      agent.processBatch(['文献盒/B.md']),
    ]);
    expect(maxActive).toBe(1); // 两个批次被串行锁排队，从未重叠
  });
});

// ---------------- 命令 bz-secondbrain-link-all 守卫分支（ticket 115） ----------------

describe('命令 bz-secondbrain-link-all 守卫分支', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
    unloadSecondBrain();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    unloadSecondBrain();
  });

  function makeAllApp() {
    const vault = new MockVault();
    vault.files.set('文献盒/A.md', '正文');
    const app = mockAppWithVault(vault);
    setApp(app as any);
    return app;
  }

  it('自动双链已关闭：提示且不进入补链', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const spy = vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({ status: 'done', summary: { total: 0, processed: 0, created: 0, queued: 0, failed: 0 } });
    await runSecondBrainLinkAll(makeAllApp() as any);
    expect(getNoticeMessages().some((m) => m.includes('自动双链已在第二大脑设置中关闭'))).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('补链产出关联：按汇总通知（启动静默路径不重复通知）', async () => {
    const spy = vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({
      status: 'done',
      summary: { total: 2, processed: 2, created: 3, queued: 0, failed: 0 },
    });
    await runSecondBrainLinkAll(makeAllApp() as any);
    expect(spy).toHaveBeenCalled(); // 手动命令路径进入补链（启动补链同路径静默）
    expect(getNoticeMessages().some((m) => m.includes('批量补链完成：处理 2 篇 / 新建关联 3 条'))).toBe(true);
  });

  it('零新建：通知未发现实质关联', async () => {
    vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({
      status: 'done',
      summary: { total: 1, processed: 1, created: 0, queued: 0, failed: 0 },
    });
    await runSecondBrainLinkAll(makeAllApp() as any);
    expect(getNoticeMessages().some((m) => m.includes('批量补链完成：未发现实质关联，未新建'))).toBe(true);
  });

  it('embedding 不可达：提示稍后自动补链', async () => {
    vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({ status: 'unreachable' });
    await runSecondBrainLinkAll(makeAllApp() as any);
    expect(getNoticeMessages().some((m) => m.includes('embedding 服务不可达'))).toBe(true);
  });

  it('无待补链笔记：提示已处理完', async () => {
    vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({ status: 'no-targets' });
    await runSecondBrainLinkAll(makeAllApp() as any);
    expect(getNoticeMessages().some((m) => m.includes('当前无待补链笔记'))).toBe(true);
  });
});
