// @vitest-environment node
/**
 * 模型档位表测试（issue 342/ADR-0151）：归一化、精确/别名/包含匹配、未收录返回 null、
 * 表自洽（键不重复、数值为正整数）。
 */
import { describe, it, expect } from 'vitest';
import { MODEL_LIMITS, normalizeModelId, resolveModelLimits } from '../../src/core/model-limits';

describe('normalizeModelId', () => {
  it('小写化 + 去 vendor 前缀 / tag 后缀 / 首尾空白', () => {
    expect(normalizeModelId('deepseek-ai/DeepSeek-V3')).toBe('deepseek-v3');
    expect(normalizeModelId('deepseek/deepseek-flash:free')).toBe('deepseek-flash');
    expect(normalizeModelId('  GPT-4o-Mini  ')).toBe('gpt-4o-mini');
  });

  it('空值 / 非字符串 → 空串', () => {
    expect(normalizeModelId('')).toBe('');
    expect(normalizeModelId(undefined as any)).toBe('');
  });
});

describe('resolveModelLimits', () => {
  it('精确命中与别名命中（同一模型的旧 API 名 / 带 vendor 前缀写法）', () => {
    const expected = { maxOutput: 393216, contextWindow: 1048576 };
    expect(resolveModelLimits('deepseek-flash')).toEqual(expected);
    expect(resolveModelLimits('deepseek-v4-flash')).toEqual(expected); // 旧 API 名别名
    expect(resolveModelLimits('deepseek-ai/DeepSeek-V4-Flash')).toEqual(expected); // vendor 前缀写法
  });

  it('带日期后缀的快照名落到主条目（最长命中键）', () => {
    expect(resolveModelLimits('deepseek-flash-2026-09-10')?.maxOutput).toBe(393216);
    expect(resolveModelLimits('qwen-plus-2026-05-26')?.contextWindow).toBe(1000000);
  });

  it('智谱 GLM-5.3 系（issue 411/ADR-0179 补录）：主名/别名/大小写/快照名同档', () => {
    expect(resolveModelLimits('glm-5.3-flash')?.maxOutput).toBe(131072);
    expect(resolveModelLimits('GLM-5.3-Flash')?.contextWindow).toBe(1000000); // 大小写归一
    expect(resolveModelLimits('glm-5.3-flash-2026-09')?.maxOutput).toBe(131072); // 快照名落主条目
  });

  it('未收录 / 空模型名返回 null（由调用方回落注册表默认，不在此造兜底值）', () => {
    expect(resolveModelLimits('some-unknown-model')).toBeNull();
    expect(resolveModelLimits('')).toBeNull();
    expect(resolveModelLimits(undefined)).toBeNull();
  });

  it('表自洽：键归一化后全局不重复，数值为正整数', () => {
    const keys = MODEL_LIMITS.flatMap((e) => [e.id, ...(e.aliases || [])]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of MODEL_LIMITS) {
      for (const k of keys) expect(normalizeModelId(k)).toBe(k); // 表内键必须已是归一化形态
      expect(Number.isInteger(e.maxOutput) && e.maxOutput > 0).toBe(true);
      expect(Number.isInteger(e.contextWindow) && e.contextWindow > 0).toBe(true);
    }
  });
});
