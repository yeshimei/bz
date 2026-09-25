// @vitest-environment node
/**
 * 重排客户端测试（issue 427/ADR-0186）：
 * - logprobs → P(yes) 换算（首 token yes/no 两项归一化；缺项/缺失的返回 null）；
 * - 请求口径：官方模板三段、logprobs + num_predict 1 + temperature 0、模型 = RERANK_MODEL；
 * - 失败语义：非 2xx / 无 logprobs **一律抛错**（不做 yes/no 文本二值降级——那会让排序退回
 *   0/1 两档并列，且引入 ADR-0185 已清理的「两把尺」）；
 * - 整轮预算用尽即抛错（调用方回退余弦序）；
 * - issue 428：取消（signal）抛 AbortError——调用方据此**不回退余弦序**（旧序回填会盖掉新查询）；
 * - issue 429：模型名逐次读设置（留空回落 RERANK_MODEL）。
 * 只 fake Date（不 fake 定时器）：预算判定走 Date.now，超时定时器保持真身以免微任务与假时钟纠缠。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { yesNoLogprobScore, rerankScores } from '../../src/secondbrain/rerank';
import { RERANK_MODEL } from '../../src/secondbrain/config';
import { isQwen3Embedding8b } from '../../src/core/ai-models';
import { isAbortError } from '../../src/core/abort';
import { setSettingsProvider } from '../../src/core/settings-provider';

const lp = (pYes: number) => [
  { token: 'yes', logprob: Math.log(pYes) },
  { token: 'no', logprob: Math.log(1 - pYes) },
];
/** Ollama /api/chat 的 logprobs 段：首 token 条目 + 其 top_logprobs 候选表（yes/no 两项） */
const okResponse = (pYes: number) =>
  new Response(
    JSON.stringify({
      message: { content: pYes >= 0.5 ? 'yes' : 'no' },
      logprobs: [{ token: pYes >= 0.5 ? 'yes' : 'no', logprob: Math.log(Math.max(pYes, 1 - pYes)), top_logprobs: lp(pYes) }],
    }),
    { status: 200 }
  );

describe('yesNoLogprobScore（logprobs → P(yes)）', () => {
  it('两项俱在：归一化 softmax = P(yes)', () => {
    expect(yesNoLogprobScore([{ token: 'yes', logprob: Math.log(0.8), top_logprobs: lp(0.8) }])).toBeCloseTo(0.8, 6);
    expect(yesNoLogprobScore([{ token: ' no ', logprob: Math.log(0.25), top_logprobs: lp(0.25) }])).toBeCloseTo(0.25, 6);
  });

  it('大小写/空白/标点归一化后识别（"YES"、"No."）', () => {
    const raw = [
      { top_logprobs: [{ token: ' YES', logprob: Math.log(0.9) }, { token: 'No.', logprob: Math.log(0.1) }] },
    ];
    expect(yesNoLogprobScore(raw)).toBeCloseTo(0.9, 6);
  });

  it('只现一档：yes 在 = 1 / no 在 = 0（另一档不可见即极低）', () => {
    expect(yesNoLogprobScore([{ top_logprobs: [{ token: 'yes', logprob: -0.1 }] }])).toBe(1);
    expect(yesNoLogprobScore([{ top_logprobs: [{ token: 'no', logprob: -0.1 }] }])).toBe(0);
  });

  it('类内多 token 变体累加：yes/ yes/Yes 同属一类（不因只取首个而低估）', () => {
    const raw = [
      {
        top_logprobs: [
          { token: 'yes', logprob: Math.log(0.5) },
          { token: ' yes', logprob: Math.log(0.2) },
          { token: 'no', logprob: Math.log(0.15) },
          { token: ' no', logprob: Math.log(0.1) },
        ],
      },
    ];
    // P(yes 类) = 0.7 / (0.7 + 0.25) = 0.7368…
    expect(yesNoLogprobScore(raw)).toBeCloseTo(0.7 / 0.95, 6);
  });

  it('无 top_logprobs（旧版服务忽略该参数）→ null：单条 logprob 无法归一化，不做 0/1 二值降级', () => {
    expect(yesNoLogprobScore([{ token: 'yes', logprob: Math.log(0.7) }])).toBeNull();
    expect(yesNoLogprobScore([{ token: 'no', logprob: Math.log(0.7) }])).toBeNull();
    expect(yesNoLogprobScore([{}])).toBeNull();
  });

  it('非有限 logprob（±Infinity / NaN）当无效候选跳过；两类皆无效 → null（不产出 NaN 分）', () => {
    expect(
      yesNoLogprobScore([
        { top_logprobs: [{ token: 'yes', logprob: -Infinity }, { token: 'no', logprob: Math.log(0.3) }] },
      ])
    ).toBe(0);
    expect(
      yesNoLogprobScore([{ top_logprobs: [{ token: 'yes', logprob: NaN }, { token: 'no', logprob: -Infinity }] }])
    ).toBeNull();
  });

  it('yes/no 都不在（模型未按模板作答 / 旧版服务）→ null', () => {
    expect(yesNoLogprobScore([{ top_logprobs: [{ token: 'maybe', logprob: -1 }] }])).toBeNull();
    expect(yesNoLogprobScore([{ top_logprobs: [] }])).toBeNull();
    expect(yesNoLogprobScore([])).toBeNull();
    expect(yesNoLogprobScore(undefined)).toBeNull();
  });
});

describe('rerankScores（串行打分）', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({ secondBrainOllamaUrl: 'http://127.0.0.1:65535' }) as any);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('逐对串行调用：分数同序返回，请求体带官方模板与 logprobs 参数', async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      return okResponse(body.messages[1].content.includes('D1') ? 0.9 : 0.2);
    });
    vi.stubGlobal('fetch', fetchMock);
    const scores = await rerankScores('查询词', ['D1', 'D2']);
    expect(scores[0]).toBeCloseTo(0.9, 6);
    expect(scores[1]).toBeCloseTo(0.2, 6);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe(RERANK_MODEL);
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false); // 不关思考则首 token 恒为 thinking 标记，拿不到 yes/no
    expect(body.logprobs).toBe(true);
    // num_ctx 显式压到 2048：模型默认 40200 会占 10.1GB 显存，与 8B 嵌入无法共驻
    expect(body.options).toEqual({ num_predict: 1, temperature: 0, num_ctx: 2048 });
    expect(body.messages[0].content).toContain('answer can only be "yes" or "no"');
    expect(body.messages[1].content).toBe(
      '<Instruct>: Given a web search query, retrieve relevant passages that answer the query\n<Query>: 查询词\n<Document>: D1'
    );
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:65535/api/chat');
  });

  it('超长查询 / 超长候选段按上限截断（prompt 不超上下文，召回侧全文本不受影响）', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: any) => okResponse(0.5));
    vi.stubGlobal('fetch', fetchMock);
    await rerankScores('Q'.repeat(3000), ['D'.repeat(2000)]);
    const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content as string;
    expect(content).toContain(`<Query>: ${'Q'.repeat(1000)}\n`);
    expect(content.endsWith(`<Document>: ${'D'.repeat(600)}`)).toBe(true);
  });

  it('baseUrl 覆盖（移动端远程口径）：打到远程地址', async () => {
    const fetchMock = vi.fn(async (_url: string) => okResponse(0.5));
    vi.stubGlobal('fetch', fetchMock);
    await rerankScores('q', ['d'], 'http://192.168.1.45:11434');
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.45:11434/api/chat');
  });

  it('非 2xx → 抛错（调用方据此回退余弦序）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(rerankScores('q', ['d'])).rejects.toThrow('Ollama 错误: 500');
  });

  it('响应无 logprobs → 抛错：不做 yes/no 文本二值降级', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: 'yes' } }), { status: 200 })));
    await expect(rerankScores('q', ['d'])).rejects.toThrow('未返回 yes/no logprobs');
  });

  it('整轮预算用尽 → 抛错（完成的对数体现在错误里）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetchMock = vi.fn(async () => {
      vi.setSystemTime(Date.now() + 5000); // 每对 5s，预算 6s：第二对后即超
      return okResponse(0.5);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(rerankScores('q', ['d1', 'd2', 'd3'])).rejects.toThrow('重排预算用尽');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('模型名逐次解析（issue 429）：设置覆盖即用设置值，留空回落 RERANK_MODEL 默认', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: any) => okResponse(0.5));
    vi.stubGlobal('fetch', fetchMock);

    setSettingsProvider(() => ({ secondBrainRerankModel: 'dengcao/Qwen3-Reranker-8B:Q4_K_M' }) as any);
    await rerankScores('q', ['d']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('dengcao/Qwen3-Reranker-8B:Q4_K_M');

    setSettingsProvider(() => ({ secondBrainRerankModel: '   ' }) as any); // 纯空白 = 未设置
    await rerankScores('q', ['d']);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe(RERANK_MODEL);
  });

  it('取消（signal 已中断）：对间检查点直抛 AbortError，一对都不发', async () => {
    const fetchMock = vi.fn(async () => okResponse(0.5));
    vi.stubGlobal('fetch', fetchMock);
    const ac = new AbortController();
    ac.abort();
    await expect(rerankScores('q', ['d1', 'd2'], undefined, ac.signal)).rejects.toSatisfy((e: unknown) => isAbortError(e));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('取消（打分途中）：在途那对被中断并抛 AbortError（不误报成「重排调用超时」）', async () => {
    const ac = new AbortController();
    const removeSpy = vi.spyOn(ac.signal, 'removeEventListener');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: any) =>
        new Promise<Response>((_resolve, reject) => {
          ac.abort(); // 模拟「查询已换」发生在打分途中（请求已带内层 signal 发出）
          if (init.signal.aborted) {
            reject(new Error('The operation was aborted'));
            return;
          }
          init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
        })
      )
    );
    await expect(rerankScores('q', ['d1'], undefined, ac.signal)).rejects.toSatisfy((e: unknown) => isAbortError(e));
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function)); // 取消路径解绑外层监听（不漏监听）
  });
});

describe('isQwen3Embedding8b（重排生效判定与设置行可见性的单一真相）', () => {
  it('只认 8b 一族（含 tag / 下划线变体）', () => {
    expect(isQwen3Embedding8b('qwen3-embedding:8b')).toBe(true);
    expect(isQwen3Embedding8b('Qwen3_Embedding-8B')).toBe(true);
    expect(isQwen3Embedding8b('qwen3-embedding:8b-fp16')).toBe(true);
  });
  it('非 8b / 非 Qwen3 一律 false（含 0.6b 4b 与 8bit 误伤防护）', () => {
    expect(isQwen3Embedding8b('qwen3-embedding:4b')).toBe(false);
    expect(isQwen3Embedding8b('qwen3-embedding:0.6b')).toBe(false);
    expect(isQwen3Embedding8b('qwen3-embedding:8bit')).toBe(false);
    expect(isQwen3Embedding8b('bge-m3')).toBe(false);
    expect(isQwen3Embedding8b('')).toBe(false);
    expect(isQwen3Embedding8b(undefined)).toBe(false);
  });
});
