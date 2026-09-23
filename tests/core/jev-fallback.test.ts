// @vitest-environment node
/**
 * 判定编排（src/core/jev-fallback.ts，ADR-0181）：
 * - 未启用 / 未配置 → 直接回落：Jev 材料**零构造**、零请求；
 * - Jev 成功 → 以 parse 结果为准（含域内弃权值），回落零调用；
 * - 请求失败（HTTP 非 2xx）→ 回落；
 * - 答案畸形（parse 抛错）→ 回落；
 * - 取消（前置 / 在途）→ 抛 AbortError 且**不回落**；
 * - 回落自身失败 → 原样上抛（调用方决定入队 / 留空）；
 * - config 覆盖透传 askJev。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { judgeOrFallback, type JudgePlan } from '../../src/core/jev-fallback';
import type { JevConfig, JevQuestion } from '../../src/core/jev';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { requestUrl } from '../mock-obsidian-entry';

const requestUrlMock = vi.mocked(requestUrl);

/** 就绪设置（就绪门读设置，不可用 config 覆盖绕过——那是 askJev 层的事） */
function ready(): void {
  setSettingsProvider(
    () =>
      ({
        jevEnabled: true,
        jevEndpoint: 'https://api.typesafe.ai/v1/systemone',
        jevApiKey: 'sk-test',
        jevModel: 'jev-1.13.0',
        jevTimeoutMs: 5000,
      }) as any
  );
}

function okResponse(body: unknown) {
  return { status: 200, text: JSON.stringify(body) } as any;
}

const JEV_OK = { model: 'jev-1.13.0', answers: { q: { type: 'noul', noul: 1 } } };

interface PlanOver {
  parse?: (answers: Record<string, any>) => string;
  fallback?: () => Promise<string>;
  signal?: AbortSignal;
  config?: Partial<JevConfig>;
}

/** 计划工厂：默认 request / fallback 都是 spy，便于断言「材料是否白造」「回落是否发生」 */
function makePlan(over: PlanOver = {}) {
  const request = vi.fn(() => ({
    state: '材料',
    questions: { q: { type: 'noul', instructions: '是？' } as JevQuestion },
  }));
  const fallback = vi.fn(async () => 'LLM 结果');
  const plan: JudgePlan<string> = {
    request,
    parse: over.parse ?? (() => 'JEV 结果'),
    fallback: over.fallback ?? fallback,
    signal: over.signal,
    config: over.config,
  };
  return { plan, request, fallback };
}

beforeEach(() => {
  requestUrlMock.mockReset();
  requestUrlMock.mockResolvedValue(okResponse(JEV_OK));
});

describe('judgeOrFallback：Jev 优先 / 不可用回落', () => {
  it('未启用（jevEnabled=false）→ 直接回落：材料零构造、零请求', async () => {
    setSettingsProvider(() => ({ jevEnabled: false, jevApiKey: 'sk-test' }) as any);
    const { plan, request, fallback } = makePlan();
    await expect(judgeOrFallback(plan)).resolves.toBe('LLM 结果');
    expect(request).not.toHaveBeenCalled();
    expect(requestUrlMock).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('已启用但缺密钥 → 同样直接回落（就绪门含端点/密钥齐备）', async () => {
    setSettingsProvider(() => ({ jevEnabled: true, jevEndpoint: 'https://api.typesafe.ai/v1/systemone', jevApiKey: '' }) as any);
    const { plan, request, fallback } = makePlan();
    await expect(judgeOrFallback(plan)).resolves.toBe('LLM 结果');
    expect(request).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('Jev 成功 → 以 parse 结果为准，回落零调用', async () => {
    ready();
    const { plan, fallback } = makePlan();
    await expect(judgeOrFallback(plan)).resolves.toBe('JEV 结果');
    expect(requestUrlMock).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('请求失败（HTTP 503）→ 回落', async () => {
    ready();
    requestUrlMock.mockResolvedValue({ status: 503, text: 'no healthy upstream' } as any);
    const { plan, fallback } = makePlan();
    await expect(judgeOrFallback(plan)).resolves.toBe('LLM 结果');
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('答案畸形（parse 抛错）→ 回落（不静默伪装成零命中）', async () => {
    ready();
    const { plan, fallback } = makePlan({
      parse: () => {
        throw new Error('Jev 响应缺少 answers 字段');
      },
    });
    await expect(judgeOrFallback(plan)).resolves.toBe('LLM 结果');
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('调用前已取消 → 抛 AbortError：零材料、零请求、零回落', async () => {
    ready();
    const ctrl = new AbortController();
    ctrl.abort();
    const { plan, request, fallback } = makePlan({ signal: ctrl.signal });
    await expect(judgeOrFallback(plan)).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
    expect(requestUrlMock).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('在途取消 → 抛 AbortError 且不回落（用户主动放弃，回落等于白烧一次 LLM）', async () => {
    ready();
    requestUrlMock.mockImplementation(() => new Promise(() => {}) as any);
    const ctrl = new AbortController();
    const { plan, fallback } = makePlan({ signal: ctrl.signal, config: { timeoutMs: 30 } });
    const p = judgeOrFallback(plan);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('回落自身失败 → 原样上抛（由调用方入队 / 留空，不引第三层）', async () => {
    setSettingsProvider(() => ({ jevEnabled: false }) as any);
    const fb = vi.fn(async () => {
      throw new Error('LLM 未配置 API Key');
    });
    const { plan } = makePlan({ fallback: fb });
    await expect(judgeOrFallback(plan)).rejects.toThrow('LLM 未配置 API Key');
    expect(fb).toHaveBeenCalledTimes(1);
  });

  it('config 覆盖透传（打到覆盖端点）', async () => {
    ready();
    const { plan } = makePlan({ config: { endpoint: 'https://example.test/systemone', apiKey: 'sk-x' } });
    await judgeOrFallback(plan);
    expect((requestUrlMock.mock.calls[0][0] as any).url).toBe('https://example.test/systemone');
  });
});
