// @vitest-environment node
/**
 * 第二大脑索引范围解析测试（ADR-0141 §3）：
 * ALLOW_PATHS = 三个盒子（无条件）∪ 白名单额外目录；白名单里的三盒条目剔除（幂等）。
 * 逗号目录串的**拆分与归一**归 core parseDirList（见 tests/core/knowledge-boxes.test.ts），
 * 本文件只测域侧的范围拼装语义。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resolveAllowPaths } from '../../src/secondbrain/config';

describe('resolveAllowPaths（三盒恒含 + 额外目录）', () => {
  const set = (overrides: Record<string, unknown> = {}) =>
    setSettingsProvider(() => ({ knowledgeDirectory: '文献盒', knowledgeCardboxDirectory: '卡片盒', knowledgeTopicDirectory: '主题盒', ...overrides }) as any);

  beforeEach(() => set());
  afterEach(() => setSettingsProvider(() => ({}) as any));

  it('白名单留空：仍是三个盒子（三盒恒含，永不为空）', () => {
    expect(resolveAllowPaths('')).toEqual(['文献盒', '卡片盒', '主题盒']);
    expect(resolveAllowPaths(undefined)).toEqual(['文献盒', '卡片盒', '主题盒']);
  });

  it('白名单里的三盒条目被剔除，只留真正的额外目录', () => {
    expect(resolveAllowPaths('文献盒,卡片盒,主题盒,归档/网页剪藏')).toEqual(['文献盒', '卡片盒', '主题盒', '归档/网页剪藏']);
    expect(resolveAllowPaths('文献盒,归档/网页剪藏')).toEqual(['文献盒', '卡片盒', '主题盒', '归档/网页剪藏']);
  });

  it('剔除是幂等的：反复解析同一值结果一致（不写回脏值也能自洽）', () => {
    const once = resolveAllowPaths('文献盒,卡片盒,主题盒,归档/网页剪藏');
    expect(resolveAllowPaths(once.join(','))).toEqual(once);
  });

  it('盒子目录改了自动跟随（白名单无需跟着改）', () => {
    set({ knowledgeCardboxDirectory: '卡片盒2', knowledgeTopicDirectory: '' });
    expect(resolveAllowPaths('文献盒')).toEqual(['文献盒', '卡片盒2', '主题盒']);
    // 旧卡片盒条目此时不再是「盒目录」→ 作为额外目录保留（用户显式写过就不悄悄丢）
    expect(resolveAllowPaths('卡片盒')).toEqual(['文献盒', '卡片盒2', '主题盒', '卡片盒']);
  });

  it('额外目录可为库内根级单文件（前缀/全等语义由向量库消费侧完成）', () => {
    expect(resolveAllowPaths('CODE/root.md')).toEqual(['文献盒', '卡片盒', '主题盒', 'CODE/root.md']);
  });
});
