/**
 * 自动关联 UI/通知层测试（ticket 111 + 115 + 119；ADR-0141 正名并限定三盒，jsdom）：
 * - ⚙️ 知识盒设置弹窗「自动关联」组总开关联动明细显隐（ADR-0141 §1 自第二大脑设置页迁入）；
 * - 管线写入（单侧幂等 / 上限截断 / 入队 / 裁判失败入队）；
 * - 通知触发条件（本批新建 N 条 / N=0 静默 / 队列消费完成 / 死链清理有移除才报）；
 * - 监听器聚合与守卫（范围恒为三盒）；命令 bz-knowledge-relink 守卫分支（含盒外拒绝）；
 * - 存量补链（ticket 115）：目标清单扫描 / 可达门 / 队列排除 / 串行锁 / 已尝试 0 条不重跑（ADR-0141 §6）；
 * - 正文大改自动重跑（v1.4/ticket 119）：成功建链后记基准哈希；修改过滤（实质变化才重跑）；
 *   修改监听聚合与删除清基准；自写 related 不触发循环重跑。
 * - 自动关联通道（issue 309 + ADR-0141）：createLinkBridge 四段能力——preview（草稿未落盘也能算关联，
 *   生成后立刻跑）/ apply（落盘后写预演结果）/ now（兜底单篇管线，force 供手动命令）/ backfill（批量补链）；
 *   装载等待与返回值透传。「请去补白名单」一次性引导已随三盒恒含退役（ADR-0141 §3）。
 * - processNoteNow 自身的通知门（issue 298 保留）：新建 N / 入队 / 失败三态 toast（通道调用传 silent）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { clearDomainEvents, emitDomainEvent } from '../../src/core/domain-bus';
import { closeSettingsModal, openSettingsModal } from '../../src/core/settings-modal';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { LinkAgent, __setLinkBatchMsForTests } from '../../src/secondbrain/link-agent/pipeline';
import {
  LinkAgentWatcher,
  __setLinkCleanDebounceMsForTests,
  createLinkBridge,
  startQueueConsumption,
  startStartupBackfill,
} from '../../src/secondbrain/link-agent/watch';
import { enqueuePaths, loadQueue, loadLinkState, computeHash } from '../../src/secondbrain/link-agent/data';
import { AI } from '../../src/secondbrain/ai';
import { unloadSecondBrain } from '../../src/secondbrain/index';
import { relinkActiveNote, linkAllInBoxes } from '../../src/knowledge/index';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { secondBrainSettingsSchema } from '../../src/secondbrain/panel';
import { setLinkBridge } from '../../src/core/link-now';

function baseSettings() {
  // ADR-0141 §3：白名单不再是候选来源开关（三盒恒含索引），此处留空不影响自动关联行为
  return { ...DEFAULT_SETTINGS, secondBrainAllowPaths: '' } as any;
}

/** 知识盒设置弹窗（「自动关联」组所在处；ADR-0141 §1 自第二大脑设置页迁入） */
function openAutoLinkSettings(): void {
  openSettingsModal({ title: '知识盒设置', maxWidth: 520, schema: knowledgeSettingsSchema() });
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

describe('⚙️ 知识盒设置弹窗「自动关联」组（ADR-0141 §1：自第二大脑设置页迁入）', () => {
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

  it('开启态：组名与六条明细渲染；「关联范围」行已退役（ADR-0141 §2：范围恒为三个盒子）', () => {
    openAutoLinkSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('自动关联');
    for (const name of ['单篇候选数量 TopK', '每篇关联上限', '候选相似度下限', '完成通知', '失效关联自动清理', '已有关联不再建链']) {
      expect([...popup.querySelectorAll('.setting-item')].some((el) => (el as HTMLElement).dataset.name === name)).toBe(true);
    }
    const rowNames = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    expect(rowNames).not.toContain('关联范围'); // 范围不再可配
    closeSettingsModal();
  });

  it('第二大脑设置页不再有「自动双链」组（ADR-0141 §1：设置组已迁知识盒）', () => {
    const groups = secondBrainSettingsSchema().groups.map((g) => g.name);
    expect(groups).not.toContain('自动双链');
    expect(groups).not.toContain('自动关联');
  });

  it('onChange 关闭总开关：明细即时隐藏（bz-setting-hidden）且键持久化；重开弹窗还原关闭态', async () => {
    openAutoLinkSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    rowTrigger(popup, '自动关联')(false);
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.linkAgentEnabled).toBe(false);
    // 明细整体隐藏（ticket 131 visibleWhen 声明式：隐藏行留在 DOM 带 .bz-setting-hidden）
    const detailHidden = (name: string) => {
      const el = [...popup.querySelectorAll('.setting-item')].find((s) => (s as HTMLElement).dataset.name === name);
      return el ? (el as HTMLElement).closest('.bz-setting-hidden') !== null : false;
    };
    expect(detailHidden('单篇候选数量 TopK')).toBe(true);
    closeSettingsModal();

    // 重开弹窗按当前状态还原：仍关闭、明细隐藏
    openAutoLinkSettings();
    const popup2 = document.getElementById('bz-settings-modal-popup')!;
    const topkEl2 = [...popup2.querySelectorAll('.setting-item')].find(
      (s) => (s as HTMLElement).dataset.name === '单篇候选数量 TopK'
    ) as HTMLElement;
    expect(topkEl2).toBeTruthy();
    expect(topkEl2.closest('.bz-setting-hidden')).not.toBeNull();
    closeSettingsModal();
  });

  it('重开还原开启态；各键独立持久化（TopK/上限文本、通知与清理 toggle）', async () => {
    settings.linkAgentEnabled = false;
    settings.linkAgentTopK = 12;
    settings.linkAgentMaxLinks = 3;
    settings.linkAgentNotify = false;
    settings.linkAgentAutoClean = false;
    settings.linkAgentRespectRelated = false;
    openAutoLinkSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    // 开启态还原（master 值来自当前设置）
    rowTrigger(popup, '自动关联')(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.linkAgentEnabled).toBe(true);
    // 各键独立持久化
    rowTrigger(popup, '单篇候选数量 TopK')('6');
    rowTrigger(popup, '每篇关联上限')('5');
    rowTrigger(popup, '候选相似度下限')('0.5');
    rowTrigger(popup, '完成通知')(true);
    rowTrigger(popup, '失效关联自动清理')(true);
    rowTrigger(popup, '已有关联不再建链')(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(settings.linkAgentTopK).toBe(6);
    expect(settings.linkAgentMaxLinks).toBe(5);
    expect(settings.linkAgentMinScore).toBe(0.5); // issue 330/ADR-0146：钳制到 0~1 的数字
    expect(settings.linkAgentNotify).toBe(true);
    expect(settings.linkAgentAutoClean).toBe(true);
    expect(settings.linkAgentRespectRelated).toBe(true);
    closeSettingsModal();
  });

  it('[f2-sb] 重载提示一次弹窗只提示一次（ADR-0141：总开关仍在知识盒设置页，仍是启动快照配置）', async () => {
    openAutoLinkSettings();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    clearNotices();
    // 「自动关联」toggle 仍带 warnReload（首次改动提示「重载插件后生效」）
    rowTrigger(popup, '自动关联')(false);
    rowTrigger(popup, '自动关联')(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(settings.linkAgentEnabled).toBe(true);
    // 一次弹窗会话内只提示一次（f2 重载提示收敛）
    expect(getNoticeMessages().filter((m) => m.includes('重载插件后生效')).length).toBe(1);
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

    // 幂等：同一裁决重跑不再新增。
    // v1.7/ticket 167：A 已写入 related，自动路径被尊重门拦截（skipped-related，见新 describe），
    // 此处用 respectRelated:false 模拟手动重跑豁免，验证幂等合并仍生效
    const r2 = await agent.processNote('文献盒/A.md', { respectRelated: false });
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

  it('previewLinks：检索失败必须冒头 → queued（不冒充「暂无关联」）', async () => {
    const { agent, store } = makeWorld({});
    store.vectorSearch.mockRejectedValue(new Error('Ollama 无响应'));
    await expect(agent.previewLinks('一篇草稿正文', '草稿标题')).resolves.toEqual({ status: 'queued' });
  });

  it('previewLinks：可达且零命中 → done 空 picks（真空候选，与不可达两态可区分）', async () => {
    const { agent } = makeWorld({ hits: [] });
    await expect(agent.previewLinks('一篇草稿正文', '草稿标题')).resolves.toEqual({ status: 'done', picks: [] });
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
    const r = await agent.processNote('CONFIG/STORAGE/.ENCRYPT/x.md');
    expect(r).toEqual({ status: 'skipped' });
  });

  it('候选端限三盒（ADR-0141 §2）：盒外候选被过滤，仅剔除自身/缺失文件/encrypt 锁定', async () => {
    const { vault, agent } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '卡片盒/K.md', chunk: 'K', score: 0.85 },
        { path: '主题盒/T.md', chunk: 'T', score: 0.82 },
        { path: '其他/X.md', chunk: 'X', score: 0.8 }, // 盒外 → 过滤
        { path: '书库/Y.md', chunk: 'Y', score: 0.78 }, // 盒外 → 过滤
        { path: '文献盒/A.md', chunk: '自身', score: 0.99 }, // 自身剔除
        { path: 'CONFIG/STORAGE/.ENCRYPT/E.md', chunk: 'E', score: 0.7 }, // encrypt 锁定剔除
        { path: '文献盒/GONE.md', chunk: 'G', score: 0.6 }, // 文件不存在剔除
      ],
    });
    vault.files.set('卡片盒/K.md', 'k');
    vault.files.set('主题盒/T.md', 't');
    vault.files.set('其他/X.md', 'x');
    vault.files.set('书库/Y.md', 'y');
    const r1 = await agent.findCandidates('文献盒/A.md', '正文');
    expect(r1.map((c) => c.path)).toEqual(['文献盒/B.md', '卡片盒/K.md', '主题盒/T.md']);

    // 盒子目录改了 → 候选范围跟着改（实时读设置，无缓存）
    const second = makeWorld({
      hits: [
        { path: '卡片盒2/N.md', chunk: 'N', score: 0.9 },
        { path: '卡片盒/K.md', chunk: 'K', score: 0.85 }, // 旧卡片盒已不在盒内
      ],
    });
    second.vault.files.set('卡片盒2/N.md', 'n');
    second.vault.files.set('卡片盒/K.md', 'k');
    setSettingsProvider(() => ({ ...baseSettings(), knowledgeCardboxDirectory: '卡片盒2' }));
    const r2 = await second.agent.findCandidates('文献盒/A.md', '正文');
    expect(r2.map((c) => c.path)).toEqual(['卡片盒2/N.md']);
  });

  it('候选相似度下限（issue 330/ADR-0146，issue 425/ADR-0185 换算）：低于下限的候选剔除不送裁判；边界值保留；0 不过滤', async () => {
    // 默认 0.30（原始余弦尺，分数不再锐化）：等于下限保留（严格小于才剔）、低于剔除
    const { vault, agent } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.5 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.3 }, // 边界：保留
        { path: '文献盒/E.md', chunk: 'E', score: 0.299 }, // 低于下限：剔除
      ],
    });
    vault.files.set('文献盒/E.md', 'e');
    const r1 = await agent.findCandidates('文献盒/A.md', '正文');
    expect(r1.map((c) => c.path)).toEqual(['文献盒/B.md', '文献盒/D.md']);

    // 0 = 不过滤：低分候选照常入选（设置实时读，改 provider 即生效）
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentMinScore: 0 }));
    const r2 = await agent.findCandidates('文献盒/A.md', '正文');
    expect(r2.map((c) => c.path)).toEqual(['文献盒/B.md', '文献盒/D.md', '文献盒/E.md']);
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

describe('已有 related 不再自动建链（v1.7/ticket 167）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('尊重门默认开启：related 非空的笔记直接 skipped-related，不探测不裁判不写入', async () => {
    const { vault, agent, store, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    // A 已有 related（已连接）
    vault.files.set(
      '文献盒/A.md',
      '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文'
    );
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'skipped-related' });
    expect(store.refresh).not.toHaveBeenCalled();
    expect(store.vectorSearch).not.toHaveBeenCalled();
    expect(askSpy).not.toHaveBeenCalled();
    // 未改动文件（未新增链）
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });

  it('related 为空数组 / 缺失：视为未接管，照常建链', async () => {
    const { vault, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    vault.files.set('文献盒/A.md', '---\nrelated: []\n---\n\n正文'); // 空数组
    vault.files.set('文献盒/C.md', '---\ntags: x\n---\n\n正文'); // 无 related 键
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const r1 = await agent.processNote('文献盒/A.md');
    expect(r1).toEqual({ status: 'done', created: 1 });
    const r2 = await agent.processNote('文献盒/C.md');
    expect(r2).toEqual({ status: 'done', created: 1 });
  });

  it('respectRelated:false（手动重跑）豁免：已有 related 也强制重跑并幂等合并', async () => {
    const { vault, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    vault.files.set(
      '文献盒/A.md',
      '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文'
    );
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const r = await agent.processNote('文献盒/A.md', { respectRelated: false });
    expect(r).toEqual({ status: 'done', created: 0 }); // 幂等：链已存在不加重复
    expect(askSpy).toHaveBeenCalled();
  });

  it('开关关闭（linkAgentRespectRelated=false）：恢复旧行为——已有关联仍走完整管线', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentRespectRelated: false }));
    const { vault, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    vault.files.set(
      '文献盒/A.md',
      '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文'
    );
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 0 }); // 幂等重跑（旧行为）
    expect(askSpy).toHaveBeenCalled();
  });

  it('队列消费：related 非空条目 skipped-related 且移除队列条目（不滞留）；未连接的照常建链', async () => {
    const { vault, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/D.md', chunk: 'D', score: 0.8 }], // B 处理时自身被剔除，指向 D 保证建链
    });
    vault.files.set(
      '文献盒/A.md',
      '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文' // A 已连接
    );
    await enqueuePaths(['文献盒/A.md', '文献盒/B.md']); // B 未连接
    askSpy.mockResolvedValue('[{"id":1,"reason":"同主题"}]');
    const summary = await agent.consumeQueue();
    // A 被尊重门跳过并移除；B 正常建链
    expect(summary).toMatchObject({ total: 2, processed: 1, created: 1 });
    expect((await loadQueue()).length).toBe(0); // 两条都被移除（无滞留）
    const fmB = vault.files.get('文献盒/B.md')!;
    expect(fmB).toContain('related');
  });

  it('队列消费：全部为已连接时 processed=0 且完成通知不出现（静默移除）', async () => {
    const { vault, agent, askSpy } = makeWorld({});
    vault.files.set('文献盒/A.md', '---\nrelated: ["[[文献盒/B]]"]\n---\n\n正文');
    vault.files.set('文献盒/B.md', '---\nrelated: ["[[文献盒/A]]"]\n---\n\n正文');
    await enqueuePaths(['文献盒/A.md', '文献盒/B.md']);
    askSpy.mockResolvedValue('[]');
    const summary = await agent.consumeQueue();
    expect(summary).toMatchObject({ total: 2, processed: 0, created: 0, failed: 0 });
    expect((await loadQueue()).length).toBe(0);
    // processed=0 → 完成通知被收起（静默），不弹「处理完毕」文案
    expect(getNoticeMessages().some((m) => m.includes('待处理关联已处理完毕'))).toBe(false);
    expect(askSpy).not.toHaveBeenCalled();
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
    // ② 幂等重跑（created=0）→ 基准刷新为当前内容（幂等返回 done 仍记）。
    // v1.7/ticket 167：已连接笔记自动路径被尊重门拦截，此处用 respectRelated:false 模拟手动重跑豁免
    const r2 = await agent.processNote('文献盒/A.md', { respectRelated: false });
    expect(r2).toEqual({ status: 'done', created: 0 });
    state = await loadLinkState();
    expect(state['文献盒/A.md'].hash).toBe(computeHash(vault.files.get('文献盒/A.md')!));

    clearNotices();
    // ③ 不可达（入队）→ 不记基准：先大改正文（文件变了），入队后基准仍是旧内容哈希。
    // 同样传 respectRelated:false 豁免尊重门（A 已有 related，自动路径本会跳过入队——队列消费遇已连接条目是另一语义）
    vault.files.set('文献盒/A.md', '---\ntitle: 向量笔记\ntags: vec\n---\n\n入队后不更新基准的正文。');
    const agent2 = new LinkAgent({
      app: app as any,
      store: store as any,
      probe: vi.fn(async () => false), // 同 vault 不同探测：不可达
    });
    expect((await agent2.processNote('文献盒/A.md', { respectRelated: false })).status).toBe('queued');
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
    expect(await agent.filterChangedForRelink(['文献盒/GONE.md', '文献盒/notes.txt', 'CONFIG/STORAGE/.ENCRYPT/e.md'])).toEqual([]);
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

  it('死链清理：有移除才报「已清理 N 条失效关联」；零变化静默；扫描范围恒为三盒', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set(
      '文献盒/C.md',
      '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n  - "[[文献盒/B]]"\n---\n\n正文'
    );
    vault.files.set('卡片盒/E.md', '---\nrelated:\n  - "[[卡片盒/DEAD.md]]"\n---\n\n正文');
    // 盒外（书库）不在范围内：失效链原样保留（ADR-0141 §2：范围不再可配）
    vault.files.set('书库/F.md', '---\nrelated:\n  - "[[书库/DEAD2.md]]"\n---\n\n正文');
    const n1 = await agent.cleanDeadLinks();
    expect(n1).toBe(2); // 文献盒 1 + 卡片盒 1
    expect(getNoticeMessages().some((m) => m.includes('已清理 2 条失效关联'))).toBe(true);
    expect(vault.files.get('文献盒/C.md')).not.toContain('GONE');
    expect(vault.files.get('文献盒/C.md')).toContain('[[文献盒/B]]');
    expect(vault.files.get('卡片盒/E.md')).not.toContain('DEAD');
    expect(vault.files.get('书库/F.md')).toContain('DEAD2');

    clearNotices();
    const n2 = await agent.cleanDeadLinks();
    expect(n2).toBe(0);
    expect(getNoticeMessages().some((m) => m.includes('已清理'))).toBe(false);
  });

  it('[n2-sb] 启动静默：silent 批次/队列不发进度与完成 toast，汇总照常；手动（非 silent）保留通知', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"}]');
    const s = await agent.processBatch(['文献盒/A.md'], { silent: true });
    expect(s.processed).toBe(1);
    expect(getNoticeMessages()).toEqual([]); // 启动路径批次全程静默（手动命令非 silent 才有 toast，已有用例覆盖）

    // 队列消费同样支持启动静默
    const { agent: agent2, askSpy: ask2 } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    ask2.mockResolvedValue('[{"id":1,"reason":"b"}]');
    await enqueuePaths(['文献盒/A.md']);
    const s2 = await agent2.consumeQueue({ silent: true });
    expect(s2).toMatchObject({ processed: 1 });
    expect(getNoticeMessages()).toEqual([]);
  });

  it('[n2-sb] 启动包装器按静默接线：startQueueConsumption / startStartupBackfill 传 { silent: true }', async () => {
    const agent = new LinkAgent({ app: {} as any, store: {} as any, probe: vi.fn(async () => true) });
    const spyC = vi.spyOn(LinkAgent.prototype, 'consumeQueue').mockResolvedValue(null);
    const spyB = vi.spyOn(LinkAgent.prototype, 'backfillMissingLinks').mockResolvedValue({
      status: 'done',
      summary: { total: 0, processed: 0, created: 0, queued: 0, failed: 0 },
    });
    try {
      await startQueueConsumption(agent as any, Promise.resolve(), { silent: true });
      await startStartupBackfill(agent as any, Promise.resolve(), { silent: true });
      expect(spyC).toHaveBeenCalledWith({ silent: true });
      expect(spyB).toHaveBeenCalledWith({ silent: true });
    } finally {
      spyC.mockRestore();
      spyB.mockRestore();
    }
  });

  it('死链清理：encrypt 锁定态（保险箱清单存在且未解锁）一律跳过', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set('CONFIG/STORAGE/.ENCRYPT/.safe.enc', 'cipher');
    vault.files.set('文献盒/C.md', '---\nrelated:\n  - "[[文献盒/GONE.md]]"\n---\n\n正文');
    // 范围恒为三盒（ADR-0141 §2）：文献盒在盒内，其他/ 在盒外
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

  it('三盒内创建事件聚合成批；盒外忽略；缓冲内已删除文件不进批次', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/X.md', 'x');
    vault.files.set('主题盒/T.md', 't');
    vault.files.set('其他/Y.md', 'y');
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.onCreated('文献盒/DEAD.md'); // 防抖窗口内将被删除
    watcher.onCreated('主题盒/T.md'); // 三盒之一：同样触发
    watcher.onCreated('其他/Y.md'); // 盒外忽略
    watcher.onDeleted('文献盒/DEAD.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/X.md', '主题盒/T.md']);
    watcher.destroy();
  });

  it('盒子目录改了监听范围跟着改（实时读设置）；盒外路径一律不触发', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('卡片盒2/N.md', 'n');
    vault.files.set('卡片盒/K.md', 'k');
    setSettingsProvider(() => ({ ...baseSettings(), knowledgeCardboxDirectory: '卡片盒2' }));
    watcher.start();
    watcher.onCreated('卡片盒2/N.md'); // 新卡片盒目录：在盒内
    watcher.onCreated('卡片盒/K.md'); // 旧卡片盒目录：已不在盒内
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['卡片盒2/N.md']);
    watcher.destroy();

    // 盒外一律不触发（范围不可配 → 不存在「范围为空什么也不录」这个态了）
    clearDomainEvents();
    const w2env = makeWatcher(new MockVault());
    w2env.vault.files.set('书库/Z.md', 'z');
    w2env.watcher.start();
    w2env.watcher.onCreated('书库/Z.md');
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
    // 范围恒为三盒（ADR-0141 §2）：文献盒在盒内，其他/ 在盒外
    // 修改过滤 stub：只保留 M 与 X（UNCHANGED 被滤掉；X 虽来自 created 也并入批次去重）
    agent.filterChangedForRelink.mockImplementation(async (paths: string[]) =>
      paths.filter((p) => p.includes('M.md') || p.includes('X.md'))
    );
    watcher.start();
    watcher.onCreated('文献盒/X.md');
    watcher.onModified('文献盒/M.md');
    watcher.onModified('文献盒/UNCHANGED.md'); // 过滤剔除
    watcher.onModified('文献盒/DEAD.md'); // 防抖窗口内被删除 → 缓冲剔除
    watcher.onModified('其他/Y.md'); // 盒外忽略
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
    // 范围恒为三盒（ADR-0141 §2）：文献盒在盒内，其他/ 在盒外
    agent.filterChangedForRelink.mockRejectedValue(new Error('状态文件损坏'));
    watcher.start();
    watcher.onModified('文献盒/M.md');
    await new Promise((r) => setTimeout(r, 70));
    expect(agent.processBatch).toHaveBeenCalledTimes(1);
    expect(agent.processBatch.mock.calls[0][0]).toEqual(['文献盒/M.md']);
    watcher.destroy();
  });

  it('v1.4 修改事件校验：盒外/开关关闭不缓冲，删除清两缓冲', async () => {
    const { vault, agent, watcher } = makeWatcher(new MockVault());
    vault.files.set('文献盒/M.md', 'm');
    // 范围恒为三盒（ADR-0141 §2）：文献盒在盒内，其他/ 在盒外
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

});

describe('命令 bz-knowledge-relink 守卫分支（ADR-0141 §1：命令迁入知识盒域，引擎留第二大脑）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
    setLinkBridge(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLinkBridge(null);
  });

  function makeCommandApp(activePath: string | null) {
    const vault = new MockVault();
    if (activePath) vault.files.set(activePath, '正文');
    const app = mockAppWithVault(vault);
    (app.workspace as any).getActiveFile = () => (activePath ? { path: activePath } : null);
    setApp(app as any);
    return app;
  }

  /** 注入假通道（知识盒只经 core/link-now 消费，域隔离下不 import 第二大脑） */
  function injectBridge(outcome: unknown) {
    const now = vi.fn(async () => outcome);
    setLinkBridge({ now, preview: vi.fn(), apply: vi.fn(), backfill: vi.fn() } as any);
    return now;
  }

  it('无活动笔记：提示先打开笔记', async () => {
    injectBridge({ status: 'done', created: 0 });
    await relinkActiveNote({ workspace: { getActiveFile: () => null } } as any);
    expect(getNoticeMessages().some((m) => m.includes('请先打开一个笔记'))).toBe(true);
  });

  it('手动重跑强制：force 透传（跳过「已有 related 不建链」尊重门），完成后按结果通知', async () => {
    const app = makeCommandApp('文献盒/a.md');
    const now = injectBridge({ status: 'done', created: 2 });
    await relinkActiveNote(app as any);
    expect(now).toHaveBeenCalledWith('文献盒/a.md', { force: true }); // v1.7/ticket 167 保留
    expect(getNoticeMessages().some((m) => m.includes('已新建关联 2 条'))).toBe(true);
  });

  it('盒外笔记：拒绝并提示不在三个盒子内（ADR-0141 §2 口径反转——手动不再豁免范围）', async () => {
    const app = makeCommandApp('我的/日记/x.md');
    const now = injectBridge({ status: 'out-of-scope' });
    await relinkActiveNote(app as any);
    expect(now).toHaveBeenCalledWith('我的/日记/x.md', { force: true }); // 命令不预判盒界，判定归实现侧
    expect(getNoticeMessages().some((m) => m.includes('该笔记不在三个盒子内'))).toBe(true);
  });

  it('零新建 / 入队 / 失败 / 无法处理：各自提示', async () => {
    const app = makeCommandApp('文献盒/a.md');
    injectBridge({ status: 'done', created: 0 });
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('未发现实质关联，未新建'))).toBe(true);

    clearNotices();
    injectBridge({ status: 'queued' });
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('已加入待处理队列'))).toBe(true);

    clearNotices();
    injectBridge({ status: 'failed', error: '服务商不可用' });
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('关联处理失败：服务商不可用'))).toBe(true);

    clearNotices();
    injectBridge({ status: 'skipped' });
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('该笔记暂无法处理'))).toBe(true);
  });

  it('自动关联已关闭：提示且不调通道', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const app = makeCommandApp('文献盒/a.md');
    const now = injectBridge({ status: 'done', created: 1 });
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('自动关联已在知识盒设置中关闭'))).toBe(true);
    expect(now).not.toHaveBeenCalled();
  });

  it('通道未接线（第二大脑未就绪）：明确提示，不静默', async () => {
    const app = makeCommandApp('文献盒/a.md');
    setLinkBridge(null);
    await relinkActiveNote(app as any);
    expect(getNoticeMessages().some((m) => m.includes('自动关联暂不可用'))).toBe(true);
  });
});

// ---------------- 存量补链与串行锁（ticket 115） ----------------

describe('存量补链（backfillMissingLinks，ticket 115 + 116 + ADR-0141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings); // 范围恒为三盒（ADR-0141 §2），不再需要范围覆盖
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

  it('三盒内没有文件：目标为空，返回 no-targets（空盒是合法状态，不报错不提示）', async () => {
    // 三盒全部指向空目录（含 ADR-0141 §4 的「不做存在性探测」：目录不存在即该盒范围为空格）
    setSettingsProvider(
      () => ({
        ...baseSettings(),
        knowledgeDirectory: '空文献盒',
        knowledgeCardboxDirectory: '空卡片盒',
        knowledgeTopicDirectory: '空主题盒',
      })
    );
    const { agent, askSpy } = makeWorld({});
    const result = await agent.backfillMissingLinks();
    expect(result).toEqual({ status: 'no-targets' });
    expect(askSpy).not.toHaveBeenCalled();
    expect(getNoticeMessages()).toEqual([]);
  });

  it('盒外笔记不进目标：书库/日记里的缺关联笔记不被自动建链（ADR-0141 §2）', async () => {
    const { vault, agent, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"r"}]');
    vault.files.set('书库/缺关联.md', '一本还没建过关联的书');
    vault.files.set('我的/日记/缺关联.md', '一篇还没建过关联的日记');
    const result = await agent.backfillMissingLinks();
    expect(result.status).toBe('done');
    const summary = (result as { summary: { total: number } }).summary;
    expect(summary.total).toBe(3); // 只有文献盒 A/B/D
    expect(vault.files.get('书库/缺关联.md')).not.toContain('related');
    expect(vault.files.get('我的/日记/缺关联.md')).not.toContain('related');
  });

  it('已尝试且 0 条（ADR-0141 §6）：正文未变不再重跑；正文改了重新进目标', async () => {
    // 第一轮：AI 判定无关联 → 写基准并记 empty
    const first = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    first.askSpy.mockResolvedValue('[]');
    const r1 = await first.agent.backfillMissingLinks();
    expect(r1.status).toBe('done');
    const st = await loadLinkState();
    expect(Object.values(st).filter((e) => e.empty === true).length).toBeGreaterThan(0);

    // 第二轮（同一库）：仍无 related，但基准已记「已尝试且 0 条」→ 不再进目标、不再调裁判
    first.askSpy.mockClear();
    const r2 = await first.agent.backfillMissingLinks();
    expect(r2).toEqual({ status: 'no-targets' });
    expect(first.askSpy).not.toHaveBeenCalled();

    // 正文改了 → 哈希不同 → 重新进目标
    first.vault.files.set('文献盒/A.md', '改过一遍的正文，与基准哈希不同');
    first.askSpy.mockResolvedValue('[]');
    const r3 = await first.agent.backfillMissingLinks();
    expect(r3.status).toBe('done');
    const s3 = (r3 as { summary: { total: number } }).summary;
    expect(s3.total).toBe(1); // 只有刚改过的 A 重新进目标
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

describe('命令 bz-knowledge-link-all 守卫分支（ADR-0141 §1：命令迁入知识盒域）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
    setLinkBridge(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLinkBridge(null);
  });

  /** 注入假通道的 backfill 段（知识盒命令只把状态映射成提示） */
  function injectBackfill(outcome: unknown) {
    const backfill = vi.fn(async () => outcome);
    setLinkBridge({ now: vi.fn(), preview: vi.fn(), apply: vi.fn(), backfill } as any);
    return backfill;
  }

  it('自动关联已关闭：提示且不调通道', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const backfill = injectBackfill({ status: 'done', processed: 0, created: 0 });
    await linkAllInBoxes();
    expect(getNoticeMessages().some((m) => m.includes('自动关联已在知识盒设置中关闭'))).toBe(true);
    expect(backfill).not.toHaveBeenCalled();
  });

  it('补链产出关联：按汇总通知（启动静默路径不重复通知）', async () => {
    const backfill = injectBackfill({ status: 'done', processed: 2, created: 3 });
    await linkAllInBoxes();
    expect(backfill).toHaveBeenCalled();
    expect(getNoticeMessages().some((m) => m.includes('批量补链完成：处理 2 篇 / 新建关联 3 条'))).toBe(true);
  });

  it('零新建：通知未发现实质关联', async () => {
    injectBackfill({ status: 'done', processed: 1, created: 0 });
    await linkAllInBoxes();
    expect(getNoticeMessages().some((m) => m.includes('批量补链完成：未发现实质关联，未新建'))).toBe(true);
  });

  it('embedding 不可达：提示稍后自动补链', async () => {
    injectBackfill({ status: 'unreachable' });
    await linkAllInBoxes();
    expect(getNoticeMessages().some((m) => m.includes('embedding 服务不可达'))).toBe(true);
  });

  it('无待补链笔记：提示已处理完', async () => {
    injectBackfill({ status: 'no-targets' });
    await linkAllInBoxes();
    expect(getNoticeMessages().some((m) => m.includes('当前无待补链笔记'))).toBe(true);
  });

  it('通道未接线：明确提示，不抛错', async () => {
    setLinkBridge(null);
    await linkAllInBoxes();
    expect(getNoticeMessages().some((m) => m.includes('自动关联暂不可用'))).toBe(true);
  });
});

// ---------------- 自动关联通道（issue 309 + ADR-0141） ----------------

describe('自动关联通道 createLinkBridge：知识盒录入面板的四段能力', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    __setLinkBatchMsForTests(30);
    __setLinkCleanDebounceMsForTests(30);
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  function makeBridge(initialLoad?: Promise<void> | null) {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app as any);
    const agent = {
      processNoteNow: vi.fn(async () => ({ status: 'done', created: 1 })),
      previewLinks: vi.fn(async () => ({ status: 'done', picks: [{ path: '卡片盒/A.md', title: 'A' }] })),
      applyLinks: vi.fn(async () => ({ status: 'done', created: 2 })),
      backfillMissingLinks: vi.fn(async () => ({
        status: 'done',
        summary: { total: 2, processed: 2, created: 1, queued: 0, failed: 0 },
      })),
    } as any;
    const bridge = createLinkBridge(agent, initialLoad);
    return { vault, app, agent, bridge };
  }

  it('preview：等索引装载完成后调 previewLinks（草稿未落盘也能算关联）', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { agent, bridge } = makeBridge(gate);
    const p = bridge.preview('一段草稿正文', '草稿标题');
    await new Promise((r) => setTimeout(r, 5));
    expect(agent.previewLinks).not.toHaveBeenCalled(); // 装载未完成
    release();
    const out = await p;
    expect(agent.previewLinks).toHaveBeenCalledWith('一段草稿正文', '草稿标题', undefined); // issue 327：透传 signal 位
    expect(out).toEqual({ status: 'done', picks: [{ path: '卡片盒/A.md', title: 'A' }] });
  });

  it('apply：落盘后把预演结果写进 related（返回写入条数）', async () => {
    const { vault, agent, bridge } = makeBridge(null);
    vault.files.set('文献盒/新文献.md', 'x');
    const out = await bridge.apply('文献盒/新文献.md', ['卡片盒/A.md', '卡片盒/B.md']);
    expect(agent.applyLinks).toHaveBeenCalledWith('文献盒/新文献.md', ['卡片盒/A.md', '卡片盒/B.md']);
    expect(out).toEqual({ status: 'done', created: 2 });
  });

  it('now：兜底单篇管线，通知静默（进度由面板呈现）；force 透传给手动重跑用', async () => {
    const { vault, agent, bridge } = makeBridge(null);
    vault.files.set('文献盒/新文献.md', 'x');
    await bridge.now('文献盒/新文献.md');
    expect(agent.processNoteNow).toHaveBeenCalledWith('文献盒/新文献.md', { silent: true, force: false });
    await bridge.now('文献盒/新文献.md', { force: true });
    expect(agent.processNoteNow).toHaveBeenLastCalledWith('文献盒/新文献.md', { silent: true, force: true });
  });

  it('backfill：批量补链结果折算为截面形状（命令侧只认 processed/created）', async () => {
    const { agent, bridge } = makeBridge(null);
    expect(await bridge.backfill()).toEqual({ status: 'done', processed: 2, created: 1 });
    expect(agent.backfillMissingLinks).toHaveBeenCalled();

    agent.backfillMissingLinks.mockResolvedValueOnce({ status: 'unreachable' });
    expect(await bridge.backfill()).toEqual({ status: 'unreachable' });
    agent.backfillMissingLinks.mockResolvedValueOnce({ status: 'no-targets' });
    expect(await bridge.backfill()).toEqual({ status: 'no-targets' });
  });

  it('装载失败不阻断：照常跑（preview / now）', async () => {
    const { vault, agent, bridge } = makeBridge(Promise.reject(new Error('装载失败')));
    vault.files.set('文献盒/X.md', 'x');
    await bridge.now('文献盒/X.md');
    await bridge.preview('正文');
    expect(agent.processNoteNow).toHaveBeenCalled();
    expect(agent.previewLinks).toHaveBeenCalledWith('正文', undefined, undefined);
  });

  it('空路径：直接返回零新建且不触发管线（防误调）', async () => {
    const { agent, bridge } = makeBridge(null);
    expect(await bridge.now('   ')).toEqual({ status: 'done', created: 0 });
    expect(await bridge.apply('  ', ['卡片盒/A.md'])).toEqual({ status: 'done', created: 0 });
    expect(agent.processNoteNow).not.toHaveBeenCalled();
    expect(agent.applyLinks).not.toHaveBeenCalled();
  });

  it('落盘类调用零提示：三盒恒含索引后不再有「请去补白名单」引导（ADR-0141 §3 退役）', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), secondBrainAllowPaths: '' }));
    const { vault, bridge } = makeBridge(null);
    vault.files.set('文献盒/X.md', 'x');
    await bridge.now('文献盒/X.md');
    await bridge.apply('文献盒/X.md', ['卡片盒/A.md']);
    expect(getNoticeMessages()).toEqual([]);
  });
});

describe('范围卫：盒外一律拒绝（ADR-0141 §2：手动亦无豁免）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('processNote：盒外路径直接 out-of-scope，不探测不裁判不写盘', async () => {
    const { vault, agent, askSpy } = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    askSpy.mockResolvedValue('[]');
    vault.files.set('我的/日记/x.md', '日记正文');
    vault.files.set('书库/Y.md', '书正文');
    expect(await agent.processNote('我的/日记/x.md')).toEqual({ status: 'out-of-scope' });
    expect(await agent.processNote('书库/Y.md')).toEqual({ status: 'out-of-scope' });
    expect(await agent.processNote('文献盒/A.md')).toMatchObject({ status: 'done' }); // 盒内照常
    expect(vault.files.get('我的/日记/x.md')).not.toContain('related');
    expect(askSpy).toHaveBeenCalledTimes(1); // 只有盒内的那篇走了裁判
  });

  it('processNoteNow / applyLinks：盒外同样 out-of-scope，且不写任何东西', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set('其他/X.md', 'x');
    expect(await agent.processNoteNow('其他/X.md')).toEqual({ status: 'out-of-scope' });
    expect(await agent.applyLinks('其他/X.md', ['文献盒/B.md'])).toEqual({ status: 'out-of-scope' });
    expect(vault.files.get('其他/X.md')).not.toContain('related');
  });

  it('两处入口共用同一守卫：同一路径在 processNote / applyLinks 返回相同状态（判定顺序只有一处）', async () => {
    const { vault, agent } = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    const both = async (path: string) => ({
      process: (await agent.processNote(path)).status,
      apply: (await agent.applyLinks(path, ['文献盒/B.md'])).status,
    });

    // 盒外且存在 → 两处都 out-of-scope（ADR-0141 §2：手动无豁免）
    vault.files.set('其他/存在.md', 'x');
    expect(await both('其他/存在.md')).toEqual({ process: 'out-of-scope', apply: 'out-of-scope' });
    // 盒外且不存在 / 盒内且不存在 → 两处都 skipped（文件门先于盒界门）
    expect(await both('其他/不存在.md')).toEqual({ process: 'skipped', apply: 'skipped' });
    expect(await both('文献盒/不存在.md')).toEqual({ process: 'skipped', apply: 'skipped' });
    // 非 md（canvas）→ 两处都 skipped
    vault.files.set('文献盒/白板.canvas', '{}');
    expect(await both('文献盒/白板.canvas')).toEqual({ process: 'skipped', apply: 'skipped' });
    // encrypt 锁定（盒内盒外都算）→ 两处都 skipped：硬跳过先于盒界，这是唯一的顺序
    vault.files.set('CONFIG/STORAGE/.ENCRYPT/E.md', 'x');
    expect(await both('CONFIG/STORAGE/.ENCRYPT/E.md')).toEqual({ process: 'skipped', apply: 'skipped' });
  });

  it('队列消费：盒外条目就地清理，不留滞留（范围不再可配，它永远跑不了）', async () => {
    const { vault, agent } = makeWorld({});
    vault.files.set('书库/旧书.md', 'x');
    await enqueuePaths(['书库/旧书.md', '文献盒/A.md']);
    await agent.consumeQueue();
    const q = await loadQueue();
    expect(q.map((i) => i.path)).not.toContain('书库/旧书.md');
  });
});

describe('单篇即时建链 processNoteNow 通知（issue 298 + ADR-0141）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    clearDomainEvents();
    document.body.innerHTML = '';
    setSettingsProvider(baseSettings);
    setSettingsSaver(() => Promise.resolve());
  });

  it('新建 N>0：报「已为文献笔记新建关联 N 条」', async () => {
    const { agent, askSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"},{"id":2,"reason":"b"}]');
    const r = await agent.processNoteNow('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 2 });
    expect(getNoticeMessages().some((m) => m.includes('已为文献笔记新建关联 2 条'))).toBe(true);
  });

  it('N=0（无实质关联）静默：不出现完成文案', async () => {
    const { agent } = makeWorld({ hits: [] });
    await agent.processNoteNow('文献盒/A.md');
    expect(getNoticeMessages()).toEqual([]);
  });

  it('embedding 不可达：提示已入队，且不写 related', async () => {
    const { vault, agent } = makeWorld({ reachable: false });
    const r = await agent.processNoteNow('文献盒/A.md');
    expect(r).toEqual({ status: 'queued' });
    expect(getNoticeMessages().some((m) => m.includes('已入队待服务恢复后自动处理'))).toBe(true);
    expect(vault.files.get('文献盒/A.md')).not.toContain('related');
  });

  it('裁判失败：warning 提示，条目保留队列', async () => {
    const { agent, askSpy } = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    askSpy.mockRejectedValue(new Error('服务商不可用'));
    const r = await agent.processNoteNow('文献盒/A.md');
    expect(r.status).toBe('failed');
    expect(getNoticeMessages().some((m) => m.includes('自动关联处理失败'))).toBe(true);
    expect((await loadQueue()).some((i) => i.path === '文献盒/A.md')).toBe(true);
  });

  it('linkAgentNotify=false：即时反馈全程静默', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentNotify: false }));
    const { agent, askSpy } = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    askSpy.mockResolvedValue('[{"id":1,"reason":"a"}]');
    const r = await agent.processNoteNow('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(getNoticeMessages()).toEqual([]);
  });

  it('总开关关闭：processNoteNow 直接 skipped，不探测不裁判', async () => {
    setSettingsProvider(() => ({ ...baseSettings(), linkAgentEnabled: false }));
    const { agent, askSpy } = makeWorld({ hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }] });
    const r = await agent.processNoteNow('文献盒/A.md');
    expect(r).toEqual({ status: 'skipped' });
    expect(askSpy).not.toHaveBeenCalled();
    expect(getNoticeMessages()).toEqual([]);
  });
});
