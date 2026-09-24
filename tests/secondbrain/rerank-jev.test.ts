// @vitest-environment node
/**
 * Jev 重排第二通道（src/secondbrain/rerank-jev.ts，issue 431/ADR-0189）：
 * - state = 查询（沿用本地通道 1000 字截断）+ 编号候选清单（doc_0…，300 字/条截断）；
 * - 问题 = 每候选一题 noul，键 doc_0…doc_N-1（与 state 编号一一对应）；
 * - parse：缺题键 / 题型不符 / 取值越界 → 抛错 = **整轮畸形**（不单条计 0——issue 431 决策 6，
 *   计 0 会把相关条目沉底成半排）；整体缺失/非对象同罪；
 * - jevRerankScores：成功 → 分数数组同序；未配密钥（judgeOrFallback 类别①，零请求）/
 *   请求失败 / 答案畸形 → **null = 维持余弦序**（fallback 槽位，不落 LLM）；取消 → 抛
 *   AbortError 不回落；超时 min(10s, 6s) 经 config 透传 askJev。
 * askJev 经 vi.spyOn 模块命名空间拦截（跨模块调用，jev-fallback 头注背书的范式），不碰网络。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSettingsProvider } from '../../src/core/settings-provider';
import * as jev from '../../src/core/jev';
import {
  buildJevRerankState,
  buildJevRerankQuestions,
  parseJevRerankAnswers,
  jevRerankScores,
  JEV_RERANK_DOC_MAX_CHARS,
  JEV_RERANK_TIMEOUT_MS,
} from '../../src/secondbrain/rerank-jev';
import { RERANK_QUERY_MAX_CHARS } from '../../src/secondbrain/rerank';
import type { JevAnswer } from '../../src/core/jev';

const askJevSpy = vi.spyOn(jev, 'askJev');

/** 就绪设置（judgeOrFallback 的就绪门 isJevConfigured 读设置：密钥齐即接管） */
function ready(): void {
  setSettingsProvider(
    () =>
      ({
        jevProvider: 'typesafe',
        jevApiKey: 'sk-test',
        jevModel: 'jev-latest',
      }) as any
  );
}

function noulAnswers(scores: Record<string, number>): Record<string, JevAnswer> {
  return Object.fromEntries(Object.entries(scores).map(([k, noul]) => [k, { type: 'noul', noul }]));
}

describe('Jev 重排 state / 问题构造', () => {
  it('state：查询在前（1000 字截断）、候选按 doc_i 编号（300 字/条截断）', () => {
    const longQuery = '查'.repeat(RERANK_QUERY_MAX_CHARS + 500);
    const longDoc = '文'.repeat(JEV_RERANK_DOC_MAX_CHARS + 200);
    const state = buildJevRerankState(longQuery, [longDoc, '短文档']);
    expect(state).toContain('## 查询');
    expect(state).toContain('### doc_0');
    expect(state).toContain('### doc_1');
    expect(state).toContain('短文档');
    // 截断生效：查询段不含第 1001 个字（「查」重复，取编号行之前的查询正文长度验证）
    const querySection = state.split('## 候选文档')[0];
    expect(querySection.split('## 查询')[1].trim().length).toBe(RERANK_QUERY_MAX_CHARS);
    expect(state).not.toContain('文'.repeat(JEV_RERANK_DOC_MAX_CHARS + 1));
  });

  it('问题：每候选一题 noul，键 doc_0…doc_N-1 与 state 编号同构', () => {
    const qs = buildJevRerankQuestions(3);
    expect(Object.keys(qs)).toEqual(['doc_0', 'doc_1', 'doc_2']);
    for (const [key, q] of Object.entries(qs)) {
      expect(q.type).toBe('noul');
      expect(q.instructions).toContain(key);
      expect(q.instructions).toContain('相关');
    }
  });
});

describe('parseJevRerankAnswers：缺题 / 题型不符 / 越界一律整轮畸形', () => {
  const base = { doc_0: 0.7, doc_1: 0.2, doc_2: 0.9 };

  it('全量 noul 答案 → 与候选同序的分数数组', () => {
    expect(parseJevRerankAnswers(noulAnswers(base), 3)).toEqual([0.7, 0.2, 0.9]);
  });

  it('缺题键 → 抛错（不单条计 0——计 0 会把相关条目沉底成半排，issue 431 决策 6）', () => {
    const answers = noulAnswers(base);
    delete (answers as any).doc_1;
    expect(() => parseJevRerankAnswers(answers, 3)).toThrow(/doc_1/);
  });

  it('题型不符（choice/score 冒充 noul）→ 抛错', () => {
    const answers = noulAnswers(base) as any;
    answers.doc_2 = { type: 'choice', choice: 'x', confidence: 1, probabilities: {} };
    expect(() => parseJevRerankAnswers(answers, 3)).toThrow(/doc_2/);
  });

  it('取值越界 / 非有限（>1、<0、NaN）→ 抛错', () => {
    for (const bad of [1.5, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const answers = noulAnswers({ ...base, doc_2: bad });
      expect(() => parseJevRerankAnswers(answers, 3)).toThrow(/doc_2/);
    }
  });

  it('answers 整体缺失 / 非对象 / 数组 → 抛错', () => {
    expect(() => parseJevRerankAnswers(undefined as any, 1)).toThrow(/answers/);
    expect(() => parseJevRerankAnswers('x' as any, 1)).toThrow(/answers/);
    expect(() => parseJevRerankAnswers([1] as any, 1)).toThrow(/answers/);
  });
});

describe('jevRerankScores：成功 / 回落 / 取消三态', () => {
  beforeEach(() => {
    askJevSpy.mockReset();
  });

  it('成功：answers → 与 docs 同序的 noul 分；超时 min(10s, 6s) 经 config 透传', async () => {
    ready();
    askJevSpy.mockResolvedValue({ model: 'jev-1', answers: noulAnswers({ doc_0: 0.7, doc_1: 0.2 }) });

    const scores = await jevRerankScores('q', ['甲', '乙']);
    expect(scores).toEqual([0.7, 0.2]);
    expect(askJevSpy).toHaveBeenCalledTimes(1);
    const [state, questions, opts] = askJevSpy.mock.calls[0];
    expect(state).toContain('q');
    expect(state).toContain('### doc_1');
    expect(Object.keys(questions)).toEqual(['doc_0', 'doc_1']);
    // JEV_RERANK_TIMEOUT_MS = min(Jev 固化 10s, 重排段预算 6s) = 6000：重排段不得跑穿检索级 10s
    expect(JEV_RERANK_TIMEOUT_MS).toBe(6000);
    expect(opts?.config?.timeoutMs).toBe(6000);
  });

  it('未配密钥：judgeOrFallback 类别①——零请求直接回落 null（不发一次注定失败的往返）', async () => {
    setSettingsProvider(() => ({}) as any);
    const scores = await jevRerankScores('q', ['甲']);
    expect(scores).toBeNull();
    expect(askJevSpy).not.toHaveBeenCalled();
  });

  it('请求失败（网络 / 非 2xx）→ 回落 null，不抛错', async () => {
    ready();
    askJevSpy.mockRejectedValue(new Error('Jev API 503: no healthy upstream'));
    expect(await jevRerankScores('q', ['甲'])).toBeNull();
  });

  it('答案畸形（缺题键）→ parse 抛错交回落 → null（整轮回余弦，不半排）', async () => {
    ready();
    askJevSpy.mockResolvedValue({ model: 'jev-1', answers: noulAnswers({ doc_0: 0.5 }) }); // 缺 doc_1
    expect(await jevRerankScores('q', ['甲', '乙'])).toBeNull();
  });

  it('取消：前置已取消 → 抛 AbortError，不回落、零请求', async () => {
    ready();
    const ac = new AbortController();
    ac.abort();
    await expect(jevRerankScores('q', ['甲'], ac.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(askJevSpy).not.toHaveBeenCalled();
  });

  it('取消：在途取消 → 抛 AbortError（fallback 的 null 不得盖过取消语义）', async () => {
    ready();
    const ac = new AbortController();
    const abortErr = Object.assign(new Error('Jev 请求已取消'), { name: 'AbortError' });
    askJevSpy.mockImplementation((_state, _questions, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(abortErr));
      });
    });
    const p = jevRerankScores('q', ['甲'], ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
