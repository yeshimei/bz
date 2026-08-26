/**
 * 自动双链 UI/通知层测试（ticket 111，jsdom）：
 * - ⚙️ 弹窗「自动双链」总开关联动明细显隐（onChange 即时重渲染、各键独立持久化、重开还原）；
 * - 管线写入（单侧幂等 / 上限截断 / 入队 / 裁判失败入队）；
 * - 通知触发条件（本批新建 N 条 / N=0 静默 / 队列消费完成 / 死链清理有移除才报）；
 * - 监听器聚合与守卫；命令 bz-secondbrain-rebuild-links 注册守卫分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { enqueuePaths, loadQueue } from '../../src/secondbrain/link-agent/data';
import { AI } from '../../src/secondbrain/ai';
import { rebuildSecondBrainLinks, unloadSecondBrain } from '../../src/secondbrain/index';

const QUEUE_PATH = 'CONFIG/STORAGE/secondbrain_link_queue.json';

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

  it('开启态：组名与四行明细渲染', () => {
    openSecondBrainSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('自动双链');
    for (const name of ['单篇候选数量 TopK', '每篇关联上限', '完成通知', '失效关联自动清理']) {
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
    // 明细整体隐藏（区块重渲染后无明细行）
    expect([...popup.querySelectorAll('.setting-item')].some((el) => (el as HTMLElement).dataset.name === '单篇候选数量 TopK')).toBe(false);
    closeSettingsModal();

    // 重开弹窗按当前状态还原：仍关闭、无明细
    openSecondBrainSettings();
    const popup2 = document.getElementById('bz-settings-modal-popup')!;
    expect([...popup2.querySelectorAll('.setting-item')].some((el) => (el as HTMLElement).dataset.name === '单篇候选数量 TopK')).toBe(false);
    closeSettingsModal();
  });

  it('重开还原开启态；各键独立持久化（TopK/上限文本、通知与清理 toggle）', async () => {
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
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.linkAgentTopK).toBe(6);
    expect(settings.linkAgentMaxLinks).toBe(5);
    expect(settings.linkAgentNotify).toBe(true);
    expect(settings.linkAgentAutoClean).toBe(true);
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
    vectorSearch: vi.fn(async () => opts.hits ?? []),
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

  it('死链清理：有移除才报「已清理 N 条失效关联」；零变化静默', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set(
      '文献盒/C.md',
      '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n  - "[[文献盒/B]]"\n---\n\n正文'
    );
    const n1 = await agent.cleanDeadLinks();
    expect(n1).toBe(1);
    expect(getNoticeMessages().some((m) => m.includes('已清理 1 条失效关联'))).toBe(true);
    expect(vault.files.get('文献盒/C.md')).not.toContain('GONE');
    expect(vault.files.get('文献盒/C.md')).toContain('[[文献盒/B]]');

    clearNotices();
    const n2 = await agent.cleanDeadLinks();
    expect(n2).toBe(0);
    expect(getNoticeMessages().some((m) => m.includes('已清理'))).toBe(false);
  });

  it('死链清理：encrypt 锁定态（保险箱清单存在且未解锁）一律跳过', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set('CONFIG/.ENCRYPT/.safe.enc', 'cipher');
    vault.files.set('文献盒/C.md', '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n---\n\n正文');
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
    } as any;
    const watcher = new LinkAgentWatcher(app as any, agent);
    return { vault, agent, watcher };
  }

  it('文献盒内创建事件聚合成批；非文献盒忽略；缓冲内已删除文件不进批次', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/X.md', 'x');
    vault.files.set('其他/Y.md', 'y');
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

  it('白名单缺「文献盒」时一次性引导提示；补齐后与重复 start 不再提示', () => {
    setSettingsProvider(() => ({ ...baseSettings(), secondBrainAllowPaths: '卡片盒' }));
    const { watcher } = makeWatcher(new MockVault());
    watcher.start();
    expect(getNoticeMessages().some((m) => m.includes('文献盒'))).toBe(true);
    watcher.destroy();

    // 第二个 watcher（同会话）：不再重复提示
    clearNotices();
    const w2 = makeWatcher(new MockVault()).watcher;
    w2.start();
    expect(getNoticeMessages().some((m) => m.includes('白名单'))).toBe(false);
    w2.destroy();

    // 白名单已包含文献盒：无提示
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

  it('非文献盒笔记：提示性通知，不进入管线', async () => {
    const app = makeCommandApp('我的/日记/x.md');
    await rebuildSecondBrainLinks(app as any);
    expect(getNoticeMessages().some((m) => m.includes('不在文献盒'))).toBe(true);
  });

  it('自动双链已关闭：提示且不进入管线', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const app = makeCommandApp('文献盒/a.md');
    await rebuildSecondBrainLinks(app as any);
    expect(getNoticeMessages().some((m) => m.includes('自动双链已在第二大脑设置中关闭'))).toBe(true);
    unloadSecondBrain();
  });
});
