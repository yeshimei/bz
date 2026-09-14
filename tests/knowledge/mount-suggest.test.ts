// @vitest-environment node
/**
 * 挂载树·AI 语义建议链路测试（issue 318 / ADR-0138 / ADR-0139 §3）：
 * 分句、稳定键、过滤（否决/已固定/弱关联/已存在双链）、缓存读写与逐卡失效、处置留档与否决表、
 * 降级三分支（无索引/移动端/无 AI）、幽灵节点并树、清空缓存。
 * AI 与向量检索全程 mock（不联网、不真调模型）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  json: vi.fn(),
  aiOk: true,
  api: null as { isIndexReady: () => boolean; search: (q: string, k?: number) => Promise<any[]> } | null,
}));

vi.mock('../../src/secondbrain/index', () => ({
  exportVectorSearch: () => mocks.api,
}));

vi.mock('../../src/core/ai', () => ({
  createAI: () => ({ json: mocks.json }),
  getAIProvider: async () => {
    if (!mocks.aiOk) throw new Error('未配置 API Key');
    return { endpoint: 'https://example.invalid', apiKey: 'test-key' };
  },
}));

import { Platform } from 'obsidian';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { hash31 } from '../../src/core/utils';
import {
  SUGGEST_MIN_SCORE,
  cacheValid,
  clearSuggestCache,
  filterSuggestions,
  generateSuggestions,
  markSuggestion,
  mergeSuggestions,
  readSuggestCache,
  splitAnchors,
  suggestKey,
  type SuggestCtx,
} from '../../src/knowledge/mount-suggest';
import type { MountSuggestion, MountTree, SuggestRun, SuggestState } from '../../src/knowledge/mount-types';

const CARDBOX = '卡片盒';
const LIT = '文献盒';
const ANCHOR_A1 = '甲卡正文：这是第一段足够长的锚点句子';
const ANCHOR_A2 = '这是第二段足够长的锚点句子';
const BODY_A = `${ANCHOR_A1}。${ANCHOR_A2}。`;
const BODY_ONE = `${ANCHOR_A1}。`; // 单锚点正文（处置配对断言用）
const BODY_B = '乙卡正文：这是唯一一段足够长的锚点句子。';

let vault: MockVault;
let ctx: SuggestCtx;

/** 造一条候选（锚点偏移只影响 from/to，键只认文本） */
function mk(text: string, target: string, score = 0.9, state: SuggestState = 'pending'): MountSuggestion {
  return { anchor: { from: 0, to: text.length, text }, target, kind: 'note', reason: '一句话理由', score, state };
}

beforeEach(() => {
  vault = new MockVault();
  vault.files.set(`文献盒/目标一.md`, '目标一正文');
  vault.files.set(`文献盒/目标二.md`, '目标二正文');
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  mocks.search.mockReset();
  mocks.json.mockReset();
  mocks.aiOk = true;
  mocks.api = { isIndexReady: () => true, search: mocks.search };
  (Platform as any).isMobile = false;
  ctx = { app, cardboxDir: CARDBOX, litDir: LIT };
});

afterEach(() => {
  setSettingsProvider(() => ({}) as any);
  (Platform as any).isMobile = false;
});

describe('splitAnchors（分句/分词切分）', () => {
  it('中英混排按标点断句；空串、纯符号、过短片段跳过；from/to 指回原文', () => {
    const body = [
      '卡片盒是思考的组织核心。It overlaps with statistics nicely.',
      '短。',
      '---',
      '- 列表项也是一个足够长的句子；',
    ].join('\n');
    const anchors = splitAnchors(body);
    expect(anchors.map((a) => a.text)).toEqual([
      '卡片盒是思考的组织核心',
      'It overlaps with statistics nicely',
      '列表项也是一个足够长的句子',
    ]);
    expect(body.slice(anchors[0].from, anchors[0].to)).toBe('卡片盒是思考的组织核心');
    expect(body.slice(anchors[2].from, anchors[2].to)).toBe('列表项也是一个足够长的句子');
  });

  it('双链转显示文本、行内标记剥离；纯符号段落不产锚点', () => {
    const body = '看这张 [[卡片盒/某卡|别名卡片]] 的论述是否成立，**重点**在后面。\n***\n';
    const anchors = splitAnchors(body);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].text).toBe('看这张 别名卡片 的论述是否成立，重点在后面');
    expect(splitAnchors('')).toEqual([]);
    expect(splitAnchors('***\n\n###\n')).toEqual([]);
  });
});

describe('suggestKey（跨编辑稳定键）', () => {
  it('同文本不同偏移同键；目标归一（反斜杠/扩展名/大小写）；不同目标不同键', () => {
    const a = { anchor: { from: 0, to: 8, text: '机器学习是人工智能的分支' }, target: '文献盒/某笔记.md' };
    const b = { anchor: { from: 120, to: 128, text: ' 机器学习是人工智能的分支 ' }, target: '文献盒\\某笔记' };
    expect(suggestKey(a)).toBe(suggestKey(b));
    expect(suggestKey({ anchor: a.anchor, target: '文献盒/另一篇.md' })).not.toBe(suggestKey(a));
    expect(suggestKey({ anchor: { from: 0, to: 3, text: 'ABC Def' }, target: 'x.md' })).toBe(
      suggestKey({ anchor: { from: 9, to: 12, text: 'abc  def' }, target: 'X' })
    );
  });
});

describe('filterSuggestions（否决/已固定/弱关联/已存在双链）', () => {
  it('四类一律剔除；边界分数按 >= minScore 保留', () => {
    const good = mk('这是一个足够长的锚点句子', '文献盒/甲.md');
    const weak = mk('这是另一个足够长的句子', '文献盒/乙.md', 0.4);
    const fixed = mk('第三个足够长的锚点句子', '文献盒/丙.md', 0.9, 'fixed');
    const dismissed = mk('第四个足够长的锚点句子', '文献盒/丁.md');
    const existingLink = mk('第五个足够长的锚点句子', '文献盒/戊.md');
    const out = filterSuggestions([good, weak, fixed, dismissed, existingLink], {
      dismissed: [suggestKey(dismissed)],
      existing: ['戊'], // 正文写的是裸名，候选是全路径
    });
    expect(out).toEqual([good]);
    expect(filterSuggestions([mk('边界分数句子内容', '文献盒/甲.md', SUGGEST_MIN_SCORE)], { dismissed: [] })).toHaveLength(1);
    expect(filterSuggestions([mk('低一分句子内容', '文献盒/甲.md', SUGGEST_MIN_SCORE - 0.01)], { dismissed: [] })).toEqual([]);
  });
});

describe('generateSuggestions（生成 + 缓存 + 逐卡失效）', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_A);
    vault.files.set(`${CARDBOX}/B.md`, BODY_B);
    mocks.search.mockResolvedValue([{ path: '文献盒/目标一.md', chunk: '目标一的一段', score: 0.9 }]);
    mocks.json.mockResolvedValue(JSON.stringify([{ anchor: 1, target: 1, score: 0.9, reason: '同一主题' }]));
  });

  it('首跑 fresh 并落缓存；二跑 cached 不重复检索；改哪张卡只失效那张', async () => {
    const run1 = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run1.status).toBe('fresh');
    expect(run1.suggestions).toHaveLength(1);
    expect(run1.suggestions[0]).toMatchObject({
      target: '文献盒/目标一.md',
      kind: 'para',
      score: 0.9,
      reason: '同一主题',
      state: 'pending',
    });
    expect(run1.suggestions[0].anchor.text).toBe(ANCHOR_A1);
    const callsAfterA = mocks.search.mock.calls.length;

    const run2 = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run2.status).toBe('cached');
    expect(run2.suggestions).toHaveLength(1);
    expect(run2.generatedAt).toBe(run1.generatedAt);
    expect(mocks.search.mock.calls.length).toBe(callsAfterA); // 命中缓存不重跑

    const runB = await generateSuggestions(`${CARDBOX}/B.md`, ctx);
    expect(runB.status).toBe('fresh');

    // 改 A 的正文（多一句）→ A 过期重跑，B 仍命中
    vault.files.set(`${CARDBOX}/A.md`, `${BODY_A}这是新增的一句足够长的话。`);
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('fresh');
    expect((await generateSuggestions(`${CARDBOX}/B.md`, ctx)).status).toBe('cached');

    const cache = await readSuggestCache();
    expect(Object.keys(cache.cards).sort()).toEqual([`${CARDBOX}/A.md`, `${CARDBOX}/B.md`]);
    const entryB = cache.cards[`${CARDBOX}/B.md`];
    expect(cacheValid(entryB, entryB.bodyHash)).toBe(true);
    expect(cacheValid(entryB, String(hash31(BODY_A)))).toBe(false);
    expect(cacheValid(undefined, entryB.bodyHash)).toBe(false);
  });

  it('卡片盒内目标 → card 形态；主卡读不到 → fresh 空结果且不落缓存', async () => {
    vault.files.set(`${CARDBOX}/C.md`, '丙卡正文');
    mocks.search.mockResolvedValue([{ path: `${CARDBOX}/C.md`, chunk: '丙卡的一段', score: 0.9 }]);
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions[0].kind).toBe('card');

    const missing = await generateSuggestions(`${CARDBOX}/不存在.md`, ctx);
    expect(missing).toEqual({ status: 'fresh', suggestions: [] });
    expect((await readSuggestCache()).cards[`${CARDBOX}/不存在.md`]).toBeUndefined();
  });

  it('已存在的双链目标不推；失效目标（文件已删）不推', async () => {
    vault.files.set(`${CARDBOX}/A.md`, `甲卡正文：这是第一段足够长的锚点句子，参见 [[目标一]]。这是第二段足够长的锚点句子。`);
    mocks.search.mockResolvedValue([
      { path: '文献盒/目标一.md', chunk: '一', score: 0.9 },
      { path: '文献盒/已删除.md', chunk: '二', score: 0.8 },
    ]);
    mocks.json.mockResolvedValue(JSON.stringify([{ anchor: 1, target: 1, score: 0.9, reason: '不该出现' }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions).toEqual([]);
    expect(mocks.json).not.toHaveBeenCalled(); // 候选全被过滤，无需裁判
  });

  it('裁判输出坏 JSON → 空结果落缓存；裁判调用失败 → no-ai 且不落缓存', async () => {
    mocks.json.mockResolvedValue('抱歉，我无法判断。');
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run).toEqual({ status: 'fresh', suggestions: [], generatedAt: expect.any(Number) });
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('cached');

    await clearSuggestCache();
    mocks.json.mockRejectedValue(new Error('网络不可达'));
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).status).toBe('no-ai');
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('向量检索抛错 → no-index 且不落缓存（瞬时故障不污染缓存）', async () => {
    mocks.search.mockRejectedValue(new Error('embedding 服务不可达'));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('no-index');
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('分句结果为空（纯符号正文）→ fresh 空结果并落缓存', async () => {
    vault.files.set(`${CARDBOX}/D.md`, '***\n---\n###\n');
    const run = await generateSuggestions(`${CARDBOX}/D.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await generateSuggestions(`${CARDBOX}/D.md`, ctx)).status).toBe('cached');
  });
});

describe('markSuggestion（固定/取消都留档，取消进否决表）', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_ONE); // 单锚点正文：配对过滤的断言才干净
    vault.files.set(`${CARDBOX}/B.md`, BODY_ONE); // 同锚点文本：验证否决跨卡生效
    mocks.search.mockResolvedValue([
      { path: '文献盒/目标一.md', chunk: '一', score: 0.9 },
      { path: '文献盒/目标二.md', chunk: '二', score: 0.85 },
    ]);
    mocks.json.mockResolvedValue(
      JSON.stringify([
        { anchor: 1, target: 1, score: 0.9, reason: '理由一' },
        { anchor: 1, target: 2, score: 0.85, reason: '理由二' },
      ])
    );
  });

  it('取消 → 永不再推（含跨编辑/跨卡）；固定 → 留档且不重复推', async () => {
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.suggestions).toHaveLength(2);
    const [s1, s2] = run.suggestions;
    await markSuggestion(`${CARDBOX}/A.md`, s1, 'dismissed', ctx);
    await markSuggestion(`${CARDBOX}/A.md`, s2, 'fixed', ctx);

    const cache = await readSuggestCache();
    const states = cache.cards[`${CARDBOX}/A.md`].suggestions.map((s) => [s.target, s.state]);
    expect(states).toContainEqual(['文献盒/目标一.md', 'dismissed']);
    expect(states).toContainEqual(['文献盒/目标二.md', 'fixed']);

    // 强制重跑：两条配对都被挡在送审之前（否决 + 已固定），处置留档仍在
    mocks.json.mockClear();
    const rerun = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(rerun.status).toBe('fresh');
    expect(rerun.suggestions).toEqual([]);
    expect(mocks.json).not.toHaveBeenCalled();
    const after = await readSuggestCache();
    expect(after.cards[`${CARDBOX}/A.md`].suggestions.filter((s) => s.state !== 'pending')).toHaveLength(2);

    // 正文追加一句（锚点文本不变）：否决键不吃偏移，仍被挡掉
    vault.files.set(`${CARDBOX}/A.md`, `${BODY_ONE}追加的一句足够长的话。`);
    expect((await generateSuggestions(`${CARDBOX}/A.md`, ctx)).suggestions).toEqual([]);

    // 另一张卡出现同一「锚点 → 目标」：否决跨卡生效（目标一不推）；固定只在本卡留档 → 只推目标二
    const runB = await generateSuggestions(`${CARDBOX}/B.md`, ctx);
    expect(runB.suggestions.map((s) => s.target)).toEqual(['文献盒/目标二.md']);
  });

  it('无缓存片时处置也留档（建无效片，下次生成照常重跑）', async () => {
    await markSuggestion(`${CARDBOX}/A.md`, mk(ANCHOR_A1, '文献盒/目标一.md'), 'dismissed', ctx);
    const cache = await readSuggestCache();
    expect(cache.cards[`${CARDBOX}/A.md`].bodyHash).toBe('');
    expect(cacheValid(cache.cards[`${CARDBOX}/A.md`], String(hash31(BODY_ONE)))).toBe(false);
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('fresh');
    expect(run.suggestions.map((s) => s.target)).toEqual(['文献盒/目标二.md']);
    expect(mocks.json).toHaveBeenCalledTimes(1);
  });
});

describe('降级与设置开关', () => {
  beforeEach(() => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_A);
    mocks.search.mockResolvedValue([{ path: '文献盒/目标一.md', chunk: '一', score: 0.9 }]);
    mocks.json.mockResolvedValue(JSON.stringify([{ anchor: 1, target: 1, score: 0.9, reason: '理由' }]));
  });

  it('无向量索引（未初始化/未就绪）→ no-index，空候选，不检索不落缓存', async () => {
    mocks.api = null;
    expect(await generateSuggestions(`${CARDBOX}/A.md`, ctx)).toEqual({ status: 'no-index', suggestions: [] });
    mocks.api = { isIndexReady: () => false, search: mocks.search };
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run.status).toBe('no-index');
    expect(run.suggestions).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('移动端 → no-index（索引就绪也不跑）', async () => {
    (Platform as any).isMobile = true;
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run).toEqual({ status: 'no-index', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('无可用 AI 通道 → no-ai，空候选，不检索不落缓存', async () => {
    mocks.aiOk = false;
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(run).toEqual({ status: 'no-ai', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
    expect((await readSuggestCache()).cards).toEqual({});
  });

  it('knowledgeMountAutoSuggest 关闭：被调用时返回 off（不冒充已缓存）；显式 force 才继续', async () => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', knowledgeMountAutoSuggest: false }) as any);
    const off = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(off).toEqual({ status: 'off', suggestions: [] });
    expect(mocks.search).not.toHaveBeenCalled();
    const forced = await generateSuggestions(`${CARDBOX}/A.md`, ctx, { force: true });
    expect(forced.status).toBe('fresh');
    expect(forced.suggestions).toHaveLength(1);
  });
});

describe('mergeSuggestions（幽灵节点 + 虚线边）与 clearSuggestCache', () => {
  it('未在树中的目标补幽灵节点与虚线边；同目标去重；已在树中/根自身不画；不改原树', () => {
    const tree: MountTree = {
      root: 'r',
      direction: 'downstream',
      nodes: [
        { id: 'r', path: `${CARDBOX}/A.md`, title: 'A', kind: 'card', source: 'self', depth: 0, anchor: null, missing: false, suggested: false, attached: false, body: '正文', parent: null },
        { id: 'n1', path: '文献盒/目标一.md', title: '目标一', kind: 'para', source: 'link', depth: 1, anchor: null, missing: false, suggested: false, attached: false, body: null, parent: 'r' },
      ],
      edges: [{ from: 'r', to: 'n1', suggested: false }],
    };
    const run: SuggestRun = {
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: 3, text: '锚点甲' }, target: '文献盒/目标二.md', kind: 'note', reason: 'r', score: 0.9, state: 'pending' },
        { anchor: { from: 4, to: 7, text: '锚点乙' }, target: '文献盒/目标二.md', kind: 'note', reason: 'r', score: 0.8, state: 'pending' },
        { anchor: { from: 8, to: 11, text: '锚点丙' }, target: '文献盒/目标一.md', kind: 'note', reason: 'r', score: 0.8, state: 'pending' },
        { anchor: { from: 12, to: 15, text: '锚点丁' }, target: `${CARDBOX}/A.md`, kind: 'card', reason: 'r', score: 0.8, state: 'pending' },
      ],
    };
    const merged = mergeSuggestions(tree, run);
    expect(tree.nodes).toHaveLength(2); // 原树未被改动
    expect(tree.edges).toHaveLength(1);
    expect(merged.nodes).toHaveLength(3);
    expect(merged.edges).toHaveLength(2);
    const ghost = merged.nodes[2];
    expect(ghost).toMatchObject({
      id: 'ai:文献盒/目标二.md',
      path: '文献盒/目标二.md',
      title: '目标二',
      kind: 'note',
      source: 'ai',
      depth: 1,
      suggested: true,
      attached: false,
      missing: false,
      body: null,
    });
    expect(ghost.anchor).toEqual({ from: 0, to: 3, text: '锚点甲' });
    expect(merged.edges[1]).toEqual({ from: 'r', to: 'ai:文献盒/目标二.md', suggested: true });
    expect(merged.root).toBe('r');
    expect(merged.direction).toBe('downstream');
    expect(mergeSuggestions(tree, { status: 'cached', suggestions: [] }).nodes).toHaveLength(2);
  });

  it('clearSuggestCache：只清候选与生成时间，fixed/dismissed 留档保留 → 同一条不再出现', async () => {
    vault.files.set(`${CARDBOX}/A.md`, BODY_ONE);
    mocks.search.mockResolvedValue([{ path: '文献盒/目标一.md', chunk: '一', score: 0.9 }]);
    mocks.json.mockResolvedValue(JSON.stringify([{ anchor: 1, target: 1, score: 0.9, reason: '理由' }]));
    const run = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    await markSuggestion(`${CARDBOX}/A.md`, run.suggestions[0], 'dismissed', ctx);

    await clearSuggestCache();
    const entry = (await readSuggestCache()).cards[`${CARDBOX}/A.md`];
    expect(entry.bodyHash).toBe(''); // 片失效 → 下次必然重算
    expect(entry.generatedAt).toBe(0);
    expect(entry.suggestions.map((s) => s.state)).toEqual(['dismissed']); // 留档保留

    // 重算：候选被否决表挡在送审之前 → 同一条「锚点 → 目标」不再出现（ADR-0139 §3 永久不再推）
    mocks.json.mockClear();
    const again = await generateSuggestions(`${CARDBOX}/A.md`, ctx);
    expect(again.status).toBe('fresh');
    expect(again.suggestions).toEqual([]);
    expect(mocks.json).not.toHaveBeenCalled();

    // 无任何留档的片整片删除（纯 pending 缓存被清干净）
    vault.files.set(`${CARDBOX}/B.md`, BODY_B);
    expect((await generateSuggestions(`${CARDBOX}/B.md`, ctx)).suggestions).toHaveLength(1);
    await clearSuggestCache();
    const after = await readSuggestCache();
    expect(after.cards[`${CARDBOX}/B.md`]).toBeUndefined();
    expect(after.cards[`${CARDBOX}/A.md`].suggestions).toHaveLength(1);
  });
});
