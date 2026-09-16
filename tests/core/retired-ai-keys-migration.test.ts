// @vitest-environment node
/**
 * issue 342 后续一次性迁移测试（migrateRetiredAIKeys，src/settings.ts）：
 * 「上下文窗口」设置行删除（模型固有属性、插件零消费点），aiContextOverrides 键退役。
 */
import { describe, it, expect } from 'vitest';
import { migrateRetiredAIKeys } from '../../src/settings';

describe('migrateRetiredAIKeys', () => {
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
