// @vitest-environment node
/**
 * AI 设置键一次性迁移测试（migrateRetiredAIKeys，src/settings.ts）：
 * - issue 342 后续：「上下文窗口」设置行删除（模型固有属性、插件零消费点），aiContextOverrides 键退役；
 * - issue 411/ADR-0179：服务商注册表收敛为 deepseek / zhipu-plan / ollama 三条通道——
 *   14 家密钥键 + custom 三件套退役、存量非法 aiProvider 回落缺省、per-provider 覆盖表清退役键、
 *   全局 aiThinking 迁进 aiThinkingOverrides（按 provider 存）。
 */
import { describe, it, expect } from 'vitest';
import { migrateRetiredAIKeys } from '../../src/settings';
import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER } from '../../src/core/ai';

describe('migrateRetiredAIKeys · issue 342 后续（上下文窗口键退役）', () => {
  it('旧键存在 → 就地删除并返回 true（调用方据此落盘）', () => {
    const raw: Record<string, unknown> = { aiProvider: 'deepseek', aiContextOverrides: { deepseek: 1048576 } };
    expect(migrateRetiredAIKeys(raw)).toBe(true);
    expect('aiContextOverrides' in raw).toBe(false);
    expect(raw.aiProvider).toBe('deepseek'); // 其余键不动
  });

  it('无旧键 → 不改动返回 false（幂等，C16 不重复落盘）', () => {
    expect(migrateRetiredAIKeys({ aiProvider: 'deepseek' })).toBe(false);
    expect(migrateRetiredAIKeys({})).toBe(false);
    expect(migrateRetiredAIKeys(null)).toBe(false);
    expect(migrateRetiredAIKeys(undefined)).toBe(false);
    expect(migrateRetiredAIKeys('字符串')).toBe(false);
  });
});

describe('migrateRetiredAIKeys · issue 411/ADR-0179（服务商收敛三条通道）', () => {
  it('退役服务商密钥键 + custom 三件套一并删除', () => {
    const raw: Record<string, unknown> = {
      aiProvider: 'deepseek',
      deepseekApiKey: 'keep',
      zhipuPlanApiKey: 'keep2',
      ollamaApiKey: '',
      opencodeGoApiKey: 'x',
      openaiApiKey: 'x',
      anthropicApiKey: 'x',
      googleApiKey: 'x',
      moonshotApiKey: 'x',
      zhipuApiKey: 'x',
      dashscopeApiKey: 'x',
      siliconflowApiKey: 'x',
      openrouterApiKey: 'x',
      xaiApiKey: 'x',
      groqApiKey: 'x',
      mistralApiKey: 'x',
      togetherApiKey: 'x',
      aiCustomEndpoint: 'https://x.example/v1',
      aiCustomModel: 'taste-1',
      aiCustomApiKey: 'x',
    };
    expect(migrateRetiredAIKeys(raw)).toBe(true);
    for (const key of [
      'opencodeGoApiKey', 'openaiApiKey', 'anthropicApiKey', 'googleApiKey', 'moonshotApiKey',
      'zhipuApiKey', 'dashscopeApiKey', 'siliconflowApiKey', 'openrouterApiKey', 'xaiApiKey',
      'groqApiKey', 'mistralApiKey', 'togetherApiKey',
      'aiCustomEndpoint', 'aiCustomModel', 'aiCustomApiKey',
    ]) {
      expect(key in raw, key).toBe(false);
    }
    // 在册三条通道的键保留
    expect(raw.deepseekApiKey).toBe('keep');
    expect(raw.zhipuPlanApiKey).toBe('keep2');
    expect('ollamaApiKey' in raw).toBe(true);
  });

  it('存量非法 aiProvider → 回落缺省通道（否则解析会落到缺省描述上，密钥键对不上）', () => {
    for (const stale of ['opencode-go', 'openai', 'custom', '']) {
      const raw: Record<string, unknown> = { aiProvider: stale, deepseekApiKey: 'k' };
      expect(migrateRetiredAIKeys(raw), stale).toBe(true);
      expect(raw.aiProvider).toBe(DEFAULT_AI_PROVIDER);
    }
    // 在册 id 不动
    for (const p of AI_PROVIDER_REGISTRY) {
      const raw: Record<string, unknown> = { aiProvider: p.id };
      expect(migrateRetiredAIKeys(raw), p.id).toBe(false);
      expect(raw.aiProvider).toBe(p.id);
    }
    // 缺键不写（合并 DEFAULT_SETTINGS 时自然取缺省值）
    const empty: Record<string, unknown> = {};
    expect(migrateRetiredAIKeys(empty)).toBe(false);
    expect('aiProvider' in empty).toBe(false);
  });

  it('per-provider 覆盖表清掉退役 provider 条目（留着是读不到的死值）', () => {
    const raw: Record<string, unknown> = {
      aiProvider: 'deepseek',
      aiModelOverrides: { deepseek: 'deepseek-v4-pro', openai: 'gpt-4o', custom: 'taste-1' },
      aiMaxTokensOverrides: { ollama: 8192, siliconflow: 4096 },
      aiThinkingOverrides: { deepseek: 'off', dashscope: 'off' },
    };
    expect(migrateRetiredAIKeys(raw)).toBe(true);
    expect(raw.aiModelOverrides).toEqual({ deepseek: 'deepseek-v4-pro' });
    expect(raw.aiMaxTokensOverrides).toEqual({ ollama: 8192 });
    expect(raw.aiThinkingOverrides).toEqual({ deepseek: 'off' });
  });

  it('全局 aiThinking → aiThinkingOverrides[当前 provider]：表内档位沿用，「中」按官方映射折 high', () => {
    const off: Record<string, unknown> = { aiProvider: 'deepseek', aiThinking: 'off' };
    expect(migrateRetiredAIKeys(off)).toBe(true);
    expect('aiThinking' in off).toBe(false);
    expect(off.aiThinkingOverrides).toEqual({ deepseek: 'off' });

    // ollama 表内有「中」→ 原样沿用（不该被折成 high）
    const mediumOllama: Record<string, unknown> = { aiProvider: 'ollama', aiThinking: 'medium' };
    expect(migrateRetiredAIKeys(mediumOllama)).toBe(true);
    expect(mediumOllama.aiThinkingOverrides).toEqual({ ollama: 'medium' });

    // deepseek 表内无「中」（官方映射 medium→high）→ 折 high
    const mediumDeepseek: Record<string, unknown> = { aiProvider: 'deepseek', aiThinking: 'medium' };
    expect(migrateRetiredAIKeys(mediumDeepseek)).toBe(true);
    expect(mediumDeepseek.aiThinkingOverrides).toEqual({ deepseek: 'high' });

    // auto（缺省档）不写覆盖：回落「不注入」
    const auto: Record<string, unknown> = { aiProvider: 'deepseek', aiThinking: 'auto' };
    expect(migrateRetiredAIKeys(auto)).toBe(true);
    expect(auto.aiThinkingOverrides).toBeUndefined();
  });

  it('旧档位不在新表内 → 丢弃不迁（宁回落自动，也不发服务商不认识的参数）', () => {
    // 智谱 Plan（glm-5.3 强制思考）没有「关闭」档：旧 off 不迁
    const zhipu: Record<string, unknown> = { aiProvider: 'zhipu-plan', aiThinking: 'off' };
    expect(migrateRetiredAIKeys(zhipu)).toBe(true);
    expect(zhipu.aiThinkingOverrides).toBeUndefined();
    // 非法档位同样丢弃
    const bogus: Record<string, unknown> = { aiProvider: 'deepseek', aiThinking: '一切' };
    expect(migrateRetiredAIKeys(bogus)).toBe(true);
    expect(bogus.aiThinkingOverrides).toBeUndefined();
  });

  it('幂等：迁移后的对象再跑一遍不改动（不重复落盘）', () => {
    const raw: Record<string, unknown> = {
      aiProvider: 'opencode-go',
      openaiApiKey: 'x',
      aiThinking: 'high',
      aiModelOverrides: { openai: 'gpt-4o', deepseek: 'deepseek-v4-pro' },
    };
    expect(migrateRetiredAIKeys(raw)).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(raw));
    expect(migrateRetiredAIKeys(raw)).toBe(false);
    expect(raw).toEqual(snapshot);
  });
});
