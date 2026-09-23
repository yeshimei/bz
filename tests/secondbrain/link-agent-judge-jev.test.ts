/**
 * 自动关联裁判接入 Jev（issue 392 / ADR-0173）：多维判定 + 失败回落 LLM。
 *
 * 覆盖工单「测试」一节：
 * - Jev 三维判定口径（ref 单维即建链 / 仅 topic 不建 / topic+complement 建链 / 全低不建 / 边界 = M 建链）；
 * - 顺序来自代码（max 降序 + maxLinks 截断保留高分）；
 * - Jev 抛错 → 回落 LLM（AI.ask 真被调、结果正确，而非返回空）；
 * - signal abort → 不回落（AI.ask 零调用）；
 * - answers 整体缺失 → 回落（不静默零命中）；
 * - 两道都抛错 → 入队 + failed；
 * - jevEnabled=false → 不碰 Jev，走旧 LLM 路径；
 * - previewLinks 与主流程 processNote 共用同一裁判 judge()（两处都覆盖）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { LinkAgent } from '../../src/secondbrain/link-agent/pipeline';
import { enqueuePaths, loadQueue } from '../../src/secondbrain/link-agent/data';
import { AI } from '../../src/secondbrain/ai';
import * as jev from '../../src/core/jev';
import type { JevAnswer, JevResult } from '../../src/core/jev';

/** 判定阈值（与 pipeline.ts JUDGE_DIM_MIN 同源；测试断言边界用） */
const JUDGE_DIM_MIN = 0.5;

function jevSettings(over: Record<string, unknown> = {}): any {
  return {
    ...DEFAULT_SETTINGS,
    jevEnabled: true,
    jevEndpoint: 'https://api.typesafe.ai/v1/systemone',
    jevApiKey: 'test-key',
    jevModel: 'jev-1.13.0',
    jevTimeoutMs: 10000,
    ...over,
  };
}

/** 构造 Jev 三维答案：scores 键为候选前缀 `c1`/`c2`/…，维度 topic/ref/complement 缺省视为不答（=0） */
function jevResult(scores: Record<string, { topic?: number; ref?: number; complement?: number }>): JevResult {
  const answers: Record<string, JevAnswer> = {};
  for (const [cid, dims] of Object.entries(scores)) {
    if (dims.topic !== undefined) answers[`${cid}_topic`] = { type: 'noul', noul: dims.topic };
    if (dims.ref !== undefined) answers[`${cid}_ref`] = { type: 'noul', noul: dims.ref };
    if (dims.complement !== undefined) answers[`${cid}_complement`] = { type: 'noul', noul: dims.complement };
  }
  return { model: 'jev-1.13.0', answers };
}

function abortError(): Error {
  const e = new Error('Jev 请求已取消');
  e.name = 'AbortError';
  return e;
}

interface WorldOpts {
  hits?: { path: string; chunk: string; score: number }[];
  reachable?: boolean;
}

function makeWorld(opts: WorldOpts = {}) {
  const vault = new MockVault();
  vault.files.set(
    '文献盒/A.md',
    '---\ntitle: 向量笔记\ntags: vec\n---\n\n关于向量数据库与近邻检索的正文内容，足够长用于档案卡。'
  );
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
  const askJevSpy = vi.spyOn(jev, 'askJev');
  askJevSpy.mockReset();
  const askSpy = vi.spyOn(AI, 'ask');
  askSpy.mockReset();
  return { vault, app, store, agent, askJevSpy, askSpy };
}

beforeEach(() => {
  resetObsidianMocks();
});

// ---------------- 主流程 processNote：Jev 三维判定口径 ----------------

describe('裁判接入 Jev：三维判定口径（processNote）', () => {
  it('仅 ref 高（≥M）→ 建链（单靠直接指向就够，不要求 topic/complement）', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockResolvedValue(jevResult({ c1: { ref: 0.9, topic: 0.1, complement: 0.1 } }));
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
    expect(askJevSpy).toHaveBeenCalledTimes(1);
  });

  it('仅 topic 高（ref/complement 低）→ 不建（同主题不算，本票核心口径）', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockResolvedValue(jevResult({ c1: { topic: 0.9, ref: 0.1, complement: 0.1 } }));
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 0 });
    expect(vault.files.get('文献盒/A.md')).not.toContain('[[文献盒/B]]');
  });

  it('topic + complement 都高（ref 低）→ 建链（逻辑与，非加权和）', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockResolvedValue(jevResult({ c1: { topic: 0.9, ref: 0.1, complement: 0.9 } }));
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });

  it('三维全低 → 不建', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockResolvedValue(jevResult({ c1: { topic: 0.1, ref: 0.1, complement: 0.1 } }));
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 0 });
    expect(vault.files.get('文献盒/A.md')).not.toContain('[[文献盒/B]]');
  });

  it('ref 恰好等于 JUDGE_DIM_MIN → 建链（≥ 语义，边界断言）', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockResolvedValue(jevResult({ c1: { ref: JUDGE_DIM_MIN, topic: 0.0, complement: 0.0 } }));
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });

  it('顺序来自代码：Jev max 降序 + maxLinks 截断保留高分（同分保持候选原序）', async () => {
    setSettingsProvider(() => jevSettings({ linkAgentMaxLinks: 1 }));
    const { vault, agent, askJevSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 }, // 候选顺序 = 向量相似度降序 [B, D]
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    // Jev 强度反序：B 弱（score 0.5）、D 强（score 0.9）
    askJevSpy.mockResolvedValue(
      jevResult({
        c1: { topic: 0.5, complement: 0.5, ref: 0.1 }, // B: link, score = max = 0.5
        c2: { ref: 0.9, topic: 0.1, complement: 0.1 }, // D: link, score = 0.9
      })
    );
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    const fm = vault.files.get('文献盒/A.md')!;
    expect(fm).toContain('[[文献盒/D]]');
    expect(fm).not.toContain('[[文献盒/B]]');
  });
});

// ---------------- 失败回落 ----------------

describe('裁判接入 Jev：失败回落 LLM（processNote）', () => {
  it('Jev 抛错 → 回落 LLM：确实调用 AI.ask 且结果正确，而非返回空', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockRejectedValue(new Error('Jev 服务商不可用'));
    askSpy.mockResolvedValue('[{"id":1}]'); // 旧 prompt 已不要求 reason
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(askJevSpy).toHaveBeenCalledTimes(1);
    expect(askSpy).toHaveBeenCalledTimes(1);
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });

  it('answers 整体缺失 → 回落（不静默零命中）', async () => {
    setSettingsProvider(() => jevSettings());
    const { vault, agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    // 模拟 askJev 返回畸形响应（整体缺 answers）——judgeByJev 抛错 → 回落
    askJevSpy.mockResolvedValue({ model: '', answers: undefined } as unknown as JevResult);
    askSpy.mockResolvedValue('[{"id":1}]');
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(askSpy).toHaveBeenCalledTimes(1);
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });

  it('两道都抛错 → 入队 + failed（link.queue 有条目）', async () => {
    setSettingsProvider(() => jevSettings());
    const { agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockRejectedValue(new Error('Jev 挂了'));
    askSpy.mockRejectedValue(new Error('LLM 也挂了'));
    const r = await agent.processNote('文献盒/A.md');
    expect(r.status).toBe('failed');
    const q = await loadQueue();
    expect(q.some((i) => i.path === '文献盒/A.md')).toBe(true);
  });

  it('jevEnabled=false → 不碰 Jev，走旧 LLM 路径（行为与本票前一致）', async () => {
    setSettingsProvider(() => jevSettings({ jevEnabled: false }));
    const { vault, agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askSpy.mockResolvedValue('[{"id":1}]');
    const r = await agent.processNote('文献盒/A.md');
    expect(r).toEqual({ status: 'done', created: 1 });
    expect(askJevSpy).not.toHaveBeenCalled();
    expect(askSpy).toHaveBeenCalledTimes(1);
    expect(vault.files.get('文献盒/A.md')).toContain('[[文献盒/B]]');
  });
});

// ---------------- 预演路径 previewLinks 共用裁判 ----------------

describe('裁判接入 Jev：previewLinks 共用同一 judge()', () => {
  it('Jev 命中多候选 → picks 顺序按代码（max 降序），与主流程同规则', async () => {
    setSettingsProvider(() => jevSettings());
    const { agent, askJevSpy } = makeWorld({
      hits: [
        { path: '文献盒/B.md', chunk: 'B', score: 0.9 },
        { path: '文献盒/D.md', chunk: 'D', score: 0.8 },
      ],
    });
    askJevSpy.mockResolvedValue(
      jevResult({
        c1: { topic: 0.5, complement: 0.5, ref: 0.1 },
        c2: { ref: 0.9, topic: 0.1, complement: 0.1 },
      })
    );
    const r = await agent.previewLinks('草稿正文关于知识管理与向量检索', '草稿标题');
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      expect(r.picks.map((p) => p.path)).toEqual(['文献盒/D.md', '文献盒/B.md']);
    }
  });

  it('在途取消（abort 落在 Jev 请求期间）→ 不回落 LLM（AI.ask 零调用），返回 failed', async () => {
    setSettingsProvider(() => jevSettings());
    const { agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    const ctrl = new AbortController();
    askJevSpy.mockImplementation(async () => {
      ctrl.abort(); // 模拟请求在途时用户放弃（重新生成）
      throw abortError();
    });
    const r = await agent.previewLinks('草稿正文', '草稿标题', { signal: ctrl.signal });
    expect(r.status).toBe('failed');
    expect(askJevSpy).toHaveBeenCalledTimes(1);
    expect(askSpy).not.toHaveBeenCalled(); // 取消不回落，白烧一次 LLM 不值
  });

  it('调用前已取消 → 连 Jev 材料都不造：零请求、零回落，返回 failed', async () => {
    setSettingsProvider(() => jevSettings());
    const { agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await agent.previewLinks('草稿正文', '草稿标题', { signal: ctrl.signal });
    expect(r.status).toBe('failed');
    expect(askJevSpy).not.toHaveBeenCalled();
    expect(askSpy).not.toHaveBeenCalled();
  });

  it('Jev 抛错 → 回落 LLM（预演同规则，与后台一致）', async () => {
    setSettingsProvider(() => jevSettings());
    const { agent, askJevSpy, askSpy } = makeWorld({
      hits: [{ path: '文献盒/B.md', chunk: 'B', score: 0.9 }],
    });
    askJevSpy.mockRejectedValue(new Error('Jev 超时'));
    askSpy.mockResolvedValue('[{"id":1}]');
    const r = await agent.previewLinks('草稿正文', '草稿标题');
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      expect(r.picks.map((p) => p.path)).toEqual(['文献盒/B.md']);
    }
    expect(askSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------- parseJudgeOutput 容忍缺 reason（回落路径解析器） ----------------

describe('parseJudgeOutput 容忍缺 reason（issue 392 决策 5/8）', () => {
  it('缺 reason 的条目仍解析正确（不丢弃），既有的带 reason 形态也照常', async () => {
    const { parseJudgeOutput } = await import('../../src/secondbrain/link-agent/data');
    expect(parseJudgeOutput('[{"id":1}]', 2)).toEqual([{ id: 1, reason: '' }]);
    expect(parseJudgeOutput('[{"id":2,"reason":"同主题"}]', 2)).toEqual([{ id: 2, reason: '同主题' }]);
    expect(parseJudgeOutput('[{"id":1},{"id":3,"reason":"x"}]', 3)).toEqual([
      { id: 1, reason: '' },
      { id: 3, reason: 'x' },
    ]);
  });

  it('越界/非数字 id 仍丢弃', async () => {
    const { parseJudgeOutput } = await import('../../src/secondbrain/link-agent/data');
    expect(parseJudgeOutput('[{"id":0},{"id":5},{"id":2}]', 3)).toEqual([{ id: 2, reason: '' }]);
  });
});
