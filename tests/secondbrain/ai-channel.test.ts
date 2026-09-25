// @vitest-environment node
/**
 * 第二大脑 AI 通道数据层测试（issue 359：对话请求全部经 core AIService「跟随 AI 设置」）：
 * - AI.ask 经 core AIService.prompt 且**不显式锁模型**（第二参 undefined）——这是「用户在
 *   AI 设置配什么模型对话就用什么」的接线锚：core 侧「未显式指定模型 → provider.model
 *   （aiProvider + per-provider 模型覆盖解析结果）优先生效」已由 tests/core/ai-cov.test.ts
 *   回归，两侧拼接即完整链路；
 * - signal / onDelta 原样透传（对话可取消 + 流式链路的通道级契约）；
 * - DeepSeek 专用形态退役：模块不再导出 getDeepseekAI / resetDeepseekAI（旧单例缓存面清零；
 *   域内无独立 API key / 写死域名，provider 解析全部来自主设置页 AI 设置——验收口径回归锚）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../../src/core/ai';
import * as sbAI from '../../src/secondbrain/ai';
import { AI } from '../../src/secondbrain/ai';

describe('第二大脑 AI 通道：跟随 AI 设置（issue 359）', () => {
  let promptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    promptSpy = vi.spyOn(AIService.prototype, 'prompt').mockResolvedValue('回答');
  });

  it('AI.ask 经 core AIService 且不显式锁模型（AI 设置解析的 provider 模型优先）', async () => {
    const answer = await AI.ask('测试问题');
    expect(answer).toBe('回答');
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(promptSpy.mock.calls[0][0]).toBe('测试问题');
    // 第二参 undefined = 不显式指定模型 → core 侧 provider 解析（AI 设置）的模型优先生效
    expect(promptSpy.mock.calls[0][1]).toBeUndefined();
  });

  it('signal 与 onDelta 原样透传（可取消 + 流式链路契约）', async () => {
    const controller = new AbortController();
    const onDelta = (delta: string) => void delta;
    await AI.ask('流式问题', { signal: controller.signal, onDelta });
    const opts = promptSpy.mock.calls[0][2];
    expect(opts.signal).toBe(controller.signal);
    expect(opts.onDelta).toBe(onDelta);
  });

  it('单参调用零负担：opts 缺省时透传空选项（旧调用面兼容）', async () => {
    await AI.ask('只问不传');
    expect(promptSpy.mock.calls[0][2]).toEqual({});
  });

  it('DeepSeek 专用形态退役：无 getDeepseekAI / resetDeepseekAI 导出，AI.ask 门面保留', () => {
    expect((sbAI as any).getDeepseekAI).toBeUndefined();
    expect((sbAI as any).resetDeepseekAI).toBeUndefined();
    expect(typeof AI.ask).toBe('function'); // 调用面（chat-panel / mobile-panel / link-agent）只认 AI.ask
  });
});
