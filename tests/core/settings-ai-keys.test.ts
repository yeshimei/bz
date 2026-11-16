// @vitest-environment node
/**
 * 服务商密钥行的表绑定（2026-11-12/ADR-0297）：新增服务商不占静态设置键，
 * 密钥统一读写 `aiApiKeys[providerId]`。这里直接对 schema 行的 binding 做读写断言——
 * 渲染层（两个渲染器）都走 core 的 bindValue 通用内核，binding 对了渲染就对了。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { aiSettingsSchema } from '../../src/core/settings-main-schema';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { AI_PROVIDER_REGISTRY } from '../../src/core/ai';
import type { SettingsRow } from '../../src/core/settings-schema';

type KeyRow = SettingsRow & {
  name: string;
  binding: { key?: string } | { get: () => string; set: (v: string) => void; save: () => void };
};

let state: Record<string, any>;

beforeEach(() => {
  state = { ...DEFAULT_SETTINGS, aiApiKeys: {} };
  setSettingsProvider(() => state as any);
});

/** 取 LLM 组里某家服务商的密钥行 */
function keyRowOf(providerId: string): KeyRow {
  const desc = AI_PROVIDER_REGISTRY.find((p) => p.id === providerId)!;
  const row = aiSettingsSchema().groups[0].rows.find(
    (r) => (r as { name?: string }).name === desc.apiKeyLabel
  ) as KeyRow | undefined;
  expect(row, `${providerId} 应有密钥行`).toBeTruthy();
  return row!;
}

describe('密钥行绑定：新家走表，老三家走旧键', () => {
  it('新家（qwen）：三函数绑定，写入落到 aiApiKeys.qwen', () => {
    const row = keyRowOf('qwen');
    const b = row.binding as { get: () => string; set: (v: string) => void; save: () => void };
    expect(typeof b.get, '表绑定的 get').toBe('function');
    expect(typeof b.set).toBe('function');

    b.set('sk-qwen-1');
    expect(state.aiApiKeys.qwen).toBe('sk-qwen-1');
    expect(b.get()).toBe('sk-qwen-1');
  });

  it('新家：清空即删键（不留空串槽位）', () => {
    const b = keyRowOf('qwen').binding as { get: () => string; set: (v: string) => void };
    b.set('sk-qwen-1');
    b.set('');
    expect('qwen' in state.aiApiKeys).toBe(false);
    expect(b.get()).toBe('');
  });

  it('新家：各家互不覆盖（键 = provider id）', () => {
    (keyRowOf('qwen').binding as any).set('sk-qwen');
    (keyRowOf('kimi').binding as any).set('sk-kimi');
    expect(state.aiApiKeys).toEqual({ qwen: 'sk-qwen', kimi: 'sk-kimi' });
  });

  it('老三家：仍键直绑旧键（存量数据零迁移）', () => {
    for (const [id, key] of [['deepseek', 'deepseekApiKey'], ['zhipu-plan', 'zhipuPlanApiKey'], ['ollama', 'ollamaApiKey']] as const) {
      expect(keyRowOf(id).binding, id).toEqual({ key });
    }
  });

  it('键位唯一：注册表里没有两家共用同一个静态键', () => {
    const used = AI_PROVIDER_REGISTRY.map((p) => p.apiKeyKey).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('自定义协议行', () => {
  it('直绑 aiCustomProtocol，两档（OpenAI 兼容 / Anthropic）', () => {
    const row = aiSettingsSchema().groups[0].rows.find(
      (r) => (r as { name?: string }).name === '自定义协议'
    ) as { binding: { key?: string }; options: Array<{ value: string; label: string }> } | undefined;
    expect(row).toBeTruthy();
    expect(row!.binding).toEqual({ key: 'aiCustomProtocol' });
    expect(row!.options.map((o) => o.value)).toEqual(['openai', 'anthropic']);
  });

  it('缺省值是 openai（老用户不设也走原报文）', () => {
    expect(DEFAULT_SETTINGS.aiCustomProtocol).toBe('openai');
    expect(DEFAULT_SETTINGS.aiApiKeys).toEqual({});
  });
});
